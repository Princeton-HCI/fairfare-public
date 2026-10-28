import { supabase } from '@src/lib/server/db';
import { decrypt } from '@src/lib/server/encryption';

export type OrganizationArgyleConfigRow = SupabaseRows['organization_argyle_configs'];
export type AffiliateOrganizationRow = SupabaseRows['affiliate_organizations'];

export interface ResolvedArgyleCredentials {
  apiKeyId: string;
  apiKeySecret: string;
  linkUrl: string;
  flowId: string | null;
  organizationId: string;
  organizationKey: string;
  webhookSecret: string;
  webhookSubscriptionId: string | null;
  isActive: boolean;
  maxArgyleAccounts: number | null;
}

type Lookup =
  | { by: 'user'; userId: string }
  | { by: 'account'; argyleAccount: string }
  | { by: 'argyleUser'; argyleUser: string }
  | { by: 'org'; organizationId: string }
  | { by: 'orgKey'; organizationKey: string };

const CONFIG_WITH_ORG_SELECT = `
  *,
  affiliate_organizations!inner (
    id,
    key,
    name
  )
`;

type ConfigWithOrg = OrganizationArgyleConfigRow & {
  affiliate_organizations: Pick<AffiliateOrganizationRow, 'id' | 'key' | 'name'>;
};

const buildResolved = (config: ConfigWithOrg): ResolvedArgyleCredentials => {
  const orgId = config.organization_id;
  return {
    apiKeyId: config.api_key_id,
    apiKeySecret: decrypt(config.api_key_secret, orgId),
    webhookSecret: decrypt(config.webhook_secret, orgId),
    linkUrl: config.link_url,
    flowId: config.flow_id,
    organizationId: orgId,
    organizationKey: config.affiliate_organizations.key,
    webhookSubscriptionId: config.argyle_webhook_subscription_id,
    isActive: config.is_active,
    maxArgyleAccounts: config.max_argyle_accounts
  };
};

const fetchConfigByOrganizationId = async (
  organizationId: string
): Promise<ConfigWithOrg | null> => {
  const { data, error } = await supabase
    .from('organization_argyle_configs')
    .select(CONFIG_WITH_ORG_SELECT)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ConfigWithOrg | null) ?? null;
};

const fetchConfigByOrganizationKey = async (
  organizationKey: string
): Promise<ConfigWithOrg | null> => {
  const { data, error } = await supabase
    .from('organization_argyle_configs')
    .select(CONFIG_WITH_ORG_SELECT)
    .eq('affiliate_organizations.key', organizationKey)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ConfigWithOrg | null) ?? null;
};

const lookupOrgIdForUser = async (userId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('driver_affiliate_organization_affiliations')
    .select('affiliate_organization_id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();
  if (error) throw error;
  return data?.affiliate_organization_id ?? null;
};

const lookupOrgIdForAccount = async (argyleAccount: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('argyle_accounts')
    .select('organization_id')
    .eq('argyle_account', argyleAccount)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.organization_id ?? null;
};

const lookupOrgIdForArgyleUser = async (argyleUser: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('argyle_accounts')
    .select('organization_id')
    .eq('argyle_user', argyleUser)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.organization_id ?? null;
};

export const resolveArgyleCredentials = async (
  lookup: Lookup
): Promise<ResolvedArgyleCredentials | null> => {
  let orgId: string | null;
  let config: ConfigWithOrg | null = null;

  switch (lookup.by) {
    case 'user':
      orgId = await lookupOrgIdForUser(lookup.userId);
      if (!orgId) return null;
      config = await fetchConfigByOrganizationId(orgId);
      break;
    case 'account':
      orgId = await lookupOrgIdForAccount(lookup.argyleAccount);
      if (!orgId) return null;
      config = await fetchConfigByOrganizationId(orgId);
      break;
    case 'argyleUser':
      orgId = await lookupOrgIdForArgyleUser(lookup.argyleUser);
      if (!orgId) return null;
      config = await fetchConfigByOrganizationId(orgId);
      break;
    case 'org':
      config = await fetchConfigByOrganizationId(lookup.organizationId);
      break;
    case 'orgKey':
      config = await fetchConfigByOrganizationKey(lookup.organizationKey);
      break;
  }

  return config ? buildResolved(config) : null;
};

export const getOrganizationByKey = async (organizationKey: string) => {
  const { data, error } = await supabase
    .from('affiliate_organizations')
    .select('id, key, name, status, driver_signup_code')
    .eq('key', organizationKey)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const getPrimaryOrganizationForUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('driver_affiliate_organization_affiliations')
    .select(
      `affiliate_organizations!inner (
        id, key, name, status, driver_signup_code
      )`
    )
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data.affiliate_organizations as unknown as {
    id: string;
    key: string;
    name: string;
    status: SupabaseRows['affiliate_organizations']['status'];
    driver_signup_code: string | null;
  };
};

/**
 * How much of an organization's Argyle account allowance is used. Takes the
 * already-resolved credentials rather than re-reading the config row: both
 * callers have resolved them a few lines earlier.
 */
export const getOrganizationArgyleCapacity = async (
  credentials: ResolvedArgyleCredentials | null
) => {
  if (!credentials) {
    return { maxArgyleAccounts: null, currentCount: null, isActive: false };
  }

  const { count, error } = await supabase
    .from('argyle_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', credentials.organizationId)
    .is('deleted_at', null);

  if (error) throw error;

  return {
    maxArgyleAccounts: credentials.maxArgyleAccounts,
    currentCount: count ?? 0,
    isActive: credentials.isActive
  };
};
