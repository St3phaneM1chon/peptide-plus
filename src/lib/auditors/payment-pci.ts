/**
 * PAYMENT-PCI Auditor
 * Checks PCI-DSS compliance: webhook signature verification, no card data storage,
 * no payment data in logs, server-side amount validation, refund authorization,
 * and idempotency keys on payment creation.
 *
 * v2 - Reduced false positives:
 * - payment-01: Only flags actual webhook handler files (by path or webhook-specific patterns)
 * - payment-02: Excludes auditor self-detection, icon/UI files, sanitization/masking lists,
 *   and only flags files that use card field names in a data-storage context
 * - payment-05: Only flags files with actual refund mutation logic (stripe.refunds.create,
 *   or API routes that expose refund endpoints), not webhook handlers that react to refund events
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as path from 'path';

export default class PaymentPciAuditor extends BaseAuditor {
  auditTypeCode = 'PAYMENT-PCI';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkWebhookSignatureVerification());
    results.push(...this.checkNoCreditCardStorage());
    results.push(...this.checkNoPaymentDataInLogs());
    results.push(...this.checkServerSideAmountValidation());
    results.push(...this.checkRefundAuthorization());
    results.push(...this.checkIdempotencyKey());

    return results;
  }

  // ---------------------------------------------------------------------------
  // Helpers: file classification for false-positive reduction
  // ---------------------------------------------------------------------------

  /**
   * Returns true if the file is an actual webhook handler, meaning it receives
   * inbound HTTP events from a payment provider and must verify signatures.
   *
   * Criteria (must meet at least one):
   *   - File path contains "webhook" (e.g. /api/payments/webhook/route.ts)
   *   - File calls stripe.webhooks.constructEvent (Stripe signature verification)
   *   - File calls /v1/notifications/verify-webhook-signature (PayPal verification)
   *   - File explicitly handles event.type / event_type switch-case for provider events
   *
   * Files that merely *reference* Stripe or mention "webhook" in a comment/string
   * constant are NOT considered webhook handlers.
   */
  private isWebhookHandler(filePath: string, content: string): boolean {
    const rel = this.relativePath(filePath).toLowerCase();

    // Skip forwarding/proxy handlers that just redirect to the canonical webhook endpoint
    // These don't process events themselves and don't need signature verification
    const isForwarder =
      /fetch\s*\(\s*.*(?:\/api\/.*webhook|url\.toString\(\))/.test(content) &&
      !/constructEvent/.test(content) &&
      !/webhookEvent/.test(content) &&
      !/event\.type\s*===/.test(content);
    if (isForwarder) return false;

    // Exclude admin webhook management routes (they manage webhooks, not receive payment events)
    if (/\/admin\/webhook/.test(rel)) return false;

    // Exclude non-payment webhooks (email bounce, inbound email, etc.)
    if (/email-bounce|inbound-email/.test(rel)) return false;

    // Exclude webhook utility/config files (outgoing senders, event definitions, integration configs)
    if (/lib\/webhooks\//.test(rel) || /integrations\.service/.test(rel)) return false;

    // Path-based: file lives under a "webhook" directory (only payment-related ones reach here)
    if (/\/webhook[s]?\//.test(rel)) return true;

    // Stripe signature verification present
    if (/stripe\.webhooks\.constructEvent/.test(content)) return true;

    // PayPal signature verification present
    if (/verify-webhook-signature|verifyWebhookSignature/.test(content)) return true;

    // Handles provider event types (switch on event.type / event_type)
    if (
      /event\.type\s*===|switch\s*\(\s*event\.type\s*\)|switch\s*\(\s*eventType\s*\)/.test(content) &&
      (/constructEvent|verify.*signature|PAYMENT\.\w+\.COMPLETED/i.test(content))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Returns true if the file should be excluded from payment-02 card-data scanning.
   *
   * Exclusion reasons:
   *   - File is inside src/lib/auditors/ (self-detection)
   *   - File is a UI icon/nav/ribbon config (Lucide icon name "CreditCard")
   *   - File is a sanitization/masking utility (references card names in deny-lists)
   *   - File is an email template (expiryDate refers to subscription/coupon expiry)
   */
  private isExcludedFromCardDataScan(filePath: string, content: string): boolean {
    const rel = this.relativePath(filePath).toLowerCase();

    // 1. Self-detection: auditor files
    if (rel.includes('src/lib/auditors/')) return true;

    // 2. Icon/UI reference files (Lucide icon imports/maps)
    if (
      rel.includes('icon-resolver') ||
      rel.includes('outlook-nav') ||
      rel.includes('ribbon-config') ||
      rel.includes('platform-icons')
    ) {
      return true;
    }

    // 3. Sanitization / masking utilities: card field names appear inside
    //    arrays or lists of sensitive-field-name strings to redact/mask.
    //    Heuristic: file contains "sensitiveFields" or "redact" or "mask"
    //    AND the card reference is inside a string array literal.
    if (/sensitiveFields|redact|mask|sanitize/i.test(content)) {
      // Check that the card-related terms appear only in string arrays
      // (i.e. quoted inside '' or "" within an array context)
      const cardInArray = /\[\s*(?:['"][^'"]*['"],?\s*)*['"](?:creditCard|cardNumber|cvv|cvc)\s*['"]/.test(content) ||
        /['"](?:creditcard|cardnumber|cvv|cvc)['"]/.test(content);
      if (cardInArray) return true;
    }

    // 4. Email templates: "expiryDate" typically refers to coupon/subscription expiry
    if (rel.includes('email') && rel.includes('template')) {
      // Only exclude if expiryDate is used as a display variable, not a card field
      if (/expir(?:y|es)(?:Date|At)/.test(content) && !/cardExpiry|card_expiry/i.test(content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Determines whether a card-related field name match in a file represents
   * actual card data storage/processing (true positive) vs. a benign reference.
   *
   * Benign references include:
   *   - String literals in arrays (deny-lists, config objects)
   *   - Lucide icon imports/references
   *   - Comments
   *   - TypeScript type/interface declarations that define what to mask/redact
   *
   * Suspicious (likely real) references include:
   *   - Assignment: cardNumber = ..., req.body.cardNumber, body.cvv
   *   - Database writes: prisma.*.create({ data: { cardNumber } })
   *   - Variable declarations storing actual values
   */
  private isLikelyCardDataStorage(content: string, matchStr: string): boolean {
    const lines = content.split('\n');
    const matchLower = matchStr.toLowerCase();

    for (const line of lines) {
      if (!line.toLowerCase().includes(matchLower)) continue;
      const trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

      // Skip string-only references: the match is inside quotes within an array
      // e.g. 'creditCard', "cardNumber", etc. in a list of field names
      if (/^['"].*['"],?\s*$/.test(trimmed)) continue;

      // Skip Lucide icon imports: import { CreditCard } from 'lucide-react'
      if (/from\s+['"]lucide-react['"]/.test(line)) continue;
      // Skip icon map entries: 'credit-card': CreditCard
      if (/['"]credit-card['"]\s*:/.test(line)) continue;

      // Suspicious patterns: assignment, req.body access, db write context
      if (
        new RegExp(`${matchStr}\\s*=\\s*`, 'i').test(line) ||            // cardNumber = ...
        new RegExp(`body\\.${matchStr}`, 'i').test(line) ||               // body.cardNumber
        new RegExp(`req\\.body\\.${matchStr}`, 'i').test(line) ||         // req.body.cardNumber
        new RegExp(`data:\\s*\\{[^}]*${matchStr}`, 'i').test(line) ||     // data: { cardNumber: ... }
        new RegExp(`prisma\\..*${matchStr}`, 'i').test(line)              // prisma.x.create({ cardNumber })
      ) {
        return true;
      }

      // If the line defines a TypeScript interface field (e.g. cardNumber: string)
      // that is NOT in a masking/redaction context, flag it
      if (new RegExp(`${matchStr}\\s*[?]?:\\s*(string|number)`, 'i').test(line)) {
        // Check if the surrounding context is a masking/sanitization type
        const idx = content.indexOf(line);
        const surrounding = content.substring(Math.max(0, idx - 200), idx + 200);
        if (!/sanitize|mask|redact|sensitive/i.test(surrounding)) {
          return true;
        }
      }
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Check: payment-01 - Webhook signature verification
  // ---------------------------------------------------------------------------

  /**
   * payment-01: Webhook handlers must verify signatures.
   *
   * Only scans files that are actual webhook handlers (by path or content patterns).
   * Regular API routes (checkout, subscriptions, gift-cards, admin orders) are excluded.
   */
  private checkWebhookSignatureVerification(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allTsFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
    ];

    const webhookFiles: string[] = [];
    for (const file of allTsFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      if (this.isWebhookHandler(file, content)) {
        webhookFiles.push(file);
      }
    }

    if (webhookFiles.length === 0) {
      results.push(
        this.fail(
          'payment-01',
          'MEDIUM',
          'No webhook handler found',
          'No file found containing webhook handling logic. If the app processes payment provider events, webhook handlers with signature verification are required.',
          { recommendation: 'Create API routes for Stripe (/api/payments/webhook) and/or PayPal (/api/webhooks/paypal) that verify event signatures before processing.' }
        )
      );
      return results;
    }

    for (const file of webhookFiles) {
      const content = this.readFile(file);
      const hasStripeVerification = /(?:stripe|getStripe\w*\(\))\.webhooks\.constructEvent/.test(content);
      const hasPayPalVerification = /verify-webhook-signature|verifyWebhookSignature/.test(content);
      const hasSignatureVerification = hasStripeVerification || hasPayPalVerification;

      if (hasSignatureVerification) {
        const provider = hasStripeVerification ? 'Stripe' : 'PayPal';
        results.push(this.pass('payment-01', `${provider} webhook signature verification found in ${this.relativePath(file)}`));
      } else {
        const lineNum = this.findLineNumber(content, 'webhook') || this.findLineNumber(content, 'event');
        results.push(
          this.fail(
            'payment-01',
            'CRITICAL',
            'Webhook handler missing signature verification',
            `File ${this.relativePath(file)} is a webhook handler but does not verify event signatures. Attackers could forge webhook events.`,
            {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: this.getSnippet(content, lineNum),
              recommendation: 'For Stripe: use stripe.webhooks.constructEvent(body, sig, secret). For PayPal: call /v1/notifications/verify-webhook-signature.',
            }
          )
        );
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Check: payment-02 - No credit card data storage
  // ---------------------------------------------------------------------------

  /**
   * payment-02: No credit card field names in DB schema or models (actual storage).
   *
   * Excludes:
   *   - Auditor files (self-detection)
   *   - Icon/UI config files (Lucide icon names)
   *   - Sanitization/masking utilities (field name deny-lists)
   *   - Email templates (subscription/coupon expiryDate)
   *   - String constants that only name fields to redact (not store)
   *
   * Only flags files where card field names appear in a data-storage context
   * (assignments, request body access, database writes, non-masking type definitions).
   */
  private checkNoCreditCardStorage(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const forbiddenPatterns = [
      /cardNumber/i,
      /\bpan\b/i,
      /\bcvv\b/i,
      /\bcvc\b/i,
      /\bcvv2\b/i,
      /creditCard/i,
      /cardExpiry/i,
      /expiryDate/i,
      /expiryMonth/i,
      /expiryYear/i,
      /cardHolderName/i,
    ];

    // Scan Prisma schema (always scan - schema is the canonical data model)
    const schemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schemaContent = this.readFile(schemaPath);

    if (schemaContent) {
      for (const pattern of forbiddenPatterns) {
        const match = schemaContent.match(pattern);
        if (match) {
          const lineNum = this.findLineNumber(schemaContent, match[0]);
          results.push(
            this.fail(
              'payment-02',
              'CRITICAL',
              `Credit card data field "${match[0]}" found in Prisma schema`,
              `PCI-DSS prohibits storing raw credit card data. The field "${match[0]}" was found in schema.prisma.`,
              {
                filePath: 'prisma/schema.prisma',
                lineNumber: lineNum,
                codeSnippet: this.getSnippet(schemaContent, lineNum),
                recommendation: 'Never store raw card numbers, CVV, or expiry dates. Use Stripe tokens/payment methods instead.',
              }
            )
          );
        }
      }
    }

    // Scan TypeScript lib files (with exclusions for false positives)
    const libFiles = this.findLibFiles();
    for (const file of libFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Skip excluded files entirely
      if (this.isExcludedFromCardDataScan(file, content)) continue;

      for (const pattern of forbiddenPatterns) {
        const match = content.match(pattern);
        if (match) {
          // Only flag if the match appears in a data-storage context
          if (!this.isLikelyCardDataStorage(content, match[0])) continue;

          const lineNum = this.findLineNumber(content, match[0]);
          results.push(
            this.fail(
              'payment-02',
              'CRITICAL',
              `Credit card data field "${match[0]}" found in ${this.relativePath(file)}`,
              `PCI-DSS prohibits storing raw credit card data. Found reference to "${match[0]}" in a data-storage context.`,
              {
                filePath: this.relativePath(file),
                lineNumber: lineNum,
                codeSnippet: this.getSnippet(content, lineNum),
                recommendation: 'Remove card data fields. Use Stripe tokens or payment method IDs instead.',
              }
            )
          );
        }
      }
    }

    if (results.length === 0) {
      results.push(this.pass('payment-02', 'No raw credit card data fields found in schema or models'));
    }

    return results;
  }

  /**
   * payment-03: No console.log/logger calls leaking payment/card/stripe variables
   */
  private checkNoPaymentDataInLogs(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
      ...this.findComponents(),
    ];

    const sensitiveLogPattern = /console\.(log|info|debug|warn)\s*\([^)]*\b(card|payment|stripe|secret|token|amount|price)\b/i;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (sensitiveLogPattern.test(line)) {
          results.push(
            this.fail(
              'payment-03',
              'HIGH',
              `Payment-related data in console log`,
              `A console.log statement in ${this.relativePath(file)} may leak payment-sensitive data.`,
              {
                filePath: this.relativePath(file),
                lineNumber: i + 1,
                codeSnippet: this.getSnippet(content, i + 1),
                recommendation: 'Remove console.log calls that reference payment variables. Use structured logging with sensitive field redaction in production.',
              }
            )
          );
        }
      }
    }

    if (results.length === 0) {
      results.push(this.pass('payment-03', 'No payment-sensitive data found in console.log calls'));
    }

    return results;
  }

  /**
   * payment-04: Checkout/payment API routes must validate amounts server-side
   */
  private checkServerSideAmountValidation(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiRoutes = this.findApiRoutes();

    const paymentRoutes = apiRoutes.filter((f) => {
      const rel = this.relativePath(f).toLowerCase();
      return rel.includes('checkout') || rel.includes('payment') || rel.includes('order') || rel.includes('stripe');
    });

    if (paymentRoutes.length === 0) {
      results.push(
        this.fail(
          'payment-04',
          'MEDIUM',
          'No checkout/payment API routes found',
          'Could not find API routes for checkout, payment, or order processing to verify server-side amount validation.',
          { recommendation: 'Ensure payment processing API routes exist and calculate amounts from DB prices, not from client request body.' }
        )
      );
      return results;
    }

    for (const file of paymentRoutes) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check if amount comes directly from request body without server validation
      const usesBodyAmount = /body\.(amount|total|price)/i.test(content) || /req\.body\.(amount|total|price)/i.test(content);
      const hasDbLookup = /prisma\.|findUnique|findFirst|findMany/i.test(content);
      const calculatesTotal = /reduce|\.price\s*\*|subtotal|calculateTotal/i.test(content);

      if (usesBodyAmount && !hasDbLookup && !calculatesTotal) {
        const lineNum = this.findLineNumber(content, 'amount') || this.findLineNumber(content, 'total') || this.findLineNumber(content, 'price');
        results.push(
          this.fail(
            'payment-04',
            'CRITICAL',
            `Payment amount taken from request body without server validation`,
            `File ${this.relativePath(file)} appears to use amount/total/price directly from the request body without recalculating from DB prices.`,
            {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: this.getSnippet(content, lineNum),
              recommendation: 'Always recalculate order totals server-side from DB product prices. Never trust client-submitted amounts.',
            }
          )
        );
      } else {
        results.push(this.pass('payment-04', `Server-side validation pattern found in ${this.relativePath(file)}`));
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Check: payment-05 - Refund authorization
  // ---------------------------------------------------------------------------

  /**
   * payment-05: Refund endpoints must verify authorization.
   *
   * Only flags files that contain actual refund-initiating logic:
   *   - API routes that call stripe.refunds.create() or expose a refund action endpoint
   *   - Files whose path contains "refund"
   *
   * Does NOT flag:
   *   - Webhook handlers that react to charge.refunded events (they don't initiate refunds)
   *   - Lib files that only contain accounting/commission logic triggered by webhooks
   */
  private checkRefundAuthorization(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiRoutes = this.findApiRoutes();
    const libFiles = this.findLibFiles();
    const allFiles = [...apiRoutes, ...libFiles];

    const refundFiles: string[] = [];
    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;
      const rel = this.relativePath(file).toLowerCase();

      // Skip webhook handlers: they react to refund events, they don't initiate them
      if (this.isWebhookHandler(file, content)) continue;

      // Must contain actual refund-initiating logic
      const hasRefundCreation =
        /refunds\.create/i.test(content) ||                                // stripe.refunds.create()
        /stripe\.refunds/i.test(content) ||                                // stripe refund API call
        (rel.includes('refund') && /export\s+async\s+function\s+(POST|PUT|PATCH)/i.test(content));  // refund API endpoint

      if (hasRefundCreation) {
        refundFiles.push(file);
      }
    }

    if (refundFiles.length === 0) {
      results.push(
        this.fail(
          'payment-05',
          'LOW',
          'No refund endpoints found',
          'No files found containing refund-initiating logic (stripe.refunds.create or refund API endpoints). If refunds are supported, verify they require admin authorization.',
          { recommendation: 'Implement refund endpoints with proper authorization checks (auth() or withAdminGuard).' }
        )
      );
      return results;
    }

    for (const file of refundFiles) {
      const content = this.readFile(file);
      const hasAuth = /auth\s*\(\)|withAdminGuard|getServerSession|requireAuth|isAdmin|role.*ADMIN/i.test(content);

      if (hasAuth) {
        results.push(this.pass('payment-05', `Refund authorization check found in ${this.relativePath(file)}`));
      } else {
        const lineNum = this.findLineNumber(content, 'refund');
        results.push(
          this.fail(
            'payment-05',
            'CRITICAL',
            'Refund endpoint missing authorization check',
            `File ${this.relativePath(file)} contains refund-initiating logic but no auth()/withAdminGuard call to verify the caller is authorized.`,
            {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: this.getSnippet(content, lineNum),
              recommendation: 'Add auth() or withAdminGuard check at the top of refund endpoints. Only admin/owner roles should issue refunds.',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * payment-06: Stripe payment creation calls should use idempotencyKey
   */
  private checkIdempotencyKey(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
    ];

    const paymentCreationFiles: { file: string; lineNum: number; content: string }[] = [];

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Skip monitoring/APM/logging files with Stripe code in examples/comments
      const rel = this.relativePath(file).toLowerCase();
      if (/apm|monitoring|telemetry|tracing|metrics/.test(rel)) continue;

      // Look for Stripe payment intent/charge creation
      const creationPatterns = [
        /paymentIntents\.create/,
        /charges\.create/,
        /checkout\.sessions\.create/,
      ];

      for (const pattern of creationPatterns) {
        const match = content.match(pattern);
        if (match) {
          const lineNum = this.findLineNumber(content, match[0]);
          paymentCreationFiles.push({ file, lineNum, content });
        }
      }
    }

    if (paymentCreationFiles.length === 0) {
      results.push(
        this.fail(
          'payment-06',
          'LOW',
          'No Stripe payment creation calls found',
          'Could not find calls to paymentIntents.create, charges.create, or checkout.sessions.create.',
          { recommendation: 'If using Stripe for payments, ensure idempotencyKey is passed in the options parameter of create calls.' }
        )
      );
      return results;
    }

    for (const { file, lineNum, content } of paymentCreationFiles) {
      // Check for idempotencyKey near the create call (within ~20 lines)
      const lines = content.split('\n');
      const start = Math.max(0, lineNum - 5);
      const end = Math.min(lines.length, lineNum + 20);
      const vicinity = lines.slice(start, end).join('\n');

      const hasIdempotencyKey = /idempotencyKey|idempotency_key/i.test(vicinity);

      if (hasIdempotencyKey) {
        results.push(this.pass('payment-06', `Idempotency key found near payment creation in ${this.relativePath(file)}`));
      } else {
        results.push(
          this.fail(
            'payment-06',
            'HIGH',
            'Stripe payment creation missing idempotencyKey',
            `File ${this.relativePath(file)} calls a Stripe create method without an idempotencyKey, risking duplicate charges on retries.`,
            {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: this.getSnippet(content, lineNum),
              recommendation: 'Pass { idempotencyKey: uniqueOrderId } as the second argument to stripe.paymentIntents.create() and similar calls.',
            }
          )
        );
      }
    }

    return results;
  }
}
