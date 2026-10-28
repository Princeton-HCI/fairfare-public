import {
  createTestUserByEmail,
  teardownTestUserByUserId,
  uniqueTestEmail
} from '@tests/utils/testUser';
import { createInternalRequestEvent, createRequestEvent } from '@tests/utils/requestEvent';
import { POST } from './+server';
import { supabase } from '@src/lib/server/db';
import { updateProfileByUserId } from '@src/lib/databaseHelpers';
import { randomUUID } from 'crypto';
import { http, HttpResponse } from 'msw';
import { server } from '@tests/setupTests';
import { scopeDatabaseReads } from '@tests/utils/scopeDatabaseReads';
import { generateMockedArgyleIdentityResponse } from '@tests/mocks/identities';

describe('POST /api/update_argyle_identities', () => {
  describe('authentication', () => {
    it('should return 401 when Authorization header is missing', async () => {
      const mockRequestEvent = createRequestEvent('http://localhost/api/update_argyle_identities', {
        method: 'POST'
      });

      await expect(POST(mockRequestEvent)).rejects.toMatchObject({
        status: 401
      });
    });

    it('should return 401 when Authorization header is invalid', async () => {
      const mockRequestEvent = createRequestEvent('http://localhost/api/update_argyle_identities', {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid-secret' }
      });

      await expect(POST(mockRequestEvent)).rejects.toMatchObject({
        status: 401
      });
    });
  });

  it('happy path: updates the identity for the matching profile', async () => {
    // setup
    const user = await createTestUserByEmail(
      uniqueTestEmail('update-argyle-identities-matching-profile')
    );
    onTestFinished(() => teardownTestUserByUserId(user.id));
    const argyleUser = randomUUID();
    const account = randomUUID();
    scopeDatabaseReads('profiles', 'user_id', user.id);
    server.use(
      http.get('http://argyletestingurl.test/v2/identities', () =>
        HttpResponse.json({
          results: [
            generateMockedArgyleIdentityResponse({
              account,
              first_name: 'Fixture',
              last_name: 'Driver'
            })
          ]
        })
      )
    );

    await updateProfileByUserId(supabase, user.id, {
      argyle_user: argyleUser
    });

    // call the endpoint from the file
    const response = await POST(
      createInternalRequestEvent('http://localhost/api/update_argyle_identities', {
        method: 'POST'
      })
    );
    const data = await response.json();

    // expect the response to be success: true
    expect(data).toEqual({ success: true });
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('first_name, last_initial')
      .eq('user_id', user.id)
      .single();
    expect(error).toBeNull();
    expect(profile).toEqual({ first_name: 'Fixture', last_initial: 'D' });
  });
});
