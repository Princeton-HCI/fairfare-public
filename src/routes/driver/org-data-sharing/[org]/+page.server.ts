import { error, redirect } from '@sveltejs/kit';
import { supabase } from '@src/lib/server/db';
import {
  getOrganizationByKey,
  getPrimaryOrganizationForUser
} from '@src/lib/server/organizationArgyle';

export const load = async ({ params, locals: { safeGetSession } }) => {
  const { user, session } = await safeGetSession();
  if (!user || !session) {
    throw redirect(302, `/driver/landing?org=${params.org}`);
  }

  const orgKey = params.org;
  const organization = await getOrganizationByKey(orgKey);
  if (!organization || organization.status !== 'active') {
    throw error(404, 'Organization not found');
  }

  const primary = await getPrimaryOrganizationForUser(user.id);

  const { count: activeArgyleAccountCount, error: countError } = await supabase
    .from('argyle_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('deleted_at', null);

  if (countError) {
    console.error('Error counting argyle_accounts on org-data-sharing load:', countError);
  }

  return {
    organization: { key: organization.key, name: organization.name },
    requiresSignupCode: !!organization.driver_signup_code,
    primaryAffiliation: primary ? { key: primary.key, name: primary.name } : null,
    hasArgyleAccounts: (activeArgyleAccountCount ?? 0) > 0
  };
};
