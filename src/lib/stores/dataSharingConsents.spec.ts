import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import { supabase as serverSupabase } from '../server/db';
import { supabase as clientSupabase } from '../client/db';
import { get } from 'svelte/store';

import { dataSharingConsents } from './dataSharingConsents';

describe('dataSharingConsents store', () => {
  beforeAll(async () => {
    const affiliateOrganizations = [
      {
        key: 'lpc',
        name: 'LPC',
        url: 'https://www.lpc.org'
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

    dataSharingConsents.reset();
    dataSharingConsents.setAffiliateOrganizations([
      {
        name: 'GLS',
        key: 'gls',
        url: 'https://gls.org'
      },
      {
        name: 'OLR',
        key: 'olr',
        url: 'https://olr.org'
      }
    ]);
  });

  it('should update consent key when setAffiliationConsent is called', () => {
    dataSharingConsents.toggleSelection('gls');
    const selected = get(dataSharingConsents).selected;
    expect(selected).toEqual([
      {
        name: 'GLS',
        key: 'gls',
        url: 'https://gls.org'
      }
    ]);

    dataSharingConsents.toggleSelection('gls');
    const selectedEmpty = get(dataSharingConsents).selected;
    expect(selectedEmpty).toEqual([]);
  });

  it('should update the consents table and return updated rows when updateDatabase is called', async () => {
    const user = await createTestUserByEmail('datasharingconsentsupdatedatabase@test.test', true);

    // log user in
    const { error } = await clientSupabase.auth.signInWithPassword({
      email: 'datasharingconsentsupdatedatabase@test.test',
      password: 'password'
    });
    if (error) throw error;

    dataSharingConsents.toggleSelection('gls');
    dataSharingConsents.toggleSelection('olr');

    await dataSharingConsents.updateDatabase();

    dataSharingConsents.reset(); // reset the store to clear the selected consents

    // get again from the db to check if the selected consents are saved
    await dataSharingConsents.getSelectedDataSharingConsentsFromDatabase();

    const selected = get(dataSharingConsents).selected;
    expect(selected[0].name).toEqual('GLS');
    expect(selected[1].name).toEqual('OLR');

    expect(selected[0].key).toEqual('gls');
    expect(selected[1].key).toEqual('olr');

    expect(selected[0].url).toEqual('https://gls.org');
    expect(selected[1].url).toEqual('https://www.olr.org');

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
