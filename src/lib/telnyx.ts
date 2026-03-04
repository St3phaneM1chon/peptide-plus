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
}) {
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
 * Generate a WebRTC credential token for client SDK (iOS/macOS).
 * The client uses this to authenticate with TelnyxRTC SDK.
 */
export async function generateWebRtcToken(connectionId: string) {
  return telnyxFetch('/telephony_credentials', {
    method: 'POST',
    body: {
      connection_id: connectionId,
    },
  });
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
