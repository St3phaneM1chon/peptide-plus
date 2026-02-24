/**
 * ACCOUNTING-INTEGRITY Auditor
 * Checks double-entry balance validation, GL reconciliation, orphan prevention,
 * tax calculation consistency, and period lock enforcement.
 *
 * v2: Reduced false positives by only flagging files that actually WRITE
 *     accounting data (Prisma create/update/delete/upsert on accounting models),
 *     not files that merely READ or reference accounting terms.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as path from 'path';

export default class AccountingIntegrityAuditor extends BaseAuditor {
  auditTypeCode = 'ACCOUNTING-INTEGRITY';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkDebitCreditBalance());
    results.push(...this.checkGLBalanceReconciliation());
    results.push(...this.checkOrphanPrevention());
    results.push(...this.checkTaxCalculationConsistency());
    results.push(...this.checkPeriodLockEnforcement());

    return results;
  }

  // ---------------------------------------------------------------------------
  // Shared helpers: detect whether a file performs actual write operations
  // ---------------------------------------------------------------------------

  /**
   * Check if a route file exports any write HTTP handlers (POST/PUT/PATCH/DELETE).
   * Returns false for GET-only routes. For lib files (non-route), returns true
   * so they are not auto-excluded (further checks apply).
   */
  private hasWriteHttpHandlers(content: string, filePath: string): boolean {
    const isRouteFile = /route\.ts$/.test(filePath);
    if (!isRouteFile) return true; // lib files don't export HTTP handlers; don't filter them here

    // Look for exported POST/PUT/PATCH/DELETE handlers.
    // Next.js route convention: `export const POST = ...` or `export async function POST(...)`
    return /export\s+(const|async\s+function|function)\s+(POST|PUT|PATCH|DELETE)\b/.test(content);
  }

  /**
   * Check if a file contains actual Prisma write operations on accounting-related
   * models (journalEntry, journalLine, chartOfAccount, accountingPeriod).
   *
   * Matches patterns like:
   *   prisma.journalEntry.create(...)
   *   tx.journalLine.create(...)
   *   prisma.chartOfAccount.update(...)
   *   prisma.journalEntry.delete(...)
   *   prisma.journalLine.createMany(...)
   *   prisma.journalEntry.upsert(...)
   *
   * Does NOT match:
   *   prisma.journalEntry.findMany(...)  (read)
   *   prisma.journalLine.aggregate(...)  (read)
   *   prisma.journalLine.count(...)      (read)
   *   prisma.journalEntry.findUnique(...)(read)
   *   Comments or string literals mentioning "create"
   */
  private hasPrismaAccountingWrites(content: string): boolean {
    // Match prisma.<model>.<writeOp> or tx.<model>.<writeOp>
    // Accounting models: journalEntry, journalLine, chartOfAccount, accountingPeriod, accountingAlert
    const writeOps = /(?:prisma|tx)\s*\.\s*(?:journalEntry|journalLine|chartOfAccount|accountingPeriod|accountingAlert)\s*\.\s*(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;
    return writeOps.test(content);
  }

  /**
   * Check if a file creates journal entries specifically (the core concern for acct-01).
   * More targeted than hasPrismaAccountingWrites - looks for journalEntry.create
   * or journalLine.create/createMany.
   */
  private createsJournalEntries(content: string): boolean {
    return /(?:prisma|tx)\s*\.\s*(?:journalEntry|journalLine)\s*\.\s*(?:create|createMany)\s*\(/.test(content);
  }

  /**
   * acct-01: Journal entry creation code must validate debit/credit balance
   *
   * Only flags files that actually CREATE journal entries or journal lines via
   * Prisma write operations. Read-only routes (GET handlers, dashboards, exports)
   * are skipped even if they reference "journal", "debit", or "credit".
   */
  private checkDebitCreditBalance(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
    ];

    const journalFiles: string[] = [];
    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Gate 1: File must reference journal-related terms AND debit/credit
      if (!(/journal/i.test(content) && /debit|credit/i.test(content))) continue;

      // Gate 2: Route files must export a write HTTP handler (POST/PUT/PATCH/DELETE)
      if (!this.hasWriteHttpHandlers(content, file)) continue;

      // Gate 3: File must actually create journal entries or lines via Prisma
      if (!this.createsJournalEntries(content)) continue;

      journalFiles.push(file);
    }

    if (journalFiles.length === 0) {
      results.push(
        this.fail(
          'acct-01',
          'HIGH',
          'No journal entry creation code found',
          'Could not find code that creates journal entries with debit/credit references.',
          { recommendation: 'Implement journal entry creation with mandatory debit === credit validation before persisting.' }
        )
      );
      return results;
    }

    for (const file of journalFiles) {
      const content = this.readFile(file);

      // Look for balance validation patterns
      const hasBalanceCheck =
        /assertJournalBalance/i.test(content) ||
        /debit.*===?\s*credit|credit.*===?\s*debit/i.test(content) ||
        /totalDebit.*totalCredit|totalCredit.*totalDebit/i.test(content) ||
        /balance.*!==?\s*0|balance.*===?\s*0/i.test(content) ||
        /sumDebit|sumCredit|debitSum|creditSum/i.test(content) ||
        /reduce.*debit.*reduce.*credit/i.test(content) ||
        /balanced|isBalanced|checkBalance|validateBalance/i.test(content);

      if (hasBalanceCheck) {
        results.push(this.pass('acct-01', `Debit/credit balance validation found in ${this.relativePath(file)}`));
      } else {
        const lineNum = this.findLineNumber(content, 'debit') || this.findLineNumber(content, 'credit');
        results.push(
          this.fail(
            'acct-01',
            'CRITICAL',
            'Journal entry creation missing debit/credit balance validation',
            `File ${this.relativePath(file)} creates journal entries but does not appear to validate that total debits equal total credits.`,
            {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: this.getSnippet(content, lineNum),
              recommendation: 'Before inserting journal entries, validate: sum(debit amounts) === sum(credit amounts). Reject unbalanced entries.',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * acct-02: GL account balance calculations must exist and reconcile with detail queries
   */
  private checkGLBalanceReconciliation(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
    ];

    let hasBalanceCalc = false;
    let hasDetailQuery = false;
    let balanceFile = '';
    let detailFile = '';

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Balance summary calculation
      if (/balance|glBalance|accountBalance/i.test(content) && /aggregate|sum|groupBy|_sum/i.test(content)) {
        hasBalanceCalc = true;
        balanceFile = file;
      }

      // Detail line query (journal lines for an account)
      if (/journalLine|JournalLine|journal_line/i.test(content) && /findMany|where.*accountId/i.test(content)) {
        hasDetailQuery = true;
        detailFile = file;
      }
    }

    if (!hasBalanceCalc) {
      results.push(
        this.fail(
          'acct-02',
          'HIGH',
          'No GL account balance calculation found',
          'Could not find code that calculates GL account balances using aggregate/sum queries.',
          { recommendation: 'Implement GL balance calculations that aggregate debit and credit amounts per account.' }
        )
      );
    } else if (!hasDetailQuery) {
      results.push(
        this.fail(
          'acct-02',
          'MEDIUM',
          'GL balance exists but no detail reconciliation query found',
          `Balance calculation found in ${this.relativePath(balanceFile)} but no journal line detail query was found to reconcile against.`,
          {
            filePath: this.relativePath(balanceFile),
            recommendation: 'Provide a detail query that lists individual journal lines per account, enabling reconciliation against the aggregate balance.',
          }
        )
      );
    } else {
      results.push(this.pass('acct-02', `GL balance calc in ${this.relativePath(balanceFile)}, detail query in ${this.relativePath(detailFile)}`));
    }

    return results;
  }

  /**
   * acct-03: Cascade delete on JournalLine -> JournalEntry to prevent orphans
   */
  private checkOrphanPrevention(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const schemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schemaContent = this.readFile(schemaPath);

    if (!schemaContent) {
      results.push(
        this.fail(
          'acct-03',
          'HIGH',
          'Cannot read Prisma schema',
          'Could not read prisma/schema.prisma to verify orphan prevention on accounting relations.',
          { recommendation: 'Ensure prisma/schema.prisma exists and is readable.' }
        )
      );
      return results;
    }

    // Parse models related to journal entries
    const models = schemaContent.split(/^model\s+/m);

    let foundJournalLineRelation = false;
    let hasCascadeOnEntry = false;

    for (const modelBlock of models) {
      const modelNameMatch = modelBlock.match(/^(\w+)/);
      if (!modelNameMatch) continue;
      const modelName = modelNameMatch[1];

      // Look for JournalLine or similar model
      if (/JournalLine|JournalEntryLine|AccountingLine/i.test(modelName)) {
        foundJournalLineRelation = true;

        // Check for onDelete behavior on the JournalEntry relation
        const lines = modelBlock.split('\n');
        for (const line of lines) {
          if (/journalEntry|JournalEntry/i.test(line) && /@relation/.test(line)) {
            if (/onDelete:\s*Cascade/i.test(line)) {
              hasCascadeOnEntry = true;
            }
          }
        }
      }
    }

    if (!foundJournalLineRelation) {
      results.push(
        this.fail(
          'acct-03',
          'MEDIUM',
          'No JournalLine model found in schema',
          'Could not find a JournalLine/JournalEntryLine model in the Prisma schema to verify cascade delete.',
          { recommendation: 'Create a JournalLine model with a relation to JournalEntry using onDelete: Cascade.' }
        )
      );
    } else if (!hasCascadeOnEntry) {
      results.push(
        this.fail(
          'acct-03',
          'HIGH',
          'JournalLine -> JournalEntry relation missing cascade delete',
          'The JournalLine model has a relation to JournalEntry but does not specify onDelete: Cascade, which could create orphan lines.',
          {
            filePath: 'prisma/schema.prisma',
            recommendation: 'Add onDelete: Cascade to the @relation annotation on the JournalEntry foreign key in JournalLine.',
          }
        )
      );
    } else {
      results.push(this.pass('acct-03', 'JournalLine -> JournalEntry cascade delete configured'));
    }

    return results;
  }

  /**
   * acct-04: Tax calculation in invoices/orders must use centralized tax constants
   *
   * Scans for files that contain hardcoded Canadian tax rate literals
   * (e.g., * 0.05 for GST, * 0.09975 for QST, * 0.14975 combined) instead of
   * importing from the centralized tax-constants.ts or tax calculation services.
   *
   * Excludes:
   *  - Tax constant definition files themselves (tax-constants.ts, tax-rates.ts, etc.)
   *  - String literals in template definitions (e.g., debitFormula: 'amount * 0.05')
   *  - Test/UAT files
   *  - Files that only READ tax data without computing
   */
  private checkTaxCalculationConsistency(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
    ];

    // Known centralized tax files that DEFINE tax rates (should not be flagged)
    const taxDefinitionPatterns = [
      /tax-constants\.ts$/,
      /tax-rates\.ts$/,
      /canadian-tax-config\.ts$/,
      /tax-compliance\.service\.ts$/,
    ];

    const taxCalcFiles: string[] = [];
    const inlineTaxFiles: { file: string; lineNum: number; snippet: string }[] = [];

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Skip tax definition files themselves
      if (taxDefinitionPatterns.some((p) => p.test(file))) {
        taxCalcFiles.push(file);
        continue;
      }

      // Skip test/UAT files
      if (/\.test\.ts$|\.spec\.ts$|\/uat\//.test(file)) continue;

      // Detect centralized tax references
      if (/calculateTax|calcTax|GST_RATE|QST_RATE|TAX_RATES|gstRate|qstRate|hstRate/i.test(content) && /function|=>|const.*=|import/.test(content)) {
        taxCalcFiles.push(file);
      }

      // Detect hardcoded inline tax rate multiplications in executable code.
      // Match: * 0.05, * 0.09975, * 0.14975, * 0.13 (HST), * 0.15 (HST)
      // But NOT inside string literals like 'amount * 0.05' (template formulas).
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments
        if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue;

        // Skip string template definitions (formulas stored as strings)
        // e.g., debitFormula: 'amount * 0.05' or creditFormula: "amount * 0.09975"
        if (/['"`].*\*\s*0\.\d+.*['"`]/.test(line)) continue;

        // Look for actual hardcoded Canadian tax rate multiplications:
        //   * 0.05  (GST/TPS 5%)
        //   * 0.09975 (QST/TVQ 9.975%)
        //   * 0.14975 (combined QC rate)
        //   * 0.13 (HST ON 13%)
        //   * 0.15 (HST NS/NB/NL 15%)
        // Skip lines where * 0.05 is clearly a non-tax usage (tolerance, threshold, etc.)
        if (/\*\s*0\.(05|09975|14975|13|15)\b/.test(line) && !/tolerance|threshold|percent|margin|confidence|amountDiff|matchScore|ratio/i.test(line)) {
          // Verify this file does NOT already import centralized tax constants
          const importsTaxConstants =
            /import\s+.*(?:GST_RATE|QST_RATE|TAX_RATES|calculateTax|getTaxRate)/i.test(content) ||
            /import\s+.*from\s+['"].*tax/i.test(content);

          if (!importsTaxConstants) {
            inlineTaxFiles.push({
              file,
              lineNum: i + 1,
              snippet: this.getSnippet(content, i + 1),
            });
            break; // One finding per file is enough
          }
        }
      }
    }

    if (taxCalcFiles.length === 0) {
      results.push(
        this.fail(
          'acct-04',
          'MEDIUM',
          'No tax calculation functions found',
          'Could not find dedicated tax calculation functions or tax constant definitions.',
          { recommendation: 'Centralize tax rates in a single file (e.g., src/lib/tax-constants.ts) and import them everywhere.' }
        )
      );
      return results;
    }

    if (inlineTaxFiles.length === 0) {
      results.push(this.pass('acct-04', `No inline hardcoded tax rates detected. ${taxCalcFiles.length} centralized tax file(s) found.`));
    } else {
      for (const entry of inlineTaxFiles) {
        results.push(
          this.fail(
            'acct-04',
            'HIGH',
            'Hardcoded tax rate instead of centralized constant',
            `File ${this.relativePath(entry.file)} uses a hardcoded tax rate literal (e.g., * 0.05 or * 0.09975) instead of importing GST_RATE/QST_RATE from the centralized tax-constants module.`,
            {
              filePath: this.relativePath(entry.file),
              lineNumber: entry.lineNum,
              codeSnippet: entry.snippet,
              recommendation: 'Import { GST_RATE, QST_RATE } from "@/lib/tax-constants" and use those constants instead of hardcoded numeric literals.',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * acct-05: Accounting write operations must check period lock status
   *
   * Only flags files that actually WRITE to accounting tables via Prisma
   * (create/update/delete/upsert). Read-only routes that merely query
   * accounting data (dashboards, exports, reports) are skipped.
   */
  private checkPeriodLockEnforcement(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
    ];

    const accountingWriteFiles: string[] = [];

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const rel = this.relativePath(file).toLowerCase();

      // Skip UAT/test runners - they clean up test data, not production writes
      if (/uat\/|test\/|\.test\.|\.spec\./i.test(rel)) continue;
      // Skip alert service - it writes to accountingAlert (notifications), not journal entries
      if (/alert-rules\.service/i.test(rel)) continue;
      // Skip the accounting periods route itself (it manages periods, not writes to them)
      if (/accounting\/periods\/route/i.test(rel)) continue;

      // Gate 1: File must reference accounting model names
      if (!(/journal|JournalEntry|chartOfAccount|accountingPeriod/i.test(content))) continue;

      // Gate 2: Route files must export a write HTTP handler (POST/PUT/PATCH/DELETE)
      if (!this.hasWriteHttpHandlers(content, file)) continue;

      // Gate 3: File must contain actual Prisma write operations on accounting models
      if (!this.hasPrismaAccountingWrites(content)) continue;

      accountingWriteFiles.push(file);
    }

    if (accountingWriteFiles.length === 0) {
      results.push(
        this.fail(
          'acct-05',
          'MEDIUM',
          'No accounting write operations found',
          'Could not find code that writes to accounting tables (journal entries, chart of accounts).',
          { recommendation: 'Ensure accounting write operations exist and enforce period lock checks.' }
        )
      );
      return results;
    }

    for (const file of accountingWriteFiles) {
      const content = this.readFile(file);

      const hasPeriodCheck =
        /period.*lock|locked|isClosed|periodStatus|CLOSED|LOCKED/i.test(content) ||
        /accountingPeriod.*status|checkPeriod|validatePeriod|isPeriodOpen|assertPeriodOpen/i.test(content);

      if (hasPeriodCheck) {
        results.push(this.pass('acct-05', `Period lock check found in ${this.relativePath(file)}`));
      } else {
        const lineNum = this.findLineNumber(content, 'create') || this.findLineNumber(content, 'journal');
        results.push(
          this.fail(
            'acct-05',
            'HIGH',
            'Accounting write operation missing period lock check',
            `File ${this.relativePath(file)} writes to accounting tables but does not check if the accounting period is locked/closed.`,
            {
              filePath: this.relativePath(file),
              lineNumber: lineNum,
              codeSnippet: this.getSnippet(content, lineNum),
              recommendation: 'Before any accounting write, query the AccountingPeriod for the transaction date and reject writes if status is CLOSED or LOCKED.',
            }
          )
        );
      }
    }

    return results;
  }
}
