import { randomBytes } from 'crypto';
import { PUB_ARGYLE_LINK_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';
import { HttpError } from '@src/lib/server/apiErrors';
import {
  createArgyleWebhookSubscription,
  deleteArgyleWebhookSubscription,
  validateArgyleApiCredentials
} from '@src/lib/server/argyleAdmin';
import { encrypt } from '@src/lib/server/encryption';
import { getOrganizationByKey, resolveArgyleCredentials } from '@src/lib/server/organizationArgyle';
import { supabase } from '@src/lib/server/db';
import { requireCapability } from '@src/lib/server/rbac';
import type { AuthContext } from '@src/lib/rbac';

export class OrganizerArgyleConfigError extends HttpError {
  constructor(message: string, status = 400) {
    super(message, status);
    this.name = 'OrganizerArgyleConfigError';
  }
}

const getAccessibleOrganizationOrThrow = async (roles: AuthContext, organizationKey: string) => {
  // Lead organizers hold this for their own organization; platform admins hold
  // it everywhere (see roles.config.ts), so no separate admin bypass is needed.
  requireCapability(roles, 'org:manage_argyle_settings', organizationKey);
  const organization = await getOrganizationByKey(organizationKey);
  if (!organization) {
    throw new OrganizerArgyleConfigError('Organization not found', 404);
  }
  return organization;
};

const VALID_ARGYLE_HOSTS = ['https://api.argyle.com', 'https://api-sandbox.argyle.com'];

export const connectOrganizationArgyleConfig = async ({
  roles,
  organizationKey,
  apiKeyId,
  apiKeySecret,
  linkUrl = PUB_ARGYLE_LINK_URL,
  flowId = null,
  maxArgyleAccounts = null,
  requestOrigin
}: {
  roles: AuthContext;
  organizationKey: string;
  apiKeyId?: string | null;
  apiKeySecret?: string | null;
  linkUrl?: string | null;
  flowId?: string | null;
  maxArgyleAccounts?: number | null;
  requestOrigin: string;
}) => {
  const organization = await getAccessibleOrganizationOrThrow(roles, organizationKey);
  const existing = await resolveArgyleCredentials({ by: 'org', organizationId: organization.id });

  if (existing?.isActive) {
    throw new OrganizerArgyleConfigError(
      'Argyle is already connected. Disconnect before connecting with new credentials.',
      409
    );
  }

  if (!apiKeyId || !apiKeySecret) {
    throw new OrganizerArgyleConfigError('apiKeyId and apiKeySecret are required', 400);
  }

  const resolvedLinkUrl = linkUrl ?? PUB_ARGYLE_LINK_URL;
  if (!VALID_ARGYLE_HOSTS.includes(resolvedLinkUrl)) {
    throw new OrganizerArgyleConfigError(
      `linkUrl must be one of: ${VALID_ARGYLE_HOSTS.join(', ')}`,
      400
    );
  }

  await validateArgyleApiCredentials({
    apiKeyId: apiKeyId,
    apiKeySecret: apiKeySecret,
    linkUrl: resolvedLinkUrl
  });

  const webhookSecret = randomBytes(32).toString('hex');
  const webhookUrl = `${env.WEBHOOK_BASE_URL || requestOrigin}/api/driver/argyle/webhooks/${organizationKey}`;

  const newSubscriptionId = await createArgyleWebhookSubscription(
    { apiKeyId: apiKeyId, apiKeySecret: apiKeySecret, linkUrl: resolvedLinkUrl },
    { organizationKey, webhookUrl, secret: webhookSecret }
  );

  try {
    const { error: upsertError } = await supabase.from('organization_argyle_configs').upsert(
      {
        organization_id: organization.id,
        api_key_id: apiKeyId,
        api_key_secret: encrypt(apiKeySecret, organization.id),
        webhook_secret: encrypt(webhookSecret, organization.id),
        argyle_webhook_subscription_id: newSubscriptionId,
        link_url: resolvedLinkUrl,
        flow_id: flowId,
        max_argyle_accounts: maxArgyleAccounts,
        is_active: true
      },
      { onConflict: 'organization_id' }
    );

    if (upsertError) {
      console.error('Error saving Argyle config:', upsertError);
      throw new OrganizerArgyleConfigError('Failed to save Argyle configuration', 500);
    }
  } catch (error) {
    try {
      await deleteArgyleWebhookSubscription(
        {
          apiKeyId: apiKeyId,
          apiKeySecret: apiKeySecret,
          linkUrl: resolvedLinkUrl
        },
        newSubscriptionId
      );
    } catch (cleanupError) {
      console.error('Failed to clean up new Argyle webhook subscription:', cleanupError);
    }
    throw error;
  }

  if (existing?.webhookSubscriptionId) {
    try {
      await deleteArgyleWebhookSubscription(
        {
          apiKeyId: existing.apiKeyId,
          apiKeySecret: existing.apiKeySecret,
          linkUrl: existing.linkUrl
        },
        existing.webhookSubscriptionId
      );
    } catch (cleanupError) {
      console.error('Failed to delete previous Argyle webhook subscription:', cleanupError);
    }
  }

  return { success: true as const };
};

export const updateOrganizationArgyleControls = async ({
  roles,
  organizationKey,
  maxArgyleAccounts = null
}: {
  roles: AuthContext;
  organizationKey: string;
  maxArgyleAccounts?: number | null;
}) => {
  const organization = await getAccessibleOrganizationOrThrow(roles, organizationKey);

  const { data: existing, error: existingError } = await supabase
    .from('organization_argyle_configs')
    .select('id')
    .eq('organization_id', organization.id)
    .maybeSingle();
  if (existingError) throw existingError;

  if (!existing) {
    if (maxArgyleAccounts !== null) {
      throw new OrganizerArgyleConfigError(
        'Configure organization Argyle credentials before setting a max accounts limit.',
        400
      );
    }
    return { success: true as const };
  }

  const { error: updateError } = await supabase
    .from('organization_argyle_configs')
    .update({ max_argyle_accounts: maxArgyleAccounts })
    .eq('organization_id', organization.id);

  if (updateError) {
    console.error('Error updating Argyle controls:', updateError);
    throw new OrganizerArgyleConfigError('Failed to update Argyle settings', 500);
  }

  return { success: true as const };
};

export const disconnectOrganizationArgyleConfig = async ({
  roles,
  organizationKey
}: {
  roles: AuthContext;
  organizationKey: string;
}) => {
  const organization = await getAccessibleOrganizationOrThrow(roles, organizationKey);
  const existing = await resolveArgyleCredentials({ by: 'org', organizationId: organization.id });

  if (!existing) {
    return { success: true as const };
  }

  if (existing.webhookSubscriptionId) {
    try {
      await deleteArgyleWebhookSubscription(
        {
          apiKeyId: existing.apiKeyId,
          apiKeySecret: existing.apiKeySecret,
          linkUrl: existing.linkUrl
        },
        existing.webhookSubscriptionId
      );
    } catch (error) {
      console.error('Failed to delete Argyle webhook subscription on disconnect:', error);
    }
  }

  const { error: disableError } = await supabase
    .from('organization_argyle_configs')
    .update({
      is_active: false,
      argyle_webhook_subscription_id: null,
      max_argyle_accounts: null,
      flow_id: null
    })
    .eq('organization_id', organization.id);

  if (disableError) {
    console.error('Error disabling Argyle config:', disableError);
    throw new OrganizerArgyleConfigError('Failed to disconnect Argyle configuration', 500);
  }

  const { error: clearCodeError } = await supabase
    .from('affiliate_organizations')
    .update({ driver_signup_code: null })
    .eq('id', organization.id);

  if (clearCodeError) {
    console.error('Error clearing driver signup code:', clearCodeError);
  }

  return { success: true as const };
};
