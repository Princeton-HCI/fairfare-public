/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { createTestUserByEmail, uniqueTestEmail, uniqueTestPhone } from '@tests/utils/testUser';
import optOut from './optOut';
import { supabase } from './server/db';
import * as email from './email';
import { vi } from 'vitest';
import { updateProfileByUserId } from './databaseHelpers';

describe('src/lib/optOut.spec.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete the user's data", async () => {
    const user = await createTestUserByEmail(uniqueTestEmail('opt-out-delete-user-data'));

    await optOut(user.id);

    const { data, error } = await supabase.auth.admin.deleteUser(user.id);

    expect(data).toStrictEqual({ user: null });

    expect(error).toBeDefined();
    expect(error?.message).toBe('User not found');

    // no teardown; the user is already deleted
  });

  it('should add a record to the opt_out_survey_responses table', async () => {
    const user = await createTestUserByEmail(
      uniqueTestEmail('opt-out-add-opt-out-survey-responses-record')
    );

    const surveyResponseId = await optOut(user.id);

    const { data: optOutSurveyResponses } = await supabase
      .from('opt_out_survey_responses')
      .select()
      .eq('id', surveyResponseId);

    expect(optOutSurveyResponses).toHaveLength(1);

    const { data: deletedUserData, error: deletedUserError } =
      await supabase.auth.admin.getUserById(user.id);

    expect(deletedUserData).toStrictEqual({ user: null });
    expect(deletedUserError?.message).toBe('User not found');
  });

  it('should send email notifications to organizations when user had data sharing consent', async () => {
    const mockSendEmailToAffiliateOrganization = vi
      .spyOn(email, 'sendOptOutEmailToAffiliateOrganization')
      .mockResolvedValue({} as any);

    // Create a test user
    const user = await createTestUserByEmail(uniqueTestEmail('opt-out-sms-notifications'));

    // update the user's profile with a first name and last initial
    const userPhone = uniqueTestPhone();
    await updateProfileByUserId(supabase, user.id, {
      first_name: 'John',
      last_initial: 'D',
      phone: userPhone
    });

    // Create a test affiliate organization with data_deletion_contact_email
    const orgKey = `test-org-email-${randomUUID().slice(0, 8)}`;
    const { data: org, error: orgError } = await supabase
      .from('affiliate_organizations')
      .insert({
        key: orgKey,
        name: 'Test Organization for SMS',
        data_deletion_contact_email: 'test@example.com',
        status: 'active'
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // Create a data sharing consent for the user with this organization
    const { error: consentError } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .insert({
        user_id: user.id,
        affiliate_organization_id: org.id
      });

    if (consentError) throw consentError;

    // optOut deletes the user, which cascades the consent; the organization is
    // this test's own row and has to go back out explicitly.
    onTestFinished(async () => {
      const { error: cleanupError } = await supabase
        .from('affiliate_organizations')
        .delete()
        .eq('key', orgKey);
      if (cleanupError) throw cleanupError;
    });

    // Call optOut
    await optOut(user.id);

    // Verify SMS was sent to the organization
    expect(mockSendEmailToAffiliateOrganization).toHaveBeenCalledWith(
      'test@example.com',
      'John',
      'D',
      userPhone
    );

    // Clean up
    await supabase.from('affiliate_organizations').delete().eq('id', org.id);
  });

  it('should not send email notifications when user had no data sharing consent', async () => {
    const mockSendEmailToAffiliateOrganization = vi
      .spyOn(email, 'sendOptOutEmailToAffiliateOrganization')
      .mockResolvedValue({} as any);

    // Create a test user
    const user = await createTestUserByEmail(uniqueTestEmail('opt-out-no-email-notifications'));

    // Call optOut
    await optOut(user.id);

    // Verify no SMS was sent
    expect(mockSendEmailToAffiliateOrganization).not.toHaveBeenCalled();
  });
});
