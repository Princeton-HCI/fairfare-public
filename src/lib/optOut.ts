import { supabase } from '@src/lib/server/db';

const optOut = async (userId: string) => {
  /**
   * Deletes a user's data and account from the database for when they opt out.
   *
   * @param userId - The user's id.
   * @returns The id of the new opt_out_survey_responses record.
   */

  // delete user
  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteUserError) throw deleteUserError;

  // write to the opt_out table
  const { data: optOutSurveyData, error: optOutError } = await supabase
    .from('opt_out_survey_responses')
    .insert({})
    .select()
    .single();

  if (optOutError) throw optOutError;
  if (!optOutSurveyData) throw new Error('optOutSurveyData is undefined');

  return optOutSurveyData.id;
};

export default optOut;
