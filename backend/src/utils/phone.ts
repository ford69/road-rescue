/** Ghana mobile prefixes (local 0XX and international +233XX). */
const GHANA_PREFIXES = ['24', '20', '26', '27', '50', '53', '54', '55', '59'] as const;

/**
 * Normalize a Ghana phone number to E.164 (+233XXXXXXXXX).
 */
export function normalizeGhanaPhone(input: string): string | null {
  const digits = input.replace(/[\s\-()]/g, '');

  let national: string | null = null;

  if (/^\+233\d{9}$/.test(digits)) {
    national = digits.slice(4);
  } else if (/^233\d{9}$/.test(digits)) {
    national = digits.slice(3);
  } else if (/^0\d{9}$/.test(digits)) {
    national = digits.slice(1);
  } else {
    return null;
  }

  const prefix = national.slice(0, 2);
  if (!(GHANA_PREFIXES as readonly string[]).includes(prefix)) {
    return null;
  }

  return `+233${national}`;
}

export function isValidGhanaPhone(input: string): boolean {
  return normalizeGhanaPhone(input) !== null;
}

export const ghanaPhoneMessage =
  'Enter a valid Ghana phone number (e.g. 0241234567 or +233241234567)';
