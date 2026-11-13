import { supabase as serverSupabase } from '@src/lib/server/db';
import { profilesByUserId } from '@src/lib/databaseHelpers';
import { requireAdminPage } from '@src/lib/server/adminAuth';
import { ilikePattern, parseListParams } from '@src/lib/server/adminListParams';
import type { OrganizationRole } from '@src/lib/rbac';

const ALLOWED_SORTS = ['created_at', 'phone_number'] as const;

interface WhitelistRow {
  phone_number: string;
  affiliate_organization_id: string;
  invited_role: OrganizationRole;
  created_at: string | null;
  affiliate_organizations: { key: string; name: string } | null;
}

interface AffiliationRow {
  user_id: string;
  organization_id: string;
  role: OrganizationRole;
  created_at: string | null;
  affiliate_organizations: { key: string; name: string } | null;
  profiles: {
    first_name: string | null;
    last_initial: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

export async function load({ locals, url }) {
  await requireAdminPage(locals);

  const params = parseListParams(url, {
    allowedSorts: ALLOWED_SORTS,
    defaultSort: 'created_at'
  });

  // Whitelist (paginated, primary table).
  let whitelistQuery = serverSupabase
    .from('organizer_affiliations_phone_whitelist')
    .select(
      'phone_number, affiliate_organization_id, invited_role, created_at, affiliate_organizations(key, name)',
      {
        count: 'exact'
      }
    );

  if (params.q) {
    whitelistQuery = whitelistQuery.ilike('phone_number', ilikePattern(params.q));
  }

  whitelistQuery = whitelistQuery
    .order(params.sort, { ascending: params.dir === 'asc' })
    .range(params.rangeFrom, params.rangeTo);

  // Affiliations (secondary, capped) joined with org. There is no FK from this
  // table to `profiles` (both reference auth.users), so PostgREST can't embed
  // profiles — fetch them separately and merge by user_id.
  const [
    { data: whitelist, count, error: wlError },
    { data: rawAffiliations, error: affError },
    { data: orgs }
  ] = await Promise.all([
    whitelistQuery,
    serverSupabase
      .from('organization_members')
      .select('user_id, organization_id, role, created_at, affiliate_organizations(key, name)')
      .order('created_at', { ascending: false })
      .limit(200),
    // Active orgs for the add-whitelist select.
    serverSupabase
      .from('affiliate_organizations')
      .select('id, key, name')
      .eq('status', 'active')
      .order('name', { ascending: true })
  ]);
  if (wlError) console.error('Error loading whitelist:', wlError);
  if (affError) console.error('Error loading organizer affiliations:', affError);

  const affRows = (rawAffiliations ?? []) as unknown as Omit<AffiliationRow, 'profiles'>[];
  const userIds = [...new Set(affRows.map((a) => a.user_id))];

  const profileByUserId = await profilesByUserId<
    { user_id: string } & NonNullable<AffiliationRow['profiles']>
  >(serverSupabase, userIds, 'user_id, first_name, last_initial, phone, email');

  const affiliations: AffiliationRow[] = affRows.map((a) => ({
    ...a,
    profiles: profileByUserId.get(a.user_id) ?? null
  }));

  return {
    whitelist: (whitelist ?? []) as unknown as WhitelistRow[],
    total: count ?? 0,
    params,
    affiliations,
    orgs: orgs ?? []
  };
}
