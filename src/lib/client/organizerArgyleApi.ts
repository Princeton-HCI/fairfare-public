import { fetchJsonOrThrow } from '@src/lib/client/fetchJson';

export const saveOrganizerArgyleCredentials = async ({
  organizationKey,
  apiKeyId,
  apiKeySecret,
  flowId
}: {
  organizationKey: string;
  apiKeyId: string;
  apiKeySecret: string;
  flowId: string | null;
}) =>
  fetchJsonOrThrow<{ success: boolean }>(
    '/api/organizer/argyle-config',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationKey, apiKeyId, apiKeySecret, flowId })
    },
    'Could not save Argyle credentials'
  );

export const updateOrganizerArgyleControls = async ({
  organizationKey,
  signupCodePlaintext,
  maxArgyleAccounts
}: {
  organizationKey: string;
  signupCodePlaintext?: string | null;
  maxArgyleAccounts: number | null;
}) =>
  fetchJsonOrThrow<{ success: boolean }>(
    '/api/organizer/argyle-config',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationKey,
        maxArgyleAccounts,
        ...(signupCodePlaintext !== undefined ? { signupCodePlaintext } : {})
      })
    },
    'Could not save organization settings'
  );

export const disconnectOrganizerArgyleCredentials = async (organizationKey: string) =>
  fetchJsonOrThrow<{ success: boolean }>(
    `/api/organizer/argyle-config?organizationKey=${encodeURIComponent(organizationKey)}`,
    { method: 'DELETE' },
    'Could not disconnect'
  );

export const deaffiliateOrganizerDriver = async ({
  organizationKey,
  driverUserId
}: {
  organizationKey: string;
  driverUserId: string;
}) =>
  fetchJsonOrThrow<{ success: boolean }>(
    '/api/organizer/deaffiliate-driver',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationKey, driverUserId })
    },
    'Could not remove driver'
  );
