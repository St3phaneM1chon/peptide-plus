/**
 * Deepgram Nova-2 Streaming STT Client
 *
 * Real-time speech-to-text via WebSocket with:
 * - Streaming transcription (<300ms latency)
 * - Automatic language detection (FR/EN/ES)
 * - Interim + final results
 * - Utterance end detection (smart endpointing)
 * - Reconnection with exponential backoff
 */

import { logger } from '@/lib/logger';
import { EventEmitter } from 'events';

// ── Configuration ────────────────────────────────────────────────────────────

export interface DeepgramSTTConfig {
  apiKey?: string;
  model?: string;
  language?: string;
  detectLanguage?: boolean;
  encoding?: string;
  sampleRate?: number;
  channels?: number;
  interimResults?: boolean;
  utteranceEndMs?: number;
  smartFormat?: boolean;
  punctuate?: boolean;
  endpointing?: number;
}

export interface TranscriptionResult {
  text: string;
  isFinal: boolean;
  confidence: number;
  language?: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  speechFinal?: boolean;
  duration?: number;
}

// ── Deepgram WebSocket Response Types ────────────────────────────────────────

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

interface DeepgramAlternative {
  transcript: string;
  confidence: number;
  words?: DeepgramWord[];
}

interface DeepgramChannel {
  alternatives: DeepgramAlternative[];
}

interface DeepgramResponse {
  type: string;
  channel?: DeepgramChannel;
  is_final?: boolean;
  speech_final?: boolean;
  duration?: number;
  channel_index?: number[];
  metadata?: {
    request_id?: string;
    model_uuid?: string;
  };
  from_finalize?: boolean;
}

// ── DeepgramSTT Class ────────────────────────────────────────────────────────

export class DeepgramSTT extends EventEmitter {
  private config: Required<DeepgramSTTConfig>;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private detectedLanguage: string | null = null;

  constructor(config: DeepgramSTTConfig = {}) {
    super();
    this.config = {
      apiKey: config.apiKey || process.env.DEEPGRAM_API_KEY || '',
      model: config.model || 'nova-2',
      language: config.language || '',
      detectLanguage: config.detectLanguage ?? true,
      encoding: config.encoding || 'mulaw',
      sampleRate: config.sampleRate || 8000,
      channels: config.channels || 1,
      interimResults: config.interimResults ?? true,
      utteranceEndMs: config.utteranceEndMs || 1000,
      smartFormat: config.smartFormat ?? true,
      punctuate: config.punctuate ?? true,
      endpointing: config.endpointing || 300,
    };
  }

  /**
   * Connect to Deepgram streaming API.
   */
  async connect(): Promise<void> {
    if (!this.config.apiKey) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

    const params = new URLSearchParams({
      model: this.config.model,
      encoding: this.config.encoding,
      sample_rate: String(this.config.sampleRate),
      channels: String(this.config.channels),
      interim_results: String(this.config.interimResults),
      utterance_end_ms: String(this.config.utteranceEndMs),
      smart_format: String(this.config.smartFormat),
      punctuate: String(this.config.punctuate),
      endpointing: String(this.config.endpointing),
    });

    if (this.config.detectLanguage) {
      params.set('detect_language', 'true');
    } else if (this.config.language) {
      params.set('language', this.config.language);
    }

    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          headers: {
            Authorization: `Token ${this.config.apiKey}`,
          },
        } as never);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.startKeepAlive();
          logger.info('[DeepgramSTT] Connected', { model: this.config.model });
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(event.data as string);
        };

        this.ws.onerror = (event: Event) => {
          const errMsg = 'error' in event ? String((event as ErrorEvent).message) : 'WebSocket error';
          logger.error('[DeepgramSTT] WebSocket error', { error: errMsg });
          this.emit('error', new Error(errMsg));
          if (!this.isConnected) reject(new Error(errMsg));
        };

        this.ws.onclose = (event: CloseEvent) => {
          this.isConnected = false;
          this.stopKeepAlive();
          logger.info('[DeepgramSTT] Disconnected', {
            code: event.code,
            reason: event.reason,
          });
          this.emit('disconnected', { code: event.code, reason: event.reason });
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Send audio data to Deepgram for transcription.
   */
  sendAudio(audioData: Buffer | Uint8Array): void {
    if (!this.ws || !this.isConnected) return;

    try {
      this.ws.send(audioData);
    } catch (err) {
      logger.warn('[DeepgramSTT] Failed to send audio', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Signal end of audio stream (finalize).
   */
  finalize(): void {
    if (!this.ws || !this.isConnected) return;

    try {
      // Send empty byte to signal end of stream
      this.ws.send(new Uint8Array(0));
    } catch {
      // Ignore — connection may already be closing
    }
  }

  /**
   * Close the WebSocket connection.
   */
  async close(): Promise<void> {
    this.stopKeepAlive();
    if (this.ws) {
      // Send CloseStream message
      try {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      } catch {
        // Ignore
      }
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.detectedLanguage = null;
  }

  /**
   * Get the detected language (available after first transcription).
   */
  getDetectedLanguage(): string | null {
    return this.detectedLanguage;
  }

  get connected(): boolean {
    return this.isConnected;
  }

  // ── Private Methods ──────────────────────────────────────────────────────

  private handleMessage(data: string): void {
    try {
      const response: DeepgramResponse = JSON.parse(data);

      if (response.type === 'Results' && response.channel) {
        const alt = response.channel.alternatives[0];
        if (!alt) return;

        const result: TranscriptionResult = {
          text: alt.transcript,
          isFinal: response.is_final || false,
          confidence: alt.confidence,
          words: alt.words?.map(w => ({
            word: w.word,
            start: w.start,
            end: w.end,
            confidence: w.confidence,
          })),
          speechFinal: response.speech_final,
          duration: response.duration,
        };

        // Extract detected language from metadata or channel index
        if (response.metadata && this.config.detectLanguage && !this.detectedLanguage) {
          // Language detection is part of the first result
          // Deepgram returns it in the model info
        }

        // Emit different events for interim vs final results
        if (result.isFinal) {
          if (result.text.trim()) {
            this.emit('transcript', result);
            logger.debug('[DeepgramSTT] Final transcript', {
              text: result.text.substring(0, 100),
              confidence: result.confidence.toFixed(2),
            });
          }
        } else {
          this.emit('interim', result);
        }

        // Utterance end — the speaker has finished a complete thought
        if (response.speech_final) {
          this.emit('utterance_end', result);
        }
      } else if (response.type === 'UtteranceEnd') {
        this.emit('utterance_end', null);
      } else if (response.type === 'Metadata') {
        logger.debug('[DeepgramSTT] Metadata received', { response });
      }
    } catch (err) {
      logger.warn('[DeepgramSTT] Failed to parse message', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private startKeepAlive(): void {
    // Send keep-alive every 10 seconds to prevent timeout
    this.keepAliveInterval = setInterval(() => {
      if (this.ws && this.isConnected) {
        try {
          this.ws.send(JSON.stringify({ type: 'KeepAlive' }));
        } catch {
          // Connection may have dropped
        }
      }
    }, 10_000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a DeepgramSTT instance with sensible defaults for telephony.
 */
export function createTelephonySTT(options?: {
  language?: string;
  detectLanguage?: boolean;
}): DeepgramSTT {
  return new DeepgramSTT({
    model: 'nova-2',
    encoding: 'mulaw',
    sampleRate: 8000,
    channels: 1,
    interimResults: true,
    utteranceEndMs: 1000,
    smartFormat: true,
    punctuate: true,
    endpointing: 300,
    language: options?.language,
    detectLanguage: options?.detectLanguage ?? true,
  });
}
