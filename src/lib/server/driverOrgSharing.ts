import {
  SYSTEM_VIRTUAL_PRIMARY_KEY,
  SYSTEM_VIRTUAL_PRIMARY_NAME
} from '@src/lib/affiliationConstants';
import { getProfileFromUserId } from '@src/lib/databaseHelpers';
import { sendOptOutEmailToAffiliateOrganization } from '@src/lib/email';
import { HttpError } from '@src/lib/server/apiErrors';
import { deleteArgyleAccount, deleteArgyleUser } from '@src/lib/server/argyleAdmin';
import { getGlobalArgyleCredentials } from '@src/lib/server/argyle';
import {
  getOrganizationByKey,
  getPrimaryOrganizationForUser,
  resolveArgyleCredentials,
  type ResolvedArgyleCredentials
} from '@src/lib/server/organizationArgyle';
import { verifySignupCode } from '@src/lib/server/signupCode';
import { supabase } from '@src/lib/server/db';
import { isDemoMode } from '@src/lib/utils';

export class DriverOrgSharingError extends HttpError {
  constructor(message: string, status = 400) {
    super(message, status);
    this.name = 'DriverOrgSharingError';
  }
}

type StopSharingScope =
  | { kind: 'organization'; affiliationKey: string }
  | { kind: 'virtual-primary' };

type OrgRow = {
  id: string;
  key: string;
  name: string;
  status: SupabaseRows['affiliate_organizations']['status'];
  driver_signup_code: string | null;
};

type OrgContact = {
  name: string;
  data_deletion_contact_email: string | null;
};

export const createAffiliation = async (
  userId: string,
  orgKey: string,
  options: { isPrimary: boolean; signupCode?: string; ipAddress?: string }
) => {
  const target = await getActiveOrganizationOrThrow(orgKey);

  if (options.isPrimary) {
    const existingPrimary = await getPrimaryOrganizationForUser(userId);
    if (existingPrimary && existingPrimary.id !== target.id) {
      throw new DriverOrgSharingError(
        `You already have a primary organization (${existingPrimary.name}). Stop sharing before choosing a new one.`,
        409
      );
    }
  } else {
    const existingPrimary = await getPrimaryOrganizationForUser(userId);
    if (!existingPrimary) {
      throw new DriverOrgSharingError(
        'You must have a primary organization before adding secondary affiliations',
        400
      );
    }
    if (existingPrimary.id === target.id) {
      throw new DriverOrgSharingError('Already affiliated with this organization as primary', 409);
    }
  }

  await ensureNotAlreadyAffiliatedOrThrow(userId, target.id);
  await validateSignupCodeOrThrow(target, options.signupCode, options.ipAddress);
  await insertAffiliationAndConsent(userId, target.id, options.isPrimary);

  return { success: true as const };
};

const getActiveOrganizationOrThrow = async (organizationKey: string): Promise<OrgRow> => {
  const organization = await getOrganizationByKey(organizationKey);
  if (!organization || organization.status !== 'active') {
    throw new DriverOrgSharingError('Organization not found', 404);
  }
  return organization;
};

const validateSignupCodeOrThrow = async (
  organization: OrgRow,
  suppliedCode: string | undefined,
  ipAddress: string | undefined
) => {
  if (!organization.driver_signup_code) return;
  const result = await verifySignupCode(
    organization.id,
    organization.driver_signup_code,
    suppliedCode,
    ipAddress ?? 'unknown'
  );
  if (result.ok) return;
  if (result.reason === 'rate_limited') {
    throw new DriverOrgSharingError(
      'Too many failed attempts. Please try again in 10 minutes.',
      429
    );
  }
  throw new DriverOrgSharingError('Invalid signup code', 403);
};

const ensureNotAlreadyAffiliatedOrThrow = async (userId: string, organizationId: string) => {
  const { data, error } = await supabase
    .from('driver_affiliate_organization_affiliations')
    .select('affiliate_organization_id')
    .eq('user_id', userId)
    .eq('affiliate_organization_id', organizationId)
    .maybeSingle();
  if (error) {
    console.error('Error checking existing affiliation:', error);
    throw new DriverOrgSharingError('Failed to validate affiliation', 500);
  }
  if (data) {
    throw new DriverOrgSharingError('Already affiliated with this organization', 409);
  }
};

const insertAffiliationAndConsent = async (
  userId: string,
  organizationId: string,
  isPrimary: boolean
) => {
  const { error: affiliationError } = await supabase
    .from('driver_affiliate_organization_affiliations')
    .insert({
      user_id: userId,
      affiliate_organization_id: organizationId,
      is_primary: isPrimary
    });

  if (affiliationError) {
    console.error('Error creating affiliation:', affiliationError);
    throw new DriverOrgSharingError('Failed to create affiliation', 500);
  }

  const { error: consentError } = await supabase
    .from('driver_affiliate_organization_data_sharing_consents')
    .insert({
      user_id: userId,
      affiliate_organization_id: organizationId
    });

  if (consentError) {
    console.error('Error creating consent:', consentError);
    await supabase
      .from('driver_affiliate_organization_affiliations')
      .delete()
      .eq('user_id', userId)
      .eq('affiliate_organization_id', organizationId);
    throw new DriverOrgSharingError('Failed to create affiliation', 500);
  }
};

export const stopSharing = async (userId: string, scope: StopSharingScope) => {
  if (scope.kind === 'virtual-primary') {
    await stopSharingVirtualPrimary(userId);
    return {
      success: true as const,
      isPrimary: true,
      organization: {
        id: '',
        key: SYSTEM_VIRTUAL_PRIMARY_KEY,
        name: SYSTEM_VIRTUAL_PRIMARY_NAME,
        data_deletion_contact_email: null
      }
    };
  }

  const consent = await getConsentByAffiliationKey(userId, scope.affiliationKey);
  if (!consent) {
    throw new DriverOrgSharingError('Data sharing consent not found. Try reloading the page.', 404);
  }

  const affiliation = await getAffiliationByUserAndOrganization(
    userId,
    consent.affiliate_organization_id
  );
  const isPrimary = affiliation?.is_primary ?? false;
  const organization = consent.affiliate_organizations;

  const orgsToNotify: OrgContact[] = isDemoMode
    ? []
    : isPrimary
      ? await collectAllConsentedOrgContacts(userId)
      : [
          {
            name: organization.name,
            data_deletion_contact_email: organization.data_deletion_contact_email ?? null
          }
        ];

  if (isPrimary) {
    await stopSharingPrimary(userId, consent.affiliate_organization_id);
  } else {
    await stopSharingSecondary(userId, consent.affiliate_organization_id);
  }

  await sendOptOutNotifications(userId, orgsToNotify);

  return { success: true as const, isPrimary, organization };
};

const stopSharingPrimary = async (userId: string, primaryOrgId: string) => {
  const { argyleAccounts, primaryCreds } = await collectAccountsForCleanup(userId, primaryOrgId);

  const { error: rpcError } = await supabase.rpc('stop_sharing_primary', {
    p_user_id: userId
  });
  if (rpcError) {
    console.error('stop_sharing_primary RPC failed:', rpcError);
    throw new DriverOrgSharingError('Failed to stop sharing', 500);
  }

  await Promise.allSettled(
    argyleAccounts.map((a) => {
      const creds: ResolvedArgyleCredentials | null = a.organization_id ? primaryCreds : null;
      const fetchCreds = creds
        ? { apiKeyId: creds.apiKeyId, apiKeySecret: creds.apiKeySecret, linkUrl: creds.linkUrl }
        : getGlobalArgyleCredentials();
      return deleteArgyleAccount(fetchCreds, a.argyle_account).catch((err) =>
        console.warn(`Failed to delete Argyle account ${a.argyle_account}:`, err)
      );
    })
  );

  await cleanupOrphanedArgyleUser(userId);
};

const stopSharingSecondary = async (userId: string, organizationId: string) => {
  const [{ error: deleteConsentError }, { error: deleteAffiliationError }] = await Promise.all([
    supabase
      .from('driver_affiliate_organization_data_sharing_consents')
      .delete()
      .eq('user_id', userId)
      .eq('affiliate_organization_id', organizationId),
    supabase
      .from('driver_affiliate_organization_affiliations')
      .delete()
      .eq('user_id', userId)
      .eq('affiliate_organization_id', organizationId)
  ]);

  if (deleteConsentError || deleteAffiliationError) {
    console.error('Error removing secondary org sharing:', {
      deleteConsentError,
      deleteAffiliationError
    });
    throw new DriverOrgSharingError('Failed to stop sharing', 500);
  }
};

const stopSharingVirtualPrimary = async (userId: string) => {
  const { data: globalAccounts, error: loadError } = await supabase
    .from('argyle_accounts')
    .select('argyle_account')
    .eq('user_id', userId)
    .is('organization_id', null)
    .is('deleted_at', null);

  if (loadError) {
    throw new DriverOrgSharingError('Could not load Argyle accounts for driver', 500);
  }

  if (globalAccounts && globalAccounts.length > 0) {
    const creds = getGlobalArgyleCredentials();
    await Promise.allSettled(
      globalAccounts.map((a) =>
        deleteArgyleAccount(creds, a.argyle_account).catch((err) =>
          console.warn(`Failed to delete global Argyle account ${a.argyle_account}:`, err)
        )
      )
    );
  }

  const { error: softDeleteError } = await supabase
    .from('argyle_accounts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('organization_id', null)
    .is('deleted_at', null);

  if (softDeleteError) {
    console.error('Error soft-deleting global Argyle accounts:', softDeleteError);
    throw new DriverOrgSharingError('Failed to stop sharing', 500);
  }

  await cleanupOrphanedArgyleUser(userId);
};

const collectAccountsForCleanup = async (userId: string, primaryOrgId: string) => {
  const { data: argyleAccounts } = await supabase
    .from('argyle_accounts')
    .select('argyle_account, organization_id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  const primaryCreds = await resolveArgyleCredentials({
    by: 'org',
    organizationId: primaryOrgId
  });

  return { argyleAccounts: argyleAccounts ?? [], primaryCreds };
};

const collectAllConsentedOrgContacts = async (userId: string): Promise<OrgContact[]> => {
  const { data } = await supabase
    .from('driver_affiliate_organization_data_sharing_consents')
    .select('affiliate_organizations!inner(name, data_deletion_contact_email)')
    .eq('user_id', userId);

  return (data ?? []).map((c) => {
    const org = c.affiliate_organizations as unknown as OrgContact;
    return { name: org.name, data_deletion_contact_email: org.data_deletion_contact_email };
  });
};

const sendOptOutNotifications = async (userId: string, orgsToNotify: OrgContact[]) => {
  if (isDemoMode || orgsToNotify.length === 0) return;

  const profile = await getProfileFromUserId(supabase, userId);

  for (const org of orgsToNotify) {
    if (!org.data_deletion_contact_email) continue;
    try {
      await sendOptOutEmailToAffiliateOrganization(
        org.data_deletion_contact_email,
        profile.first_name || '',
        profile.last_initial || '',
        profile.phone || ''
      );
    } catch (error) {
      console.error(`Failed to send data deletion notification to ${org.name}:`, error);
    }
  }
};

const getConsentByAffiliationKey = async (userId: string, affiliationKey: string) => {
  const { data, error } = await supabase
    .from('driver_affiliate_organization_data_sharing_consents')
    .select(
      `
      affiliate_organization_id,
      affiliate_organizations!inner(
        id,
        key,
        name,
        data_deletion_contact_email
      )
    `
    )
    .eq('user_id', userId)
    .eq('affiliate_organizations.key', affiliationKey)
    .maybeSingle()
    .overrideTypes<{
      affiliate_organization_id: string;
      affiliate_organizations: {
        id: string;
        key: string;
        name: string;
        data_deletion_contact_email: string | null;
      };
    }>();

  if (error) {
    console.error('Error checking consent:', error);
    throw new DriverOrgSharingError('Error checking consent', 500);
  }

  return data;
};

const getAffiliationByUserAndOrganization = async (userId: string, organizationId: string) => {
  const { data, error } = await supabase
    .from('driver_affiliate_organization_affiliations')
    .select('affiliate_organization_id, is_primary')
    .eq('user_id', userId)
    .eq('affiliate_organization_id', organizationId)
    .maybeSingle();

  if (error) {
    console.error('Error validating driver affiliation:', error);
    throw new DriverOrgSharingError('Could not validate driver affiliation', 500);
  }

  return data;
};

export const cleanupAffiliationsAfterAccountRemoval = async (
  userId: string,
  removedOrgId: string | null
) => {
  const { count: anyActiveCount } = await supabase
    .from('argyle_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (anyActiveCount && anyActiveCount > 0) return;

  if (removedOrgId) {
    await Promise.all([
      supabase
        .from('driver_affiliate_organization_data_sharing_consents')
        .delete()
        .eq('user_id', userId)
        .eq('affiliate_organization_id', removedOrgId),
      supabase
        .from('driver_affiliate_organization_affiliations')
        .delete()
        .eq('user_id', userId)
        .eq('affiliate_organization_id', removedOrgId)
    ]);
  }

  await cleanupOrphanedArgyleUser(userId);
};

export const cleanupOrphanedArgyleUser = async (userId: string) => {
  const { count } = await supabase
    .from('argyle_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (count && count > 0) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('argyle_user')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile?.argyle_user) return;

  const { data: lastAccount } = await supabase
    .from('argyle_accounts')
    .select('organization_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const creds = lastAccount?.organization_id
    ? await resolveArgyleCredentials({
        by: 'org',
        organizationId: lastAccount.organization_id
      })
    : null;

  const adminCreds = creds
    ? { apiKeyId: creds.apiKeyId, apiKeySecret: creds.apiKeySecret, linkUrl: creds.linkUrl }
    : getGlobalArgyleCredentials();

  try {
    await deleteArgyleUser(adminCreds, profile.argyle_user);
  } catch (error) {
    console.error('Failed to delete orphaned Argyle user:', error);
  }

  await supabase.from('profiles').update({ argyle_user: null }).eq('user_id', userId);
};

export const deaffiliateDriver = async (
  organizerUserId: string,
  driverUserId: string,
  organizationKey: string
) => {
  const organization = await getActiveOrganizationOrThrow(organizationKey);
  const affiliation = await getAffiliationByUserAndOrganization(driverUserId, organization.id);
  if (!affiliation) {
    throw new DriverOrgSharingError('Driver is not affiliated with this organization', 404);
  }

  if (affiliation.is_primary) {
    await stopSharingPrimary(driverUserId, organization.id);
  } else {
    await stopSharingSecondary(driverUserId, organization.id);
  }

  return { success: true as const, isPrimary: affiliation.is_primary, organizerUserId };
};
