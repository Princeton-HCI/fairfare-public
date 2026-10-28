/**
 * Flatten a multidimensional object
 *
 * For example:
 *   flattenObject{ a: 1, b: { c: 2 } }
 * Returns:
 *   { a: 1, b_c: 2}
 *
 * If 'parent' is specified at the root node, all
 * keys will be prefixed with the parent name.
 */
// @ts-expect-error we want this to be generic here
export const flattenObj = (obj, parent = '', res = {}) => {
  for (const key in obj) {
    const propName = parent ? parent + '_' + key : key;
    if (typeof obj[key] == 'object') {
      flattenObj(obj[key], propName, res);
    } else {
      // @ts-expect-error Element implicitly has an 'any' type because expression of type 'string' can't be used to index type '{}'.
      res[propName] = obj[key];
    }
  }
  return res;
};

export const USDformatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  currencyDisplay: 'narrowSymbol'
});

/**
 * Normalize a phone number to a canonical comparison form: digits only.
 *
 * Supabase stores verified phone numbers as digits without a leading `+`
 * (e.g. `15555551234`), so stripping non-digits from both the stored value
 * and any user/allowlist input yields a stable, comparable key.
 */
export const stripPhoneNumberStringOfNonDigits = (phoneNumber: string): string => {
  return phoneNumber.replace(/\D/g, '');
};

export const formatPhoneNumber = (phoneNumber: string) => {
  /**
   * Expecting a phone number like +18002223333
   */
  // Remove any non-digit characters from the phone number
  const digitsOnly = phoneNumber.replace(/\D/g, '');

  // Check if the phone number has 11 digits with the country code as 1
  if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
    // Apply the formatting to the phone number except for the country code
    return digitsOnly.slice(1).replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  } else {
    // If the phone number doesn't have 10 digits, return it as is
    return phoneNumber;
  }
};

export const convertDateToUTC = (dateWithTZ: Date) => {
  // Create a new Date object from the input date with timezone
  const date = new Date(dateWithTZ);
  // Get the UTC components of the date
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const day = String(date.getUTCDate()).padStart(2, '0');
  // Format as yyyy-MM-dd
  return `${year}-${month}-${day}`;
};

export const isDemoMode = import.meta.env.VITE_IS_DEMO === 'true';

/**
 * Display name for a person, from the identity fields `profiles` carries.
 * `fallback` is what to show when there is no name — a dash in tables, a word
 * like `'Driver'` in headings, or `person?.email ?? '—'` where an email is the
 * better stand-in.
 */
export const formatPersonName = (
  person: { first_name?: string | null; last_initial?: string | null } | null | undefined,
  fallback = '—'
): string => [person?.first_name, person?.last_initial].filter(Boolean).join(' ') || fallback;

/** Locale date for a nullable timestamp column, or a dash. */
export const formatDate = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleDateString() : '—';

/** Locale date and time for a nullable timestamp column, or a dash. */
export const formatDateTime = (value: string | null | undefined): string =>
  value ? new Date(value).toLocaleString() : '—';

/**
 * The current query string with some params changed, for links that flip one
 * filter and keep the rest. A `null` value drops the param.
 */
export const hrefWithParams = (url: URL, changes: Record<string, string | null>): string => {
  const params = new URLSearchParams(url.searchParams);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  return `?${params.toString()}`;
};
