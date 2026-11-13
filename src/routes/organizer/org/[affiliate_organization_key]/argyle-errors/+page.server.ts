import { error, redirect } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { requireCapability } from '@src/lib/server/rbac';

/**
 * Argyle accounts in an error state that belong to this organization's drivers,
 * from public.argyle_error_accounts (filled by a CSV upload).
 *
 * The table is service-role only, so this load is the access check: it shows
 * driver contact details, so it needs `org:view_driver_pii` for this org.
 */
export const load = async ({ params, locals: { safeGetSession } }) => {
  const { user, session, roles } = await safeGetSession();
  if (!user || !session) {
    throw redirect(302, '/organizer/login');
  }

  const organizationKey = params.affiliate_organization_key;
  requireCapability(roles, 'org:view_driver_pii', organizationKey);

  const { data: organization, error: organizationError } = await supabase
    .from('affiliate_organizations')
    .select('key, name')
    .eq('key', organizationKey)
    .single();

  if (organizationError || !organization) {
    console.error('Error fetching organization:', organizationError);
    throw error(404, 'Organization not found');
  }

  // The uploaded CSV may name the organization by its name or its key.
  const { data: accounts, error: accountsError } = await supabase
    .from('argyle_error_accounts')
    .select(
      'id, first_name, last_initial, email, phone, employer, status, error_code, argyle_updated_at'
    )
    .in('affiliate_organization', [organization.name, organization.key])
    .order('argyle_updated_at', { ascending: false, nullsFirst: false });

  if (accountsError) {
    console.error('Error fetching Argyle error accounts:', accountsError);
    throw error(500, 'Could not load accounts with errors');
  }

  return {
    organization,
    accounts: accounts ?? []
  };
};
