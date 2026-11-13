import { supabase as serverSupabase } from '@src/lib/server/db';
import { requireAdminPage } from '@src/lib/server/adminAuth';
import { ilikePattern, parseListParams } from '@src/lib/server/adminListParams';
import { hasCapability } from '@src/lib/rbac';
import { organizationForAdminPage } from '@src/lib/server/adminOrganization';

const ALLOWED_SORTS = ['created_at', 'name', 'key', 'status'] as const;

export async function load({ locals, url }) {
  const admin = await requireAdminPage(locals);
  const canManage = hasCapability(admin.roles, 'platform:manage_orgs');

  const params = parseListParams(url, {
    allowedSorts: ALLOWED_SORTS,
    defaultSort: 'created_at'
  });
  const statusFilter = url.searchParams.get('status') ?? 'all';

  let query = serverSupabase
    .from('affiliate_organizations')
    .select('id, key, name, url, status, signup_code, driver_signup_code, created_at', {
      count: 'exact'
    });

  if (statusFilter === 'active' || statusFilter === 'deleted') {
    query = query.eq('status', statusFilter);
  }

  if (params.q) {
    const pattern = ilikePattern(params.q);
    query = query.or(`name.ilike.${pattern},key.ilike.${pattern}`);
  }

  query = query
    .order(params.sort, { ascending: params.dir === 'asc' })
    .range(params.rangeFrom, params.rangeTo);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error loading organizations:', error);
  }

  return {
    organizations: (data ?? []).map((organization) =>
      organizationForAdminPage(organization, canManage)
    ),
    total: count ?? 0,
    params,
    statusFilter
  };
}
