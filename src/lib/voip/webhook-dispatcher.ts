/**
 * Webhook Dispatcher — Dispatch VoIP Events to External Systems
 *
 * Features:
 * - Register webhooks with URL, event filters, and HMAC secret
 * - Dispatch call events (call.started, call.ended, voicemail.new, etc.)
 * - HMAC-SHA256 signature for payload verification (Zapier/Make compatible)
 * - Retry failed deliveries with exponential backoff
 * - Delivery history and status tracking
 * - Persist webhook configs to database
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createHmac } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookConfig {
  id: string;
  url: string;
  events: string[]; // 'call.started', 'call.ended', 'voicemail.new', etc.
  secret?: string;
  active: boolean;
  retryCount?: number; // max retries, default 3
  headers?: Record<string, string>;
}

export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  webhookId: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  status: 'pending' | 'success' | 'failed';
  statusCode?: number;
  attempts: number;
  lastAttempt?: Date;
  response?: string;
}

// ---------------------------------------------------------------------------
// WebhookDispatcher
// ---------------------------------------------------------------------------

export class WebhookDispatcher {
  private webhooks: WebhookConfig[] = [];
  private deliveries: WebhookDelivery[] = [];
  private maxDeliveryHistory = 500;

  constructor() {}

  /**
   * Register a new webhook endpoint.
   * Validates the URL and adds it to the active webhooks list.
   */
  registerWebhook(config: WebhookConfig): void {
    // Validate URL
    try {
      new URL(config.url);
    } catch {
      throw new Error(`Invalid webhook URL: ${config.url}`);
    }

    // Remove existing with same ID if present
    this.webhooks = this.webhooks.filter(w => w.id !== config.id);
    this.webhooks.push(config);

    logger.info('[Webhook] Registered webhook', {
      id: config.id,
      url: config.url,
      events: config.events,
      active: config.active,
    });
  }

  /**
   * Remove a webhook by ID.
   */
  removeWebhook(id: string): void {
    const before = this.webhooks.length;
    this.webhooks = this.webhooks.filter(w => w.id !== id);

    if (this.webhooks.length < before) {
      logger.info('[Webhook] Removed webhook', { id });
    }
  }

  /**
   * Dispatch an event to all matching webhooks.
   * Only sends to active webhooks whose event filter includes the event type.
   */
  async dispatch(
    event: string,
    data: Record<string, unknown>
  ): Promise<WebhookDelivery[]> {
    const matching = this.webhooks.filter(
      w => w.active && (w.events.includes(event) || w.events.includes('*'))
    );

    if (matching.length === 0) {
      return [];
    }

    logger.info('[Webhook] Dispatching event', {
      event,
      matchingWebhooks: matching.length,
    });

    const results = await Promise.allSettled(
      matching.map(webhook => {
        const payload: WebhookPayload = {
          event,
          timestamp: new Date().toISOString(),
          data,
          webhookId: webhook.id,
        };
        return this.sendWebhook(webhook, payload);
      })
    );

    const deliveries: WebhookDelivery[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        deliveries.push(result.value);
      }
    }

    return deliveries;
  }

  /**
   * Send a payload to a specific webhook with retry logic.
   * Uses exponential backoff: 1s, 2s, 4s, etc.
   */
  private async sendWebhook(
    webhook: WebhookConfig,
    payload: WebhookPayload
  ): Promise<WebhookDelivery> {
    const maxRetries = webhook.retryCount ?? 3;
    const payloadStr = JSON.stringify(payload);

    const delivery: WebhookDelivery = {
      id: crypto.randomUUID(),
      webhookId: webhook.id,
      event: payload.event,
      status: 'pending',
      attempts: 0,
    };

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'BioCycle-Webhook/1.0',
      'X-Webhook-Event': payload.event,
      'X-Webhook-Timestamp': payload.timestamp,
      ...(webhook.headers || {}),
    };

    // Add HMAC signature if secret is configured
    if (webhook.secret) {
      headers['X-Webhook-Signature'] = this.generateSignature(payloadStr, webhook.secret);
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      delivery.attempts = attempt + 1;
      delivery.lastAttempt = new Date();

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: payloadStr,
          signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        delivery.statusCode = response.status;

        if (response.ok) {
          delivery.status = 'success';
          delivery.response = await response.text().catch(() => '');
          this.recordDelivery(delivery);

          logger.info('[Webhook] Delivered successfully', {
            webhookId: webhook.id,
            event: payload.event,
            statusCode: response.status,
            attempts: delivery.attempts,
          });

          return delivery;
        }

        // Non-retryable status codes
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          delivery.status = 'failed';
          delivery.response = await response.text().catch(() => '');
          this.recordDelivery(delivery);

          logger.warn('[Webhook] Client error, not retrying', {
            webhookId: webhook.id,
            statusCode: response.status,
          });

          return delivery;
        }

        // Server error or rate limit — retry with backoff
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        if (attempt < maxRetries) {
          logger.warn('[Webhook] Attempt failed, retrying', {
            webhookId: webhook.id,
            attempt: attempt + 1,
            error: msg,
          });

          const delayMs = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          delivery.status = 'failed';
          delivery.response = msg;
        }
      }
    }

    // All retries exhausted
    if (delivery.status !== 'success') {
      delivery.status = 'failed';
    }

    this.recordDelivery(delivery);

    logger.error('[Webhook] All retries exhausted', {
      webhookId: webhook.id,
      event: payload.event,
      attempts: delivery.attempts,
    });

    return delivery;
  }

  /**
   * Generate HMAC-SHA256 signature for payload verification.
   * The receiving endpoint can verify authenticity by computing the same hash.
   */
  private generateSignature(payload: string, secret: string): string {
    return `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  }

  /**
   * Retry all failed deliveries, optionally filtered by webhook ID.
   */
  async retryFailed(webhookId?: string): Promise<void> {
    const failed = this.deliveries.filter(
      d => d.status === 'failed' && (!webhookId || d.webhookId === webhookId)
    );

    if (failed.length === 0) {
      return;
    }

    logger.info('[Webhook] Retrying failed deliveries', {
      count: failed.length,
      webhookId: webhookId || 'all',
    });

    for (const delivery of failed) {
      const webhook = this.webhooks.find(w => w.id === delivery.webhookId);
      if (!webhook || !webhook.active) continue;

      const payload: WebhookPayload = {
        event: delivery.event,
        timestamp: new Date().toISOString(),
        data: { retryOf: delivery.id },
        webhookId: webhook.id,
      };

      await this.sendWebhook(webhook, payload);
    }
  }

  /**
   * Get delivery history, optionally filtered by webhook ID.
   * Returns most recent deliveries first.
   */
  getDeliveries(webhookId?: string): WebhookDelivery[] {
    const filtered = webhookId
      ? this.deliveries.filter(d => d.webhookId === webhookId)
      : this.deliveries;

    return [...filtered].reverse();
  }

  /**
   * Load webhook configurations from the database.
   * Reads from the WebhookEndpoint model if it exists.
   */
  async loadFromDB(): Promise<void> {
    try {
      const rows = await prisma.$queryRaw<Array<{
        id: string;
        url: string;
        events: string;
        secret: string | null;
        active: boolean;
        retryCount: number;
        headers: string | null;
      }>>`
        SELECT id, url, events, secret, active, "retryCount", headers
        FROM "WebhookEndpoint"
        WHERE active = true
      `;

      this.webhooks = rows.map(row => ({
        id: row.id,
        url: row.url,
        events: JSON.parse(row.events) as string[],
        secret: row.secret || undefined,
        active: row.active,
        retryCount: row.retryCount,
        headers: row.headers ? JSON.parse(row.headers) as Record<string, string> : undefined,
      }));

      logger.info('[Webhook] Loaded webhooks from DB', {
        count: this.webhooks.length,
      });
    } catch (error) {
      // Table may not exist yet; fall back to empty list
      logger.warn('[Webhook] Could not load webhooks from DB', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save current webhook configurations to the database.
   */
  // N+1 FIX: Batch all upsert operations in a single $transaction
  // instead of sequential individual $executeRaw per webhook
  async saveToDB(): Promise<void> {
    try {
      if (this.webhooks.length === 0) return;

      await prisma.$transaction(
        this.webhooks.map((webhook) =>
          prisma.$executeRaw`
            INSERT INTO "WebhookEndpoint" (id, url, events, secret, active, "retryCount", headers, "updatedAt")
            VALUES (
              ${webhook.id},
              ${webhook.url},
              ${JSON.stringify(webhook.events)},
              ${webhook.secret || null},
              ${webhook.active},
              ${webhook.retryCount ?? 3},
              ${webhook.headers ? JSON.stringify(webhook.headers) : null},
              NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              url = EXCLUDED.url,
              events = EXCLUDED.events,
              secret = EXCLUDED.secret,
              active = EXCLUDED.active,
              "retryCount" = EXCLUDED."retryCount",
              headers = EXCLUDED.headers,
              "updatedAt" = NOW()
          `
        )
      );

      logger.info('[Webhook] Saved webhooks to DB', {
        count: this.webhooks.length,
      });
    } catch (error) {
      logger.error('[Webhook] Failed to save webhooks to DB', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Record a delivery in the history buffer.
   * Trims oldest entries when the buffer exceeds maxDeliveryHistory.
   */
  private recordDelivery(delivery: WebhookDelivery): void {
    this.deliveries.push(delivery);

    if (this.deliveries.length > this.maxDeliveryHistory) {
      this.deliveries.splice(0, this.deliveries.length - this.maxDeliveryHistory);
    }
  }
}
