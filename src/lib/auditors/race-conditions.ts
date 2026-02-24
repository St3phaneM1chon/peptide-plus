/**
 * RACE-CONDITIONS Auditor
 * Checks for race conditions in stock updates, order creation,
 * payment processing, and optimistic locking patterns.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class RaceConditionsAuditor extends BaseAuditor {
  auditTypeCode = 'RACE-CONDITIONS';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkStockTransactions());
    results.push(...this.checkOrderTransactions());
    results.push(...this.checkPaymentIdempotency());
    results.push(...this.checkOptimisticLocking());

    return results;
  }

  /**
   * race-01: Stock/inventory update code must use prisma.$transaction
   */
  private checkStockTransactions(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiFiles = this.findApiRoutes();
    const libFiles = this.findLibFiles();
    const allFiles = [...apiFiles, ...libFiles];
    let foundStockCode = false;
    let allUseTransaction = true;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;
      const rel = this.relativePath(file).toLowerCase();

      // Skip files that never mutate stock (validations, email templates, analytics, tests, config)
      if (/validations?\/|email|template|analytics|uat\/|test\/|seed|csrf|rate-limit/i.test(rel)) continue;

      // Only match actual Prisma stock MUTATION patterns (not reads, comments, or Zod schemas)
      const stockMutationPatterns = [
        /prisma\.\w+\.update\w*\s*\([^)]{0,300}stockQuantity/i,
        /prisma\.\w+\.update\w*\s*\([^)]{0,300}stock[A-Z]/i,
        /increment\s*:\s*\{[^}]*stock/i,
        /decrement\s*:\s*\{[^}]*stock/i,
        /increment\s*:\s*\{[^}]*quantity/i,
        /decrement\s*:\s*\{[^}]*quantity/i,
        /\.update\(\s*\{[\s\S]{0,400}stockQuantity\s*:/i,
        /productFormat\.update/i,  // ProductFormat updates often touch stock
      ];

      const hasStockUpdate = stockMutationPatterns.some((p) => p.test(content));
      if (!hasStockUpdate) continue;

      foundStockCode = true;
      const hasTransaction =
        content.includes('$transaction') || content.includes('.$transaction');

      if (!hasTransaction) {
        allUseTransaction = false;
        const lineNum = this.findLineNumber(
          content,
          content.match(/stockQuantity|increment|decrement/i)?.[0] || 'stock'
        );
        results.push(
          this.fail('race-01', 'HIGH', 'Stock update without transaction', `File modifies stock/inventory without prisma.$transaction, risking race conditions on concurrent orders.`, {
            filePath: this.relativePath(file),
            lineNumber: lineNum,
            codeSnippet: this.getSnippet(content, lineNum),
            recommendation:
              'Wrap stock updates in prisma.$transaction() to ensure atomicity. Use decrement/increment operations within the transaction.',
          })
        );
      }
    }

    if (!foundStockCode) {
      results.push(
        this.fail('race-01', 'MEDIUM', 'No stock update code found', 'Could not find stock/inventory update logic. If inventory management exists, it may use unexpected patterns.', {
          recommendation:
            'Ensure stock modifications go through a centralized service that uses prisma.$transaction.',
        })
      );
    } else if (allUseTransaction) {
      results.push(this.pass('race-01', 'Stock updates use transactions'));
    }

    return results;
  }

  /**
   * race-02: Order creation must use transaction (atomic)
   */
  private checkOrderTransactions(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiFiles = this.findApiRoutes();
    const libFiles = this.findLibFiles();
    const allFiles = [...apiFiles, ...libFiles];
    let foundOrderCreation = false;
    let allUseTransaction = true;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;
      const rel = this.relativePath(file).toLowerCase();

      // Skip files that clearly don't create orders (newsletter, notifications, password, etc.)
      if (/newsletter|notification|password|search-analytics|hero-slide|categor|mailing|chat|content|video|webinar|uat\/|test\/|seed/i.test(rel)) continue;

      // Only match actual Prisma Order/OrderItem creation patterns (not orderBy, sortOrder, order.createdAt)
      const orderCreationPatterns = [
        /prisma\.order\.create\s*\(/i,
        /prisma\.orderItem\.create/i,
        /prisma\.orderItem\.createMany/i,
        /createOrder\s*\(/i,
        /order\.create\s*\(/i,  // require opening paren to exclude order.createdAt
      ];

      const hasOrderCreation = orderCreationPatterns.some((p) => p.test(content));
      if (!hasOrderCreation) continue;

      foundOrderCreation = true;
      const hasTransaction =
        content.includes('$transaction') || content.includes('.$transaction');

      if (!hasTransaction) {
        allUseTransaction = false;
        const match = content.match(/prisma\.order\.create|prisma\.orderItem\.create|createOrder\s*\(/i);
        const lineNum = this.findLineNumber(content, match?.[0] || 'order');
        results.push(
          this.fail('race-02', 'HIGH', 'Order creation without transaction', `Order creation in ${this.relativePath(file)} does not use prisma.$transaction. If order + items + stock are not atomic, partial failures can leave inconsistent state.`, {
            filePath: this.relativePath(file),
            lineNumber: lineNum,
            codeSnippet: this.getSnippet(content, lineNum),
            recommendation:
              'Wrap order creation, order item creation, and stock adjustments in a single prisma.$transaction() call.',
          })
        );
      }
    }

    if (!foundOrderCreation) {
      results.push(
        this.fail('race-02', 'MEDIUM', 'No order creation code found', 'Could not locate order creation logic. Verify order processing uses atomic transactions.', {
          recommendation:
            'Ensure order creation is implemented with prisma.$transaction for atomicity.',
        })
      );
    } else if (allUseTransaction) {
      results.push(this.pass('race-02', 'Order creation uses transactions'));
    }

    return results;
  }

  /**
   * race-03: Payment processing should have idempotency patterns
   */
  private checkPaymentIdempotency(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiFiles = this.findApiRoutes();
    const libFiles = this.findLibFiles();
    const allFiles = [...apiFiles, ...libFiles];
    let foundPaymentCode = false;
    let hasIdempotency = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const paymentPatterns = [
        /stripe/i,
        /payment/i,
        /charge/i,
        /checkout.*session/i,
      ];

      const isPaymentFile = paymentPatterns.some((p) => p.test(content));
      if (!isPaymentFile) continue;

      // Skip monitoring/APM/logging files that mention payment terms in examples/comments
      const rel = this.relativePath(file).toLowerCase();
      if (/apm|monitoring|telemetry|tracing|metrics/.test(rel)) continue;

      // Only consider files that actually process payments (not just reference them)
      const processingPatterns = [
        /paymentIntent/i,
        /checkout\.sessions\.create/i,
        /charges\.create/i,
        /processPayment/i,
        /capturePayment/i,
      ];

      const processesPayment = processingPatterns.some((p) => p.test(content));
      if (!processesPayment) continue;

      foundPaymentCode = true;

      // Check for idempotency patterns
      const idempotencyPatterns = [
        /idempotency/i,
        /idempotent/i,
        /idempotencyKey/i,
        /idempotency_key/i,
        /already.*processed/i,
        /duplicate.*check/i,
        /existing.*payment/i,
        /findFirst.*paymentIntent/i,
        /findUnique.*paymentId/i,
      ];

      if (idempotencyPatterns.some((p) => p.test(content))) {
        hasIdempotency = true;
      } else {
        const match = content.match(
          /paymentIntent|checkout\.sessions\.create|charges\.create|processPayment/i
        );
        const lineNum = this.findLineNumber(content, match?.[0] || 'payment');
        results.push(
          this.fail('race-03', 'CRITICAL', 'Payment processing without idempotency', `Payment processing in ${this.relativePath(file)} lacks idempotency checks. Duplicate requests can result in double charges.`, {
            filePath: this.relativePath(file),
            lineNumber: lineNum,
            codeSnippet: this.getSnippet(content, lineNum),
            recommendation:
              'Use Stripe idempotency keys or check for existing payment records before processing. Store payment intent IDs and verify before creating new ones.',
          })
        );
      }
    }

    if (!foundPaymentCode) {
      results.push(
        this.fail('race-03', 'LOW', 'No payment processing code found', 'Could not locate payment processing logic to verify idempotency.', {
          recommendation:
            'When implementing payment processing, always include idempotency keys and duplicate detection.',
        })
      );
    } else if (hasIdempotency) {
      results.push(this.pass('race-03', 'Payment processing has idempotency patterns'));
    }

    return results;
  }

  /**
   * race-04: Check for optimistic locking (version field or updatedAt check)
   */
  private checkOptimisticLocking(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Check schema for version fields
    const schemaPath = `${this.rootDir}/prisma/schema.prisma`;
    const schema = this.readFile(schemaPath);

    const hasVersionField = /version\s+Int/i.test(schema);
    const hasUpdatedAt = /@updatedAt/.test(schema);

    // Check code for optimistic locking patterns
    const apiFiles = this.findApiRoutes();
    const libFiles = this.findLibFiles();
    const allFiles = [...apiFiles, ...libFiles];
    let usesOptimisticLocking = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const optimisticPatterns = [
        /version.*where/i,
        /where.*version/i,
        /updatedAt.*where/i,
        /where.*updatedAt/i,
        /optimistic/i,
        /StaleObjectError/i,
        /ConcurrencyError/i,
        /P2025/,  // Prisma record not found (used in optimistic locking)
      ];

      if (optimisticPatterns.some((p) => p.test(content))) {
        usesOptimisticLocking = true;
        break;
      }
    }

    if (!hasVersionField && !usesOptimisticLocking) {
      results.push(
        this.fail('race-04', 'MEDIUM', 'No optimistic locking detected', 'No version field in Prisma schema and no optimistic locking patterns in code. Concurrent edits to the same record can silently overwrite each other.', {
          filePath: 'prisma/schema.prisma',
          recommendation:
            'Add a `version Int @default(0)` field to models that can be concurrently updated (e.g., Order, Product). Use `where: { id, version }` in updates and handle P2025 errors for retry.',
        })
      );
    } else if (hasVersionField || usesOptimisticLocking) {
      results.push(this.pass('race-04', 'Optimistic locking patterns detected'));
    } else if (hasUpdatedAt && !usesOptimisticLocking) {
      results.push(
        this.fail('race-04', 'LOW', 'updatedAt present but not used for locking', 'Schema has @updatedAt fields but they are not used in WHERE clauses for optimistic concurrency control.', {
          filePath: 'prisma/schema.prisma',
          recommendation:
            'Use updatedAt in update WHERE clauses or add an explicit version field for optimistic locking.',
        })
      );
    }

    return results;
  }
}
