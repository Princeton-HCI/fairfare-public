/**
 * Plain-language explanations of Argyle's account connection error codes, for
 * organizers helping drivers reconnect. Used by the expandable rows on the Account
 * Errors page and by its glossary page.
 *
 * Based on Argyle's reference; check it when Argyle adds or changes codes:
 * https://docs.argyle.com/api-reference/account-connection-errors
 */

export const ARGYLE_ERRORS_DOCS_URL =
  'https://docs.argyle.com/api-reference/account-connection-errors';

export type ArgyleErrorCategory =
  | 'login'
  | 'login_method'
  | 'mfa'
  | 'reconnect'
  | 'account'
  | 'wrong_account'
  | 'platform';

export interface ArgyleConnectionError {
  code: string;
  category: ArgyleErrorCategory;
  /** A few words, shown as the heading. */
  title: string;
  /** One sentence on what went wrong, shown when a row is expanded. */
  summary: string;
  /** Extra background for the glossary, when the summary isn't enough. */
  cause?: string;
  /** What the organizer can ask the driver to do. */
  help: string;
}

/** Glossary sections, in display order. */
export const ARGYLE_ERROR_CATEGORIES: { key: ArgyleErrorCategory; label: string }[] = [
  { key: 'login', label: 'Login details' },
  { key: 'login_method', label: 'Login method' },
  { key: 'mfa', label: 'Two-step verification' },
  { key: 'reconnect', label: 'Reconnecting' },
  { key: 'account', label: 'Account status' },
  { key: 'wrong_account', label: 'Wrong account or employer' },
  { key: 'platform', label: 'Platform or Argyle problems' }
];

const RECHECK_LOGIN_DETAILS =
  'Have the driver check which details they use, or first used, to log in to the exployer platform, then try again.';

export const ARGYLE_CONNECTION_ERRORS: ArgyleConnectionError[] = [
  // Login details
  {
    code: 'invalid_credentials',
    category: 'login',
    title: 'Wrong login details',
    summary: "The login details the driver entered didn't work.",
    cause: 'They may have used login details for a different account than their driver account.',
    help: 'Check that the driver can log in to the platform app directly. If they can, have them change their password and reconnect.'
  },
  {
    code: 'invalid_auth',
    category: 'login',
    title: 'Login or verification failed',
    summary: 'The login details were wrong, or two-step verification failed.',
    cause: 'Two-step verification (MFA) may have failed or be set up wrong.',
    help: 'Ask whether the driver got a verification prompt. If so, have them check their verification settings in the platform app before trying again. If not, check their login details by having them log in to the app directly.'
  },
  {
    code: 'expired_credentials',
    category: 'login',
    title: 'Password expired',
    summary: 'The platform needs the driver to change their password.',
    cause: 'Some platforms make drivers update their password from time to time.',
    help: 'Have the driver reset their password in the employer platform app, then reconnect.'
  },
  {
    code: 'temporary_credentials',
    category: 'login',
    title: 'Temporary password',
    summary: 'The driver tried to connect with a temporary password.',
    help: 'Have the driver log in to the platform with the temporary password, set a permanent one, then reconnect.'
  },
  {
    code: 'login_attempts_exceeded',
    category: 'login',
    title: 'Too many login attempts',
    summary: 'The employer platform paused logins after too many wrong passwords.',
    help: 'Have the driver wait a few hours, or reset their password in the platform app to unlock it now, then reconnect.'
  },
  {
    code: 'credentials_managed_by_organization',
    category: 'login',
    title: 'Password managed by their organization.',
    summary: "Only the driver's organization's IT department can reset this password.",
    help: 'Have the driver ask their IT department to recover their user ID or reset their password.'
  },
  {
    code: 'session_limit_reached',
    category: 'login',
    title: 'Signed in elsewhere',
    summary: 'The driver is signed in on other device(s), and the platform limits active sessions.',
    help: 'Have the driver sign out of the platform app on other devices, wait about 10 minutes, then reconnect.'
  },
  {
    code: 'passkey_limit_reached',
    category: 'login',
    title: 'Too many passkeys',
    summary:
      'The account already has reached the maximum number of passkeys for their payroll account.',
    help: "Have the driver remove a passkey they don't use in the then reconnect."
  },

  // Login method
  {
    code: 'invalid_login_method',
    category: 'login_method',
    title: 'Login method not allowed',
    summary: "The employer doesn't allow the login method the driver chose.",
    cause: 'Some employers only allow one login method or single sign-on.',
    help: 'Have the driver choose a different login method.'
  },
  {
    code: 'unsupported_auth_type',
    category: 'login_method',
    title: 'Single sign-on not supported',
    summary:
      "Argyle can't connect through the single sign-on (such as Google or Facebook) the driver used.",
    help: 'Have the driver reconnect with a username and password instead.'
  },
  {
    code: 'auth_method_temporarily_unavailable',
    category: 'login_method',
    title: 'Login method down for now',
    summary: "The login method the driver chose isn't working right now.",
    help: 'The driver is offered another way to log in. If that fails too, have them try again later.'
  },
  {
    code: 'login_gov_not_linked',
    category: 'login_method',
    title: 'Login.gov not linked',
    summary: "The driver's Login.gov sign-in isn't linked to this platform or employer.",
    help: 'Have the driver log in to the platform directly, set up Login.gov access, then reconnect.'
  },

  // Two-step verification
  {
    code: 'invalid_mfa',
    category: 'mfa',
    title: 'Wrong verification response',
    summary: 'The driver gave the wrong two-step verification code or response.',
    help: 'Check that the driver got the verification request and which method is set up in the platform app, then have them try again. If it keeps failing, see whether it also fails when they log in to the app directly.'
  },
  {
    code: 'mfa_timeout',
    category: 'mfa',
    title: 'Verification timed out',
    summary: "The driver didn't finish two-step verification in time.",
    help: 'Have the driver try again and finish verification in one go. If no code or prompt arrives, have them check which method is set up in the platform app.'
  },
  {
    code: 'mfa_cancelled_by_the_user',
    category: 'mfa',
    title: 'Verification cancelled',
    summary: 'The driver left the two-step verification screen.',
    cause: 'This often happens after a typo, such as a wrong phone number.',
    help: 'Have the driver try again and check their verification details.'
  },
  {
    code: 'mfa_not_configured',
    category: 'mfa',
    title: 'Verification not set up',
    summary: "The platform requires two-step verification, but the driver hasn't set it up.",
    help: "Have the driver set up two-step verification in the platform's account settings, then reconnect."
  },
  {
    code: 'mfa_attempts_exceeded',
    category: 'mfa',
    title: 'Verification blocked',
    summary: 'Too many failed verification attempts blocked logins to the account.',
    cause:
      'Logins stay blocked until the driver resets two-step verification on the exmployer platform.',
    help: "Have the driver reset two-step verification in the platform's security settings, then reconnect."
  },
  {
    code: 'mfa_exhausted',
    category: 'mfa',
    title: 'Locked after failed verification',
    summary: 'Too many failed verification attempts locked the account.',
    help: 'Have the driver log in to the employer platform directly to unlock the account or reset verification, then reconnect.'
  },
  {
    code: 'unsupported_mfa_method',
    category: 'mfa',
    title: 'Verification method not supported',
    summary: "Argyle doesn't support the driver's two-step verification method.",
    help: "Have the driver switch to another verification method, or turn it off for now, in the platform's security settings, then reconnect."
  },
  {
    code: 'physical_mfa_unsupported',
    category: 'mfa',
    title: 'Security key not supported',
    summary: "The driver is using a physical security key, which Argyle doesn't support.",
    help: 'Have the driver turn off the security key, set up another verification method, then reconnect.'
  },

  // Reconnecting
  {
    code: 'auth_required',
    category: 'reconnect',
    title: 'Needs to reconnect',
    summary: 'The connection expired and the driver needs to reconnect.',
    help: 'Have the driver reconnect their account.'
  },
  {
    code: 'full_auth_required',
    category: 'reconnect',
    title: 'Needs to log in again',
    summary: 'Argyle reset this connection, so the driver needs to log in again.',
    cause:
      'Argyle sets this after looking into an earlier error, or when an employer platform comes back after an outage.',
    help: 'Have the driver reconnect and enter their login details again.'
  },
  {
    code: 'ongoing_refresh_disabled',
    category: 'reconnect',
    title: 'Updates turned off',
    summary: 'Automatic data updates were turned off for this account.',
    help: 'Have the driver reconnect the account. That turns updates back on.'
  },
  {
    code: 'login_cancelled_by_the_user',
    category: 'reconnect',
    title: 'Login cancelled',
    summary: 'The driver left before entering their login details.',
    help: 'Have the driver try again and finish logging in.'
  },
  {
    code: 'user_action_timeout',
    category: 'reconnect',
    title: 'Took too long',
    summary: "The driver didn't choose an employer or create a new password in time.",
    help: 'Have the driver close the connection screen and start over.'
  },
  {
    code: 'known_employer_redirect',
    category: 'reconnect',
    title: 'Sent to employer login',
    summary: "The driver was sent to their employer's login screen.",
    help: 'Have the driver enter their login details to finish connecting.'
  },

  // Account status
  {
    code: 'account_disabled',
    category: 'account',
    title: 'Account disabled',
    summary: "The employer platform has disabled or suspended the driver's account.",
    cause: 'Accounts can be disabled for many reasons, such as not being used.',
    help: 'The driver needs to contact their employer platform to find out why.'
  },
  {
    code: 'account_inaccessible',
    category: 'account',
    title: 'Account not accessible',
    summary: "The driver's account can't be connected right now.",
    cause:
      "The account may be inactive, onboarding may not be finished, or the terms of service haven't been accepted.",
    help: 'Have the driver log in to the employer platform directly, make sure the account is active, finish onboarding, accept any terms, then reconnect.'
  },
  {
    code: 'account_incomplete',
    category: 'account',
    title: 'Account setup not finished',
    summary: "The driver hasn't finished setting up their account on the employer platform.",
    help: 'Have the driver finish setting up the account in the employer platform app, or contact the platform for help.'
  },
  {
    code: 'tos_required',
    category: 'account',
    title: 'Terms not accepted',
    summary: 'The employer platform needs the driver to accept updated terms of service.',
    help: 'Have the driver log in to the employer platform, accept the terms, then reconnect.'
  },
  {
    code: 'personal_data_access_not_granted',
    category: 'account',
    title: 'Data sharing not allowed',
    summary: "The driver hasn't allowed access to their personal data.",
    cause: "This is common for new accounts and accounts that haven't been used in a long time.",
    help: 'Have the driver log in to the platform directly and allow access to their data.'
  },
  {
    code: 'trial_period_expired',
    category: 'account',
    title: 'Trial account expired',
    summary: 'The driver had a trial account on the employer platform, and it has expired.',
    help: 'The driver needs to contact the platform to reactivate the account.'
  },
  {
    code: 'insufficient_account_data',
    category: 'account',
    title: 'Missing account details',
    summary: 'The account is missing basic details, such as name or employment status.',
    help: 'Have the driver connect a different account that has their full details.'
  },
  {
    code: 'unsupported_language',
    category: 'account',
    title: 'Language not supported',
    summary: "The driver's employer platform account is in a language Argyle doesn't support.",
    help: "Have the driver switch the platform's language to English, then reconnect."
  },

  // Wrong account or employer
  {
    code: 'invalid_account_type',
    category: 'wrong_account',
    title: 'Not a driver account',
    summary: 'The driver logged in with the wrong kind of account, such as a rider account.',
    help: 'Make sure the driver uses their driver account login. Check that they can log in to the driver app directly.'
  },
  {
    code: 'multi_driver_account',
    category: 'wrong_account',
    title: 'Shared by several drivers',
    summary:
      "The account has data for more than one driver, which Argyle doesn't support for privacy reasons.",
    help: 'Have the driver connect an account that belongs only to them.'
  },
  {
    code: 'unsupported_business_account',
    category: 'wrong_account',
    title: 'Business account',
    summary: 'The driver used business login details instead of personal ones.',
    help: 'Have the driver log in with their personal account.'
  },
  {
    code: 'account_not_found',
    category: 'wrong_account',
    title: 'No matching account',
    summary:
      "The personal details the driver gave didn't match any account on the exployer platform.",
    help: RECHECK_LOGIN_DETAILS
  },
  {
    code: 'account_nonunique',
    category: 'wrong_account',
    title: 'Several matching accounts',
    summary: 'The personal details the driver gave match more than one account.',
    help: "Have the driver check which details they use to log in, or contact their employer's HR or payroll department."
  },
  {
    code: 'all_employers_connected',
    category: 'wrong_account',
    title: 'All accounts already connected',
    summary: "Every account tied to the driver's details is already connected.",
    help: 'Have the driver check their details, or choose another employer or platform.'
  },
  {
    code: 'existing_account_found',
    category: 'wrong_account',
    title: 'Account already connected',
    summary: "The driver tried to connect an account that's already connected.",
    help: 'Have the driver check their details, or choose another employer or platform.'
  },
  {
    code: 'invalid_login_url',
    category: 'wrong_account',
    title: 'Wrong employer chosen',
    summary: 'The login worked, but the driver chose the wrong employer or platform.',
    help: 'Have the driver search for their own employer or platform and connect through that.'
  },
  {
    code: 'invalid_employer_identifier',
    category: 'wrong_account',
    title: 'Wrong company ID',
    summary: 'An employer detail the driver entered, such as a company ID, was wrong.',
    help: 'Have the driver check their login details and company ID.'
  },
  {
    code: 'invalid_store_identifier',
    category: 'wrong_account',
    title: 'Wrong store number',
    summary: 'The store or club number the driver entered was wrong.',
    help: 'Have the driver check their login details and store or club number.'
  },
  {
    code: 'unrecognized_employer_email',
    category: 'wrong_account',
    title: "Email doesn't match employer",
    summary: "The driver's email address doesn't belong to the employer they chose.",
    cause: 'Often the driver entered a personal email instead of a work email.',
    help: 'Have the driver log in with their work email.'
  },

  // Platform or Argyle problems
  {
    code: 'connection_unavailable',
    category: 'platform',
    title: 'Platform unavailable',
    summary: 'The exployer platform was unavailable when the driver tried to connect.',
    help: "Have the driver try again later or use another way to connect. Argyle Console's Coverage page lists known outages."
  },
  {
    code: 'platform_temporarily_unavailable',
    category: 'platform',
    title: 'Platform down for now',
    summary: 'The employer platform is having problems, so new connections are paused.',
    cause: 'When the platform is back, the error changes to full_auth_required.',
    help: 'Have the driver try again in a few hours.'
  },
  {
    code: 'platform_unavailable',
    category: 'platform',
    title: 'Outside service hours',
    summary: 'The employer platform only accepts connections during its service hours.',
    help: 'Have the driver try again during service hours (Eastern time): Monday to Friday 5 AM to 1 AM, Saturday 5 AM to 11 PM, Sunday 8 AM to 11 PM.'
  },
  {
    code: 'service_unavailable',
    category: 'platform',
    title: 'Platform under maintenance',
    summary: 'The employer platform is offline for maintenance or has an outage.',
    help: "If there's a known outage, let the driver know it should be fixed soon. Otherwise, have them try again."
  },
  {
    code: 'system_error',
    category: 'platform',
    title: 'Unexpected error',
    summary: "Something unexpected went wrong on Argyle's side.",
    help: 'Nothing for the driver to do. Argyle is notified automatically and looks into it. Contact Argyle support for details.'
  },
  {
    code: 'trial_connections_exhausted',
    category: 'platform',
    title: 'Argyle trial limit reached',
    summary: 'The Argyle account used for this connection reached its free trial limit.',
    help: "Not the driver's fault. Contact Argyle or turn on full access in Argyle Console."
  }
];

const ERRORS_BY_CODE = new Map(ARGYLE_CONNECTION_ERRORS.map((error) => [error.code, error]));

/** The explanation for an Argyle error code, or undefined if we don't know it. */
export function getArgyleConnectionError(
  code: string | null | undefined
): ArgyleConnectionError | undefined {
  return code ? ERRORS_BY_CODE.get(code) : undefined;
}
