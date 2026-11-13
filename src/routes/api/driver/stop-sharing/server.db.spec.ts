import { randomUUID } from 'crypto';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import { sendOptOutEmailToAffiliateOrganization } from '@src/lib/email';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

// Mock the email sending function
vi.mock('@src/lib/email', () => ({
  sendOptOutEmailToAffiliateOrganization: vi.fn()
}));

// Mock the database helper
vi.mock('@src/lib/databaseHelpers', () => ({
  getProfileFromUserId: vi.fn()
}));

// Mock isDemoMode — default to false (production behavior), override per-test as needed
vi.mock('@src/lib/utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@src/lib/utils')>()),
  isDemoMode: false
}));

describe('POST /api/driver/stop-sharing', () => {
  let testUser: any;
  let testAffiliateOrgId: string;
  const testAffiliationKey = `stop-sharing-test-org-${randomUUID().slice(0, 8)}`;
  const dataDeletionContactEmail = 'delete@delete.delete';

  beforeEach(async () => {
    // Remove any stale row from a previous failed run
    await supabase.from('affiliate_organizations').delete().eq('key', testAffiliationKey);

    // Create a test user
    testUser = await createTestUserByEmail(uniqueTestEmail('stop-sharing-test'));

    // Create a test affiliate organization
    const { data: affiliateOrg, error: orgError } = await supabase
      .from('affiliate_organizations')
      .insert({
        key: testAffiliationKey,
        name: 'Test Organization',
        data_deletion_contact_email: dataDeletionContactEmail
      })
      .select()
      .single();

    if (orgError) throw orgError;
    testAffiliateOrgId = affiliateOrg.id;

    // Mock the profile data
    (getProfileFromUserId as any).mockResolvedValue({
      first_name: 'John',
      last_initial: 'D',
      phone: '67890'
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (testUser?.id) {
      await teardownTestUserByUserId(testUser.id);
    }

    // Clean up affiliate organization
    if (testAffiliateOrgId) {
      await supabase.from('affiliate_organizations').delete().eq('id', testAffiliateOrgId);
    }

    // Reset mocks
    vi.resetAllMocks();
  });

  it('should successfully stop sharing and send email notification', async () => {
    // Create a data sharing consent
    const { error: consentError } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .insert({
        user_id: testUser.id,
        affiliate_organization_id: testAffiliateOrgId
      });

    if (consentError) throw consentError;

    // Create mock request
    const mockRequest = {
      json: async () => ({ affiliationKey: testAffiliationKey })
    } as Request;

    const mockRequestEvent: RequestEvent = {
      request: mockRequest,
      locals: {
        // @ts-expect-error - mock
        safeGetSession: async () => ({ user: testUser, session: {} })
      }
    };

    // Execute the endpoint
    const response = await POST(mockRequestEvent);

    // Verify response
    expect(response.status).toBe(200);
    const responseData = await response.json();
    expect(responseData).toMatchObject({ success: true });

    // Verify consent was deleted
    const { data: remainingConsents } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .select('*')
      .eq('user_id', testUser.id)
      .eq('affiliate_organization_id', testAffiliateOrgId);

    expect(remainingConsents).toHaveLength(0);

    // Verify email was sent
    expect(sendOptOutEmailToAffiliateOrganization).toHaveBeenCalledTimes(1);
    expect(sendOptOutEmailToAffiliateOrganization).toHaveBeenCalledWith(
      dataDeletionContactEmail,
      'John',
      'D',
      '67890'
    );
  });

  it('should skip email notification in demo mode', async () => {
    // Override isDemoMode to true for this test
    const utils = await import('@src/lib/utils');
    (utils as any).isDemoMode = true;

    // Create a data sharing consent
    const { error: consentError } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .insert({
        user_id: testUser.id,
        affiliate_organization_id: testAffiliateOrgId
      });

    if (consentError) throw consentError;

    const mockRequest = {
      json: async () => ({ affiliationKey: testAffiliationKey })
    } as Request;

    const mockRequestEvent: RequestEvent = {
      request: mockRequest,
      locals: {
        // @ts-expect-error - mock
        safeGetSession: async () => ({ user: testUser, session: {} })
      }
    };

    const response = await POST(mockRequestEvent);

    expect(response.status).toBe(200);

    // Verify consent was still deleted
    const { data: remainingConsents } = await supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .select('*')
      .eq('user_id', testUser.id)
      .eq('affiliate_organization_id', testAffiliateOrgId);

    expect(remainingConsents).toHaveLength(0);

    // Verify email was NOT sent in demo mode
    expect(sendOptOutEmailToAffiliateOrganization).not.toHaveBeenCalled();
    expect(getProfileFromUserId).not.toHaveBeenCalled();

    // Reset for other tests
    (utils as any).isDemoMode = false;
  });
});
