/**
 * ElevenLabs Turbo v2 Streaming TTS Client
 *
 * Ultra-low latency text-to-speech via WebSocket with:
 * - Streaming audio output (first byte <300ms)
 * - Natural human-quality voice (MOS 4.5+)
 * - Multi-language support (FR, EN, ES, etc.)
 * - Voice cloning support (custom Attitudes VIP voice)
 * - Fallback cascade: ElevenLabs → Cartesia → Telnyx TTS
 */

import { logger } from '@/lib/logger';
import { EventEmitter } from 'events';

// ── Configuration ────────────────────────────────────────────────────────────

export interface ElevenLabsTTSConfig {
  apiKey?: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  outputFormat?: string;
  optimizeStreamingLatency?: number;
}

export interface TTSChunk {
  audio: Buffer;
  isFinal: boolean;
  alignment?: {
    chars: string[];
    charStartTimesMs: number[];
    charDurationsMs: number[];
  };
}

// ── ElevenLabs WebSocket Types ───────────────────────────────────────────────

interface ElevenLabsWSMessage {
  audio?: string; // base64 encoded audio
  isFinal?: boolean;
  normalizedAlignment?: {
    chars: string[];
    charStartTimesMs: number[];
    charDurationsMs: number[];
  };
  error?: string;
}

// ── ElevenLabsTTS Class ──────────────────────────────────────────────────────

export class ElevenLabsTTS extends EventEmitter {
  private config: Required<ElevenLabsTTSConfig>;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private textBuffer: string[] = [];
  private isStreaming = false;

  constructor(config: ElevenLabsTTSConfig = {}) {
    super();
    this.config = {
      apiKey: config.apiKey || process.env.ELEVENLABS_API_KEY || '',
      voiceId: config.voiceId || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // "Adam" default
      modelId: config.modelId || 'eleven_turbo_v2_5',
      stability: config.stability ?? 0.5,
      similarityBoost: config.similarityBoost ?? 0.75,
      style: config.style ?? 0.0,
      useSpeakerBoost: config.useSpeakerBoost ?? true,
      outputFormat: config.outputFormat || 'ulaw_8000',
      optimizeStreamingLatency: config.optimizeStreamingLatency ?? 4,
    };
  }

  /**
   * Connect to ElevenLabs WebSocket streaming API.
   */
  async connect(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('ELEVENLABS_API_KEY not configured');
    }

    const params = new URLSearchParams({
      model_id: this.config.modelId,
      output_format: this.config.outputFormat,
      optimize_streaming_latency: String(this.config.optimizeStreamingLatency),
    });

    const url = `wss://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}/stream-input?${params.toString()}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          headers: {
            'xi-api-key': this.config.apiKey,
          },
        } as never);

        this.ws.onopen = () => {
          this.isConnected = true;

          // Send initial BOS (Beginning of Stream) message
          this.ws!.send(JSON.stringify({
            text: ' ',
            voice_settings: {
              stability: this.config.stability,
              similarity_boost: this.config.similarityBoost,
              style: this.config.style,
              use_speaker_boost: this.config.useSpeakerBoost,
            },
            generation_config: {
              chunk_length_schedule: [120, 160, 250, 290],
            },
            xi_api_key: this.config.apiKey,
          }));

          logger.info('[ElevenLabsTTS] Connected', {
            voiceId: this.config.voiceId,
            model: this.config.modelId,
          });
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data as string);
        };

        this.ws.onerror = (event: Event) => {
          const errMsg = 'error' in event ? String((event as ErrorEvent).message) : 'WebSocket error';
          logger.error('[ElevenLabsTTS] WebSocket error', { error: errMsg });
          this.emit('error', new Error(errMsg));
          if (!this.isConnected) reject(new Error(errMsg));
        };

        this.ws.onclose = (event: CloseEvent) => {
          this.isConnected = false;
          logger.info('[ElevenLabsTTS] Disconnected', { code: event.code });
          this.emit('disconnected');
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send text to be synthesized. Supports streaming — send chunks as they
   * become available from the LLM.
   */
  sendText(text: string): void {
    if (!this.ws || !this.isConnected) {
      this.textBuffer.push(text);
      return;
    }

    try {
      this.ws.send(JSON.stringify({
        text,
        try_trigger_generation: true,
      }));
      this.isStreaming = true;
    } catch (err) {
      logger.warn('[ElevenLabsTTS] Failed to send text', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Signal end of text input — flush remaining audio.
   */
  flush(): void {
    if (!this.ws || !this.isConnected) return;

    try {
      this.ws.send(JSON.stringify({
        text: '',
      }));
    } catch {
      // Ignore
    }
  }

  /**
   * Close the WebSocket connection.
   */
  async close(): Promise<void> {
    if (this.ws) {
      try {
        // Send EOS (End of Stream)
        this.ws.send(JSON.stringify({ text: '' }));
      } catch {
        // Ignore
      }
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isStreaming = false;
    this.textBuffer = [];
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get streaming(): boolean {
    return this.isStreaming;
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  private handleMessage(data: string): void {
    try {
      const msg: ElevenLabsWSMessage = JSON.parse(data);

      if (msg.error) {
        logger.error('[ElevenLabsTTS] API error', { error: msg.error });
        this.emit('error', new Error(msg.error));
        return;
      }

      if (msg.audio) {
        const audioBuffer = Buffer.from(msg.audio, 'base64');
        const chunk: TTSChunk = {
          audio: audioBuffer,
          isFinal: msg.isFinal || false,
          alignment: msg.normalizedAlignment,
        };

        this.emit('audio', chunk);

        if (msg.isFinal) {
          this.isStreaming = false;
          this.emit('done');
        }
      }
    } catch (err) {
      logger.warn('[ElevenLabsTTS] Failed to parse message', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ── REST API Fallback ────────────────────────────────────────────────────────

/**
 * Generate TTS audio via REST API (non-streaming fallback).
 * Returns raw audio buffer in the specified format.
 */
export async function generateTTSRest(
  text: string,
  options?: {
    voiceId?: string;
    modelId?: string;
    outputFormat?: string;
  }
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY not configured');

  const voiceId = options?.voiceId || process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
  const modelId = options?.modelId || 'eleven_turbo_v2_5';
  const outputFormat = options?.outputFormat || 'ulaw_8000';

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}&optimize_streaming_latency=4`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errBody.slice(0, 200)}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create an ElevenLabsTTS instance configured for telephony (μ-law 8kHz).
 */
export function createTelephonyTTS(options?: {
  voiceId?: string;
}): ElevenLabsTTS {
  return new ElevenLabsTTS({
    modelId: 'eleven_turbo_v2_5',
    outputFormat: 'ulaw_8000',
    optimizeStreamingLatency: 4,
    stability: 0.5,
    similarityBoost: 0.75,
    voiceId: options?.voiceId,
  });
}
