import { randomUUID } from 'crypto';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import * as argyle from '@src/lib/server/argyle';
import { supabase } from '@src/lib/server/db';
import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import type { ArgyleAccountResponse } from '$lib/types';

import { handleWebhook } from './handleWebhook';

import type { ArgyleWebhookResponse } from './types';
/**
 * Argyle identifiers unique to this run, so this file can run at the same time
 * as the other specs that used to share these literals (they collide on
 * argyle_user_unique and argyle_account when two files insert at once).
 */
const TEST_ARGYLE_ACCOUNT = randomUUID();
const TEST_ARGYLE_USER = randomUUID();

describe('incoming accounts.removed webhook', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'accounts.removed',
    name: 'ALL_development',
    data: {
      account: TEST_ARGYLE_ACCOUNT,
      user: TEST_ARGYLE_USER
    }
  };

  describe('when the account is actually deleted on argyle servers', () => {
    it('updates the deleted_at value in the database', async () => {
      // Create test user
      const user = await createTestUserByEmail(
        uniqueTestEmail('accounts-removed-actually-deleted')
      );

      // Update user profile with argyle_user
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: TEST_ARGYLE_USER
      });

      // Create argyle_account record
      const { error: insertError } = await supabase.from('argyle_accounts').insert({
        argyle_user: TEST_ARGYLE_USER,
        argyle_account: TEST_ARGYLE_ACCOUNT,
        user_id: user.id
      });

      if (insertError) throw insertError;

      // Mock fetchAccount to return null (account actually deleted)
      vi.spyOn(argyle, 'fetchAccount').mockResolvedValueOnce(null);

      // Verify account exists and is not deleted before webhook
      const { data: beforeWebhook, error: beforeError } = await supabase
        .from('argyle_accounts')
        .select('*')
        .eq('argyle_account', TEST_ARGYLE_ACCOUNT)
        .single();

      if (beforeError) throw beforeError;
      expect(beforeWebhook.deleted_at).toBeNull();

      // Handle the webhook
      await handleWebhook(payload);

      // Verify the account's deleted_at field has been updated
      const { data: afterWebhook, error: afterError } = await supabase
        .from('argyle_accounts')
        .select('*')
        .eq('argyle_account', TEST_ARGYLE_ACCOUNT)
        .single();

      if (afterError) throw afterError;
      expect(afterWebhook.deleted_at).not.toBeNull();
      expect(new Date(afterWebhook.deleted_at)).toBeInstanceOf(Date);

      // Cleanup
      await teardownTestUserByUserId(user.id);
    });

    it('calls fetchAccount to verify the account is actually deleted', async () => {
      // Create test user
      const user = await createTestUserByEmail(uniqueTestEmail('accounts-removed-verify-fetch'));

      // Update user profile with argyle_user
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: TEST_ARGYLE_USER
      });

      // Create argyle_account record
      const { error: insertError } = await supabase.from('argyle_accounts').insert({
        argyle_user: TEST_ARGYLE_USER,
        argyle_account: TEST_ARGYLE_ACCOUNT,
        user_id: user.id
      });

      if (insertError) throw insertError;

      // Mock fetchAccount to return null (account actually deleted)
      const fetchAccountSpy = vi.spyOn(argyle, 'fetchAccount').mockResolvedValueOnce(null);

      // Handle the webhook
      await handleWebhook(payload);

      // Verify fetchAccount was called with the correct account ID
      expect(fetchAccountSpy).toHaveBeenCalledOnce();
      expect(fetchAccountSpy).toHaveBeenCalledWith(TEST_ARGYLE_ACCOUNT, null);

      // Cleanup
      await teardownTestUserByUserId(user.id);
    });
  });

  describe('when the account is NOT actually deleted on argyle servers', () => {
    it('does not update the deleted_at value and logs a warning', async () => {
      // Create test user
      const user = await createTestUserByEmail(uniqueTestEmail('accounts-removed-not-deleted'));

      // Update user profile with argyle_user
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: TEST_ARGYLE_USER
      });

      // Create argyle_account record
      const { error: insertError } = await supabase.from('argyle_accounts').insert({
        argyle_user: TEST_ARGYLE_USER,
        argyle_account: TEST_ARGYLE_ACCOUNT,
        user_id: user.id
      });

      if (insertError) throw insertError;

      // Mock fetchAccount to return account data (account still exists)
      const mockAccountData: ArgyleAccountResponse = {
        id: TEST_ARGYLE_ACCOUNT,
        user: TEST_ARGYLE_USER,
        employers: ['Uber'],
        item: 'uber',
        source: 'uber',
        created_at: '2023-11-05T19:58:21.920Z',
        updated_at: '2023-11-05T20:01:07.480Z',
        scanned_at: '2023-11-05T20:01:07.480Z',
        connection: {
          status: 'connected',
          error_code: null,
          error_message: null,
          updated_at: '2023-11-05T20:01:07.480Z'
        },
        direct_deposit_switch: {
          status: 'pending',
          error_code: null,
          error_message: null,
          updated_at: '2023-11-05T20:01:07.480Z'
        },
        availability: {
          gigs: {
            status: 'synced',
            updated_at: '2023-11-05T20:01:07.480Z',
            available_count: 100,
            available_from: '2023-01-01T00:00:00.000Z',
            available_to: '2023-11-05T20:01:07.480Z'
          },
          shifts: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z',
            available_count: 0,
            available_from: null,
            available_to: null
          },
          paystubs: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z',
            available_count: 0,
            available_from: '2023-01-01T00:00:00.000Z',
            available_to: '2023-11-05T20:01:07.480Z'
          },
          payroll_documents: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          identities: {
            status: 'synced',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          ratings: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          vehicles: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          deposit_destinations: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          user_forms: null,
          user_uploads: null
        },
        ongoing_refresh: {
          status: 'not_refreshing'
        }
      };
      vi.spyOn(argyle, 'fetchAccount').mockResolvedValueOnce(mockAccountData);

      // Spy on console.warn to verify warning is logged
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Verify account exists and is not deleted before webhook
      const { data: beforeWebhook, error: beforeError } = await supabase
        .from('argyle_accounts')
        .select('*')
        .eq('argyle_account', TEST_ARGYLE_ACCOUNT)
        .single();

      if (beforeError) throw beforeError;
      expect(beforeWebhook.deleted_at).toBeNull();

      // Handle the webhook
      await handleWebhook(payload);

      // Verify the account's deleted_at field has NOT been updated
      const { data: afterWebhook, error: afterError } = await supabase
        .from('argyle_accounts')
        .select('*')
        .eq('argyle_account', TEST_ARGYLE_ACCOUNT)
        .single();

      if (afterError) throw afterError;
      expect(afterWebhook.deleted_at).toBeNull();

      // Verify warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[accounts.removed] Account not removed from Argyle but we received an accounts.removed webhook. Performing a no-op:',
        TEST_ARGYLE_ACCOUNT
      );

      // Cleanup
      consoleSpy.mockRestore();
      await teardownTestUserByUserId(user.id);
    });

    it('performs a no-op and returns early when account still exists', async () => {
      // Create test user
      const user = await createTestUserByEmail(uniqueTestEmail('accounts-removed-no-op'));

      // Update user profile with argyle_user
      await updateProfileByUserId(supabase, user.id, {
        argyle_user: TEST_ARGYLE_USER
      });

      // Create argyle_account record
      const { error: insertError } = await supabase.from('argyle_accounts').insert({
        argyle_user: TEST_ARGYLE_USER,
        argyle_account: TEST_ARGYLE_ACCOUNT,
        user_id: user.id
      });

      if (insertError) throw insertError;

      // Mock fetchAccount to return account data (account still exists)
      const mockAccountData: ArgyleAccountResponse = {
        id: TEST_ARGYLE_ACCOUNT,
        user: TEST_ARGYLE_USER,
        employers: ['Uber'],
        item: 'uber',
        source: 'uber',
        created_at: '2023-11-05T19:58:21.920Z',
        updated_at: '2023-11-05T20:01:07.480Z',
        scanned_at: '2023-11-05T20:01:07.480Z',
        connection: {
          status: 'connected',
          error_code: null,
          error_message: null,
          updated_at: '2023-11-05T20:01:07.480Z'
        },
        direct_deposit_switch: {
          status: 'pending',
          error_code: null,
          error_message: null,
          updated_at: '2023-11-05T20:01:07.480Z'
        },
        availability: {
          gigs: {
            status: 'synced',
            updated_at: '2023-11-05T20:01:07.480Z',
            available_count: 100,
            available_from: '2023-01-01T00:00:00.000Z',
            available_to: '2023-11-05T20:01:07.480Z'
          },
          shifts: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z',
            available_count: 0,
            available_from: null,
            available_to: null
          },
          paystubs: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z',
            available_count: 0,
            available_from: '2023-01-01T00:00:00.000Z',
            available_to: '2023-11-05T20:01:07.480Z'
          },
          payroll_documents: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          identities: {
            status: 'synced',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          ratings: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          vehicles: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          deposit_destinations: {
            status: 'not_supported',
            updated_at: '2023-11-05T20:01:07.480Z'
          },
          user_forms: null,
          user_uploads: null
        },
        ongoing_refresh: {
          status: 'not_refreshing'
        }
      };
      vi.spyOn(argyle, 'fetchAccount').mockResolvedValueOnce(mockAccountData);

      // Mock the database update to ensure it's never called
      const updateSpy = vi.spyOn(supabase.from('argyle_accounts'), 'update');

      // Handle the webhook
      await handleWebhook(payload);

      // Verify that no database update was attempted
      expect(updateSpy).not.toHaveBeenCalled();

      // Cleanup
      await teardownTestUserByUserId(user.id);
    });
  });
});
