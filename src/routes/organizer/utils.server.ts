import type { SupabaseClient } from '@supabase/supabase-js';
import { hasCapability, type AuthContext } from '@src/lib/rbac';

/** The 403 body every analysis endpoint returns for an out-of-scope request. */
export const ANALYSIS_SCOPE_DENIED = 'You do not have access to this organization';

/**
 * Gate `selectedScope` (an org key or `'all'`).
 *
 * `mode` is `view` for stats and `export` for anything that hands back
 * individual workers' rows (CSV downloads, async exports, raw activity pages).
 * Researchers can view every organization but never export.
 *
 * Callers that pass run their queries on the service-role client, because the
 * policy-analysis RPCs are revoked from `authenticated`.
 */
export function canAccessAnalysisScope(
  roles: AuthContext,
  selectedScope: string,
  mode: 'view' | 'export' = 'view'
): boolean {
  if (selectedScope === 'all') {
    return hasCapability(
      roles,
      mode === 'export' ? 'platform:export_cross_org_data' : 'platform:view_cross_org_aggregates'
    );
  }

  return hasCapability(
    roles,
    mode === 'export' ? 'org:export_driver_data' : 'org:view_dashboard',
    selectedScope
  );
}

/**
 * Confirms a driver has consented to share data with `organizationKey`.
 *
 * Driver-scoped analysis endpoints run their queries on the service-role
 * client (the policy-analysis RPCs are revoked from `authenticated`), so RLS
 * is not there to scope `driverUserId` for us — it has to be checked here.
 */
export async function driverBelongsToOrganization(
  supabase: SupabaseClient,
  driverUserId: string,
  organizationKey: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('driver_affiliate_organization_data_sharing_consents')
    .select('user_id, affiliate_organizations!inner(key)')
    .eq('user_id', driverUserId)
    .eq('affiliate_organizations.key', organizationKey)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to verify driver organization membership', error);
    return false;
  }
  return data !== null;
}
