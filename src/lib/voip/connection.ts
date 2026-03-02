/**
 * VoIP Connection Service
 * CRUD operations for VoIP provider connections (Telnyx, VoIP.ms, FusionPBX)
 * Credentials encrypted via crypto.ts (AES-256-GCM)
 */

import { prisma } from '@/lib/db';
import { encryptToken, decryptToken } from '@/lib/platform/crypto';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VoipProvider = 'telnyx' | 'voipms' | 'fusionpbx';

export interface VoipConnectionInput {
  provider: VoipProvider;
  apiKey?: string;
  apiSecret?: string;
  accountSid?: string;
  pbxHost?: string;
  pbxPort?: number;
  eslPassword?: string;
  isEnabled?: boolean;
}

export interface VoipConnectionPublic {
  id: string;
  provider: string;
  isEnabled: boolean;
  pbxHost: string | null;
  pbxPort: number | null;
  lastSyncAt: Date | null;
  syncStatus: string | null;
  syncError: string | null;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  hasEslPassword: boolean;
  phoneNumberCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Create or update a VoIP connection with encrypted credentials.
 */
export async function upsertVoipConnection(
  input: VoipConnectionInput,
  userId: string
): Promise<VoipConnectionPublic> {
  const data = {
    provider: input.provider,
    isEnabled: input.isEnabled ?? false,
    apiKey: encryptToken(input.apiKey),
    apiSecret: encryptToken(input.apiSecret),
    accountSid: input.accountSid || null,
    pbxHost: input.pbxHost || null,
    pbxPort: input.pbxPort || null,
    eslPassword: encryptToken(input.eslPassword),
    configuredById: userId,
  };

  const conn = await prisma.voipConnection.upsert({
    where: { provider: input.provider },
    create: data,
    update: {
      ...data,
      updatedAt: new Date(),
    },
    include: {
      _count: { select: { phoneNumbers: true } },
    },
  });

  return toPublic(conn);
}

/**
 * Get all VoIP connections (credentials masked).
 */
export async function listVoipConnections(): Promise<VoipConnectionPublic[]> {
  const conns = await prisma.voipConnection.findMany({
    include: {
      _count: { select: { phoneNumbers: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return conns.map(toPublic);
}

/**
 * Get a single connection by provider.
 */
export async function getVoipConnection(
  provider: string
): Promise<VoipConnectionPublic | null> {
  const conn = await prisma.voipConnection.findUnique({
    where: { provider },
    include: {
      _count: { select: { phoneNumbers: true } },
    },
  });

  return conn ? toPublic(conn) : null;
}

/**
 * Get decrypted credentials for a provider (internal use only).
 */
export async function getVoipCredentials(provider: string) {
  const conn = await prisma.voipConnection.findUnique({
    where: { provider },
  });

  if (!conn) return null;

  return {
    apiKey: decryptToken(conn.apiKey),
    apiSecret: decryptToken(conn.apiSecret),
    accountSid: conn.accountSid,
    pbxHost: conn.pbxHost,
    pbxPort: conn.pbxPort,
    eslPassword: decryptToken(conn.eslPassword),
  };
}

/**
 * Delete a VoIP connection.
 */
export async function deleteVoipConnection(provider: string): Promise<void> {
  await prisma.voipConnection.delete({
    where: { provider },
  });
}

/**
 * Test connection to a VoIP provider.
 */
export async function testVoipConnection(
  provider: string
): Promise<{ ok: boolean; message: string }> {
  const creds = await getVoipCredentials(provider);
  if (!creds) {
    return { ok: false, message: 'Connection not found' };
  }

  try {
    switch (provider) {
      case 'fusionpbx': {
        if (!creds.pbxHost || !creds.eslPassword) {
          return { ok: false, message: 'PBX host and ESL password required' };
        }
        // ESL connection test will be implemented when esl-lite is available
        return { ok: true, message: 'FusionPBX credentials configured' };
      }
      case 'telnyx': {
        if (!creds.apiKey) {
          return { ok: false, message: 'Telnyx API key required' };
        }
        // Test by fetching account balance
        const res = await fetch('https://api.telnyx.com/v2/balance', {
          headers: { Authorization: `Bearer ${creds.apiKey}` },
        });
        if (!res.ok) {
          return { ok: false, message: `Telnyx API error: ${res.status}` };
        }
        return { ok: true, message: 'Telnyx connection OK' };
      }
      case 'voipms': {
        if (!creds.apiKey || !creds.apiSecret) {
          return { ok: false, message: 'VoIP.ms username and password required' };
        }
        const url = `https://voip.ms/api/v1/rest.php?api_username=${encodeURIComponent(creds.apiKey)}&api_password=${encodeURIComponent(creds.apiSecret)}&method=getBalance`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== 'success') {
          return { ok: false, message: `VoIP.ms error: ${data.status}` };
        }
        return { ok: true, message: 'VoIP.ms connection OK' };
      }
      default:
        return { ok: false, message: `Unknown provider: ${provider}` };
    }
  } catch (error) {
    logger.error(`VoIP connection test failed for ${provider}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Update sync status for a connection.
 */
export async function updateSyncStatus(
  provider: string,
  status: string,
  error?: string
): Promise<void> {
  await prisma.voipConnection.update({
    where: { provider },
    data: {
      syncStatus: status,
      syncError: error || null,
      lastSyncAt: status === 'completed' ? new Date() : undefined,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPublic(conn: any): VoipConnectionPublic {
  return {
    id: conn.id,
    provider: conn.provider,
    isEnabled: conn.isEnabled,
    pbxHost: conn.pbxHost,
    pbxPort: conn.pbxPort,
    lastSyncAt: conn.lastSyncAt,
    syncStatus: conn.syncStatus,
    syncError: conn.syncError,
    hasApiKey: !!conn.apiKey,
    hasApiSecret: !!conn.apiSecret,
    hasEslPassword: !!conn.eslPassword,
    phoneNumberCount: conn._count?.phoneNumbers ?? 0,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt,
  };
}
