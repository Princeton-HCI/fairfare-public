import { handleWebhook } from './handleWebhook';
import type { ArgyleWebhookResponse } from './types';
import { expect, vi } from 'vitest';
import * as syncAccountData from '@src/lib/syncAccountData';

describe('incoming gigs.updated webhook', () => {
  const payload: ArgyleWebhookResponse = {
    event: 'gigs.added',
    name: 'ALL_development',
    data: {
      account: 'cc99cc99-cc99-cc99-cc99-cc99cc99cc99',
      user: 'bb22bb22-bb22-bb22-bb22-bb22bb22bb22',
      available_from: '2025-01-05T19:58:21.920Z',
      available_to: '2025-11-05T20:01:07.480Z',
      available_count: 2000,
      added_count: 12,
      added_from: '2025-11-05T19:58:21.920Z',
      added_to: '2025-11-05T20:01:07.480Z'
    }
  };

  test('calls syncAccountData', async () => {
    const syncAccountDataSpy = vi.spyOn(syncAccountData, 'default').mockResolvedValueOnce();

    await handleWebhook(payload);

    expect(syncAccountDataSpy).toHaveBeenCalledWith('cc99cc99-cc99-cc99-cc99-cc99cc99cc99', true);
  });
});
