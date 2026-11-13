import short from 'short-uuid';
import { supabase as serverSupabase } from '@src/lib/server/db';
import { requireAdminPage } from '@src/lib/server/adminAuth';
import { ilikePattern, parseListParams } from '@src/lib/server/adminListParams';
import { notInFilter, staffUserIds } from '@src/lib/server/staffUsers';
import type { ProfileWithDetails } from '@src/routes/organizer/utils';

const ALLOWED_SORTS = ['last_sign_in_at', 'first_name'] as const;

export async function load({ locals, url }) {
  await requireAdminPage(locals);

  const params = parseListParams(url, {
    allowedSorts: ALLOWED_SORTS,
    defaultSort: 'last_sign_in_at'
  });

  // Cross-org: no consent/org filter. Left joins so drivers without consents
  // or accounts still appear. Staff accounts (organizers, researchers, admins)
  // also have profiles, so exclude them: this page is about workers.
  const staff = await staffUserIds(serverSupabase);

  let query = serverSupabase.from('profiles').select(
    `
      *,
      argyle_accounts(all_gigs_last_synced_at),
      driver_affiliate_organization_data_sharing_consents(
        created_at,
        affiliate_organization:affiliate_organizations(name, key)
      )
    `,
    { count: 'exact' }
  );

  if (staff.length > 0) {
    query = query.not('user_id', 'in', notInFilter(staff));
  }

  if (params.q) {
    const pattern = ilikePattern(params.q);
    query = query.or(
      `first_name.ilike.${pattern},last_initial.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`
    );
  }

  query = query
    .order(params.sort, { ascending: params.dir === 'asc', nullsFirst: false })
    .range(params.rangeFrom, params.rangeTo);

  const { data, count, error } = await query.returns<ProfileWithDetails[]>();
  if (error) console.error('Error loading drivers:', error);

  const translator = short();
  const drivers = (data ?? []).map((profile) => ({
    profile,
    shortId: translator.fromUUID(profile.user_id)
  }));

  return {
    drivers,
    total: count ?? 0,
    params
  };
}
