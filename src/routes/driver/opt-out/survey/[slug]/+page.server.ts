import { redirect } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';

import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request }) => {
    const data = await request.formData();

    const survey_left_reason = data.get('survey_left_reason') as string;
    const survey_comments = data.get('survey_comments') as string;
    const id = data.get('id') as string;

    const { error } = await supabase.from('opt_out_survey_responses').upsert({
      id,
      survey_left_reason,
      survey_comments
    });

    if (error) {
      console.log(error);
      throw error;
    }

    throw redirect(303, '/');
  }
};
