import { error } from '@sveltejs/kit';
import { supabase as serverSupabase } from '@src/lib/server/db';
import { requireAdminPage } from '@src/lib/server/adminAuth';
import {
  getOrganizationArgyleCapacity,
  resolveArgyleCredentials
} from '@src/lib/server/organizationArgyle';
import { hasCapability } from '@src/lib/rbac';
import { organizationForAdminPage } from '@src/lib/server/adminOrganization';

async function countFor(table: string, organizationId: string): Promise<number> {
  const { count } = await serverSupabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('affiliate_organization_id', organizationId);
  return count ?? 0;
}

export async function load({ locals, params }) {
  const admin = await requireAdminPage(locals);
  const canManage = hasCapability(admin.roles, 'platform:manage_orgs');

  const { data: org, error: orgError } = await serverSupabase
    .from('affiliate_organizations')
    .select('id, key, name, url, status, signup_code, driver_signup_code, created_at, updated_at')
    .eq('key', params.organization_key)
    .maybeSingle();

  if (orgError) console.error('Error loading organization:', orgError);
  if (!org) throw error(404, 'Organization not found');

  // Resolve Argyle config but expose ONLY non-secret fields to the client, and
  // the identifying ones (key id, flow id, link URL, limit) only to platform
  // admins: Argyle settings are out of scope for researchers.
  const [creds, driverCount, organizerCount, consentCount] = await Promise.all([
    resolveArgyleCredentials({ by: 'org', organizationId: org.id }),
    countFor('driver_affiliate_organization_affiliations', org.id),
    countFor('organizer_affiliate_organization_affiliations', org.id),
    countFor('driver_affiliate_organization_data_sharing_consents', org.id)
  ]);
  const capacity = await getOrganizationArgyleCapacity(creds);

  const argyle: {
    hasCredentials: boolean;
    isActive: boolean;
    apiKeyId?: string;
    flowId?: string | null;
    linkUrl?: string;
    maxArgyleAccounts?: number | null;
  } = creds
    ? {
        hasCredentials: true,
        isActive: creds.isActive,
        ...(canManage
          ? {
              apiKeyId: creds.apiKeyId,
              flowId: creds.flowId,
              linkUrl: creds.linkUrl,
              maxArgyleAccounts: creds.maxArgyleAccounts
            }
          : {})
      }
    : { hasCredentials: false, isActive: false };

  return {
    organization: organizationForAdminPage(org, canManage),
    argyle,
    capacity,
    counts: { driverCount, organizerCount, consentCount }
  };
}
