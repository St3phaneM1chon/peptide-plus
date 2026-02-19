/**
 * Shared PayPal utility
 * - Single source of truth for PAYPAL_API_URL
 * - Caches the OAuth access token with expiry tracking
 *   (PayPal tokens last ~9 hours; we cache for 8 hours to be safe)
 */

const PAYPAL_API_URL =
  process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

export { PAYPAL_API_URL };

// ── Cached token state ─────────────────────────────────────────────────────
let cachedToken: string | null = null;
let tokenExpiresAt = 0; // Unix ms

// PayPal tokens are valid for ~9 hours (32 400 s).
// We cache for 8 hours to leave a safety margin.
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Get a PayPal OAuth access token.
 * Returns a cached value when still valid; otherwise fetches a new one.
 */
export async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set');
  }

  const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authString}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'Unknown error');
    throw new Error(`PayPal OAuth token request failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  // PayPal returns `expires_in` in seconds. If present, use it; else fall back to 8h.
  const expiresInMs = data.expires_in
    ? data.expires_in * 1000 - 60_000 // subtract 1 minute buffer
    : TOKEN_TTL_MS;

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + expiresInMs;

  return data.access_token;
}
