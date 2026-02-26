/**
 * Email Tracking Utilities
 *
 * Provides tracking pixel injection, click-through link wrapping,
 * and ID encoding/decoding for open/click event tracking.
 *
 * Security:
 * - IDs are encoded with HMAC to prevent enumeration
 * - Only marketing emails get tracking (not transactional)
 * - Unsubscribe links are never wrapped
 */

import { createHmac } from 'crypto';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TRACKING_SECRET = process.env.EMAIL_TRACKING_SECRET || process.env.NEXTAUTH_SECRET || 'default-tracking-secret';

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://biocyclepeptides.com';
}

// ---------------------------------------------------------------------------
// ID Encoding / Decoding (HMAC-based to prevent enumeration)
// ---------------------------------------------------------------------------

/**
 * Encode an EmailLog ID for use in tracking URLs.
 * Format: base64url(id + '.' + hmac_signature)
 * This prevents attackers from guessing valid email log IDs.
 */
export function encodeTrackingId(emailLogId: string): string {
  const signature = createHmac('sha256', TRACKING_SECRET)
    .update(emailLogId)
    .digest('hex')
    .slice(0, 16); // 16 hex chars = 64 bits, sufficient for anti-enumeration
  const payload = `${emailLogId}.${signature}`;
  return Buffer.from(payload).toString('base64url');
}

/**
 * Decode and verify a tracking ID from a URL parameter.
 * Returns the original EmailLog ID if valid, null if tampered.
 */
export function decodeTrackingId(encoded: string): string | null {
  try {
    const payload = Buffer.from(encoded, 'base64url').toString('utf-8');
    const dotIndex = payload.lastIndexOf('.');
    if (dotIndex === -1) return null;

    const id = payload.slice(0, dotIndex);
    const signature = payload.slice(dotIndex + 1);

    const expectedSignature = createHmac('sha256', TRACKING_SECRET)
      .update(id)
      .digest('hex')
      .slice(0, 16);

    // Constant-time comparison would be ideal but the HMAC truncation
    // already limits timing attack surface. Use simple comparison.
    if (signature !== expectedSignature) {
      logger.warn('[tracking] Invalid tracking ID signature', { encoded: encoded.slice(0, 20) });
      return null;
    }

    return id;
  } catch (err) {
    logger.warn('[tracking] Failed to decode tracking ID', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tracking URL Generation
// ---------------------------------------------------------------------------

/**
 * Generate the tracking pixel URL for a given EmailLog ID.
 */
export function getTrackingPixelUrl(emailLogId: string): string {
  const eid = encodeTrackingId(emailLogId);
  return `${getBaseUrl()}/api/tracking/email?eid=${eid}`;
}

/**
 * Generate a click tracking URL that wraps the original destination.
 */
export function getClickTrackingUrl(emailLogId: string, originalUrl: string): string {
  const eid = encodeTrackingId(emailLogId);
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${getBaseUrl()}/api/tracking/click?eid=${eid}&url=${encodedUrl}`;
}

// ---------------------------------------------------------------------------
// HTML Injection
// ---------------------------------------------------------------------------

/** Regex to match unsubscribe-related links (case-insensitive) */
const UNSUBSCRIBE_LINK_RE = /unsubscribe|list-unsubscribe|opt[_-]?out|desinscrire|desinscription/i;

/**
 * Inject a 1x1 tracking pixel into HTML email content.
 * Inserts just before </body> if present, otherwise appends to end.
 */
export function injectTrackingPixel(html: string, emailLogId: string): string {
  const pixelUrl = getTrackingPixelUrl(emailLogId);
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;

  // Insert before </body> if present
  const bodyCloseIndex = html.lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + pixelTag + html.slice(bodyCloseIndex);
  }

  // Fallback: append to end
  return html + pixelTag;
}

/**
 * Wrap all <a href="..."> links with click tracking redirects.
 * Skips:
 * - Unsubscribe links (by URL content or link text)
 * - mailto: links
 * - Anchor links (#)
 * - Already-tracked links (pointing to /api/tracking/)
 */
export function wrapLinksWithTracking(html: string, emailLogId: string): string {
  // Match <a ... href="..." ...>...</a> (non-greedy, handles multiline)
  const linkRegex = /<a\s([^>]*?)href=["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi;

  return html.replace(linkRegex, (fullMatch, beforeHref, url, afterHref, innerText) => {
    // Skip non-http links
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return fullMatch;
    }

    // Skip already-tracked links
    if (url.includes('/api/tracking/')) {
      return fullMatch;
    }

    // Skip unsubscribe links (check URL and link text)
    if (UNSUBSCRIBE_LINK_RE.test(url) || UNSUBSCRIBE_LINK_RE.test(innerText)) {
      return fullMatch;
    }

    const trackedUrl = getClickTrackingUrl(emailLogId, url);
    return `<a ${beforeHref}href="${trackedUrl}"${afterHref}>${innerText}</a>`;
  });
}

/**
 * Add both tracking pixel and link wrapping to an HTML email.
 * Only call this for marketing emails, NOT transactional.
 */
export function addEmailTracking(html: string, emailLogId: string): string {
  let tracked = wrapLinksWithTracking(html, emailLogId);
  tracked = injectTrackingPixel(tracked, emailLogId);
  return tracked;
}
