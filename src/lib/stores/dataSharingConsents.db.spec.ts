import { randomUUID } from 'crypto';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import { supabase as serverSupabase } from '../server/db';
import { supabase as clientSupabase } from '../client/db';
import { get } from 'svelte/store';

import { dataSharingConsents } from './dataSharingConsents';

const CONSENTS_USER_EMAIL = uniqueTestEmail('datasharingconsentsupdatedatabase');

/**
 * Two organizations of this file's own, for the same reason as
 * affiliations.spec.ts: the fixed `du`/`gls`/`cdu`/`pelq` rows this used to
 * delete and re-insert are shared with the rest of the suite.
 */
const ORG_A = {
  key: `consents-a-${randomUUID().slice(0, 8)}`,
  name: `Consents Store Test Org A ${randomUUID().slice(0, 8)}`,
  url: 'https://consents-store-test-a.test'
};
const ORG_B = {
  key: `consents-b-${randomUUID().slice(0, 8)}`,
  name: `Consents Store Test Org B ${randomUUID().slice(0, 8)}`,
  url: 'https://consents-store-test-b.test'
};

describe('dataSharingConsents store', () => {
  beforeAll(async () => {
    const { error } = await serverSupabase.from('affiliate_organizations').insert([ORG_A, ORG_B]);
    if (error) throw error;

    dataSharingConsents.reset();
    dataSharingConsents.setAffiliateOrganizations([ORG_A, ORG_B]);
  });

  afterAll(async () => {
    const { error } = await serverSupabase
      .from('affiliate_organizations')
      .delete()
      .in('key', [ORG_A.key, ORG_B.key]);
    if (error) throw error;
  });

  it('should update consent key when setAffiliationConsent is called', () => {
    dataSharingConsents.toggleSelection(ORG_A.key);
    expect(get(dataSharingConsents).selected).toEqual([ORG_A]);

    dataSharingConsents.toggleSelection(ORG_A.key);
    expect(get(dataSharingConsents).selected).toEqual([]);
  });

  it('should update the consents table and return updated rows when updateDatabase is called', async () => {
    const user = await createTestUserByEmail(CONSENTS_USER_EMAIL, true);

    // log user in
    const { error } = await clientSupabase.auth.signInWithPassword({
      email: CONSENTS_USER_EMAIL,
      password: 'password'
    });
    if (error) throw error;

    dataSharingConsents.toggleSelection(ORG_A.key);
    dataSharingConsents.toggleSelection(ORG_B.key);

    await dataSharingConsents.updateDatabase();

    dataSharingConsents.reset(); // reset the store to clear the selected consents

    // get again from the db to check if the selected consents are saved
    await dataSharingConsents.getSelectedDataSharingConsentsFromDatabase();

    // Compared as a set: the query behind the store has no ORDER BY, so row
    // order is not something this test should depend on.
    const selected = get(dataSharingConsents).selected;
    expect(
      selected
        .map((org) => ({ key: org.key, name: org.name, url: org.url }))
        .sort((a, b) => a.key.localeCompare(b.key))
    ).toEqual(
      [ORG_A, ORG_B]
        .map((org) => ({ key: org.key, name: org.name, url: org.url }))
        .sort((a, b) => a.key.localeCompare(b.key))
    );

    // delete the driver_affiliate_organization_data_sharing_consents rows
    const { error: deleteError } = await serverSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .delete()
      .eq('user_id', user.id);
    if (deleteError) throw deleteError;

    // clean up
    await teardownTestUserByUserId(user.id);
  });
});
