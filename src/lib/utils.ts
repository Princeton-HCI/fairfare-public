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
