/**
 * Telnyx SDK Wrapper - Lazy initialization pattern
 * Used for Call Control API, number management, and webhook verification.
 */

import { logger } from '@/lib/logger';

// Telnyx API base URL
const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

let _apiKey: string | null = null;

function getApiKey(): string {
  if (!_apiKey) {
    const key = process.env.TELNYX_API_KEY;
    if (!key) {
      throw new Error('TELNYX_API_KEY environment variable is not configured');
    }
    _apiKey = key;
  }
  return _apiKey;
}

/**
 * Make an authenticated request to the Telnyx API.
 */
export async function telnyxFetch<T = unknown>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    params?: Record<string, string>;
  } = {}
): Promise<{ data: T }> {
  const { method = 'GET', body, params } = options;

  let url = `${TELNYX_API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${getApiKey()}`,
    'Content-Type': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('[Telnyx API] Request failed', {
      path,
      status: response.status,
      body: errorBody.slice(0, 500),
    });
    throw new Error(`Telnyx API error ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  return response.json();
}

// ── Call Control Commands ─────────────────────────

/**
 * Answer an incoming call.
 */
export async function answerCall(callControlId: string, options?: {
  clientState?: string;
}) {
  return telnyxFetch(`/calls/${callControlId}/actions/answer`, {
    method: 'POST',
    body: {
      client_state: options?.clientState,
    },
  });
}

/**
 * Hang up an active call.
 */
export async function hangupCall(callControlId: string) {
  return telnyxFetch(`/calls/${callControlId}/actions/hangup`, {
    method: 'POST',
    body: {},
  });
}

/**
 * Transfer a call to another destination.
 */
export async function transferCall(callControlId: string, to: string, options?: {
  from?: string;
  fromDisplayName?: string;
}) {
  return telnyxFetch(`/calls/${callControlId}/actions/transfer`, {
    method: 'POST',
    body: {
      to,
      from: options?.from,
      from_display_name: options?.fromDisplayName,
    },
  });
}

/**
 * Bridge two calls together.
 */
export async function bridgeCall(callControlId: string, targetCallControlId: string) {
  return telnyxFetch(`/calls/${callControlId}/actions/bridge`, {
    method: 'POST',
    body: {
      call_control_id: targetCallControlId,
    },
  });
}

/**
 * Start recording a call.
 */
export async function startRecording(callControlId: string, options?: {
  channels?: 'single' | 'dual';
  format?: 'wav' | 'mp3';
}) {
  return telnyxFetch(`/calls/${callControlId}/actions/record_start`, {
    method: 'POST',
    body: {
      channels: options?.channels || 'dual',
      format: options?.format || 'wav',
    },
  });
}

/**
 * Stop recording a call.
 */
export async function stopRecording(callControlId: string) {
  return telnyxFetch(`/calls/${callControlId}/actions/record_stop`, {
    method: 'POST',
    body: {},
  });
}

/**
 * Play audio or TTS on a call.
 */
export async function speakText(callControlId: string, text: string, options?: {
  language?: string;
  voice?: string;
}) {
  return telnyxFetch(`/calls/${callControlId}/actions/speak`, {
    method: 'POST',
    body: {
      payload: text,
      language: options?.language || 'fr-CA',
      voice: options?.voice || 'female',
    },
  });
}

/**
 * Gather DTMF input from a call (IVR).
 */
export async function gatherDtmf(callControlId: string, options: {
  prompt?: string;
  language?: string;
  minDigits?: number;
  maxDigits?: number;
  timeoutSecs?: number;
  terminatingDigit?: string;
  clientState?: string;
}) {
  return telnyxFetch(`/calls/${callControlId}/actions/gather_using_speak`, {
    method: 'POST',
    body: {
      payload: options.prompt || 'Veuillez entrer votre choix.',
      language: options.language || 'fr-CA',
      voice: 'female',
      minimum_digits: options.minDigits || 1,
      maximum_digits: options.maxDigits || 1,
      timeout_millis: (options.timeoutSecs || 5) * 1000,
      terminating_digit: options.terminatingDigit || '#',
      client_state: options.clientState,
    },
  });
}

/** Response from Telnyx Call Control dial */
export interface TelnyxDialResult {
  call_control_id: string;
  call_leg_id: string;
  call_session_id: string;
  is_alive: boolean;
  record_type: string;
}

/** Get the required Telnyx connection ID. Throws if not configured. */
export function getTelnyxConnectionId(): string {
  const id = process.env.TELNYX_CONNECTION_ID;
  if (!id) throw new Error('TELNYX_CONNECTION_ID not configured');
  return id;
}

/** Get the default caller ID number. Throws if not configured. */
export function getDefaultCallerId(): string {
  const id = process.env.TELNYX_DEFAULT_CALLER_ID;
  if (!id) throw new Error('TELNYX_DEFAULT_CALLER_ID not configured');
  return id;
}

/**
 * Initiate an outbound call via Call Control API.
 */
export async function dialCall(options: {
  to: string;           // E.164 number to call
  from: string;         // E.164 caller ID
  connectionId: string; // Telnyx connection ID
  webhookUrl?: string;  // Override webhook URL
  clientState?: string; // Opaque state to pass through webhooks
  timeout?: number;     // Ring timeout in seconds
}): Promise<{ data: TelnyxDialResult }> {
  return telnyxFetch('/calls', {
    method: 'POST',
    body: {
      to: options.to,
      from: options.from,
      connection_id: options.connectionId,
      webhook_url: options.webhookUrl,
      webhook_url_method: 'POST',
      client_state: options.clientState
        ? Buffer.from(options.clientState).toString('base64')
        : undefined,
      timeout_secs: options.timeout || 30,
    },
  });
}

/**
 * Enable Answering Machine Detection on a call.
 */
export async function enableAmd(callControlId: string) {
  return telnyxFetch(`/calls/${callControlId}/actions/detect_amd`, {
    method: 'POST',
    body: {
      detect_type: 'Premium',
      after_greeting_silence_millis: 800,
      greeting_total_analysis_time_millis: 3500,
    },
  });
}

/**
 * Start live transcription on a call.
 */
export async function startTranscription(callControlId: string, options?: {
  language?: string;
}) {
  return telnyxFetch(`/calls/${callControlId}/actions/transcription_start`, {
    method: 'POST',
    body: {
      language: options?.language || 'fr',
    },
  });
}

/**
 * Stop live transcription on a call.
 */
export async function stopTranscription(callControlId: string) {
  return telnyxFetch(`/calls/${callControlId}/actions/transcription_stop`, {
    method: 'POST',
    body: {},
  });
}

// ── WebRTC Token Generation ─────────────────────────

/**
 * Generate a WebRTC credential token for client SDK (browser/iOS/macOS).
 * The client uses this JWT to authenticate with TelnyxRTC SDK.
 *
 * Flow:
 * 1. Find or create a telephony credential for the connection.
 * 2. POST /telephony_credentials/{id}/token to get a JWT login token.
 * 3. Return the credential data along with the JWT token.
 */
export async function generateWebRtcToken(connectionId: string) {
  // Step 1: Try to find an existing credential for this connection
  let credentialId: string | null = null;
  let sipUsername: string | null = null;
  let sipPassword: string | null = null;

  try {
    const existing = await telnyxFetch<{ data: Array<{ id: string; connection_id: string; sip_username: string; sip_password: string; expired: boolean }> }>(
      '/telephony_credentials',
      { params: { 'filter[connection_id]': connectionId, 'page[size]': '10' } }
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const creds = (existing as any)?.data?.data || (existing as any)?.data || [];
    const validCred = Array.isArray(creds)
      ? creds.find((c: { expired?: boolean }) => !c.expired)
      : null;
    if (validCred) {
      credentialId = validCred.id;
      sipUsername = validCred.sip_username;
      sipPassword = validCred.sip_password;
    }
  } catch (err) {
    logger.warn('[Telnyx] Failed to list existing credentials, will create new one', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Step 2: If no existing credential, create one
  if (!credentialId) {
    const created = await telnyxFetch<{ id: string; sip_username: string; sip_password: string }>('/telephony_credentials', {
      method: 'POST',
      body: { connection_id: connectionId },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const credData = (created as any)?.data || created;
    credentialId = credData.id;
    sipUsername = credData.sip_username;
    sipPassword = credData.sip_password;
  }

  // Step 3: Generate a JWT token from the credential
  const tokenResponse = await fetch(`${TELNYX_API_BASE}/telephony_credentials/${credentialId}/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
  });

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text();
    logger.error('[Telnyx] Failed to generate JWT token', {
      credentialId,
      status: tokenResponse.status,
      body: errBody.slice(0, 300),
    });
    throw new Error(`Telnyx token generation failed (${tokenResponse.status}): ${errBody.slice(0, 200)}`);
  }

  // The token endpoint returns the JWT as plain text
  const token = await tokenResponse.text();

  return {
    data: {
      id: credentialId,
      token: token.replace(/^"|"$/g, ''), // Strip surrounding quotes if present
      sip_username: sipUsername,
      sip_password: sipPassword,
    },
  };
}

// ── Number Management ─────────────────────────

/**
 * List phone numbers on the account.
 */
export async function listPhoneNumbers(params?: {
  pageSize?: number;
  status?: string;
}) {
  return telnyxFetch('/phone_numbers', {
    params: {
      'page[size]': String(params?.pageSize || 25),
      ...(params?.status ? { 'filter[status]': params.status } : {}),
    },
  });
}
