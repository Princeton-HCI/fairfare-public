import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import { supabase as clientSupabase } from '../client/db';
import { supabase as serverSupabase } from '../server/db';
import { get } from 'svelte/store';

import { affiliations } from './affiliations';

describe('affiliations store', () => {
  beforeAll(async () => {
    const affiliateOrganizations = [
      {
        key: 'lpc',
        name: 'LPC',
        url: 'https://lpc.org'
      },
      {
        key: 'gls',
        name: 'GLS',
        url: 'https://gls.org'
      },
      {
        key: 'olr',
        name: 'OLR',
        url: 'https://www.olr.org'
      },
      {
        name: 'PELQ',
        key: 'pelq',
        url: 'https://pelq.org'
      }
    ];

    // delete all the rows in the table
    const { error: deleteError } = await serverSupabase
      .from('affiliate_organizations')
      .delete()
      .not('id', 'is', null);
    if (deleteError) throw deleteError;

    const { error } = await serverSupabase
      .from('affiliate_organizations')
      .insert(affiliateOrganizations);
    if (error) throw error;
  });
  it('should toggle affiliations on when toggleSelection is called', () => {
    affiliations.reset();

    affiliations.toggleSelection({
      name: 'OLR',
      key: 'olr',
      url: 'https://olr.org'
    });
    const affiliationValue = get(affiliations);
    expect(affiliationValue.selected).toEqual({
      name: 'OLR',
      key: 'olr',
      url: 'https://olr.org'
    });
  });

  it('should toggle affiliations on when toggleSelection is called', () => {
    affiliations.reset();

    affiliations.toggleSelection({
      name: 'GLS',
      key: 'gls',
      url: 'https://gls.org'
    });
    const affiliationValueSingle = get(affiliations);
    expect(affiliationValueSingle.selected).toEqual({
      name: 'GLS',
      key: 'gls',
      url: 'https://gls.org'
    });

    affiliations.toggleSelection({
      name: 'OLR',
      key: 'olr',
      url: 'https://olr.org'
    });

    const affiliationValueDouble = get(affiliations);
    expect(affiliationValueDouble.selected).toEqual({
      name: 'OLR',
      key: 'olr',
      url: 'https://olr.org'
    });
  });

  it('should update the affiliations table and return updated rows when updateDatabase is called', async () => {
    affiliations.reset();

    const user = await createTestUserByEmail('updatedatabaseaffiliations@test.test', true);

    // log user in
    const { error } = await clientSupabase.auth.signInWithPassword({
      email: 'updatedatabaseaffiliations@test.test',
      password: 'password'
    });
    if (error) throw error;

    affiliations.reset(); // reset the store to clear the selected consents
    affiliations.toggleSelection({
      name: 'PELQ',
      key: 'pelq',
      url: 'https://pelq.org'
    });
    await affiliations.updateDatabase();

    affiliations.reset(); // reset the store to clear the selected consents

    // get again from the db to check if the selected consents are saved
    await affiliations.getSelectedAffiliationsFromDatabase();

    const selected = get(affiliations).selected;
    expect(selected?.name).toEqual('PELQ');
    expect(selected?.key).toEqual('pelq');
    expect(selected?.url).toEqual('https://pelq.org');

    // delete the driver_affiliate_organization_data_sharing_consents rows
    const { error: deleteError } = await serverSupabase
      .from('driver_affiliate_organization_affiliations')
      .delete()
      .eq('user_id', user.id);
    if (deleteError) throw deleteError;

    // clean up
    await teardownTestUserByUserId(user.id);
  });
});
