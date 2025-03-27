import optOut from '@src/lib/optOut';

export const POST = async ({ locals: { safeGetSession } }) => {
  const { user } = await safeGetSession();

  if (!user) return new Response('No user found', { status: 401 });

  let optOutSurveyId;
  try {
    optOutSurveyId = await optOut(user.id);
  } catch (e) {
    console.error('Error deleting user:', e);
    return new Response('Error deleting user', { status: 500 });
  }

  return new Response(JSON.stringify({ optOutSurveyId: optOutSurveyId }), { status: 200 });
};
