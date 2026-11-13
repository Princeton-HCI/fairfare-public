/**
 * Independent recomputation of the two counts on the organizer dashboard.
 *
 * The spec used to assert the literals 25 and 4, which held only because of what
 * *other* files seeded: 24 drivers from makeOrganizersSeeds plus exactly one
 * from tests/seeds/rbacSeeds, and nothing else in the suite affiliating a driver
 * with DU. That made an unrelated change to another spec able to fail this one,
 * and it is why tests/affiliationAndDataSharing.spec.ts carries a comment about
 * which organization it may use.
 *
 * Deriving the numbers instead keeps the assertion honest about what the page is
 * responsible for — rendering the organization's real totals — without pinning
 * it to a number some other file has to keep true. `minimumSharedDrivers` guards
 * the obvious regression a derived number would otherwise hide: a broken query
 * returning nothing, matching a page that renders nothing.
 */

import { createPlaywrightSupabaseClient } from './playwrightSupabase';

export type OrganizationCounts = {
  /** Drivers who shared data *and* have a synced identity. */
  sharedData: number;
  /** Drivers affiliated with the organization who never linked an account. */
  notLinked: number;
};

export async function getExpectedOrgCounts(
  organizationKey: string,
  viewerUserId: string
): Promise<OrganizationCounts> {
  const supabase = createPlaywrightSupabaseClient();

  // Consenting drivers with a synced identity, excluding the viewer themself —
  // the dashboard drops profiles missing a name or phone, because those are
  // the ones whose Argyle identity has not come back yet.
  const { data: consenting, error: consentingError } = await supabase
    .from('profiles')
    .select(
      `user_id, first_name, last_initial, phone,
       driver_affiliate_organization_data_sharing_consents!inner(
         affiliate_organizations!inner(key)
       )`
    )
    .eq(
      'driver_affiliate_organization_data_sharing_consents.affiliate_organizations.key',
      organizationKey
    );
  if (consentingError) throw consentingError;

  const sharedData = (consenting ?? []).filter(
    (profile) =>
      profile.user_id !== viewerUserId &&
      profile.first_name &&
      profile.last_initial &&
      profile.phone
  ).length;

  // Everyone affiliated with the organization, linked or not.
  const { count: affiliated, error: affiliatedError } = await supabase
    .from('driver_affiliate_organization_affiliations')
    .select('affiliate_organizations!inner(key)', { count: 'exact', head: true })
    .eq('affiliate_organizations.key', organizationKey);
  if (affiliatedError) throw affiliatedError;

  return { sharedData, notLinked: (affiliated ?? 0) - sharedData };
}

/** Resolves the user id behind a phone number, for the viewer exclusion above. */
export async function getUserIdByPhone(phone: string): Promise<string | undefined> {
  const supabase = createPlaywrightSupabaseClient();
  const normalized = phone.replace(/\D/g, '');

  let page = 1;
  const perPage = 500;
  for (;;) {
    const {
      data: { users }
    } = await supabase.auth.admin.listUsers({ page, perPage });
    const match = users.find((user) => user.phone?.replace(/\D/g, '') === normalized);
    if (match) return match.id;
    if (users.length < perPage) return undefined;
    page++;
  }
}
