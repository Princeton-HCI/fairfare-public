import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrganizationRole } from '@src/lib/rbac';
import type { Database } from '@src/lib/schema';

export async function upsertOrganizationMembership(
  supabase: SupabaseClient,
  params: {
    userId: string;
    organizationId: string;
    role?: OrganizationRole;
    createdBy?: string | null;
  }
): Promise<boolean> {
  const { data, error } = await supabase
    .from('organization_members')
    .upsert(
      {
        user_id: params.userId,
        organization_id: params.organizationId,
        role: params.role ?? 'organizer',
        created_by: params.createdBy ?? null
      },
      { onConflict: 'user_id, organization_id', ignoreDuplicates: true }
    )
    .select('user_id');
  if (error) throw error;
  // `ignoreDuplicates` means an existing member yields no row: they keep the
  // role they already have, and the caller learns nothing was created.
  return (data ?? []).length > 0;
}

/**
 * Login phones of `userIds`, read from the auth users. Organizers created
 * through the OTP flow have their phone only on the auth user, not on
 * `profiles`, so membership features have to look there.
 */
export async function authPhonesByUserId(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const phones = new Map<string, string>();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await supabase.auth.admin.getUserById(userId);
      if (data.user?.phone) phones.set(userId, data.user.phone);
    })
  );
  return phones;
}

export async function replaceDemoOrganizationMembership(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
) {
  const { error: deleteError } = await supabase
    .from('organization_members')
    .delete()
    .eq('user_id', userId);
  if (deleteError) throw deleteError;

  await upsertOrganizationMembership(supabase, { userId, organizationId });
}

export async function logOrganizerAction(
  supabase: SupabaseClient,
  params: {
    userId: string;
    action: Database['public']['Enums']['organizer_log_action'];
    additionalData?: Record<string, unknown>;
  }
) {
  const { error } = await supabase.from('organizer_logging').insert({
    id: randomUUID(),
    user_id: params.userId,
    action: params.action,
    additional_data: params.additionalData ?? null
  });
  if (error) {
    console.error('Failed to write organizer_logging', params.action, error);
  }
}
