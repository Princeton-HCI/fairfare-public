/**
 * This script creates a new organizer user for an organization.
 * It should be used to onboard new organizer users.
 *
 * Usage: see createOrganizerUsersTemplate.ts for an example.
 */
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// dotenv
import { config } from 'dotenv';
config();

const PUB_VITE_SUPABASE_URL = process.env.PUB_VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const createOrganizerUser = async (
  affiliateOrganizationKey: string,
  organizerUserPhoneNumber: string
) => {
  if (!PUB_VITE_SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Environment variables not set.');
  }

  const supabase = createClient(PUB_VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`
      }
    }
  });

  // get the affiliate org id
  const { data: affiliateOrganization, error: getAffiliateOrganizationError } = await supabase
    .from('affiliate_organizations')
    .select('*')
    .eq('key', affiliateOrganizationKey)
    .single();
  if (getAffiliateOrganizationError) throw getAffiliateOrganizationError;

  console.log('got affiliate organization:', affiliateOrganization.name);

  const { data: organizerUser, error: signUpOrganizerUserError } = await supabase.auth.signUp({
    phone: organizerUserPhoneNumber,
    // we assign a random password here because we will never need it
    password: uuidv4()
  });

  if (signUpOrganizerUserError) throw signUpOrganizerUserError;
  if (organizerUser === null) throw new Error('No user data returned from signup');
  if (organizerUser.user === null) throw new Error('No user returned from signup');
  console.log('created user:', organizerUser.user.id);

  // organizer user role
  const { error: userRoleError } = await supabase.from('user_roles').insert([
    {
      user_id: organizerUser.user.id,
      role: 'organizer'
    }
  ]);
  if (userRoleError) throw userRoleError;
  console.log('added organizer role to user');

  const { error: affiliationError } = await supabase
    .from('organizer_affiliate_organization_affiliations')
    .insert([
      {
        user_id: organizerUser.user.id,
        affiliate_organization_id: affiliateOrganization.id
      }
    ]);
  if (affiliationError) throw affiliationError;
  console.log('added organizer affiliation to', affiliateOrganization.name);

  // make a row in the organizer_affiliations_phone_whitelist
  const { error: whitelistError } = await supabase
    .from('organizer_affiliations_phone_whitelist')
    .insert([
      {
        phone_number: organizerUserPhoneNumber,
        affiliate_organization_id: affiliateOrganization.id
      }
    ]);
  if (whitelistError) throw whitelistError;
  console.log('added phone to whitelist');
};

export default createOrganizerUser;
