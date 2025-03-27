import type { SupabaseClient } from '@supabase/supabase-js';

type Profile = SupabaseRows['profiles'];

export const getProfileFromUserId = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase.from('profiles').select('*').eq('user_id', userId);
  if (error) throw error;
  if (data.length > 1) throw new Error('More than one profile returned');
  if (data.length === 0) throw new Error('No profile returned');

  return data[0] as Profile;
};

export const updateProfileByUserId = async (
  supabase: SupabaseClient,
  userId: string,
  updateData: Partial<Profile>
) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('user_id', userId)
    .select('*');

  if (error) {
    throw error;
  }

  return data[0] as Profile;
};
