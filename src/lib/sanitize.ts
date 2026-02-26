/**
 * SANITIZATION UTILITIES (BE-SEC-03 extended)
 * Centralized text and URL sanitization for user-submitted content.
 * Use these functions on ALL user-supplied text before storing in the database.
 */

// FAILLE-016 FIX: Delegate IP range checking to the canonical implementation in security.ts
// which covers all private/reserved IPv4 and IPv6 ranges.
import { isPrivateOrReservedIP } from '@/lib/security';

/**
 * Escape HTML entities to prevent stored XSS.
 * Use for fields that will be rendered in HTML contexts (emails, admin views).
 */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize a URL. Returns null if the URL is invalid or uses
 * a forbidden protocol (only http: and https: are allowed).
 * Also blocks localhost/private IPs to prevent SSRF.
 *
 * FAILLE-016 FIX: Delegates to isPrivateOrReservedIP() which covers all RFC-defined
 * private and reserved ranges (IPv4 + IPv6 including link-local, ULA, CGNAT, loopback).
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Only allow HTTP(S)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    // Block local/private/reserved addresses (SSRF prevention) — complete coverage
    if (isPrivateOrReservedIP(parsed.hostname)) return null;

    return parsed.toString();
  } catch (error) {
    console.error('[Sanitize] URL validation/parsing failed:', error);
    return null;
  }
}

/**
 * Strip ALL HTML tags from input, returning plain text only.
 * Use for fields that should never contain markup (names, codes, plain text fields).
 */
export function stripHtml(input: string): string {
  if (!input) return '';
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Remove control characters (except newline, carriage return, tab).
 * Apply to any user text before storage to prevent null-byte injection
 * and other control-character attacks.
 */
export function stripControlChars(input: string): string {
  if (!input) return '';
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitize a webhook payload by stripping PCI/PII-sensitive fields
 * before persisting to the database.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Webhook payloads are dynamic
export function sanitizeWebhookPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return payload;

  const sanitized = { ...payload };

  // Remove PCI-sensitive card/payment method details
  delete sanitized.card;
  delete sanitized.payment_method_details;
  delete sanitized.source;
  delete sanitized.payment_method;

  // Remove PII fields that should not be stored
  delete sanitized.billing_details;
  delete sanitized.shipping;

  // Sanitize nested charges array (Stripe)
  if (sanitized.charges?.data && Array.isArray(sanitized.charges.data)) {
    sanitized.charges.data = sanitized.charges.data.map((c: Record<string, unknown>) => {
      const cleaned = { ...c };
      delete cleaned.payment_method_details;
      delete cleaned.source;
      delete cleaned.billing_details;
      delete cleaned.payment_method;
      return cleaned;
    });
  }

  // Sanitize nested object (PayPal resource)
  if (sanitized.resource) {
    const resource = { ...sanitized.resource };
    delete resource.payer;
    delete resource.shipping;
    sanitized.resource = resource;
  }

  return sanitized;
}
