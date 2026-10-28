import { randomUUID } from 'crypto';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import { supabase as clientSupabase } from '../client/db';
import { supabase as serverSupabase } from '../server/db';
import { get } from 'svelte/store';

import { affiliations } from './affiliations';

const STORE_USER_EMAIL = uniqueTestEmail('updatedatabaseaffiliations');

/**
 * The database-backed test needs one organization to affiliate with. It creates
 * its own rather than reusing a seeded one: this file used to delete every row
 * in `affiliate_organizations` and re-insert a fixed three, which wiped the
 * organizations the Playwright suite and the other specs depend on.
 */
const TEST_ORG = {
  key: `aff-store-${randomUUID().slice(0, 8)}`,
  name: `Affiliations Store Test Org ${randomUUID().slice(0, 8)}`,
  url: 'https://affiliations-store-test.test'
};

describe('affiliations store', () => {
  beforeAll(async () => {
    const { error } = await serverSupabase.from('affiliate_organizations').insert(TEST_ORG);
    if (error) throw error;
  });

  afterAll(async () => {
    const { error } = await serverSupabase
      .from('affiliate_organizations')
      .delete()
      .eq('key', TEST_ORG.key);
    if (error) throw error;
  });

  it('should toggle affiliations on when toggleSelection is called', () => {
    affiliations.reset();

    affiliations.toggleSelection({
      name: 'CTX',
      key: 'cdu',
      url: 'https://example.org'
    });
    const affiliationValue = get(affiliations);
    expect(affiliationValue.selected).toEqual({
      name: 'CTX',
      key: 'cdu',
      url: 'https://example.org'
    });
  });

  it('should replace the selection when toggleSelection is called again', () => {
    affiliations.reset();

    affiliations.toggleSelection({
      name: 'GLS',
      key: 'gls',
      url: 'https://example.org'
    });
    const affiliationValueSingle = get(affiliations);
    expect(affiliationValueSingle.selected).toEqual({
      name: 'GLS',
      key: 'gls',
      url: 'https://example.org'
    });

    affiliations.toggleSelection({
      name: 'CTX',
      key: 'cdu',
      url: 'https://example.org'
    });

    const affiliationValueDouble = get(affiliations);
    expect(affiliationValueDouble.selected).toEqual({
      name: 'CTX',
      key: 'cdu',
      url: 'https://example.org'
    });
  });

  it('should update the affiliations table and return updated rows when updateDatabase is called', async () => {
    affiliations.reset();

    const user = await createTestUserByEmail(STORE_USER_EMAIL, true);

    // log user in
    const { error } = await clientSupabase.auth.signInWithPassword({
      email: STORE_USER_EMAIL,
      password: 'password'
    });
    if (error) throw error;

    affiliations.reset(); // reset the store to clear the selected consents
    affiliations.toggleSelection(TEST_ORG);
    await affiliations.updateDatabase();

    affiliations.reset(); // reset the store to clear the selected consents

    // get again from the db to check if the selected consents are saved
    await affiliations.getSelectedAffiliationsFromDatabase();

    const selected = get(affiliations).selected;
    expect(selected?.name).toEqual(TEST_ORG.name);
    expect(selected?.key).toEqual(TEST_ORG.key);
    expect(selected?.url).toEqual(TEST_ORG.url);

    // delete the driver_affiliate_organization_affiliations rows
    const { error: deleteError } = await serverSupabase
      .from('driver_affiliate_organization_affiliations')
      .delete()
      .eq('user_id', user.id);
    if (deleteError) throw deleteError;

    // clean up
    await teardownTestUserByUserId(user.id);
  });
});
