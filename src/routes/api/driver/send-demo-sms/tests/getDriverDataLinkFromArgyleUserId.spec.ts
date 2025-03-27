import short from 'short-uuid';
import { describe, it, expect } from 'vitest';
import { getDriverDataLinkFromArgyleUserId } from '@src/routes/api/driver/argyle/webhooks/sendTakeRateMessageIfElegibleToArgyleUser';
import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import { supabase } from '@src/lib/server/db';

describe('getDriverDataLinkFromArgyleUserId', () => {
  it('should return a correct link for demo base url', async () => {
    const user = await createTestUserByEmail('getDriverDataLinkFromArgyleUserId_demo@test.test');

    await updateProfileByUserId(supabase, user.id, {
      argyle_user: 'ab13c4d3-4b3d-4b3d-4b3d-4b3d4b3d4b3d'
    });

    const demoBaseUrl = 'https://demo.getsystem.org/';
    const link = await getDriverDataLinkFromArgyleUserId(
      'ab13c4d3-4b3d-4b3d-4b3d-4b3d4b3d4b3d',
      demoBaseUrl
    );

    const shortUserId = short().fromUUID(user.id);
    expect(link).toBe(`https://demo.getsystem.org/driver/data/${shortUserId}`);

    await teardownTestUserByUserId(user.id);
  });

  it('should return a getsystem.org url by default', async () => {
    const user = await createTestUserByEmail('getDriverDataLinkFromArgyleUserId_default@test.test');

    await updateProfileByUserId(supabase, user.id, {
      argyle_user: 'ab13c4d3-4b3d-4b3d-4b3d-001122334455'
    });

    const link = await getDriverDataLinkFromArgyleUserId('ab13c4d3-4b3d-4b3d-4b3d-001122334455');

    const shortUserId = short().fromUUID(user.id);
    expect(link).toBe(`https://www.getsystem.org/driver/data/${shortUserId}`);

    await teardownTestUserByUserId(user.id);
  });
});
