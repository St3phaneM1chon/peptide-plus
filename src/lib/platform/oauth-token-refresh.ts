/**
 * OAuth Token Auto-Refresh Middleware
 * Chantier 2.1: Proactively refresh tokens before they expire.
 *
 * Usage: Call ensureValidTokens() periodically (e.g. from a cron route)
 * or before any platform API call.
 */

import { prisma } from '@/lib/db';
import { refreshToken, type Platform } from './oauth';
import { logger } from '@/lib/logger';

// Refresh buffer: refresh tokens that expire within this window
const REFRESH_BUFFER_MS = 10 * 60 * 1000; // 10 minutes before expiry

interface RefreshResult {
  platform: string;
  status: 'refreshed' | 'valid' | 'failed' | 'no_token';
  error?: string;
}

/**
 * Check all platform connections and proactively refresh tokens nearing expiry.
 */
export async function ensureValidTokens(): Promise<RefreshResult[]> {
  const connections = await prisma.platformConnection.findMany({
    where: { isEnabled: true, accessToken: { not: null } },
    select: { platform: true, tokenExpiresAt: true, refreshToken: true },
  });

  const results: RefreshResult[] = [];
  const now = Date.now();

  for (const conn of connections) {
    const platform = conn.platform as Platform;

    if (!conn.tokenExpiresAt) {
      results.push({ platform, status: 'valid' }); // No expiry info, assume valid
      continue;
    }

    if (!conn.refreshToken) {
      results.push({ platform, status: 'no_token' });
      continue;
    }

    const expiresAt = new Date(conn.tokenExpiresAt).getTime();
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry > REFRESH_BUFFER_MS) {
      results.push({ platform, status: 'valid' });
      continue;
    }

    // Token is about to expire or already expired — refresh it
    logger.info(`[OAuthRefresh] Refreshing token for ${platform} (expires in ${Math.round(timeUntilExpiry / 1000)}s)`);

    const result = await refreshToken(platform);
    if (result.success) {
      results.push({ platform, status: 'refreshed' });
      logger.info(`[OAuthRefresh] Successfully refreshed ${platform}`);
    } else {
      results.push({ platform, status: 'failed', error: result.error });
      logger.error(`[OAuthRefresh] Failed to refresh ${platform}`, { error: result.error });
    }
  }

  return results;
}

/**
 * Check if any token is about to expire and needs attention.
 * Returns platforms that will expire within the buffer window.
 */
export async function getExpiringTokens(): Promise<Array<{ platform: string; expiresAt: Date; minutesLeft: number }>> {
  const connections = await prisma.platformConnection.findMany({
    where: {
      isEnabled: true,
      accessToken: { not: null },
      tokenExpiresAt: { not: null },
    },
    select: { platform: true, tokenExpiresAt: true },
  });

  const now = Date.now();
  return connections
    .filter((c) => {
      const expiresAt = new Date(c.tokenExpiresAt!).getTime();
      return expiresAt - now < REFRESH_BUFFER_MS;
    })
    .map((c) => ({
      platform: c.platform,
      expiresAt: c.tokenExpiresAt!,
      minutesLeft: Math.round((new Date(c.tokenExpiresAt!).getTime() - now) / 60_000),
    }));
}
