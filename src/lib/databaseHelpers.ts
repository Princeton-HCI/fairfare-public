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

/**
 * Resolve a System user from their login phone (digits-only canonical form).
 * Organizer, researcher and whitelist flows all identify people by phone, so
 * this is the one place that knows the lookup lives on `profiles`.
 */
export const findUserIdByPhone = async (
  supabase: SupabaseClient,
  phone: string
): Promise<string | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('phone', phone)
    .maybeSingle();
  // A failed lookup is not "no such user": swallowing it makes callers create a
  // duplicate account, or silently skip sending an OTP, with nothing logged.
  if (error) {
    console.error('Failed to resolve user by phone', error);
  }
  return data?.user_id ?? null;
};

/**
 * Resolve a user from the email on their *auth* user. `auth.users.email` is the
 * login identity for the email + password flows (admins, researchers), and
 * `profiles.email` only mirrors it, so the auth table is the one to trust here.
 *
 * Requires a service-role client (it reads the auth admin API).
 */
export const findAuthUserIdByEmail = async (
  supabase: SupabaseClient,
  email: string
): Promise<string | null> => {
  const normalized = email.trim().toLowerCase();
  const perPage = 500;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('Failed to list auth users while resolving an email', error);
      return null;
    }
    const match = data.users.find((user) => (user.email ?? '').toLowerCase() === normalized);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
};

/**
 * Profiles for a set of user ids, keyed by `user_id`. Membership and admin list
 * views all need the same "resolve these ids to people" step; `columns` is the
 * PostgREST select each view needs (always including `user_id`).
 */
export const profilesByUserId = async <T extends { user_id: string }>(
  supabase: SupabaseClient,
  userIds: string[],
  columns: string
): Promise<Map<string, T>> => {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase.from('profiles').select(columns).in('user_id', userIds);
  if (error) console.error('Error loading profiles by user id:', error);

  return new Map(((data ?? []) as unknown as T[]).map((row) => [row.user_id, row]));
};
