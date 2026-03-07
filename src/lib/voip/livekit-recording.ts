/**
 * LiveKit Recording Service - Egress recording to Azure Blob Storage
 * Lazy-init pattern (KB-PP-BUILD-002)
 */

import { logger } from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _egressClient: any = null;

function getLiveKitConfig() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!url || !apiKey || !apiSecret) {
    throw new Error('LiveKit not configured');
  }

  return { url, apiKey, apiSecret };
}

async function getEgressClient() {
  if (_egressClient) return _egressClient;

  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const { EgressClient } = await import('livekit-server-sdk');
  _egressClient = new EgressClient(url, apiKey, apiSecret);
  return _egressClient;
}

// ─── Recording Management ──────────────────────────────────────────────────

export interface RecordingOptions {
  roomName: string;
  /** Azure Blob container path for output */
  outputPath?: string;
  /** Video codec: h264 (default), vp8 */
  videoCodec?: string;
  /** Audio codec: opus (default) */
  audioCodec?: string;
}

export async function startRoomRecording(options: RecordingOptions): Promise<string> {
  const client = await getEgressClient();

  const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const containerName = process.env.AZURE_STORAGE_CONTAINER || 'media';

  if (!azureConnectionString) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING required for recording');
  }

  const outputPath = options.outputPath || `recordings/conference/${options.roomName}/${Date.now()}.mp4`;

  const egress = await client.startRoomCompositeEgress(
    options.roomName,
    {
      azure: {
        accountName: extractAzureAccountName(azureConnectionString),
        accountKey: extractAzureAccountKey(azureConnectionString),
        containerName,
        filepath: outputPath,
      },
    },
    {
      layout: 'grid',
      audioOnly: false,
      videoOnly: false,
    }
  );

  const egressId = egress.egressId;
  logger.info('[livekit:recording] Started room recording', {
    roomName: options.roomName,
    egressId,
    outputPath,
  });

  return egressId;
}

export async function stopRecording(egressId: string): Promise<void> {
  const client = await getEgressClient();
  await client.stopEgress(egressId);
  logger.info('[livekit:recording] Stopped recording', { egressId });
}

export async function getEgressInfo(egressId: string) {
  const client = await getEgressClient();
  const list = await client.listEgress({ egressId });
  return list[0] || null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractAzureAccountName(connectionString: string): string {
  const match = connectionString.match(/AccountName=([^;]+)/);
  if (!match) throw new Error('Invalid Azure connection string: missing AccountName');
  return match[1];
}

function extractAzureAccountKey(connectionString: string): string {
  const match = connectionString.match(/AccountKey=([^;]+)/);
  if (!match) throw new Error('Invalid Azure connection string: missing AccountKey');
  return match[1];
}
