import { error } from '@sveltejs/kit';
import { argyleFetch, buildArgyleUrl, getUserToken } from '@src/lib/server/argyle';
import { supabase } from '@src/lib/server/db';
import { studyShortcodeMap } from '../studyDetails.js';
import createTemporaryUser from '@src/lib/server/createTemporaryUser';
import { getProfileFromUserId } from '@src/lib/databaseHelpers.js';

interface ArgyleUserResponse {
  user_token: string;
  id: string;
  message: string;
}

type AffiliateOrganization = SupabaseRows['affiliate_organizations'];

/**
 * Converts the platforms passed to this URL into Argyle Link IDs that we need
 * to pass to Argyle.
 *
 * @param argyleItemsAsCommaDelimitedString e.g., "uber,lyft"
 * @returns e.g., ['item_000024123', 'item_000024124']
 */
const getArgyleLinkIds = async (argyleItemsAsCommaDelimitedString: string): Promise<string[]> => {
  // break up the argyleItemsAsCommaDelimitedString
  const platforms = argyleItemsAsCommaDelimitedString.split(',');

  const { data, error } = await supabase.from('argyle_items').select('id').in('name', platforms);

  if (error) {
    console.error(error);
    throw new Error('Error fetching argyle link ids', error);
  }

  const argyleLinkIds = data.map((item) => item.id);

  if (argyleLinkIds.length !== platforms.length) {
    throw new Error('Could not find all argyle link ids');
  }

  return argyleLinkIds;
};

/**
 * Gets a new Argyle user token and user ID from Argyle.
 *
 * @returns {argyleUserToken, argyleUserId} The Argyle user token and user ID
 */
const getArgyleTokenAndId = async (): Promise<{
  argyleUserToken: string;
  argyleUserId: string;
}> => {
  const url = buildArgyleUrl('/users');
  const response = await argyleFetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error('Could not create Argyle user');
  }

  const { user_token: argyleUserToken, id: argyleUserId } = data as ArgyleUserResponse;
  return { argyleUserToken, argyleUserId };
};

const insertStudyParticipation = async (
  userId: string,
  studyShortcode: string,
  surveyResponseId: string,
  postSync: string | null
) => {
  // Generate insert, conditional on the presence of a post_sync value
  const upsertValues: {
    user_id: string;
    study_shortcode: string;
    survey_response_id: string;
    post_sync?: string;
  } = {
    user_id: userId,
    study_shortcode: studyShortcode,
    survey_response_id: surveyResponseId
  };
  if (postSync) {
    upsertValues['post_sync'] = postSync;
  }

  const { error: upsertError } = await supabase.from('study_participations').upsert(upsertValues, {
    onConflict: 'user_id, study_shortcode'
  });

  if (
    upsertError?.message.startsWith('invalid input value for enum study_participations_post_sync')
  ) {
    console.error('Invalid post_sync value:', postSync);
    throw error(400, 'Invalid post_sync value');
  }

  if (upsertError) {
    console.error('Error inserting study participation:', upsertError);
    throw upsertError;
  }
};

const insertAffiliateOrganizationAffiliation = async (userId: string, studyShortcode: string) => {
  // NOTE: here we assume that the study shortcode is the same as the
  // affiliate organization key.
  // This may not be the case for all future studies, in which case this
  // logic will need to be updated.

  // Get the affiliate organization ID for this organization
  const { data: affiliateOrganization, error: affiliateOrganizationError } = await supabase
    .from('affiliate_organizations')
    .select('*')
    .eq('key', studyShortcode)
    .single();

  if (affiliateOrganizationError) {
    console.error('Error getting affiliate organization:', affiliateOrganizationError);
    throw affiliateOrganizationError;
  }

  // Mark the user as affiliated with this organization
  const { error: affiliationsSupabaseError } = await supabase
    .from('driver_affiliate_organization_affiliations')
    .upsert({
      user_id: userId,
      affiliate_organization_id: affiliateOrganization.id
    });

  if (affiliationsSupabaseError) {
    console.error('Error inserting affiliations:', affiliationsSupabaseError);
    throw affiliationsSupabaseError;
  }

  return affiliateOrganization as AffiliateOrganization;
};

export async function load({ params, url: { searchParams }, locals: { safeGetSession } }) {
  const studyShortcode = params.studyShortcode;
  const platforms = searchParams.get('platforms');
  const surveyResponseId = searchParams.get('survey_response_id');
  const postSync = searchParams.get('post_sync');

  if (!surveyResponseId) {
    error(
      400,
      'A survey_response_id is required in the request URL. You must complete the survey before continuing in this study.'
    );
  }

  // If we have platforms, we need to get the Argyle Link IDs
  const argyleLinkIds = platforms ? await getArgyleLinkIds(platforms) : [];

  // Here we handle if the user is already logged in
  let user;
  let session;
  let argyleUserId;
  let argyleUserToken;

  const { user: alreadyLoggedInUser, session: alreadyLoggedInSession } = await safeGetSession();

  if (alreadyLoggedInUser && alreadyLoggedInSession) {
    // The user is already logged in, now we just need to update the user's
    // Argyle token.
    user = alreadyLoggedInUser;
    session = alreadyLoggedInSession;

    const profile = await getProfileFromUserId(supabase, user.id);
    if (!profile.argyle_user) throw Error('User does not have an Argyle user ID');
    argyleUserId = profile.argyle_user;

    const token = await getUserToken(argyleUserId);
    argyleUserToken = token;
  } else {
    // Get Argyle token and user ID
    const { argyleUserToken: temporaryArgyleUserToken, argyleUserId: temporaryArgyleUserId } =
      await getArgyleTokenAndId();

    // Create a temporary user in our database with that userId
    const {
      data: { session: newTemporaryUserSession, user: newTemporaryUser },
      error: createTemporaryUserError
    } = await createTemporaryUser(temporaryArgyleUserId);
    if (createTemporaryUserError) {
      console.error('Creating a temporary user failed', createTemporaryUserError);
      throw new Error(createTemporaryUserError.message);
    }
    if (!newTemporaryUser || !newTemporaryUserSession) {
      throw new Error('Could not create temporary user: missing user or session');
    }

    user = newTemporaryUser;
    session = newTemporaryUserSession;
    argyleUserId = temporaryArgyleUserId;
    argyleUserToken = temporaryArgyleUserToken;
  }

  if (!user) {
    throw new Error('Could not create temporary user or get existing user');
  }

  // Run these awaits in parallel
  const [_, affiliateOrganization] = await Promise.all([
    // Insert study participation record
    insertStudyParticipation(user.id, studyShortcode, surveyResponseId, postSync),
    // Insert affiliate organization record (this returns the affiliate organization)
    insertAffiliateOrganizationAffiliation(user.id, studyShortcode)
  ]);

  return {
    session,
    argyleUserId,
    argyleUserToken,
    affiliateOrganization,
    studyDetails: studyShortcodeMap[studyShortcode],
    surveyResponseId,
    argyleLinkIds
  };
}
