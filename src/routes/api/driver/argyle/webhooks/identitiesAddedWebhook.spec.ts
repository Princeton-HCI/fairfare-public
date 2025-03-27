import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import * as argyle from '@src/lib/server/argyle';
import { supabase } from '@src/lib/server/db';
import * as sendSmsMessageToUserNow from '@src/lib/smsMessages/sendSmsMessageToUserNow';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';

import { handleWebhook } from './handleWebhook';

import type { ArgyleWebhookResponse } from './types';

const argyleFetchIdentityResponseBobJones = {
  id: 'cc33cc33-cc33-cc33-cc33-cc33cc33cc33',
  account: 'aa11aa11-aa11-aa11-aa11-aa11aa11aa11',
  address: {
    city: 'New York',
    line1: '123 Main',
    line2: null,
    state: 'NY',
    country: 'US',
    postal_code: '10014'
  },
  first_name: 'Bob',
  last_name: 'Jones',
  full_name: 'Bob Jones',
  birth_date: '1980-10-10',
  email: 'test1@argyle.com',
  phone_number: '+18009000010',
  picture_url: 'https://crouton.net/crouton.png',
  employment_status: 'inactive',
  employment_type: 'contractor',
  job_title: null,
  ssn: '522-09-1191',
  marital_status: 'Married filing jointly',
  gender: 'Male',
  hire_date: '2021-05-05',
  termination_date: '2023-09-18',
  termination_reason: null,
  employer: 'Uber',
  base_pay: { amount: null, period: null, currency: 'USD' },
  pay_cycle: 'weekly',
  platform_ids: {
    employee_id: null,
    position_id: null,
    platform_user_id: 'PLATFROM_USER_ID'
  },
  created_at: '2023-11-05T19:58:21.920Z',
  updated_at: '2023-11-05T20:01:07.480Z',
  metadata: {}
};

describe('incoming identities.added webhook', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'identities.added',
    name: 'ALL_development',
    data: {
      account: 'aa11aa11-aa11-aa11-aa11-aa11aa11aa11',
      user: 'bb22bb22-bb22-bb22-bb22-bb22bb22bb22',
      identity: 'cc33cc33-cc33-cc33-cc33-cc33cc33cc33'
    }
  };

  test('calls addIdentityDataToUserAndEnableOtpLogin', async () => {
    const user = await createTestUserByEmail(
      'incoming.identities.added.sends_the_phone_number_already+used@test.test'
    );

    await updateProfileByUserId(supabase, user.id, {
      argyle_user: 'bb22bb22-bb22-bb22-bb22-bb22bb22bb22'
    });

    vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(argyleFetchIdentityResponseBobJones);

    // spy on addIdentityDataToUserAndEnableOtpLogin from argyle
    const addIdentityDataToUserAndEnableOtpLoginSpy = vi.spyOn(
      argyle,
      'addIdentityDataToUserAndEnableOtpLogin'
    );

    await handleWebhook(payload);

    expect(addIdentityDataToUserAndEnableOtpLoginSpy).toHaveBeenCalledOnce();
    expect(addIdentityDataToUserAndEnableOtpLoginSpy).toHaveBeenCalledWith(
      'bb22bb22-bb22-bb22-bb22-bb22bb22bb22',
      argyleFetchIdentityResponseBobJones
    );

    await teardownTestUserByUserId(user.id);
  });

  describe('when the user has consented to share data with an organization', () => {
    it('sends them the welcome_with_data_sharing_consent sms with the organization as an argument', async () => {
      vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(argyleFetchIdentityResponseBobJones);

      const user = await createTestUserByEmail(
        'tests.sends.sms.to.user.welcome_with_data_sharing_consent@test.test'
      );

      // make a fake affiliate organization
      const { data: affiliateOrganizations, error: getAffiliateOrganizationError } = await supabase
        .from('affiliate_organizations')
        .insert({
          name: 'Testy Org',
          key: 'testy'
        })
        .select('*')
        .single();

      if (getAffiliateOrganizationError) throw getAffiliateOrganizationError;

      const affiliateOrganizationId = affiliateOrganizations.id;

      // add data sharing consent
      const { error: dataSharingConsentInsertError } = await supabase
        .from('driver_affiliate_organization_data_sharing_consents')
        .insert({
          user_id: user.id,
          affiliate_organization_id: affiliateOrganizationId
        });

      if (dataSharingConsentInsertError) throw dataSharingConsentInsertError;

      vi.spyOn(argyle, 'addIdentityDataToUserAndEnableOtpLogin').mockResolvedValueOnce({
        phone: '12345678910',
        user_id: user.id
      } as Profile);

      const messageSendSpy = vi.spyOn(sendSmsMessageToUserNow, 'default').mockResolvedValueOnce();

      await handleWebhook(payload);

      expect(messageSendSpy).toHaveBeenCalledTimes(1);
      expect(messageSendSpy).toHaveBeenCalledWith(user.id, 'welcome_with_data_sharing_consent', {
        organizationName: 'Testy Org'
      });

      // clean up sms messages
      await supabase.from('sms_messages').delete().neq('message', null);
    });
  });

  describe('when the user has not consented to share data with an organization', () => {
    it('sends the normal welcome sms to user', async () => {
      vi.spyOn(argyle, 'fetchIdentity').mockResolvedValueOnce(argyleFetchIdentityResponseBobJones);

      const user = await createTestUserByEmail('tests.sends.sms.to.user@test.test');

      vi.spyOn(argyle, 'addIdentityDataToUserAndEnableOtpLogin').mockResolvedValueOnce({
        phone: '12345678910',
        user_id: user.id
      } as Profile);

      const messageSendSpy = vi.spyOn(sendSmsMessageToUserNow, 'default').mockResolvedValueOnce();

      await handleWebhook(payload);

      expect(messageSendSpy).toHaveBeenCalledTimes(1);
      expect(messageSendSpy).toHaveBeenCalledWith(user.id, 'welcome', {});
    });
  });
});
