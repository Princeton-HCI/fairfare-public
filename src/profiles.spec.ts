import { supabase as clientSupabase } from './lib/client/db';
import { supabase as serverSupabase } from './lib/server/db';
import {
  createTestUserByEmail,
  createTestUserByPhone,
  teardownTestUserByUserId
} from '@tests/utils/testUser';
import getSupabaseWithServiceRoleAccess from '@tests/utils/serviceRoleSupabase';

import { updateProfileByUserId } from './lib/databaseHelpers';

describe('Profiles table', () => {
  it('Creating a new user adds a new row in the profiles table', async () => {
    // delete all profiles where user_id is not null
    const { error: deleteAllProfilesError } = await serverSupabase
      .from('profiles')
      .delete()
      .not('user_id', 'is', null);
    if (deleteAllProfilesError) throw deleteAllProfilesError;

    const userSignupData = await createTestUserByEmail('usercreationupdatesprofiles@test.test');

    // test expect a new row in the profiles table
    const { data: profileData, error: selectError } = await serverSupabase
      .from('profiles')
      .select('*')
      .eq('user_id', userSignupData.id);
    if (selectError) throw selectError;
    expect(profileData).not.toBeNull();
    expect(profileData.length).toEqual(1);

    // check the data
    expect(profileData[0].user_id).toEqual(userSignupData.id);
    expect(profileData[0].email).toEqual(userSignupData.email);

    // clean up
    await teardownTestUserByUserId(userSignupData.id);
  });
  it('Updating a user updates the row in the profiles table', async () => {
    const user = await createTestUserByEmail('updateuseraffectsprofiles@test.test');

    await updateProfileByUserId(serverSupabase, user.id, {
      first_name: 'NEW FIRST NAME'
    });

    // test
    const { data: profileData, error: selectError } = await serverSupabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id);
    if (selectError) throw selectError;
    expect(profileData).not.toBeNull();
    expect(profileData.length).toEqual(1);
    expect(profileData[0].first_name).toEqual('NEW FIRST NAME');

    // clean up
    await teardownTestUserByUserId(user.id);
  });
  it('Deleting a user removes the row in the profiles table', async () => {
    // 1. make a user
    const user = await createTestUserByEmail('deletinguserremovesprofilesrow@test.test');

    // 2. confirm the profile row exists
    const { data: profileData, error: selectError } = await serverSupabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id);
    if (selectError) throw selectError;
    expect(profileData).not.toBeNull();
    expect(profileData.length).toEqual(1);

    // 3. delete the user
    await getSupabaseWithServiceRoleAccess().auth.admin.deleteUser(user.id);

    // 4. confirm the profile row does not exist
    const { data: profileDataAfterDelete, error: selectErrorAfterDelete } = await serverSupabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id);
    if (selectErrorAfterDelete) throw selectErrorAfterDelete;
    expect(profileDataAfterDelete).toEqual([]);

    // no clean up - user is already deleted
  });
  describe('Organizer user', () => {
    it('cannot update or delete profile rows', async () => {
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
      if (affOrgError) throw affOrgError;
      if (!affOrgData) {
        throw new Error('Affiliate organization not found');
      }

      // 2. make a user who has consents
      const userWhoHasConsents = await createTestUserByEmail(
        'addluserwithconsents@test.test',
        true
      );

      // insert a consent record
      const { error: insertError } = await serverSupabase
        .from('driver_affiliate_organization_data_sharing_consents')
        .insert({
          affiliate_organization_id: affOrgData.id,
          user_id: userWhoHasConsents.id
        });
      if (insertError) throw insertError;

      // log out otherUserWhoHasConsents
      await serverSupabase.auth.signOut();

      // 4. make an organizer user
      const organizerUser = await createTestUserByPhone('12225550000', true);

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

      const { error } = await clientSupabase.auth.signInWithPassword({
        phone: '12225550000',
        password: 'password'
      });
      if (error) throw error;

      // set the first name
      await updateProfileByUserId(serverSupabase, userWhoHasConsents.id, {
        first_name: 'OLD FIRST NAME'
      });

      // test
      // a. confirm we can see the profile
      const { data: profileData, error: selectError } = await clientSupabase
        .from('profiles')
        .select('*')
        .eq('user_id', userWhoHasConsents.id);
      if (selectError) throw selectError;
      expect(profileData.length).toEqual(1);

      // b. try to update the profile; expect to not take effect
      // note that the update will not throw an error, but the update will not take effect
      // FIXME: make this fail loudly
      const { error: updateError } = await clientSupabase
        .from('profiles')
        .update({ first_name: 'NEW FIRST NAME' })
        .eq('user_id', userWhoHasConsents.id)
        .select();
      expect(updateError).toBe(null);

      // select
      const { data: profileDataAfterUpdate, error: selectErrorAfterUpdate } = await clientSupabase
        .from('profiles')
        .select('*')
        .eq('user_id', userWhoHasConsents.id);
      if (selectErrorAfterUpdate) throw selectErrorAfterUpdate;
      expect(profileDataAfterUpdate.length).toEqual(1);
      expect(profileDataAfterUpdate[0].first_name).toEqual('OLD FIRST NAME');

      // c. try to delete the profile; expect an error
      // note that the delete will not throw an error, but the delete will not take effect
      // FIXME: make this fail loudly
      const { error: deleteError } = await clientSupabase
        .from('profiles')
        .delete()
        .eq('user_id', userWhoHasConsents.id);
      expect(deleteError).toBe(null);

      // select; expect the profile to still be there
      const { data: profileDataAfterDelete, error: selectErrorAfterDelete } = await clientSupabase
        .from('profiles')
        .select('*')
        .eq('user_id', userWhoHasConsents.id);
      if (selectErrorAfterDelete) throw selectErrorAfterDelete;
      expect(profileDataAfterDelete.length).toEqual(1);

      // clean up
      await teardownTestUserByUserId(userWhoHasConsents.id);
      await teardownTestUserByUserId(organizerUser.id);
    });
  });
});
