import { error } from '@sveltejs/kit';
import short from 'short-uuid';
import { supabase as serverSupabase } from '@src/lib/server/db';
import { requireAdminPage } from '@src/lib/server/adminAuth';

interface OrgRef {
  key: string;
  name: string;
}
interface AffiliationRow {
  affiliate_organization_id: string;
  is_primary: boolean | null;
  created_at: string | null;
  affiliate_organizations: OrgRef | null;
}
interface ConsentRow {
  affiliate_organization_id: string;
  created_at: string | null;
  affiliate_organizations: OrgRef | null;
}

export async function load({ locals, params }) {
  await requireAdminPage(locals);

  let userId: string;
  try {
    userId = short().toUUID(params.driver_short_id);
  } catch {
    throw error(404, 'Driver not found');
  }

  const { data: profile, error: profileError } = await serverSupabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) console.error('Error loading driver profile:', profileError);
  if (!profile) throw error(404, 'Driver not found');

  const [{ data: affiliations }, { data: consents }, { data: argyleAccounts }] = await Promise.all([
    serverSupabase
      .from('driver_affiliate_organization_affiliations')
      .select(
        'affiliate_organization_id, is_primary, created_at, affiliate_organizations(key, name)'
      )
      .eq('user_id', userId),
    serverSupabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .select('affiliate_organization_id, created_at, affiliate_organizations(key, name)')
      .eq('user_id', userId),
    serverSupabase
      .from('argyle_accounts')
      .select(
        'id, employer, all_gigs_last_synced_at, all_gigs_last_sync_attempt_status, deleted_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
  ]);

  return {
    userId,
    profile,
    affiliations: (affiliations ?? []) as unknown as AffiliationRow[],
    consents: (consents ?? []) as unknown as ConsentRow[],
    argyleAccounts: argyleAccounts ?? []
  };
}
