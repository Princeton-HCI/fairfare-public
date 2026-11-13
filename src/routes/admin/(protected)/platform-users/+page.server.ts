import { supabase as serverSupabase } from '@src/lib/server/db';
import { profilesByUserId } from '@src/lib/databaseHelpers';
import { requireAdminPage } from '@src/lib/server/adminAuth';
import { ASSIGNABLE_PLATFORM_ROLES, type PlatformRole } from '@src/lib/rbac';

export interface PlatformUserRow {
  user_id: string;
  role: PlatformRole;
  created_at: string | null;
  membershipCount: number;
  profile: {
    first_name: string | null;
    last_initial: string | null;
    email: string | null;
    last_sign_in_at: string | null;
  } | null;
}

export async function load({ locals }) {
  const admin = await requireAdminPage(locals);

  const { data: roleRows, error: roleError } = await serverSupabase
    .from('user_roles')
    .select('user_id, role, created_at')
    .in('role', [...ASSIGNABLE_PLATFORM_ROLES])
    .order('created_at', { ascending: true });
  if (roleError) console.error('Error loading platform users:', roleError);

  const rows = roleRows ?? [];
  const userIds = rows.map((r) => r.user_id);

  const membershipCountByUserId = new Map<string, number>();

  const [profileByUserId, { data: memberships, error: memberError }] = await Promise.all([
    profilesByUserId<{ user_id: string } & NonNullable<PlatformUserRow['profile']>>(
      serverSupabase,
      userIds,
      'user_id, first_name, last_initial, email, last_sign_in_at'
    ),
    userIds.length > 0
      ? serverSupabase.from('organization_members').select('user_id').in('user_id', userIds)
      : { data: [], error: null }
  ]);
  if (memberError) console.error('Error loading platform user memberships:', memberError);

  for (const m of memberships ?? []) {
    membershipCountByUserId.set(m.user_id, (membershipCountByUserId.get(m.user_id) ?? 0) + 1);
  }

  const users: PlatformUserRow[] = rows.map((r) => ({
    user_id: r.user_id,
    role: r.role as PlatformRole,
    created_at: r.created_at,
    membershipCount: membershipCountByUserId.get(r.user_id) ?? 0,
    profile: profileByUserId.get(r.user_id) ?? null
  }));

  // The page hides the actions on the signed-in admin's own row; the endpoints
  // refuse them anyway, so this only keeps a misclick from producing a toast.
  return { users, currentUserId: admin.user.id };
}
