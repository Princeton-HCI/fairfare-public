import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { argyleAccounts } from '@src/lib/stores/argyleAccounts';
import { toast } from '@src/lib/toasts';
import { PUB_ARGYLE_LINK_URL } from '$env/static/public';
import type { ArgyleAccountData } from '@src/lib/types';
import { isDemoMode } from '../utils';
import { userDemoPhoneNumber } from '../stores/userDemoPhoneNumber';
import { ARGYLE_SANDBOX_BOB } from '../demo/constants';

const GLOBAL_SYSTEM_FLOW_ID = 'QM3BSPT2';

export interface ArgyleBootstrap {
  canConnect: boolean;
  reason?: 'over_capacity' | 'inactive_config';
  currentCount: number | null;
  maxCount: number | null;
  token: string;
  config: {
    apiHost: string;
    flowId: string | null;
    organizationId: string | null;
    organizationKey: string | null;
  };
}

export const fetchArgyleBootstrap = async (orgKey?: string): Promise<ArgyleBootstrap> => {
  const url = orgKey
    ? `/api/driver/argyle/bootstrap?orgKey=${encodeURIComponent(orgKey)}`
    : '/api/driver/argyle/bootstrap';
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || 'Could not bootstrap Argyle link');
  }
  return (await response.json()) as ArgyleBootstrap;
};

/**
 * Determines the correct sandbox credential for a given input based on its
 * `name`, `inputmode`, and `placeholder` attributes. This is needed because
 * different platforms reuse the same `name` for different field types:
 *   - Uber: name="username" → email, name="password" → text password
 *   - Lyft: name="username" → phone number, name="password" → driver's license
 */
const getCredentialForInput = (input: HTMLInputElement): string | null => {
  const name = input.getAttribute('name') ?? '';
  const inputMode = input.getAttribute('inputmode') ?? '';
  const placeholder = (input.getAttribute('placeholder') ?? '').toLowerCase();

  switch (name) {
    case 'username':
      // Lyft uses name="username" with inputmode="numeric" for phone
      // Uber uses name="username" with inputmode="email" for email
      return inputMode === 'numeric' ? ARGYLE_SANDBOX_BOB.phone : ARGYLE_SANDBOX_BOB.email;
    case 'phone':
      return ARGYLE_SANDBOX_BOB.phone;
    case 'password':
      // Lyft uses name="password" for driver's license
      if (placeholder.includes('license')) return ARGYLE_SANDBOX_BOB.driversLicense;
      return ARGYLE_SANDBOX_BOB.password;
    case 'legacy_mfa_token':
      return ARGYLE_SANDBOX_BOB.mfaCode;
    default:
      return null;
  }
};

/**
 * Sets an input value using the native HTMLInputElement setter so that
 * framework state (React/styled-components inside Argyle's shadow DOM)
 * picks up the change and enables the Connect/Continue button.
 *
 * Key techniques for React 18 compatibility:
 * - Invalidate React's internal _valueTracker so it detects the change
 * - Dispatch focus/blur to simulate real user interaction
 * - Use composed: true so events cross the shadow DOM boundary
 */
const setNativeInputValue = (input: HTMLInputElement, value: string) => {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  if (!nativeSetter) return;

  // Focus the input first so React's focus-dependent handlers fire
  input.dispatchEvent(new FocusEvent('focus', { bubbles: true, composed: true }));
  input.dispatchEvent(new FocusEvent('focusin', { bubbles: true, composed: true }));

  // Invalidate React's internal _valueTracker before setting the value.
  // React compares tracker.getValue() against the DOM value to decide if
  // an onChange should fire. Setting the tracker to a stale value forces
  // React to see a difference and trigger its state update.
  const tracker = (
    input as HTMLInputElement & { _valueTracker?: { setValue: (v: string) => void } }
  )._valueTracker;
  if (tracker) {
    tracker.setValue(input.value);
  }

  nativeSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

  // Blur after filling to trigger any validation-on-blur handlers
  input.dispatchEvent(new FocusEvent('blur', { bubbles: true, composed: true }));
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
};

/**
 * Observes the Argyle Link shadow DOM and auto-fills sandbox demo credentials
 * for each step of the login flow. Handles multi-input forms (e.g. Lyft shows
 * phone + driver's license on the same screen) and single-input forms (Uber).
 *
 * Robustness features:
 * - Value-aware deduplication: re-fills if inputs are cleared (e.g. back navigation)
 * - Retry with backoff: verifies fill took hold, retries up to 3 times
 * - Root re-discovery: periodic check reconnects observer if Argyle recreates its DOM
 * - Skips already-filled inputs to avoid unnecessary dispatches
 *
 * Returns a cleanup function that disconnects all observers and timers.
 * Only runs when isDemoMode is true.
 */
export const startDemoPrefill = (): (() => void) => {
  if (!isDemoMode) return () => {};

  let destroyed = false;

  // Track both input names AND their current values to detect clears/back navigation
  let lastFilledSignature = '';

  /** Build a signature from input names + their current values. */
  const buildSignature = (inputs: NodeListOf<HTMLInputElement>): string =>
    Array.from(inputs)
      .map((i) => `${i.getAttribute('name')}=${i.value}`)
      .join(',');

  /**
   * Fill a set of inputs with credentials, retrying up to maxAttempts
   * times if the values don't stick.
   */
  const fillWithRetry = (inputs: NodeListOf<HTMLInputElement>, attempt = 0) => {
    if (destroyed || attempt >= 3) return;

    let anyFilled = false;
    inputs.forEach((input) => {
      const expected = getCredentialForInput(input);
      // Skip inputs that already hold the correct value
      if (!expected || input.value === expected) return;
      setNativeInputValue(input, expected);
      anyFilled = true;
    });

    if (!anyFilled) return;

    // Verify after a short delay; retry if values didn't take hold
    const delay = 200 * (attempt + 1);
    setTimeout(() => {
      if (destroyed) return;
      const needsRetry = Array.from(inputs).some((input) => {
        const expected = getCredentialForInput(input);
        return expected && input.value !== expected;
      });
      if (needsRetry) {
        fillWithRetry(inputs, attempt + 1);
      } else {
        // Update signature after successful fill
        lastFilledSignature = buildSignature(inputs);
      }
    }, delay);
  };

  const tryPrefill = () => {
    if (destroyed) return;

    const root = document.querySelector('[id^="argyle-link-root"]');
    if (!root?.shadowRoot) return;

    const inputs = root.shadowRoot.querySelectorAll<HTMLInputElement>('[data-hook="auth-input"]');
    if (inputs.length === 0) return;

    // Build a signature that includes both names and current values
    const signature = buildSignature(inputs);

    // Skip if same step with same values (already filled correctly)
    if (signature === lastFilledSignature) return;

    // Small delay so the form is fully interactive, then fill with retry
    setTimeout(() => {
      if (destroyed) return;
      fillWithRetry(inputs);
    }, 300);
  };

  let observer: MutationObserver | null = null;
  let currentRootElement: Element | null = null;

  /** Attach (or re-attach) a MutationObserver to the Argyle shadow root. */
  const attachObserver = (root: Element) => {
    if (!root.shadowRoot || destroyed) return;
    observer?.disconnect();
    currentRootElement = root;
    tryPrefill();
    observer = new MutationObserver(() => tryPrefill());
    observer.observe(root.shadowRoot, { childList: true, subtree: true, attributes: true });
  };

  // Poll until the shadow root appears, then switch to MutationObserver
  const waitInterval = setInterval(() => {
    if (destroyed) return;
    const root = document.querySelector('[id^="argyle-link-root"]');
    if (root?.shadowRoot) {
      clearInterval(waitInterval);
      attachObserver(root);
    }
  }, 200);

  // Periodic fallback: re-discover root if Argyle recreated its DOM,
  // and catch any mutations the observer may have missed
  const healthCheck = setInterval(() => {
    if (destroyed) return;
    const root = document.querySelector('[id^="argyle-link-root"]');
    if (!root?.shadowRoot) return;

    // If the root element changed, reconnect the observer
    if (root !== currentRootElement) {
      attachObserver(root);
    } else {
      // Even if root hasn't changed, try prefill as a fallback
      tryPrefill();
    }
  }, 1000);

  // Safety timeout: stop after 5 minutes
  const safetyTimeout = setTimeout(
    () => {
      if (!destroyed) cleanup();
    },
    5 * 60 * 1000
  );

  const cleanup = () => {
    destroyed = true;
    clearInterval(waitInterval);
    clearInterval(healthCheck);
    clearTimeout(safetyTimeout);
    observer?.disconnect();
    observer = null;
    currentRootElement = null;
  };

  return cleanup;
};

/**
 * Demo-only: soft-delete the account via our API since webhooks don't fire.
 * Only registered as a callback when isDemoMode is true.
 */
const handleDemoAccountRemoval = async (argyleAccountData: ArgyleAccountData) => {
  const { accountId } = argyleAccountData;
  try {
    const response = await fetch('/api/driver/argyle/disconnect-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId })
    });

    if (!response.ok) {
      throw new Error('Failed to disconnect account');
    }

    const t = get(_);
    toast({ text: t('driver.argyle.account-disconnected'), type: 'success' });
  } catch (error) {
    console.error('Account removal error:', error);
    const t = get(_);
    toast({ text: t('driver.argyle.account-disconnection-error'), type: 'error' });
  }
};

const buildAccountConnectionHandler =
  (orgKey?: string) => async (argyleAccountData: ArgyleAccountData) => {
    const { accountId, userId: argyleUserId } = argyleAccountData;

    try {
      argyleAccounts.setFromArgyleLinkData(argyleAccountData);

      const response = await fetch('/api/driver/argyle/connect-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, argyleUserId, orgKey })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'Failed to connect account');
      }

      const t = get(_);
      toast({ text: t('driver.argyle.account-connected'), type: 'success' });
    } catch (error) {
      console.error('Account connection error:', error);
      const t = get(_);
      toast({ text: t('driver.argyle.account-connection-error'), type: 'error' });
    }
  };

const fetchArgyleToken = async () => {
  const response = await fetch('/api/driver/argyle/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  const { token } = await response.json();
  return token;
};

const refreshArgyleToken = async (updateToken: (token: string) => void) => {
  try {
    const token = await fetchArgyleToken();

    argyleAccounts.setToken(token);
    updateToken(token);
  } catch (error) {
    toast({ text: 'Error getting new token', type: 'error' });
    console.error(error);
  }
};

interface CreateArgyleLinkInstanceOptions {
  argyleLinkIds?: string[];
  apiHost?: string;
  flowId?: string | null;
  organizationId?: string | null;
  orgKey?: string;
}

const createArgyleLinkInstance = (
  userToken: string,
  onClose: () => void,
  options: CreateArgyleLinkInstanceOptions = {}
) => {
  const argyleLinkIds = options.argyleLinkIds ?? [];
  const apiHost = options.apiHost ?? PUB_ARGYLE_LINK_URL;
  const resolvedFlowId =
    options.flowId ?? (options.organizationId ? undefined : GLOBAL_SYSTEM_FLOW_ID);
  const handleAccountConnection = buildAccountConnectionHandler(options.orgKey);

  const accountCallbacks = isDemoMode
    ? {
        onAccountConnected: async (data: ArgyleAccountData) => {
          await handleAccountConnection(data);
          userDemoPhoneNumber.sendDemoSMSMessages();
        },
        onAccountRemoved: handleDemoAccountRemoval
      }
    : { onAccountConnected: handleAccountConnection };

  return window.Argyle.create({
    apiHost,
    userToken,
    ...(resolvedFlowId ? { flowId: resolvedFlowId } : {}),
    items: argyleLinkIds.length === 0 ? undefined : argyleLinkIds,
    ...accountCallbacks,
    onAccountError: (data: ArgyleAccountData) => console.log('Account error:', data),
    onClose,
    onTokenExpired: refreshArgyleToken
  });
};

export default createArgyleLinkInstance;

export { fetchArgyleToken };
