/**
 * TAX-ACCURACY Auditor
 * Verifies Canadian tax rates (GST, QST, HST), tax exemption handling,
 * banker's rounding, and report-collection consistency.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class TaxAccuracyAuditor extends BaseAuditor {
  auditTypeCode = 'TAX-ACCURACY';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkGSTRate());
    results.push(...this.checkQSTRate());
    results.push(...this.checkHSTRates());
    results.push(...this.checkTaxExemptionHandling());
    results.push(...this.checkBankersRounding());
    results.push(...this.checkTaxReportConsistency());

    return results;
  }

  /** Helper to collect all tax-relevant files */
  private getTaxFiles(): string[] {
    return [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
      ...this.findComponents(),
    ];
  }

  /** Check if a rate value is near a GST/QST/HST definition (not a Quick Method, threshold, or string) */
  private isActualTaxRateContext(content: string, matchIndex: number): boolean {
    // Get surrounding context (200 chars before and after)
    const start = Math.max(0, matchIndex - 200);
    const end = Math.min(content.length, matchIndex + 200);
    const context = content.substring(start, end).toLowerCase();

    // Skip Quick Method rates (CRA simplified remittance rates)
    if (/quick.?method|remittance.?rate|remit/i.test(context)) return false;

    // Skip string/template literal descriptions (not actual numeric rates)
    // e.g., rate: '9.975% QST + 5% GST = 14.975% effective'
    const lineStart = content.lastIndexOf('\n', matchIndex) + 1;
    const lineEnd = content.indexOf('\n', matchIndex);
    const line = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd);
    if (/['"`].*\d+\.?\d*%.*['"`]/.test(line)) return false;

    // Skip payroll/exemption threshold amounts (dollar values, not rates)
    if (/annual.?exemption|exemption.?amount|threshold|maximum|minimum|ceiling/i.test(context)) return false;

    return true;
  }

  /**
   * tax-01: GST rate constant must be 5% (0.05)
   */
  private checkGSTRate(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = this.getTaxFiles();

    let foundGST = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Look for GST rate definition
      const gstPatterns = [
        /GST_RATE\s*[:=]\s*([\d.]+)/i,
        /gstRate\s*[:=]\s*([\d.]+)/i,
        /gst\s*[:=]\s*([\d.]+)/i,
        /['"]gst['"]\s*[:=]\s*([\d.]+)/i,
      ];

      for (const pattern of gstPatterns) {
        const match = content.match(pattern);
        if (match) {
          const rate = parseFloat(match[1]);
          const matchIndex = content.indexOf(match[0]);
          const lineNum = this.findLineNumber(content, match[0]);

          // Skip false positives: gst:0 in HST provinces is correct (HST replaces GST)
          const surroundingContext = content.substring(
            Math.max(0, matchIndex - 300),
            Math.min(content.length, matchIndex + 100)
          );
          if (rate === 0 && /hst|HST|harmonized/i.test(surroundingContext)) {
            continue; // In HST provinces, gst: 0 is correct
          }

          // Skip Quick Method rates, string descriptions, threshold amounts
          if (!this.isActualTaxRateContext(content, matchIndex)) {
            continue;
          }

          foundGST = true;
          if (rate === 0.05 || rate === 5) {
            results.push(this.pass('tax-01', `GST rate correctly set to 5% in ${this.relativePath(file)}`));
          } else {
            results.push(
              this.fail(
                'tax-01',
                'CRITICAL',
                `GST rate is ${rate} instead of 0.05 (5%)`,
                `File ${this.relativePath(file)} defines GST rate as ${rate}. The correct Canadian GST rate is 5% (0.05).`,
                {
                  filePath: this.relativePath(file),
                  lineNumber: lineNum,
                  codeSnippet: this.getSnippet(content, lineNum),
                  recommendation: 'Set the GST rate to 0.05 (5%). This is the federal Goods and Services Tax rate across Canada.',
                }
              )
            );
          }
        }
      }
    }

    if (!foundGST) {
      results.push(
        this.fail(
          'tax-01',
          'HIGH',
          'No GST rate constant found',
          'Could not find a GST rate definition (GST_RATE, gstRate, etc.) in the codebase.',
          { recommendation: 'Define a GST_RATE constant of 0.05 in a centralized tax configuration file (e.g., src/lib/tax.ts).' }
        )
      );
    }

    return results;
  }

  /**
   * tax-02: QST rate constant must be 9.975% (0.09975)
   */
  private checkQSTRate(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = this.getTaxFiles();

    let foundQST = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const qstPatterns = [
        /QST_RATE\s*[:=]\s*([\d.]+)/i,
        /qstRate\s*[:=]\s*([\d.]+)/i,
        /qst\s*[:=]\s*([\d.]+)/i,
        /['"]qst['"]\s*[:=]\s*([\d.]+)/i,
      ];

      for (const pattern of qstPatterns) {
        const match = content.match(pattern);
        if (match) {
          const rate = parseFloat(match[1]);
          const matchIndex = content.indexOf(match[0]);
          const lineNum = this.findLineNumber(content, match[0]);

          // Skip Quick Method rates, string descriptions, threshold amounts
          if (!this.isActualTaxRateContext(content, matchIndex)) {
            continue;
          }

          foundQST = true;
          if (rate === 0.09975 || rate === 9.975) {
            results.push(this.pass('tax-02', `QST rate correctly set to 9.975% in ${this.relativePath(file)}`));
          } else {
            results.push(
              this.fail(
                'tax-02',
                'CRITICAL',
                `QST rate is ${rate} instead of 0.09975 (9.975%)`,
                `File ${this.relativePath(file)} defines QST rate as ${rate}. The correct Quebec QST rate is 9.975% (0.09975).`,
                {
                  filePath: this.relativePath(file),
                  lineNumber: lineNum,
                  codeSnippet: this.getSnippet(content, lineNum),
                  recommendation: 'Set the QST rate to 0.09975 (9.975%). This is the Quebec Sales Tax rate.',
                }
              )
            );
          }
        }
      }
    }

    if (!foundQST) {
      results.push(
        this.fail(
          'tax-02',
          'HIGH',
          'No QST rate constant found',
          'Could not find a QST rate definition (QST_RATE, qstRate, etc.) in the codebase.',
          { recommendation: 'Define a QST_RATE constant of 0.09975 in a centralized tax configuration file.' }
        )
      );
    }

    return results;
  }

  /**
   * tax-03: HST rates per province must be defined and correct
   */
  private checkHSTRates(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = this.getTaxFiles();

    // Expected HST rates by province (NS reduced to 14% effective April 1, 2025)
    const expectedHST: Record<string, number> = {
      ON: 0.13,
      NB: 0.15,
      NS: 0.14,
      NL: 0.15,
      PE: 0.15,
    };

    let foundHSTConfig = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Look for HST rate definitions - object/map style
      if (/HST|hst/i.test(content) && /rate|Rate/i.test(content)) {
        foundHSTConfig = true;

        // Check for province codes near HST mentions
        for (const [province, expectedRate] of Object.entries(expectedHST)) {
          const provincePattern = new RegExp(`['"]?${province}['"]?\\s*[:=]\\s*([\\d.]+)`, 'i');
          const match = content.match(provincePattern);

          if (match) {
            const rate = parseFloat(match[1]);
            const matchIndex = content.indexOf(match[0]);

            // Skip non-rate contexts (payroll thresholds, dollar amounts, counts)
            if (!this.isActualTaxRateContext(content, matchIndex)) continue;

            // Skip values that are clearly not tax rates (> 1 and not a percentage like 13, 14, 15)
            const validPercentages = [expectedRate * 100, expectedRate];
            if (rate > 1 && !validPercentages.includes(rate) && ![13, 14, 15].includes(rate)) continue;

            if (rate === expectedRate || rate === expectedRate * 100) {
              // Correct rate found
            } else {
              const lineNum = this.findLineNumber(content, match[0]);
              results.push(
                this.fail(
                  'tax-03',
                  'CRITICAL',
                  `HST rate for ${province} is ${rate} instead of ${expectedRate}`,
                  `File ${this.relativePath(file)} defines HST for ${province} as ${rate}. Expected: ${expectedRate} (${expectedRate * 100}%).`,
                  {
                    filePath: this.relativePath(file),
                    lineNumber: lineNum,
                    codeSnippet: this.getSnippet(content, lineNum),
                    recommendation: `Set HST rate for ${province} to ${expectedRate} (${expectedRate * 100}%).`,
                  }
                )
              );
            }
          }
        }
      }

      // Also check for a tax-by-province lookup
      if (/province|Province|provinceCode/i.test(content) && /tax|Tax|rate|Rate/i.test(content)) {
        foundHSTConfig = true;
      }
    }

    if (!foundHSTConfig) {
      results.push(
        this.fail(
          'tax-03',
          'HIGH',
          'No HST per-province rate configuration found',
          'Could not find HST rate definitions organized by province (ON=13%, NB/NS/NL/PE=15%).',
          {
            recommendation:
              'Create a tax rate configuration mapping province codes to their HST rates. ON=0.13, NB/NS/NL/PE=0.15. For non-HST provinces, apply GST + PST/QST as applicable.',
          }
        )
      );
    } else {
      results.push(this.pass('tax-03', 'HST per-province configuration found'));
    }

    return results;
  }

  /**
   * tax-04: Tax exemption handling logic must exist
   */
  private checkTaxExemptionHandling(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = this.getTaxFiles();

    let foundExemption = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      if (/tax.*exempt|exempt.*tax|isTaxExempt|taxExempt|exemption/i.test(content)) {
        foundExemption = true;

        // Skip data-only files (config objects, type definitions, descriptive strings)
        const isDataOnly = /interface\s+.*\{|type\s+.*=|countryObligations|PAYROLL_RATES|DEDUCTIBILITY/i.test(content);
        if (isDataOnly && !/function\s|=>\s*\{|async\s/.test(content.substring(
          Math.max(0, content.search(/exempt/i) - 500),
          Math.min(content.length, content.search(/exempt/i) + 500)
        ))) {
          continue; // Data declaration, not logic
        }

        // Check for proper conditional logic
        const hasConditional = /if\s*\(.*exempt/i.test(content) || /\?\s*0\s*:|exempt.*\?\s*null/i.test(content) || /exemptSales|zeroRatedSales/i.test(content);

        if (hasConditional) {
          results.push(this.pass('tax-04', `Tax exemption conditional logic found in ${this.relativePath(file)}`));
        } else {
          const lineNum = this.findLineNumber(content, 'exempt');
          results.push(
            this.fail(
              'tax-04',
              'MEDIUM',
              'Tax exemption referenced but no conditional logic found',
              `File ${this.relativePath(file)} mentions tax exemption but does not appear to conditionally skip tax calculation when exempt.`,
              {
                filePath: this.relativePath(file),
                lineNumber: lineNum,
                codeSnippet: this.getSnippet(content, lineNum),
                recommendation: 'Add conditional logic: if (customer.isTaxExempt) { taxAmount = 0; } to skip tax for exempt entities.',
              }
            )
          );
        }
      }
    }

    if (!foundExemption) {
      results.push(
        this.fail(
          'tax-04',
          'MEDIUM',
          'No tax exemption handling found',
          'No code found that handles tax-exempt customers or products (isTaxExempt, taxExempt, exemption).',
          { recommendation: 'Add tax exemption support for registered businesses, resellers, and tax-exempt organizations.' }
        )
      );
    }

    return results;
  }

  /**
   * tax-05: Check for banker's rounding or Decimal library for monetary calculations
   */
  private checkBankersRounding(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = this.getTaxFiles();

    let foundDecimalLib = false;
    let foundBankersRounding = false;
    let foundNaiveRounding = false;
    let naiveFile = '';
    let naiveLineNum = 0;
    let naiveContent = '';

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check for Decimal.js, Big.js, dinero.js, or similar precision libraries
      if (/import.*(?:Decimal|Big|Dinero|bignumber|currency)/i.test(content) || /require\s*\(\s*['"](?:decimal\.js|big\.js|dinero\.js|bignumber\.js|currency\.js)['"]\s*\)/.test(content)) {
        foundDecimalLib = true;
      }

      // Check for banker's rounding implementation
      if (/banker.*round|round.*half.*even|ROUND_HALF_EVEN|toFixed.*round/i.test(content)) {
        foundBankersRounding = true;
      }

      // Check for naive Math.round on monetary values
      if (/Math\.round\s*\(.*(?:price|total|amount|tax|subtotal)/i.test(content) ||
          /(?:price|total|amount|tax|subtotal).*Math\.round/i.test(content) ||
          /\.toFixed\s*\(\s*2\s*\)/i.test(content)) {
        if (/tax|price|amount|total|subtotal/i.test(content)) {
          foundNaiveRounding = true;
          naiveFile = file;
          const matchStr = content.match(/Math\.round|\.toFixed/)?.[0] || 'toFixed';
          naiveLineNum = this.findLineNumber(content, matchStr);
          naiveContent = content;
        }
      }
    }

    if (foundDecimalLib) {
      results.push(this.pass('tax-05', 'Decimal precision library found for monetary calculations'));
    } else if (foundBankersRounding) {
      results.push(this.pass('tax-05', 'Banker\'s rounding implementation found'));
    } else if (foundNaiveRounding) {
      results.push(
        this.fail(
          'tax-05',
          'MEDIUM',
          'Naive Math.round / toFixed used for monetary calculations',
          `File ${this.relativePath(naiveFile)} uses Math.round or toFixed on monetary values without banker\'s rounding or a Decimal library.`,
          {
            filePath: this.relativePath(naiveFile),
            lineNumber: naiveLineNum,
            codeSnippet: this.getSnippet(naiveContent, naiveLineNum),
            recommendation: 'Use a Decimal library (decimal.js, dinero.js) or implement banker\'s rounding (round-half-to-even) for all monetary calculations to avoid cumulative rounding errors.',
          }
        )
      );
    } else {
      results.push(
        this.fail(
          'tax-05',
          'LOW',
          'No rounding strategy detected for monetary calculations',
          'Could not find any rounding logic (Math.round, toFixed, Decimal library, or banker\'s rounding) in tax/price-related code.',
          { recommendation: 'Implement a Decimal library or banker\'s rounding for all monetary calculations to ensure cent-level accuracy.' }
        )
      );
    }

    return results;
  }

  /**
   * tax-06: Tax report generation must match collection logic
   */
  private checkTaxReportConsistency(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
    ];

    let hasCollectionLogic = false;
    let hasReportLogic = false;
    let collectionFile = '';
    let reportFile = '';

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Tax collection during checkout/order
      if (/taxAmount|taxCollected|collectTax|taxLine/i.test(content) && /order|checkout|invoice|payment/i.test(content)) {
        hasCollectionLogic = true;
        collectionFile = file;
      }

      // Tax reporting / remittance
      if (/taxReport|taxSummary|taxRemittance|gstReport|qstReport|hstReport|taxFiling/i.test(content)) {
        hasReportLogic = true;
        reportFile = file;
      }
    }

    if (!hasCollectionLogic) {
      results.push(
        this.fail(
          'tax-06',
          'MEDIUM',
          'No tax collection logic found',
          'Could not find code that collects tax during order/checkout processing.',
          { recommendation: 'Implement tax collection logic that records GST/QST/HST amounts per transaction.' }
        )
      );
    } else if (!hasReportLogic) {
      results.push(
        this.fail(
          'tax-06',
          'MEDIUM',
          'Tax collection exists but no tax report generation found',
          `Tax collection found in ${this.relativePath(collectionFile)} but no corresponding tax report/summary generation was found.`,
          {
            filePath: this.relativePath(collectionFile),
            recommendation: 'Implement tax report generation that aggregates collected taxes by period for GST/QST/HST remittance filing.',
          }
        )
      );
    } else {
      results.push(this.pass('tax-06', `Tax collection in ${this.relativePath(collectionFile)}, reporting in ${this.relativePath(reportFile)}`));
    }

    return results;
  }
}
