import { supabase as clientSupabase } from './lib/client/db';
import { supabase as serverSupabase } from './lib/server/db';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import getSupabaseWithServiceRoleAccess from '@tests/utils/serviceRoleSupabase';
import { generateMockedDriverActivity } from '@src/mocks/activities';

type DriverActivity = SupabaseRows['argyle_driver_activities'];

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
            key: 'test-org'
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
      .eq('key', 'test-org')
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // make a user
    const user = await createTestUserByEmail('anonymousCannotReadUserConsents@test.test');

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

    await teardownTestUserByUserId(user.id);
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
            key: 'test-org'
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
      .eq('key', 'test-org')
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // 2. make a user who has consents
    const userWhoHasConsents = await createTestUserByEmail(
      'otherUserWhoHasConsentsOnlyAbleToReadRows@test.test'
    );

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
      'otherUserWhoHasNoConsentsOnlyAbleToReadRows@test.test'
    );

    // 4. make an organizer user
    const organizerUser = await createTestUserByEmail(
      'organizerUserForUserConsents@test.test',
      true
    );

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
    const accountIdForUserWhoHasConsents = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const argyleUserForUserWhoHasConsents = 'cccccccc-cccc-0000-0000-cccccccccccc';
    const { error: insertArgyleAccountError } = await serverSupabase
      .from('argyle_accounts')
      .insert({
        argyle_account: accountIdForUserWhoHasConsents,
        user_id: userWhoHasConsents.id,
        argyle_user: argyleUserForUserWhoHasConsents
      });
    if (insertArgyleAccountError) throw insertArgyleAccountError;

    // 6.2 for userWhoHasNoConsents -- add a row to argyle accounts with an account id and user id
    // account id is a uuid with all ds
    const accountIdForUserWhoHasNoConsents = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const argyleUserForUserWhoHasNoConsents = 'dddddddd-dddd-0000-0000-dddddddddddd';
    const { error: insertArgyleAccountForUserWhoHasNoConsentsError } = await serverSupabase
      .from('argyle_accounts')
      .insert({
        argyle_account: accountIdForUserWhoHasNoConsents,
        user_id: userWhoHasNoConsents.id,
        argyle_user: argyleUserForUserWhoHasNoConsents
      });
    if (insertArgyleAccountForUserWhoHasNoConsentsError)
      throw insertArgyleAccountForUserWhoHasNoConsentsError;

    // 7. add data to the argyle_driver_activities table for userWithNoConsents and for userWhoHasConsents
    const userWhoHasConsentsActivities: DriverActivity[] = [
      generateMockedDriverActivity({
        user: userWhoHasConsents.id,
        account: accountIdForUserWhoHasConsents
      }),
      generateMockedDriverActivity({
        user: userWhoHasConsents.id,
        account: accountIdForUserWhoHasConsents
      }),
      generateMockedDriverActivity({
        user: userWhoHasConsents.id,
        account: accountIdForUserWhoHasConsents
      })
    ];

    const userWhoDoesNotHaveConsentsActivities: DriverActivity[] = [
      generateMockedDriverActivity({
        user: userWhoHasNoConsents.id,
        account: accountIdForUserWhoHasNoConsents
      }),
      generateMockedDriverActivity({
        user: userWhoHasNoConsents.id,
        account: accountIdForUserWhoHasNoConsents
      }),
      generateMockedDriverActivity({
        user: userWhoHasNoConsents.id,
        account: accountIdForUserWhoHasNoConsents
      }),
      generateMockedDriverActivity({
        user: userWhoHasNoConsents.id,
        account: accountIdForUserWhoHasNoConsents
      }),
      generateMockedDriverActivity({
        user: userWhoHasNoConsents.id,
        account: accountIdForUserWhoHasNoConsents
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
      email: 'organizerUserForUserConsents@test.test',
      password: 'password'
    });
    if (error) throw error;

    // test

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

    // clean up
    await teardownTestUserByUserId(userWhoHasConsents.id);
    await teardownTestUserByUserId(userWhoHasNoConsents.id);
    await teardownTestUserByUserId(organizerUser.id);
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
            key: 'test-org'
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
      .eq('key', 'test-org')
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // 2. make a user who has consents
    const userWhoHasConsents = await createTestUserByEmail('otheruserwhoconsents@test.test');

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
      'otheruserwhohasnoconsentsonlyabletoreadprofilerows@test.test'
    );

    // 4. make an organizer user
    const organizerUser = await createTestUserByEmail('organizeruserforprofiles@test.test', true);

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
      email: 'organizeruserforprofiles@test.test',
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
    expect(organizerViewableProfiles.sort()).toEqual([
      { email: 'otheruserwhoconsents@test.test' },
      { email: 'organizeruserforprofiles@test.test' }
    ]);

    // clean up
    await teardownTestUserByUserId(userWhoHasConsents.id);
    await teardownTestUserByUserId(userWhoHasNoConsents.id);
    await teardownTestUserByUserId(organizerUser.id);
  });
  it('Cannot update their own organization affiliation', async () => {
    // set up
    // 0. delete all affiliate organizations
    const { error: deleteAllAffOrgsError } = await serverSupabase
      .from('affiliate_organizations')
      .delete()
      .not('id', 'eq', '00000000-0000-0000-0000-000000000000');
    expect(deleteAllAffOrgsError).toBe(null);

    // 1. make an affiliate organization (main-org)
    const { data: mainOrgData, error: mainOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .insert({ name: 'Main Org', key: 'main-org' })
      .select('*')
      .single();
    expect(mainOrgError).toBe(null);
    if (mainOrgData === null) throw new Error('Affiliate organization not found');

    // 2. make another affiliate organization (other-org)
    const { data: otherOrgData, error: otherOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .insert({ name: 'Other Org', key: 'other-org' })
      .select('*')
      .single();
    expect(otherOrgError).toBe(null);
    if (otherOrgData === null) throw new Error('Affiliate organization not found');

    // 3. make an organizer user
    const organizerUser = await createTestUserByEmail(
      'organizerUserForAffiliation@test.test',
      true
    );

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
      email: 'organizerUserForAffiliation@test.test',
      password: 'password'
    });
    expect(signInError).toBe(null);

    // test
    // 7. try to update the organizer user's organization affiliation to other-org; expect an error
    const { error: naughtyUpdateError } = await clientSupabase
      .from('organizer_affiliate_organization_affiliations')
      .update({ affiliate_organization_id: otherOrgData.id })
      .eq('user_id', organizerUser.id);
    // expect no error as this fails silently
    expect(naughtyUpdateError).toBe(null);

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

    // clean up - delete the users
    await teardownTestUserByUserId(organizerUser.id);
    await serverSupabase.from('affiliate_organizations').delete().eq('key', 'main-org');
    await serverSupabase.from('affiliate_organizations').delete().eq('key', 'other-org');
  });
  it("Cannot read users' consents in driver_affiliate_organization_data_sharing_consents when not in the same organization", async () => {
    // set up

    // make an affiliate organization
    const { error: insertAffOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .upsert(
        {
          name: 'Test Org',
          key: 'test-org'
        },
        { onConflict: 'key', ignoreDuplicates: true }
      )
      .select('*');
    expect(insertAffOrgError).toBe(null);

    // get the affiliate org id
    const { data: affOrgData, error: affOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .select('id')
      .eq('key', 'test-org')
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // make a user
    const otherUserWhoHasConsents = await createTestUserByEmail(
      'otherUserWhoHasConsents@test.test'
    );

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
    const organizerUser = await createTestUserByEmail(
      'organizerUserForUserConsents@test.test',
      true
    );

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
      email: 'organizerUserForUserConsents@test.test',
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

    // clean up
    await teardownTestUserByUserId(otherUserWhoHasConsents.id);
    await teardownTestUserByUserId(organizerUser.id);
  });
  it("Can read consenting users' consents in driver_affiliate_organization_data_sharing_consents when they're in the same organization", async () => {
    // set up

    // make an affiliate organization
    const { error: insertAffOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .upsert(
        {
          name: 'Test Org',
          key: 'test-org'
        },
        { onConflict: 'key', ignoreDuplicates: true }
      )
      .select('*');
    expect(insertAffOrgError).toBe(null);

    // get the affiliate org id
    const { data: affOrgData, error: affOrgError } = await serverSupabase
      .from('affiliate_organizations')
      .select('id')
      .eq('key', 'test-org')
      .single();
    expect(affOrgError).toBe(null);
    if (!affOrgData) {
      throw new Error('Affiliate organization not found');
    }

    // make a user
    const userConsentingToShareData = await createTestUserByEmail(
      'otherUserWhoHasConsents@test.test'
    );

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
    const organizerUser = await createTestUserByEmail(
      'organizerUserForUserConsents@test.test',
      true
    );

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
      email: 'organizerUserForUserConsents@test.test',
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

    // clean up
    await teardownTestUserByUserId(userConsentingToShareData.id);
    await teardownTestUserByUserId(organizerUser.id);
  });
});
