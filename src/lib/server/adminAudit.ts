import { supabase as serverSupabase } from '@src/lib/server/db';
import type { Json } from '@src/lib/schema';
import type { AdminContext } from '@src/lib/server/adminAuth';

export interface AdminActionLog {
  /** Free-form action key, e.g. 'organization.create', 'driver.delete'. */
  action: string;
  /** Entity kind affected, e.g. 'organization' | 'organizer' | 'driver' | 'config'. */
  targetType?: string | null;
  /** Id/key of the affected entity. */
  targetId?: string | null;
  /** Arbitrary structured context (before/after, reason, etc.). */
  metadata?: Json | null;
}

/**
 * Append a row to the admin audit trail. Best-effort: failures are logged but
 * never thrown, so audit logging can't roll back or block the primary mutation
 * (mirrors the email-failure tolerance in optOut).
 *
 * The acting admin comes from the guard's `AdminContext` rather than from the
 * entry, so a handler cannot attribute an action to the wrong identity.
 */
export async function logAdminAction(admin: AdminContext, entry: AdminActionLog): Promise<void> {
  try {
    const { error } = await serverSupabase.from('admin_activity_log').insert({
      admin_user_id: admin.user.id,
      admin_email: admin.email,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      metadata: entry.metadata ?? null
    });

    if (error) {
      console.error('Failed to write admin_activity_log entry', entry.action, error);
    }
  } catch (err) {
    console.error('Unexpected error writing admin_activity_log entry', entry.action, err);
  }
}
