/**
 * FreeSWITCH Event Socket Layer (ESL) Client
 * Provides control of FreeSWITCH via ESL for real-time call management.
 * Uses lazy initialization pattern (KB-PP-BUILD-002).
 */

import { logger } from '@/lib/logger';
import { getVoipCredentials } from './connection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EslConfig {
  host: string;
  port: number;
  password: string;
}

export interface ChannelInfo {
  uuid: string;
  direction: string;
  callerNumber: string;
  calledNumber: string;
  state: string;
  created: string;
}

export interface OriginateParams {
  destination: string;
  callerIdNumber: string;
  callerIdName?: string;
  extension: string;
  context?: string;
  dialplan?: string;
}

// ---------------------------------------------------------------------------
// ESL Client (lazy singleton)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _eslClient: any = null;
let _eslConfig: EslConfig | null = null;

/**
 * Get ESL configuration from the FusionPBX VoipConnection.
 */
async function getEslConfig(): Promise<EslConfig | null> {
  if (_eslConfig) return _eslConfig;

  const creds = await getVoipCredentials('fusionpbx');
  if (!creds?.pbxHost || !creds?.eslPassword) {
    return null;
  }

  _eslConfig = {
    host: creds.pbxHost,
    port: creds.pbxPort || 8021,
    password: creds.eslPassword,
  };

  return _eslConfig;
}

/**
 * Get or create ESL client connection.
 * Returns null if esl-lite is not installed or config is missing.
 */
async function getEslClient() {
  if (_eslClient) return _eslClient;

  const config = await getEslConfig();
  if (!config) {
    logger.warn('[ESL] No FusionPBX connection configured');
    return null;
  }

  try {
    // Dynamic import to avoid crash if esl-lite not installed
    const esl = await import('esl-lite');
    _eslClient = new esl.FreeSwitchClient({
      host: config.host,
      port: config.port,
      password: config.password,
    });
    await _eslClient.connect();
    logger.info(`[ESL] Connected to FreeSWITCH at ${config.host}:${config.port}`);
    return _eslClient;
  } catch (error) {
    logger.error('[ESL] Connection failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    _eslClient = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// ESL Commands
// ---------------------------------------------------------------------------

/**
 * Execute a FreeSWITCH API command via ESL.
 */
export async function eslApi(command: string): Promise<string | null> {
  const client = await getEslClient();
  if (!client) return null;

  try {
    const result = await client.api(command);
    return result?.body || null;
  } catch (error) {
    logger.error(`[ESL] API command failed: ${command}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Originate a call from an extension to a destination.
 */
export async function originateCall(params: OriginateParams): Promise<string | null> {
  const cmd = `originate {origination_caller_id_number=${params.callerIdNumber},origination_caller_id_name=${params.callerIdName || params.callerIdNumber}}sofia/internal/${params.destination} ${params.extension} XML ${params.context || 'default'}`;

  const result = await eslApi(cmd);
  if (result?.startsWith('+OK')) {
    const uuid = result.replace('+OK ', '').trim();
    logger.info(`[ESL] Call originated: ${uuid}`);
    return uuid;
  }

  logger.warn(`[ESL] Originate failed: ${result}`);
  return null;
}

/**
 * Hang up a call by UUID.
 */
export async function hangupCall(
  uuid: string,
  cause: string = 'NORMAL_CLEARING'
): Promise<boolean> {
  const result = await eslApi(`uuid_kill ${uuid} ${cause}`);
  return result?.startsWith('+OK') || false;
}

/**
 * Transfer a call to another extension.
 */
export async function transferCall(
  uuid: string,
  destination: string,
  context: string = 'default'
): Promise<boolean> {
  const result = await eslApi(`uuid_transfer ${uuid} ${destination} XML ${context}`);
  return result?.startsWith('+OK') || false;
}

/**
 * Put a call on hold.
 */
export async function holdCall(uuid: string): Promise<boolean> {
  const result = await eslApi(`uuid_hold ${uuid}`);
  return result?.startsWith('+OK') || false;
}

/**
 * Resume a held call.
 */
export async function unholdCall(uuid: string): Promise<boolean> {
  const result = await eslApi(`uuid_hold off ${uuid}`);
  return result?.startsWith('+OK') || false;
}

/**
 * Start recording a call.
 */
export async function startRecording(
  uuid: string,
  filepath: string
): Promise<boolean> {
  const result = await eslApi(`uuid_record ${uuid} start ${filepath}`);
  return result?.startsWith('+OK') || false;
}

/**
 * Stop recording a call.
 */
export async function stopRecording(
  uuid: string,
  filepath: string
): Promise<boolean> {
  const result = await eslApi(`uuid_record ${uuid} stop ${filepath}`);
  return result?.startsWith('+OK') || false;
}

/**
 * Send DTMF digits to a call.
 */
export async function sendDtmf(
  uuid: string,
  digits: string
): Promise<boolean> {
  const result = await eslApi(`uuid_send_dtmf ${uuid} ${digits}`);
  return result?.startsWith('+OK') || false;
}

/**
 * Get list of active channels (calls).
 */
export async function getActiveChannels(): Promise<ChannelInfo[]> {
  const result = await eslApi('show channels as json');
  if (!result) return [];

  try {
    const data = JSON.parse(result);
    const rows = data.rows || [];
    return rows.map((row: Record<string, string>) => ({
      uuid: row.uuid || '',
      direction: row.direction || '',
      callerNumber: row.cid_num || '',
      calledNumber: row.dest || '',
      state: row.callstate || '',
      created: row.created || '',
    }));
  } catch {
    return [];
  }
}

/**
 * Get FreeSWITCH status (uptime, sessions, etc.).
 */
export async function getFreeSwitchStatus(): Promise<string | null> {
  return eslApi('status');
}

/**
 * Disconnect ESL client (cleanup).
 */
export function disconnectEsl(): void {
  if (_eslClient) {
    try {
      _eslClient.disconnect();
    } catch {
      // ignore
    }
    _eslClient = null;
  }
  _eslConfig = null;
}
