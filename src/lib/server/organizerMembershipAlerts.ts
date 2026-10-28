import type { SupabaseClient } from '@supabase/supabase-js';
import { userTypeLabel, type OrganizationRole } from '@src/lib/rbac';
import { sendOrganizerAccountCreatedAlert } from '@src/lib/email';

interface MembershipAlert {
  id: string;
  claim_token: string;
  phone: string;
  organization_key: string;
  role: OrganizationRole;
  source: 'signup' | 'team' | 'admin';
  /** Incremented by the claim RPC, so this is the number of the current attempt. */
  attempts: number;
}

/** Retries happen every five minutes, so this is roughly one hour of trying. */
export const MAX_ALERT_DELIVERY_ATTEMPTS = 12;

export interface ProcessAlertsResult {
  sent: number;
  failed: number;
  abandoned: number;
  /** Set when alerts are switched off because no recipients are configured. */
  disabled?: boolean;
}

/**
 * Alerts are opt-in: configuring at least one recipient in
 * `ORGANIZER_ALERT_EMAILS` is what turns the feature on.
 */
export function alertRecipientsConfigured(): boolean {
  return (process.env.ORGANIZER_ALERT_EMAILS ?? '').split(',').some((email) => email.trim());
}

/**
 * Process durable database events. Delivery is at least once, with leased
 * claims. An event that still fails on its `MAX_ALERT_DELIVERY_ATTEMPTS`th
 * attempt is marked abandoned so it stops being retried; it stays in the table
 * with `last_error` set for an operator to inspect.
 */
export async function processOrganizerMembershipAlerts(
  supabase: SupabaseClient
): Promise<ProcessAlertsResult> {
  // Deployments that want no alerts leave `ORGANIZER_ALERT_EMAILS` unset. That
  // is a configuration, not a failure, so report a clean no-op rather than an
  // error the scheduler would log every run. Events are left queued and
  // unclaimed, so adding recipients later delivers the backlog.
  if (!alertRecipientsConfigured()) {
    return { sent: 0, failed: 0, abandoned: 0, disabled: true };
  }
  const { data, error } = await supabase.rpc('claim_organizer_membership_alerts');
  if (error) throw error;

  const outcomes = await Promise.all(
    ((data ?? []) as MembershipAlert[]).map(
      async (alert): Promise<'sent' | 'failed' | 'abandoned'> => {
        let outcome: 'sent' | 'failed' | 'abandoned' = 'failed';
        try {
          await sendOrganizerAccountCreatedAlert({
            phone: alert.phone,
            organizationKey: alert.organization_key,
            role: userTypeLabel('organization', alert.role),
            source: alert.source
          });
          outcome = 'sent';
        } catch {
          // Avoid storing SMTP errors, which can contain credentials or recipient data.
          console.error('Organizer membership alert delivery failed', {
            alertId: alert.id,
            attempt: alert.attempts
          });
          if (alert.attempts >= MAX_ALERT_DELIVERY_ATTEMPTS) outcome = 'abandoned';
        }

        const now = new Date().toISOString();
        const patch =
          outcome === 'sent'
            ? { sent_at: now, claim_token: null, last_error: null }
            : outcome === 'abandoned'
              ? {
                  abandoned_at: now,
                  claim_token: null,
                  last_error: `Email delivery failed; abandoned after ${alert.attempts} attempts`
                }
              : {
                  available_at: new Date(Date.now() + 5 * 60_000).toISOString(),
                  claim_token: null,
                  last_error: 'Email delivery failed'
                };

        const { error: updateError } = await supabase
          .from('organizer_membership_alerts')
          .update(patch)
          .eq('id', alert.id)
          .eq('claim_token', alert.claim_token);
        // Leave the lease to expire if acknowledgement fails. Never lose the event.
        if (updateError) throw updateError;
        return outcome;
      }
    )
  );
  return {
    sent: outcomes.filter((o) => o === 'sent').length,
    failed: outcomes.filter((o) => o === 'failed').length,
    abandoned: outcomes.filter((o) => o === 'abandoned').length
  };
}
