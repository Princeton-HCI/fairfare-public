import { createTestUserByEmail } from '@tests/utils/testUser';
import optOut from './optOut';
import { supabase } from './server/db';

describe('src/lib/optOut.spec.ts', () => {
  it("should delete the user's data", async () => {
    const user = await createTestUserByEmail('opt.out.delete.user.data@test.test');

    await optOut(user.id);

    const { data, error } = await supabase.auth.admin.deleteUser(user.id);

    expect(data).toStrictEqual({ user: null });

    expect(error).toBeDefined();
    expect(error?.message).toBe('User not found');

    // no teardown; the user is already deleted
  });

  it('should add a record to the opt_out_survey_responses table', async () => {
    // delete all records from the opt_out_survey_responses table
    const { error: deleteError } = await supabase
      .from('opt_out_survey_responses')
      .delete()
      .not('id', 'eq', '00000000-0000-0000-0000-000000000000');
    if (deleteError) throw deleteError;

    const user = await createTestUserByEmail(
      'opt.out.add.opt_out_survey_responses.record@test.test'
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
});
