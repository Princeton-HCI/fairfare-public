import { redirect } from '@sveltejs/kit';
// Driver rows are read with the service-role client: RLS does not scope
// platform roles (a researcher has no membership), so every read below is
// scoped to the organization explicitly, in the app.
import { supabase } from '@src/lib/server/db';
import { requireCapability } from '@src/lib/server/rbac';
import { getDrivers } from '@src/routes/organizer/utils';

export async function load({ params, locals }) {
  const { session, roles } = await locals.safeGetSession();

  if (session === null) {
    throw redirect(302, '/organizer/login');
  }

  const organizationKey = params.affiliate_organization_key;
  // The layout already required org:view_dashboard; driver rows additionally
  // require the PII capability.
  requireCapability(roles, 'org:view_driver_pii', organizationKey);

  const { data, error } = await supabase
    .from('driver_affiliate_organization_affiliations')
    // `!inner` is what makes the embedded filter restrict the parent rows.
    // Without it PostgREST returns every affiliation with the embed nulled out,
    // so this count would be the platform-wide total rather than this org's.
    .select('affiliate_organizations!inner( key )')
    .eq('affiliate_organizations.key', organizationKey);

  if (error) {
    console.log('error', error);
    return { error };
  }
  if (!data) {
    return { error: 'No data' };
  }

  return {
    totalDriversSignedUp: data.length,
    profiles: await getDrivers(supabase, session.user.id, organizationKey)
  };
}
