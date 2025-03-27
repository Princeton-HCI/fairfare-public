import { createTestUserByEmail, teardownTestUserByUserId } from '@tests/utils/testUser';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';

describe('POST /api/update_argyle_identities', () => {
  it('happy path: updates the identity for the matching profile', async () => {
    // setup
    const user = await createTestUserByEmail('update_argyle_identities_matching_profile@test.test');

    await updateProfileByUserId(supabase, user.id, {
      argyle_user: 'abcd1234-abab-1234-abab-2654abcd1234'
    });

    // call the endpoint from the file
    const response = await POST();
    const data = await response.json();

    // expect the response to be success: true
    expect(data).toEqual({ success: true });

    await teardownTestUserByUserId(user.id);
  });
});
