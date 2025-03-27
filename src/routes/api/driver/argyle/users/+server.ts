import { argyleFetch, buildArgyleUrl } from '@src/lib/server/argyle';
import { json } from '@sveltejs/kit';
import createTemporaryUser from '@src/lib/server/createTemporaryUser';

interface ArgyleUserResponse {
  user_token: string;
  id: string;
  message: string;
}

export const POST = async () => {
  try {
    const url = buildArgyleUrl('/users');
    const response = await argyleFetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      }
    });

    const data = await response.json();
    if (response.ok) {
      const { user_token: argyleUserToken, id: argyleUserId } = data as ArgyleUserResponse;

      // here we need to log in the user, make them an anon account with
      // this user ID in their profile
      // return a session and then update the profile as needed with argyle
      // account IDs

      const { data: temporaryUser, error: createTemporaryUserError } =
        await createTemporaryUser(argyleUserId);
      if (createTemporaryUserError) {
        console.error('createTemporaryUserError:', createTemporaryUserError);
        return json({ error: createTemporaryUserError }, { status: 400 });
      }
      const { session, user } = temporaryUser;
      return json(
        {
          session,
          user,
          argyleUserId,
          argyleUserToken
        },
        { status: 200 }
      );
    }
    console.error('Failed to create new Argyle user', data);
    throw new Error('Failed to create new Argyle user');
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
};
