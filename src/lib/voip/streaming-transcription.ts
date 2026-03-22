/**
 * Streaming Transcription Service — Real-time speech-to-text via WebSocket
 *
 * Connects to a transcription WebSocket server (e.g., Deepgram, AssemblyAI,
 * or a self-hosted Whisper streaming endpoint) and streams audio data from
 * the browser's MediaStream API via AudioWorklet.
 *
 * Features:
 * - Interim and final transcription results
 * - Per-word confidence and timing data
 * - Speaker identification (agent vs customer)
 * - PCM16 encoding for WebSocket transmission
 * - Pause/resume without disconnecting
 * - Full transcript accumulation
 *
 * Usage:
 *   const stt = new StreamingTranscriptionService({ language: 'fr' });
 *   stt.onTranscription((event) => {
 *     if (event.type === 'final') updateUI(event.text);
 *   });
 *   await stt.connect('wss://transcription-server.example.com/ws');
 *   stt.feedAudio(audioDataFromWorklet);
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamingTranscriptionConfig {
  language?: string;
  sampleRate?: number;
  encoding?: 'pcm16' | 'opus' | 'mulaw';
  interimResults?: boolean;
  punctuation?: boolean;
  model?: string;
}

export interface TranscriptionEvent {
  type: 'interim' | 'final';
  text: string;
  confidence: number;
  timestamp: number;
  duration: number;
  speaker?: 'agent' | 'customer';
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: Required<StreamingTranscriptionConfig> = {
  language: 'fr',
  sampleRate: 16000,
  encoding: 'pcm16',
  interimResults: true,
  punctuation: true,
  model: 'general',
};

// ---------------------------------------------------------------------------
// StreamingTranscriptionService
// ---------------------------------------------------------------------------

export class StreamingTranscriptionService {
  private ws: WebSocket | null = null;
  private config: Required<StreamingTranscriptionConfig>;
  private onTranscriptCallback?: (event: TranscriptionEvent) => void;
  private onErrorCallback?: (error: Error) => void;
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;
  private audioBuffer: Float32Array[] = [];
  private isStreaming = false;
  private isPaused = false;
  private finalTranscripts: string[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 2000;
  private wsUrl: string = '';
  private sendInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config?: StreamingTranscriptionConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Connect to the transcription WebSocket server.
   * Sends configuration as query parameters on connection.
   */
  async connect(wsUrl: string): Promise<void> {
    this.wsUrl = wsUrl;
    this.reconnectAttempts = 0;

    return this.doConnect();
  }

  /**
   * Internal connection logic, shared by connect() and reconnect.
   */
  private doConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Build URL with config query params
      const url = new URL(this.wsUrl);
      url.searchParams.set('language', this.config.language);
      url.searchParams.set('sample_rate', String(this.config.sampleRate));
      url.searchParams.set('encoding', this.config.encoding);
      url.searchParams.set('interim_results', String(this.config.interimResults));
      url.searchParams.set('punctuation', String(this.config.punctuation));
      url.searchParams.set('model', this.config.model);

      try {
        this.ws = new WebSocket(url.toString());
        this.ws.binaryType = 'arraybuffer';
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.isStreaming = true;
        this.isPaused = false;
        this.reconnectAttempts = 0;

        // Start periodic flush of audio buffer (every 100ms)
        this.sendInterval = setInterval(() => this.flushAudioBuffer(), 100);

        logger.info('[StreamingSTT] Connected', { url: this.wsUrl });
        this.onConnectCallback?.();
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleMessage(event);
      };

      this.ws.onerror = (event: Event) => {
        const errorMsg = `WebSocket error: ${(event as ErrorEvent).message || 'unknown'}`;
        logger.error('[StreamingSTT] Error', { error: errorMsg });
        this.onErrorCallback?.(new Error(errorMsg));
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.isStreaming = false;
        this.stopSendInterval();

        logger.info('[StreamingSTT] Disconnected', {
          code: event.code,
          reason: event.reason,
        });

        this.onDisconnectCallback?.();

        // Auto-reconnect on unexpected closure
        if (
          event.code !== 1000 &&
          event.code !== 1001 &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * this.reconnectAttempts;
          logger.info('[StreamingSTT] Reconnecting...', {
            attempt: this.reconnectAttempts,
            delayMs: delay,
          });
          setTimeout(() => {
            this.doConnect().catch(() => {
              // Reconnect failed
            });
          }, delay);
        }
      };

      // Timeout for initial connection
      setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
          this.ws?.close();
        }
      }, 10000);
    });
  }

  /**
   * Handle incoming WebSocket messages (transcription results).
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : null;

      if (!data) return;

      // Support common transcription server response options
      const isFinal = data.is_final ?? (data.type === 'final' ? true : !data.is_partial);
      const text =
        data.channel?.alternatives?.[0]?.transcript || // Deepgram format
        data.text || // Generic format
        data.transcript || // AssemblyAI format
        '';

      if (!text.trim()) return;

      const confidence =
        data.channel?.alternatives?.[0]?.confidence ??
        data.confidence ??
        0.8;

      // Extract word-level timing if available
      const rawWords =
        data.channel?.alternatives?.[0]?.words || data.words || [];

      const words = rawWords.map(
        (w: Record<string, unknown>) => ({
          word: String(w.word || w.punctuated_word || ''),
          start: Number(w.start || 0),
          end: Number(w.end || 0),
          confidence: Number(w.confidence || 0),
        })
      );

      const transcriptionEvent: TranscriptionEvent = {
        type: isFinal ? 'final' : 'interim',
        text: text.trim(),
        confidence: Math.max(0, Math.min(1, confidence)),
        timestamp: Date.now(),
        duration: data.duration ?? data.audio_duration ?? 0,
        speaker: data.speaker ?? undefined,
        words: words.length > 0 ? words : undefined,
      };

      // Accumulate final transcripts
      if (isFinal) {
        this.finalTranscripts.push(text.trim());
      }

      this.onTranscriptCallback?.(transcriptionEvent);
    } catch (error) {
      logger.debug('[StreamingSTT] Failed to parse message', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Feed raw audio data from AudioWorklet/MediaStream.
   * Audio is buffered and sent periodically to avoid flooding.
   */
  feedAudio(audioData: Float32Array): void {
    if (!this.isStreaming || this.isPaused) return;
    this.audioBuffer.push(new Float32Array(audioData));
  }

  /**
   * Flush buffered audio and send to WebSocket.
   */
  private flushAudioBuffer(): void {
    if (
      this.audioBuffer.length === 0 ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN ||
      this.isPaused
    ) {
      return;
    }

    // Concatenate buffered audio
    const totalLength = this.audioBuffer.reduce((sum, arr) => sum + arr.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.audioBuffer) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    this.audioBuffer = [];

    // Convert and send
    let payload: ArrayBuffer;
    if (this.config.encoding === 'pcm16') {
      payload = this.float32ToPcm16(combined);
    } else {
      // For opus/mulaw, send raw float32 and let server handle encoding
      payload = combined.buffer;
    }

    try {
      this.ws.send(payload);
    } catch {
      // WebSocket send failed, buffer will be rebuilt on next feedAudio
    }
  }

  /**
   * Convert Float32Array [-1.0, 1.0] to PCM16 Int16Array.
   */
  private float32ToPcm16(float32: Float32Array): ArrayBuffer {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return pcm16.buffer;
  }

  /**
   * Subscribe to transcription events.
   */
  onTranscription(callback: (event: TranscriptionEvent) => void): void {
    this.onTranscriptCallback = callback;
  }

  /**
   * Subscribe to error events.
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Subscribe to connect events.
   */
  onConnect(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  /**
   * Subscribe to disconnect events.
   */
  onDisconnect(callback: () => void): void {
    this.onDisconnectCallback = callback;
  }

  /**
   * Check if currently connected to the transcription server.
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isStreaming;
  }

  /**
   * Pause audio streaming without disconnecting.
   */
  pause(): void {
    this.isPaused = true;
    this.audioBuffer = [];
    logger.debug('[StreamingSTT] Paused');
  }

  /**
   * Resume audio streaming after pause.
   */
  resume(): void {
    this.isPaused = false;
    logger.debug('[StreamingSTT] Resumed');
  }

  /**
   * Disconnect from the transcription server.
   */
  disconnect(): void {
    this.isStreaming = false;
    this.isPaused = false;
    this.stopSendInterval();
    this.audioBuffer = [];
    this.maxReconnectAttempts = 0; // Prevent auto-reconnect

    if (this.ws) {
      try {
        // Send close signal to server (some servers flush pending results)
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'close_stream' }));
        }
        this.ws.close(1000, 'Client disconnect');
      } catch {
        // Already closed
      }
      this.ws = null;
    }

    logger.info('[StreamingSTT] Disconnected (manual)');
  }

  /**
   * Get the full accumulated transcript from all final results.
   */
  getFullTranscript(): string {
    return this.finalTranscripts.join(' ');
  }

  /**
   * Get count of final transcript segments received.
   */
  getSegmentCount(): number {
    return this.finalTranscripts.length;
  }

  /**
   * Stop the periodic send interval.
   */
  private stopSendInterval(): void {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
  }
}
