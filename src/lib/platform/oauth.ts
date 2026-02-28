/**
 * Unified OAuth Manager for Platform Integrations
 * Handles OAuth flows for Zoom, Teams, Google Meet/YouTube, Webex
 */

import { prisma } from '@/lib/db';
import { encryptToken, decryptToken } from './crypto';
import { logger } from '@/lib/logger';
import { createHash, randomBytes } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Platform = 'zoom' | 'teams' | 'google-meet' | 'webex' | 'youtube';

interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // seconds
  tokenType?: string;
  scope?: string;
}

interface PlatformOAuthConfig {
  authUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
}

// ---------------------------------------------------------------------------
// Platform Configs
// ---------------------------------------------------------------------------

function getCallbackUrl(platform: Platform): string {
  // Prefer AUTH_URL / NEXTAUTH_URL for OAuth callbacks (server-side, matches actual host)
  // NEXT_PUBLIC_APP_URL is the public-facing URL which may differ from the auth callback origin
  const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com';
  return `${baseUrl}/api/admin/platform-connections/${platform}/callback`;
}

function getPlatformConfig(platform: Platform): PlatformOAuthConfig {
  switch (platform) {
    case 'zoom':
      return {
        authUrl: 'https://zoom.us/oauth/authorize',
        tokenUrl: 'https://zoom.us/oauth/token',
        revokeUrl: 'https://zoom.us/oauth/revoke',
        scopes: [
          'cloud_recording:read:recording',
          'meeting:read:list_meetings',
          'user:read:user',
          'user:read:email',
        ],
        clientId: process.env.ZOOM_CLIENT_ID || '',
        clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
      };

    case 'teams':
      return {
        authUrl: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/oauth2/v2.0/authorize`,
        tokenUrl: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || 'common'}/oauth2/v2.0/token`,
        revokeUrl: undefined, // Azure AD doesn't have a standard revoke endpoint
        scopes: [
          'https://graph.microsoft.com/OnlineMeetings.Read.All',
          'https://graph.microsoft.com/OnlineMeetings.ReadWrite',
          'https://graph.microsoft.com/CallRecords.Read.All',
          'https://graph.microsoft.com/Files.Read.All',
          'offline_access',
        ],
        clientId: process.env.AZURE_AD_CLIENT_ID || '',
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
      };

    case 'google-meet':
      return {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        revokeUrl: 'https://oauth2.googleapis.com/revoke',
        scopes: [
          'https://www.googleapis.com/auth/meetings.space.readonly',
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/calendar.events',
        ],
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      };

    case 'youtube':
      return {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        revokeUrl: 'https://oauth2.googleapis.com/revoke',
        scopes: [
          'https://www.googleapis.com/auth/youtube.readonly',
          'https://www.googleapis.com/auth/youtube.upload',
        ],
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      };

    case 'webex':
      return {
        authUrl: 'https://webexapis.com/v1/authorize',
        tokenUrl: 'https://webexapis.com/v1/access_token',
        revokeUrl: undefined,
        scopes: [
          'spark:recordings_read',
          'meeting:recordings_read',
          'meeting:schedules_write',
        ],
        clientId: process.env.WEBEX_CLIENT_ID || '',
        clientSecret: process.env.WEBEX_CLIENT_SECRET || '',
      };

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

// V-052 FIX: Redact potential tokens/secrets from log output
function redactSensitive(text: string): string {
  // Redact anything that looks like an access/refresh token (long alphanumeric strings)
  return text
    .replace(/"(access_token|refresh_token|token|id_token|client_secret)"\s*:\s*"[^"]+"/gi, '"$1":"[REDACTED]"')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, 'Bearer [REDACTED]')
    .replace(/ya29\.[A-Za-z0-9._\-]+/g, 'ya29.[REDACTED]') // Google tokens
    .replace(/eyJ[A-Za-z0-9_\-]{20,}/g, '[JWT_REDACTED]'); // JWT tokens
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return redactSensitive(error.message);
  return redactSensitive(String(error));
}

// ---------------------------------------------------------------------------
// OAuth Manager
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PKCE helpers (V-022 fix: OAuth Authorization Code with PKCE)
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

function generateRandomState(): string {
  return randomBytes(32).toString('hex');
}

// In-memory store for PKCE verifiers and state (per-session, short-lived)
// In production, use a Redis/DB store with TTL
const pkceStore = new Map<string, { codeVerifier: string; platform: Platform; createdAt: number }>();

// Clean expired entries (older than 10 minutes)
function cleanPkceStore() {
  const now = Date.now();
  for (const [key, val] of pkceStore.entries()) {
    if (now - val.createdAt > 10 * 60 * 1000) {
      pkceStore.delete(key);
    }
  }
}

/**
 * Generate the authorization URL to redirect the user to the platform's OAuth consent screen.
 * V-021/V-022 fix: Uses cryptographic random state + PKCE code challenge.
 */
export function getAuthorizationUrl(platform: Platform, _state?: string): { url: string; state: string } {
  const config = getPlatformConfig(platform);
  const callbackUrl = getCallbackUrl(platform);

  // V-021 fix: Generate cryptographic random state (never use platform name)
  const oauthState = generateRandomState();

  // V-022 fix: Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store verifier for the callback
  cleanPkceStore();
  pkceStore.set(oauthState, { codeVerifier, platform, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: callbackUrl,
    response_type: 'code',
    state: oauthState,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  // Platform-specific scope formatting
  if (platform === 'teams') {
    params.set('scope', config.scopes.join(' '));
    params.set('response_mode', 'query');
  } else if (platform === 'google-meet' || platform === 'youtube') {
    params.set('scope', config.scopes.join(' '));
    params.set('access_type', 'offline');
    params.set('prompt', 'consent');
  } else if (platform === 'zoom') {
    // Zoom doesn't use scope param in authorize URL for OAuth apps
  } else {
    params.set('scope', config.scopes.join(' '));
  }

  return { url: `${config.authUrl}?${params.toString()}`, state: oauthState };
}

/**
 * Validate OAuth state and retrieve PKCE verifier.
 */
export function validateOAuthState(state: string): { codeVerifier: string; platform: Platform } | null {
  const entry = pkceStore.get(state);
  if (!entry) return null;

  // Check expiry (10 minutes)
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) {
    pkceStore.delete(state);
    return null;
  }

  // One-time use: delete after retrieval
  pkceStore.delete(state);
  return { codeVerifier: entry.codeVerifier, platform: entry.platform };
}

/**
 * Exchange authorization code for tokens and store them in PlatformConnection.
 * V-022 fix: Includes PKCE code_verifier in token exchange.
 */
export async function handleCallback(
  platform: Platform,
  code: string,
  userId?: string,
  codeVerifier?: string,
): Promise<{ success: boolean; error?: string }> {
  const config = getPlatformConfig(platform);
  const callbackUrl = getCallbackUrl(platform);

  try {
    const bodyParams: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    };

    // V-022 fix: Include PKCE code_verifier if available
    if (codeVerifier) {
      bodyParams.code_verifier = codeVerifier;
    }

    const body = new URLSearchParams(bodyParams);

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[OAuth] Token exchange failed for ${platform}:`, redactSensitive(errorText));
      return { success: false, error: `Token exchange failed: ${response.status}` };
    }

    const tokens: OAuthTokens & Record<string, unknown> = await response.json();

    // Store encrypted tokens
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    await prisma.platformConnection.upsert({
      where: { platform },
      create: {
        platform,
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken || null),
        tokenExpiresAt: expiresAt,
        isEnabled: true,
        connectedById: userId || null,
        syncStatus: 'idle',
      },
      update: {
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken || null),
        tokenExpiresAt: expiresAt,
        isEnabled: true,
        connectedById: userId || undefined,
        syncStatus: 'idle',
        syncError: null,
      },
    });

    logger.info(`[OAuth] Successfully connected ${platform}`);
    return { success: true };
  } catch (error) {
    logger.error(`[OAuth] Callback error for ${platform}:`, safeErrorMessage(error));
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshToken(platform: Platform): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  const config = getPlatformConfig(platform);

  const connection = await prisma.platformConnection.findUnique({
    where: { platform },
  });

  if (!connection?.refreshToken) {
    return { success: false, error: 'No refresh token available' };
  }

  const currentRefreshToken = decryptToken(connection.refreshToken);
  if (!currentRefreshToken) {
    return { success: false, error: 'Failed to decrypt refresh token' };
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentRefreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`[OAuth] Token refresh failed for ${platform}:`, redactSensitive(errorText));

      await prisma.platformConnection.update({
        where: { platform },
        data: { syncStatus: 'error', syncError: `Token refresh failed: ${response.status}` },
      });

      return { success: false, error: `Token refresh failed: ${response.status}` };
    }

    const tokens: OAuthTokens = await response.json();
    const expiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : null;

    await prisma.platformConnection.update({
      where: { platform },
      data: {
        accessToken: encryptToken(tokens.accessToken),
        // Some platforms return a new refresh token
        ...(tokens.refreshToken ? { refreshToken: encryptToken(tokens.refreshToken) } : {}),
        tokenExpiresAt: expiresAt,
        syncError: null,
      },
    });

    return { success: true, accessToken: tokens.accessToken };
  } catch (error) {
    logger.error(`[OAuth] Refresh error for ${platform}:`, safeErrorMessage(error));
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get a valid access token, auto-refreshing if expired.
 */
export async function getValidAccessToken(platform: Platform): Promise<string | null> {
  const connection = await prisma.platformConnection.findUnique({
    where: { platform },
  });

  if (!connection?.accessToken || !connection.isEnabled) {
    return null;
  }

  // Check if token is expired (with 5-minute buffer)
  if (connection.tokenExpiresAt) {
    const bufferMs = 5 * 60 * 1000;
    if (new Date(connection.tokenExpiresAt).getTime() - bufferMs < Date.now()) {
      const result = await refreshToken(platform);
      if (result.success && result.accessToken) {
        return result.accessToken;
      }
      return null;
    }
  }

  return decryptToken(connection.accessToken);
}

/**
 * Revoke tokens and disconnect a platform.
 */
export async function revokeConnection(platform: Platform): Promise<{ success: boolean }> {
  const config = getPlatformConfig(platform);
  const connection = await prisma.platformConnection.findUnique({
    where: { platform },
  });

  if (!connection) {
    return { success: true };
  }

  // Try to revoke on the platform side
  if (config.revokeUrl && connection.accessToken) {
    const token = decryptToken(connection.accessToken);
    if (token) {
      try {
        if (platform === 'zoom') {
          await fetch(config.revokeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
            },
            body: `token=${token}`,
          });
        } else if (platform === 'google-meet' || platform === 'youtube') {
          await fetch(`${config.revokeUrl}?token=${token}`, { method: 'POST' });
        }
      } catch (error) {
        logger.warn(`[OAuth] Revocation request failed for ${platform}:`, safeErrorMessage(error));
        // Continue with local cleanup
      }
    }
  }

  // Clear tokens and disable
  await prisma.platformConnection.update({
    where: { platform },
    data: {
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      isEnabled: false,
      syncStatus: 'idle',
      syncError: null,
      webhookId: null,
    },
  });

  logger.info(`[OAuth] Disconnected ${platform}`);
  return { success: true };
}

/**
 * Test a platform connection by making a simple API call.
 */
export async function testConnection(platform: Platform): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  const token = await getValidAccessToken(platform);
  if (!token) {
    return { success: false, error: 'No valid access token' };
  }

  try {
    let testUrl: string;
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

    switch (platform) {
      case 'zoom':
        testUrl = 'https://api.zoom.us/v2/users/me';
        break;
      case 'teams':
        testUrl = 'https://graph.microsoft.com/v1.0/me';
        break;
      case 'google-meet':
      case 'youtube':
        testUrl = 'https://www.googleapis.com/oauth2/v2/userinfo';
        break;
      case 'webex':
        testUrl = 'https://webexapis.com/v1/people/me';
        break;
      default:
        return { success: false, error: `Unknown platform: ${platform}` };
    }

    const response = await fetch(testUrl, { headers });

    if (response.ok) {
      const data = await response.json();
      const name = data.display_name || data.displayName || data.name || data.email || 'Connected';
      return { success: true, message: `Connected as: ${name}` };
    }

    return { success: false, error: `API returned ${response.status}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Connection test failed' };
  }
}

/**
 * List of supported platforms with their display info.
 */
export const SUPPORTED_PLATFORMS: Array<{
  id: Platform;
  name: string;
  icon: string;
  description: string;
  hasWebhook: boolean;
}> = [
  { id: 'zoom', name: 'Zoom', icon: 'Video', description: 'Import cloud recordings from Zoom meetings', hasWebhook: true },
  { id: 'teams', name: 'Microsoft Teams', icon: 'Users', description: 'Import recordings from Teams meetings via Graph API', hasWebhook: true },
  { id: 'google-meet', name: 'Google Meet', icon: 'Monitor', description: 'Import recordings from Google Meet sessions', hasWebhook: false },
  { id: 'webex', name: 'Cisco Webex', icon: 'Globe', description: 'Import recordings from Webex meetings', hasWebhook: true },
  { id: 'youtube', name: 'YouTube', icon: 'Play', description: 'Import videos and publish to YouTube channel', hasWebhook: false },
];
