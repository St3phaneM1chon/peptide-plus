/**
 * Centralized phone normalization utilities for CRM
 *
 * Used by: DNC checks, deduplication, campaign bridge
 */

/**
 * Strip all non-digit characters from a phone number
 */
export function stripPhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Generate all E.164-like variants of a phone number for DNC matching.
 * Covers: raw digits, +digits, +1digits, and without leading 1.
 */
export function phoneDncVariants(phone: string): string[] {
  const digits = stripPhone(phone);
  if (!digits) return [];

  const variants = [digits, `+${digits}`, `+1${digits}`];
  if (digits.startsWith('1') && digits.length === 11) {
    variants.push(digits.substring(1));
  }
  // International prefixes (001, 00)
  if (digits.startsWith('001')) {
    variants.push(digits.substring(3));
  } else if (digits.startsWith('00')) {
    variants.push(digits.substring(2));
  }

  return [...new Set(variants)];
}

/**
 * Convert a phone number to E.164 format (assumes North American if 10 digits).
 */
export function toE164(phone: string): string {
  const digits = stripPhone(phone);
  if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}
