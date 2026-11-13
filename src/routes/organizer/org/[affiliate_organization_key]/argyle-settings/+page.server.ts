import { error, redirect } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import { resolveArgyleCredentials } from '@src/lib/server/organizationArgyle';
import { requireCapability } from '@src/lib/server/rbac';
import { getPrimaryAffiliatedDrivers } from '@src/routes/organizer/utils';

export const load = async ({ params, locals: { safeGetSession } }) => {
  const { user, session, roles } = await safeGetSession();
  if (!user || !session) {
    throw redirect(302, '/organizer/login');
  }

  const organizationKey = params.affiliate_organization_key;
  requireCapability(roles, 'org:manage_argyle_settings', organizationKey);

  const { data: organization, error: organizationError } = await supabase
    .from('affiliate_organizations')
    .select('id, key, name, driver_signup_code')
    .eq('key', organizationKey)
    .single();

  if (organizationError || !organization) {
    console.error('Error fetching organization:', organizationError);
    throw error(404, 'Organization not found');
  }

  // Use the same resolver as runtime code so we exercise the per-row AAD
  // decryption path in tests + dev — but only export non-secret fields to
  // the client.
  const [credentials, { count: currentArgyleAccountCount, error: countError }, sharingDrivers] =
    await Promise.all([
      resolveArgyleCredentials({
        by: 'org',
        organizationId: organization.id
      }),
      supabase
        .from('argyle_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organization.id)
        .is('deleted_at', null),
      getPrimaryAffiliatedDrivers(supabase, organization.id)
    ]);

  if (countError) {
    console.error('Error counting Argyle accounts:', countError);
  }

  return {
    organization: {
      id: organization.id,
      key: organization.key,
      name: organization.name
    },
    driverSignupCode: organization.driver_signup_code ?? '',
    requiresSignupCode: !!organization.driver_signup_code,
    currentArgyleAccountCount: currentArgyleAccountCount ?? 0,
    argyleConfig: credentials
      ? {
          apiKeyId: credentials.apiKeyId,
          flowId: credentials.flowId,
          maxArgyleAccounts: credentials.maxArgyleAccounts,
          isActive: credentials.isActive,
          hasCredentials: true,
          hasWebhookSubscription: !!credentials.webhookSubscriptionId
        }
      : null,
    sharingDrivers
  };
};
