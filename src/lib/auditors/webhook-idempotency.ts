/**
 * WEBHOOK-IDEMPOTENCY Auditor
 * Checks webhook handlers for idempotency, duplicate detection,
 * safe error handling, and event ordering logic.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class WebhookIdempotencyAuditor extends BaseAuditor {
  auditTypeCode = 'WEBHOOK-IDEMPOTENCY';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    const webhookFiles = this.findWebhookFiles();

    results.push(...this.checkIdempotency(webhookFiles));
    results.push(...this.checkStripeDuplicateDetection(webhookFiles));
    results.push(...this.checkErrorHandling(webhookFiles));
    results.push(...this.checkEventOrdering(webhookFiles));

    return results;
  }

  /** Find webhook-related files (API routes with webhook in path or content) */
  private findWebhookFiles(): string[] {
    const apiFiles = this.findApiRoutes();
    const webhookFiles: string[] = [];

    for (const file of apiFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Skip forwarding/proxy handlers that just redirect to the canonical webhook endpoint
      // These don't need their own idempotency since the target handler has it
      const isForwarder =
        /fetch\s*\(\s*.*(?:\/api\/.*webhook|url\.toString\(\))/.test(content) &&
        !/constructEvent/.test(content) &&
        !/webhookEvent/.test(content);
      if (isForwarder) continue;

      const isWebhookPath = /webhook/i.test(file);
      if (isWebhookPath) {
        const rel = this.relativePath(file).toLowerCase();
        // Skip admin webhook management routes (they manage webhooks, not receive events)
        if (/\/admin\/webhook/.test(rel)) continue;
        // Skip email webhook handlers (not payment-related)
        if (/email-bounce|inbound-email/.test(rel)) continue;
        // Skip email campaign sending routes that mention webhooks in path
        if (/emails\/campaigns/.test(rel)) continue;
        webhookFiles.push(file);
        continue;
      }

      // Check if file handles webhook events
      const webhookPatterns = [
        /constructEvent/,
        /webhook.*event/i,
        /event\.type/,
        /stripe\.webhooks/i,
      ];

      if (webhookPatterns.some((p) => p.test(content))) {
        webhookFiles.push(file);
      }
    }

    return webhookFiles;
  }

  /**
   * webhook-01: Check webhook handlers for idempotency (check if event already processed)
   */
  private checkIdempotency(webhookFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (webhookFiles.length === 0) {
      results.push(
        this.fail('webhook-01', 'LOW', 'No webhook handlers found', 'No webhook API routes or files detected. If webhooks are expected (e.g., Stripe), they may be missing.', {
          recommendation:
            'If the application integrates with Stripe or other webhook-based services, implement webhook handlers with idempotency checks.',
        })
      );
      return results;
    }

    let allIdempotent = true;

    for (const file of webhookFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check for idempotency patterns
      const idempotencyPatterns = [
        /findFirst.*eventId/i,
        /findUnique.*eventId/i,
        /already.*processed/i,
        /duplicate.*event/i,
        /processed.*event/i,
        /event.*exists/i,
        /idempoten/i,
        /webhookEvent.*create/i,    // Logging event to DB (for dedup)
        /processedEvents/i,
        /eventLog/i,
      ];

      const hasIdempotency = idempotencyPatterns.some((p) => p.test(content));

      if (!hasIdempotency) {
        allIdempotent = false;
        results.push(
          this.fail('webhook-01', 'HIGH', 'Webhook handler lacks idempotency check', `Webhook handler at ${this.relativePath(file)} does not check if the event was already processed. Webhook retries can cause duplicate processing (double charges, duplicate orders).`, {
            filePath: this.relativePath(file),
            recommendation:
              'Store processed event IDs in the database. Before processing any event, check if it was already handled. Use: `const existing = await prisma.webhookEvent.findUnique({ where: { eventId } })`.',
          })
        );
      }
    }

    if (allIdempotent) {
      results.push(
        this.pass('webhook-01', 'Webhook handlers have idempotency checks')
      );
    }

    return results;
  }

  /**
   * webhook-02: Check for Stripe event ID duplicate detection
   */
  private checkStripeDuplicateDetection(webhookFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Find files specifically handling Stripe webhooks (not PayPal or other providers)
    const stripeWebhookFiles = webhookFiles.filter((file) => {
      const rel = this.relativePath(file).toLowerCase();
      // Explicitly exclude PayPal webhook handlers
      if (/paypal/i.test(rel)) return false;
      const content = this.readFile(file);
      return content && (/stripe/i.test(content) || /constructEvent/.test(content));
    });

    if (stripeWebhookFiles.length === 0) {
      // Also check if Stripe is used at all in the project
      const libFiles = this.findLibFiles();
      const usesStripe = libFiles.some((f) => /stripe/i.test(this.readFile(f)));

      if (usesStripe) {
        results.push(
          this.fail('webhook-02', 'HIGH', 'Stripe used but no webhook handler found', 'The project uses Stripe but no Stripe webhook handler was detected. Webhook handling is critical for payment verification.', {
            recommendation:
              'Implement a Stripe webhook endpoint at /api/webhooks/stripe that verifies signatures and processes events idempotently.',
          })
        );
      } else {
        results.push(this.pass('webhook-02', 'No Stripe webhook handling required'));
      }
      return results;
    }

    let allHaveDedupe = true;

    for (const file of stripeWebhookFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check for Stripe event ID extraction and dedup
      const hasEventIdExtract =
        /event\.id/.test(content) || /stripeEvent\.id/.test(content);
      const hasDedupe =
        /findFirst|findUnique|findMany/.test(content) &&
        (/eventId|stripeEventId|event_id/.test(content) || /event\.id/.test(content));
      const hasConstructEvent = /constructEvent/.test(content) || /webhooks\.constructEvent/.test(content);

      if (!hasConstructEvent) {
        allHaveDedupe = false;
        results.push(
          this.fail('webhook-02', 'CRITICAL', 'Stripe webhook missing signature verification', `${this.relativePath(file)} appears to handle Stripe webhooks but does not verify the webhook signature with constructEvent(). Anyone can send fake webhook events.`, {
            filePath: this.relativePath(file),
            recommendation:
              'Use stripe.webhooks.constructEvent(body, sig, endpointSecret) to verify webhook signatures before processing events.',
          })
        );
      } else if (!hasEventIdExtract || !hasDedupe) {
        allHaveDedupe = false;
        results.push(
          this.fail('webhook-02', 'HIGH', 'Stripe webhook missing duplicate event detection', `${this.relativePath(file)} handles Stripe webhooks but does not check for duplicate event IDs. Stripe may retry events, causing double processing.`, {
            filePath: this.relativePath(file),
            recommendation:
              'Extract event.id from the Stripe event, check the database for existing processed events, and skip if already handled.',
          })
        );
      }
    }

    if (allHaveDedupe) {
      results.push(
        this.pass('webhook-02', 'Stripe webhook duplicate detection in place')
      );
    }

    return results;
  }

  /**
   * webhook-03: Check webhook error handling doesn't corrupt data
   */
  private checkErrorHandling(webhookFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (webhookFiles.length === 0) {
      results.push(this.pass('webhook-03', 'No webhook handlers to check'));
      return results;
    }

    let allSafe = true;

    for (const file of webhookFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check for proper error handling
      const hasTryCatch = /try\s*\{/.test(content) && /catch\s*\(/.test(content);
      const hasTransaction = /\$transaction/.test(content);

      // Bad pattern: catch block that does a partial update or doesn't rollback
      const catchBlocks = content.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/gs) || [];
      let hasUnsafeCatch = false;

      for (const catchBlock of catchBlocks) {
        // Check if catch block modifies data without transaction
        const modifiesData =
          /prisma\.\w+\.(create|update|delete|upsert)/.test(catchBlock);
        if (modifiesData && !hasTransaction) {
          hasUnsafeCatch = true;
        }
      }

      if (!hasTryCatch) {
        allSafe = false;
        results.push(
          this.fail('webhook-03', 'HIGH', 'Webhook handler missing try/catch', `${this.relativePath(file)} lacks try/catch error handling. Unhandled errors can leave data in an inconsistent state and cause silent failures.`, {
            filePath: this.relativePath(file),
            recommendation:
              'Wrap webhook processing in try/catch. In the catch block, log the error, return an appropriate HTTP status (500 for retry, 200 to acknowledge), and ensure no partial data modifications.',
          })
        );
      } else if (hasUnsafeCatch) {
        allSafe = false;
        results.push(
          this.fail('webhook-03', 'MEDIUM', 'Webhook catch block modifies data without transaction', `${this.relativePath(file)} has catch blocks that modify database records without a transaction. This can corrupt data on partial failures.`, {
            filePath: this.relativePath(file),
            recommendation:
              'Use prisma.$transaction for all database modifications in webhook handlers. Catch blocks should only log errors and return appropriate HTTP statuses, not modify data.',
          })
        );
      }
    }

    if (allSafe) {
      results.push(
        this.pass('webhook-03', 'Webhook error handling is safe')
      );
    }

    return results;
  }

  /**
   * webhook-04: Check for event ordering logic
   */
  private checkEventOrdering(webhookFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (webhookFiles.length === 0) {
      results.push(this.pass('webhook-04', 'No webhook handlers to check'));
      return results;
    }

    let hasOrderingLogic = false;

    for (const file of webhookFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check for event ordering patterns
      const orderingPatterns = [
        /created\s*[><]=?\s*/,               // Timestamp comparison
        /event\.created/,                     // Stripe event timestamp
        /createdAt.*>.*existing/i,            // Checking if newer
        /newer|older|stale|outdated/i,        // Ordering terminology
        /sequence|order.*number/i,            // Sequence numbers
        /lastProcessedAt/i,                   // Tracking last processed
        /event_.*order/i,                     // Event ordering
      ];

      if (orderingPatterns.some((p) => p.test(content))) {
        hasOrderingLogic = true;
      }
    }

    if (!hasOrderingLogic && webhookFiles.length > 0) {
      results.push(
        this.fail('webhook-04', 'LOW', 'No event ordering logic in webhook handlers', 'Webhook handlers do not appear to handle out-of-order events. Webhooks can arrive out of sequence (e.g., payment_intent.succeeded before checkout.session.completed).', {
          recommendation:
            'Implement event ordering by checking event timestamps (event.created) or using a state machine pattern. Always verify the current state before applying changes from a webhook event.',
        })
      );
    } else if (hasOrderingLogic) {
      results.push(
        this.pass('webhook-04', 'Event ordering logic detected in webhook handlers')
      );
    }

    return results;
  }
}
