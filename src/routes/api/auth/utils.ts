import { supabase } from '@src/lib/server/db';

const getUserPhoneNumberFromId = async (userId: string) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('phone')
    .eq('user_id', userId);

  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error('No user meta data found');

  return profile[0].phone;
};

export { getUserPhoneNumberFromId };
