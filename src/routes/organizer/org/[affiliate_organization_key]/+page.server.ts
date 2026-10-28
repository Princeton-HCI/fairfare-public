import { redirect } from '@sveltejs/kit';
import { requireCapability } from '@src/lib/server/rbac';
// Driver rows are read with the service-role client: RLS does not scope
// platform roles (a researcher has no membership), so every read below is
// scoped to the organization explicitly, in the app.
import { supabase } from '@src/lib/server/db';
import { getDrivers } from '../../utils';

export async function load({ params, locals }) {
  const { session, roles } = await locals.safeGetSession();

  if (session === null) {
    throw redirect(302, '/organizer/login');
  }

  const organizationKey = params.affiliate_organization_key;

  // The layout already required org:view_dashboard; driver rows additionally
  // require the PII capability.
  requireCapability(roles, 'org:view_driver_pii', organizationKey);

  // Use the organization's name directly (so it works even when there are 0 profiles)
  const { data: organization, error: orgError } = await supabase
    .from('affiliate_organizations')
    .select('id, name')
    .eq('key', organizationKey)
    .single();

  if (orgError || !organization) {
    console.error('Error fetching organization:', orgError);
    return { error: 'Organization not found' };
  }

  // Note: We use supabase here because the RLS policy on driver_affiliate_organization_affiliations
  // only allows users to see their own affiliations. Since we've already verified the organizer
  // has access to this organization above, it's safe to bypass RLS for this aggregate count.
  const { data, error } = await supabase
    .from('driver_affiliate_organization_affiliations')
    .select('affiliate_organizations!inner(key)') // using !inner ensures we only get rows where affiliate_organizations exists and matches organizationKey
    .eq('affiliate_organizations.key', organizationKey);

  if (error) {
    console.log('error', error);
    return { error };
  }
  if (!data) {
    return { error: 'No data' };
  }

  return {
    organizationName: organization!.name,
    totalDriversSignedUp: data.length,
    profiles: await getDrivers(supabase, session.user.id, organizationKey)
  };
}
