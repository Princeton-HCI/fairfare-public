import { PUB_ARGYLE_LINK_URL } from '$env/static/public';
import { argyleFetch, buildArgyleUrl } from '@src/lib/server/argyle';

export interface ArgyleAdminCredentials {
  apiKeyId: string;
  apiKeySecret: string;
  linkUrl?: string | null;
}

const resolveLinkUrl = (linkUrl?: string | null) => linkUrl ?? PUB_ARGYLE_LINK_URL;

const argyleAdminFetch = async (
  creds: ArgyleAdminCredentials,
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH',
  path: string,
  body?: unknown
) => {
  const url = buildArgyleUrl(path, resolveLinkUrl(creds.linkUrl));
  return argyleFetch(
    url,
    {
      method,
      ...(body
        ? {
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
          }
        : {})
    },
    { apiKeyId: creds.apiKeyId, apiKeySecret: creds.apiKeySecret }
  );
};

export const validateArgyleApiCredentials = async (creds: ArgyleAdminCredentials) => {
  const response = await argyleAdminFetch(creds, 'GET', '/users?limit=1');
  if (!response.ok) {
    throw new Error(`Argyle credential validation failed: ${await response.text()}`);
  }
};

export const createArgyleWebhookSubscription = async (
  creds: ArgyleAdminCredentials,
  args: { organizationKey: string; webhookUrl: string; secret: string }
): Promise<string> => {
  const response = await argyleAdminFetch(creds, 'POST', '/webhooks', {
    events: ['*'],
    name: `system-${args.organizationKey}`,
    url: args.webhookUrl,
    secret: args.secret
  });

  if (!response.ok) {
    throw new Error(`Failed to create Argyle webhook subscription: ${await response.text()}`);
  }

  const data = await response.json();
  return data.id as string;
};

export const deleteArgyleWebhookSubscription = async (
  creds: ArgyleAdminCredentials,
  subscriptionId: string
) => {
  const response = await argyleAdminFetch(creds, 'DELETE', `/webhooks/${subscriptionId}`);
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Argyle webhook subscription: ${await response.text()}`);
  }
};

export const deleteArgyleUser = async (creds: ArgyleAdminCredentials, userId: string) => {
  const response = await argyleAdminFetch(creds, 'DELETE', `/users/${userId}`);
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Argyle user ${userId}: ${await response.text()}`);
  }
};

export const deleteArgyleAccount = async (creds: ArgyleAdminCredentials, accountId: string) => {
  const response = await argyleAdminFetch(creds, 'DELETE', `/accounts/${accountId}`);
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete Argyle account ${accountId}: ${await response.text()}`);
  }
};
