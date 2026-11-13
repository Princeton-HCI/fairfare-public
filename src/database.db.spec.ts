import { randomUUID } from 'crypto';
import { supabase as clientSupabase } from './lib/client/db';
import { supabase as serverSupabase } from './lib/server/db';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import getSupabaseWithServiceRoleAccess from '@tests/utils/serviceRoleSupabase';
import { generateMockedDriverActivityRow } from '@tests/mocks/activities';
/**
 * Argyle identifiers unique to this run, so this file can run at the same time
 * as the other specs that used to share these literals (they collide on
 * argyle_user_unique and argyle_account when two files insert at once).
 */
const TEST_ARGYLE_ACCOUNT = randomUUID();

const ORGANIZERUSERFORUSERCONSENTS_EMAIL = uniqueTestEmail('organizeruserforuserconsents');
const OTHERUSERWHOCONSENTS_EMAIL = uniqueTestEmail('otheruserwhoconsents');
const ORGANIZERUSERFORPROFILES_EMAIL = uniqueTestEmail('organizeruserforprofiles');
const ORGANIZERUSERFORAFFILIATION_EMAIL = uniqueTestEmail('organizeruserforaffiliation');
const OTHERUSERWHOHASCONSENTS_EMAIL = uniqueTestEmail('otheruserwhohasconsents');

/**
 * Organization keys are unique per run, and removed in afterAll. A fixed key
 * meant a leftover row from an earlier run collided with this one, which is why
 * the affiliation test below used to start by deleting every organization —
 * including the ones the rest of the suite and the Playwright seeds rely on.
 */
const TEST_ORG_KEY = `db-spec-test-org-${randomUUID().slice(0, 8)}`;
const MAIN_ORG_KEY = `db-spec-main-org-${randomUUID().slice(0, 8)}`;
const OTHER_ORG_KEY = `db-spec-other-org-${randomUUID().slice(0, 8)}`;

afterAll(async () => {
  const { error } = await serverSupabase
    .from('affiliate_organizations')
    .delete()
    .in('key', [TEST_ORG_KEY, MAIN_ORG_KEY, OTHER_ORG_KEY]);
  if (error) throw error;
});

type ArgyleDriverActivity = SupabaseRows['argyle_driver_activities'];

describe('anonymous user', () => {
  it('cannot read the driver_affiliate_organization_data_sharing_consents table', async () => {
    // set up

    // make an affiliate organization
    const { error: insertAffOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .upsert(
        [
          {
            name: 'Test Org',
            key: TEST_ORG_KEY
          }
        ],
        { onConflict: 'key', ignoreDuplicates: true }
      )
      .select('*');
    expect(insertAffOrgError).toBe(null);

    // get the affiliate org id
    const { data: affOrgData, error: affOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .select('id')
      .eq('key', TEST_ORG_KEY)
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // make a user
    const user = await createTestUserByEmail(uniqueTestEmail('anonymouscannotreaduserconsents'));
    onTestFinished(() => teardownTestUserByUserId(user.id));

    // insert a record with server db
    const { error: insertError } = await serverSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .insert([
        {
          affiliate_organization_id: affOrgData.id,
          user_id: user.id
        }
      ]);
    if (insertError) throw insertError;

    // log out
    await serverSupabase.auth.signOut();
    await clientSupabase.auth.signOut();

    // test

    const { data, error } = await clientSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .select('*');
    if (error) throw error;
    // expect user to not be able to read the data in the table
    expect(data).toEqual([]);
  });
});

describe('organizer user', () => {
  it("is only able to read argyle_driver_activities rows for users who have consented to share data with the organizer's organization", async () => {
    // set up
    // 1. make an affiliate organization
    const { error: insertAffOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .upsert(
        [
          {
            name: 'Test Org',
            key: TEST_ORG_KEY
          }
        ],
        { onConflict: 'key', ignoreDuplicates: true }
      )
      .select('*');
    expect(insertAffOrgError).toBe(null);

    // get the affiliate org id
    const { data: affOrgData, error: affOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .select('id')
      .eq('key', TEST_ORG_KEY)
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // 2. make a user who has consents
    const userWhoHasConsents = await createTestUserByEmail(
      uniqueTestEmail('otheruserwhohasconsentsonlyabletoreadrows')
    );
    onTestFinished(() => teardownTestUserByUserId(userWhoHasConsents.id));

    // insert a record with server db
    const { error: insertError } = await serverSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .insert({
        affiliate_organization_id: affOrgData.id,
        user_id: userWhoHasConsents.id
      });
    if (insertError) throw insertError;

    // log out otherUserWhoHasConsents
    await serverSupabase.auth.signOut();

    // 3. make a user who does not have consents
    const userWhoHasNoConsents = await createTestUserByEmail(
      uniqueTestEmail('otheruserwhohasnoconsentsonlyabletoreadrows')
    );
    onTestFinished(() => teardownTestUserByUserId(userWhoHasNoConsents.id));

    // 4. make an organizer user
    const organizerUser = await createTestUserByEmail(ORGANIZERUSERFORUSERCONSENTS_EMAIL, true);
    onTestFinished(() => teardownTestUserByUserId(organizerUser.id));

    // log out organizerUser
    await serverSupabase.auth.signOut();

    // 5. insert a row into user_roles table to give the organizer user the organizer role
    const { error: insertUserRoleError } = await getSupabaseWithServiceRoleAccess()
      .from('user_roles')
      .insert({
        user_id: organizerUser.id,
        role: 'organizer'
      });
    if (insertUserRoleError) throw insertUserRoleError;

    // 6. make a row in organizer_affiliate_organization_affiliations table to give the organizer user access to the affiliate organization
    const { error: insertOrganizerAffiliationsError } = await getSupabaseWithServiceRoleAccess()
      .from('organizer_affiliate_organization_affiliations')
      .insert({
        user_id: organizerUser.id,
        affiliate_organization_id: affOrgData.id
      });
    if (insertOrganizerAffiliationsError) throw insertOrganizerAffiliationsError;

    // 6.1 for userWhoHasConsents -- add a row to argyle accounts with an account id and user id
    // account id is a uuid with all cs
    const accountIdForUserWhoHasConsents = TEST_ARGYLE_ACCOUNT;
    const argyleUserForUserWhoHasConsents = 'cccccccc-cccc-0000-0000-cccccccccccc';
    const { data: argyleAccountData, error: insertArgyleAccountError } = await serverSupabase
      .from('argyle_accounts')
      .insert({
        argyle_account: accountIdForUserWhoHasConsents,
        user_id: userWhoHasConsents.id,
        argyle_user: argyleUserForUserWhoHasConsents
      })
      .select()
      .single();
    if (insertArgyleAccountError) throw insertArgyleAccountError;

    // 6.2 for userWhoHasNoConsents -- add a row to argyle accounts with an account id and user id
    // account id is a uuid with all ds
    const accountIdForUserWhoHasNoConsents = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const argyleUserForUserWhoHasNoConsents = 'dddddddd-dddd-0000-0000-dddddddddddd';
    const {
      data: argyleAccountDataForUserWhoHasNoConsents,
      error: insertArgyleAccountForUserWhoHasNoConsentsError
    } = await serverSupabase
      .from('argyle_accounts')
      .insert({
        argyle_account: accountIdForUserWhoHasNoConsents,
        user_id: userWhoHasNoConsents.id,
        argyle_user: argyleUserForUserWhoHasNoConsents
      })
      .select()
      .single();
    if (insertArgyleAccountForUserWhoHasNoConsentsError)
      throw insertArgyleAccountForUserWhoHasNoConsentsError;

    // 7. add data to the argyle_driver_activities table for userWithNoConsents and for userWhoHasConsents
    const userWhoHasConsentsActivities: ArgyleDriverActivity[] = [
      generateMockedDriverActivityRow({
        user: userWhoHasConsents.id,
        account_id: argyleAccountData.id
      }),
      generateMockedDriverActivityRow({
        user: userWhoHasConsents.id,
        account_id: argyleAccountData.id
      }),
      generateMockedDriverActivityRow({
        user: userWhoHasConsents.id,
        account_id: argyleAccountData.id
      })
    ];

    const userWhoDoesNotHaveConsentsActivities: ArgyleDriverActivity[] = [
      generateMockedDriverActivityRow({
        user: userWhoHasNoConsents.id,
        account_id: argyleAccountDataForUserWhoHasNoConsents.id
      }),
      generateMockedDriverActivityRow({
        user: userWhoHasNoConsents.id,
        account_id: argyleAccountDataForUserWhoHasNoConsents.id
      }),
      generateMockedDriverActivityRow({
        user: userWhoHasNoConsents.id,
        account_id: argyleAccountDataForUserWhoHasNoConsents.id
      }),
      generateMockedDriverActivityRow({
        user: userWhoHasNoConsents.id,
        account_id: argyleAccountDataForUserWhoHasNoConsents.id
      }),
      generateMockedDriverActivityRow({
        user: userWhoHasNoConsents.id,
        account_id: argyleAccountDataForUserWhoHasNoConsents.id
      })
    ];

    const { error: insertUserWhoHasConsentsActivitiesError } = await serverSupabase
      .from('argyle_driver_activities')
      .insert(userWhoHasConsentsActivities);

    if (insertUserWhoHasConsentsActivitiesError) throw insertUserWhoHasConsentsActivitiesError;

    const { error: insertUserWhoDoesNotHaveConsentsActivitiesError } = await serverSupabase
      .from('argyle_driver_activities')
      .insert(userWhoDoesNotHaveConsentsActivities);

    if (insertUserWhoDoesNotHaveConsentsActivitiesError)
      throw insertUserWhoDoesNotHaveConsentsActivitiesError;

    // 8. log in as the organizer user
    const { error } = await clientSupabase.auth.signInWithPassword({
      email: ORGANIZERUSERFORUSERCONSENTS_EMAIL,
      password: 'password'
    });
    if (error) throw error;

    // 9. expect the organizer user to be able to read the user data for the user who has consented but not the user who has not consented
    // select all the rows from the argyle_driver_activities table with clientSupabase
    const { data: organizerViewableActivities, error: userWhoHasConsentsActivitiesError } =
      await clientSupabase
        .from('argyle_driver_activities')
        .select('*')
        .eq('user', userWhoHasConsents.id);
    if (userWhoHasConsentsActivitiesError) throw userWhoHasConsentsActivitiesError;

    expect(organizerViewableActivities.length).toEqual(userWhoHasConsentsActivities.length);

    // expect all the ids to be equal to the ids of the userWhoHasConsentsActivities
    organizerViewableActivities.forEach((activity, _) => {
      expect(activity.user).toEqual(userWhoHasConsents.id);
    });
  });
  it("is only able to read profile rows for users who have consented to share data with the organizer's organization", async () => {
    // set up
    // 1. make an affiliate organization
    const { error: insertAffOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .upsert(
        [
          {
            name: 'Test Org',
            key: TEST_ORG_KEY
          }
        ],
        { onConflict: 'key', ignoreDuplicates: true }
      )
      .select('*');
    expect(insertAffOrgError).toBe(null);

    // get the affiliate org id
    const { data: affOrgData, error: affOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .select('id')
      .eq('key', TEST_ORG_KEY)
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // 2. make a user who has consents
    const userWhoHasConsents = await createTestUserByEmail(OTHERUSERWHOCONSENTS_EMAIL);
    onTestFinished(() => teardownTestUserByUserId(userWhoHasConsents.id));

    // insert a record with server db
    const { error: insertError } = await serverSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .insert({
        affiliate_organization_id: affOrgData.id,
        user_id: userWhoHasConsents.id
      });
    if (insertError) throw insertError;

    // log out otherUserWhoHasConsents
    await serverSupabase.auth.signOut();

    // 3. make a user who does not have consents
    const userWhoHasNoConsents = await createTestUserByEmail(
      uniqueTestEmail('otheruserwhohasnoconsentsonlyabletoreadprofilerows')
    );
    onTestFinished(() => teardownTestUserByUserId(userWhoHasNoConsents.id));

    // 4. make an organizer user
    const organizerUser = await createTestUserByEmail(ORGANIZERUSERFORPROFILES_EMAIL, true);
    onTestFinished(() => teardownTestUserByUserId(organizerUser.id));

    // log out organizerUser
    await serverSupabase.auth.signOut();

    // 5. insert a row into user_roles table to give the organizer user the organizer role
    const { error: insertUserRoleError } = await getSupabaseWithServiceRoleAccess()
      .from('user_roles')
      .insert({
        user_id: organizerUser.id,
        role: 'organizer'
      });
    if (insertUserRoleError) throw insertUserRoleError;

    // 6. make a row in organizer_affiliate_organization_affiliations table to give the organizer user access to the affiliate organization
    const { error: insertOrganizerAffiliationsError } = await getSupabaseWithServiceRoleAccess()
      .from('organizer_affiliate_organization_affiliations')
      .insert({
        user_id: organizerUser.id,
        affiliate_organization_id: affOrgData.id
      });
    if (insertOrganizerAffiliationsError) throw insertOrganizerAffiliationsError;

    // 7. log in as the organizer user
    const { error } = await clientSupabase.auth.signInWithPassword({
      email: ORGANIZERUSERFORPROFILES_EMAIL,
      password: 'password'
    });
    if (error) throw error;

    // test

    // 8. expect the organizer user to be able to read the user data for the user who has consented but not the user who has not consented
    // select all the rows from the argyle_driver_activities table with clientSupabase
    const { data: organizerViewableProfiles, error: userWhoHasConsentsProfilesError } =
      await clientSupabase.from('profiles').select('email');
    if (userWhoHasConsentsProfilesError) throw userWhoHasConsentsProfilesError;

    // expect to see the user who has consents but not the user who does not have consents
    // (and also the organizer user themself)
    //
    // Compared as a sorted list of emails. `.sort()` on an array of objects
    // compares them as "[object Object]", so it left row order to the database
    // and the assertion passed or failed on which order came back.
    expect(organizerViewableProfiles.map((profile) => profile.email).sort()).toEqual(
      [OTHERUSERWHOCONSENTS_EMAIL, ORGANIZERUSERFORPROFILES_EMAIL].sort()
    );
  });
  it('Cannot update their own organization affiliation', async () => {
    // set up
    // 1. make an affiliate organization (main-org)
    const { data: mainOrgData, error: mainOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .insert({ name: 'Main Org', key: MAIN_ORG_KEY })
      .select('*')
      .single();
    expect(mainOrgError).toBe(null);
    if (mainOrgData === null) throw new Error('Affiliate organization not found');

    // 2. make another affiliate organization (other-org)
    const { data: otherOrgData, error: otherOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .insert({ name: 'Other Org', key: OTHER_ORG_KEY })
      .select('*')
      .single();
    expect(otherOrgError).toBe(null);
    if (otherOrgData === null) throw new Error('Affiliate organization not found');

    // 3. make an organizer user
    const organizerUser = await createTestUserByEmail(ORGANIZERUSERFORAFFILIATION_EMAIL, true);
    onTestFinished(() => teardownTestUserByUserId(organizerUser.id));

    // 4. insert a row into user_roles table to give the organizer user the organizer role
    const { error: insertUserRoleError } = await getSupabaseWithServiceRoleAccess()
      .from('user_roles')
      .insert({
        user_id: organizerUser.id,
        role: 'organizer'
      });
    expect(insertUserRoleError).toBe(null);

    // 5. make a row in organizer_affiliate_organization_affiliations table to give the organizer user access to the main organization
    const { error: insertOrganizerAffiliationsError } = await getSupabaseWithServiceRoleAccess()
      .from('organizer_affiliate_organization_affiliations')
      .insert({
        user_id: organizerUser.id,
        affiliate_organization_id: mainOrgData.id
      });
    expect(insertOrganizerAffiliationsError).toBe(null);

    // 6. log in as the organizer user
    const { error: signInError } = await clientSupabase.auth.signInWithPassword({
      email: ORGANIZERUSERFORAFFILIATION_EMAIL,
      password: 'password'
    });
    expect(signInError).toBe(null);

    // test
    // 7. try to update the organizer user's organization affiliation to other-org
    const { error: naughtyUpdateError } = await clientSupabase
      .from('organizer_affiliate_organization_affiliations')
      .update({ affiliate_organization_id: otherOrgData.id })
      .eq('user_id', organizerUser.id);
    // The affiliations view is not updatable; role changes go through RPCs.
    expect(naughtyUpdateError).not.toBe(null);
    expect(naughtyUpdateError?.code).toBe('42501');

    // 8. verify the affiliate_organization_id is still main-org
    const { data: updatedAffiliationData, error: selectError } = await serverSupabase
      .from('organizer_affiliate_organization_affiliations')
      .select('*')
      .eq('user_id', organizerUser.id);
    expect(selectError).toBe(null);

    expect(updatedAffiliationData).not.toBeNull();
    if (updatedAffiliationData === null) throw new Error('Affiliation not found');
    expect(updatedAffiliationData.length).toBe(1);

    // the id should *not* have changed
    expect(updatedAffiliationData[0].affiliate_organization_id).toBe(mainOrgData.id);
  });
  it("Cannot read users' consents in driver_affiliate_organization_data_sharing_consents when not in the same organization", async () => {
    // set up

    // make an affiliate organization
    const { error: insertAffOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .upsert(
        {
          name: 'Test Org',
          key: TEST_ORG_KEY
        },
        { onConflict: 'key', ignoreDuplicates: true }
      )
      .select('*');
    expect(insertAffOrgError).toBe(null);

    // get the affiliate org id
    const { data: affOrgData, error: affOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .select('id')
      .eq('key', TEST_ORG_KEY)
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // make a user
    const otherUserWhoHasConsents = await createTestUserByEmail(OTHERUSERWHOHASCONSENTS_EMAIL);
    onTestFinished(() => teardownTestUserByUserId(otherUserWhoHasConsents.id));

    // insert a record with server db
    const { error: insertError } = await serverSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .insert({
        affiliate_organization_id: affOrgData.id,
        user_id: otherUserWhoHasConsents.id
      });
    if (insertError) throw insertError;

    // log out otherUserWhoHasConsents
    await serverSupabase.auth.signOut();

    // make an organizer user
    const organizerUser = await createTestUserByEmail(ORGANIZERUSERFORUSERCONSENTS_EMAIL, true);
    onTestFinished(() => teardownTestUserByUserId(organizerUser.id));

    // log out organizerUser
    await serverSupabase.auth.signOut();

    // insert a row into user_roles table
    const { error: insertUserRoleError } = await getSupabaseWithServiceRoleAccess()
      .from('user_roles')
      .insert({
        user_id: organizerUser.id,
        role: 'organizer'
      });
    if (insertUserRoleError) throw insertUserRoleError;

    const { error } = await clientSupabase.auth.signInWithPassword({
      email: ORGANIZERUSERFORUSERCONSENTS_EMAIL,
      password: 'password'
    });
    if (error) throw error;

    // expect user to not be able to read the data in the table
    // this is because although the organizer user has the organizer role,
    // they are not affiliated with the affiliate organization that the
    // other user has consented to share data with
    const { data, error: selectError } = await clientSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .select('*');
    if (selectError) throw selectError;
    expect(data).toEqual([]);
  });
  it("Can read consenting users' consents in driver_affiliate_organization_data_sharing_consents when they're in the same organization", async () => {
    // set up

    // make an affiliate organization
    const { error: insertAffOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .upsert(
        {
          name: 'Test Org',
          key: TEST_ORG_KEY
        },
        { onConflict: 'key', ignoreDuplicates: true }
      )
      .select('*');
    expect(insertAffOrgError).toBe(null);

    // get the affiliate org id
    const { data: affOrgData, error: affOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .select('id')
      .eq('key', TEST_ORG_KEY)
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // make a user
    const userConsentingToShareData = await createTestUserByEmail(OTHERUSERWHOHASCONSENTS_EMAIL);
    onTestFinished(() => teardownTestUserByUserId(userConsentingToShareData.id));

    // insert a record with server db
    const { error: insertError } = await serverSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .insert({
        affiliate_organization_id: affOrgData.id,
        user_id: userConsentingToShareData.id
      });
    if (insertError) throw insertError;

    // log out otherUserWhoHasConsents
    await serverSupabase.auth.signOut();

    // make an organizer user
    const organizerUser = await createTestUserByEmail(ORGANIZERUSERFORUSERCONSENTS_EMAIL, true);
    onTestFinished(() => teardownTestUserByUserId(organizerUser.id));

    // log out organizerUser
    await serverSupabase.auth.signOut();

    // insert a row into user_roles table
    const { error: insertUserRoleError } = await getSupabaseWithServiceRoleAccess()
      .from('user_roles')
      .insert({
        user_id: organizerUser.id,
        role: 'organizer'
      });
    if (insertUserRoleError) throw insertUserRoleError;

    // insert a row into organizer_affiliate_organization_affiliations table
    const { error: insertOrganizerAffiliationsError } = await getSupabaseWithServiceRoleAccess()
      .from('organizer_affiliate_organization_affiliations')
      .insert({
        user_id: organizerUser.id,
        affiliate_organization_id: affOrgData.id
      });
    if (insertOrganizerAffiliationsError) throw insertOrganizerAffiliationsError;

    const { error } = await clientSupabase.auth.signInWithPassword({
      email: ORGANIZERUSERFORUSERCONSENTS_EMAIL,
      password: 'password'
    });
    if (error) throw error;

    // expect user to not be able to read the data in the table
    const { data, error: selectError } = await clientSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .select('*');
    if (selectError) throw selectError;
    expect(data.length).toEqual(1);
    expect(data[0].affiliate_organization_id).toEqual(affOrgData.id);
    expect(data[0].user_id).toEqual(userConsentingToShareData.id);
  });
});
