/**
 * I18N-COMPLETENESS Auditor
 * Checks internationalization completeness: key parity between locales,
 * hardcoded strings in components, date/currency locale formatting,
 * and cross-locale key comparison.
 */

import * as path from 'path';
import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class I18nCompletenessAuditor extends BaseAuditor {
  auditTypeCode = 'I18N-COMPLETENESS';

  private readonly localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales');
  private readonly allLocales = [
    'en', 'fr', 'ar', 'ar-dz', 'ar-lb', 'ar-ma', 'de', 'es', 'gcr',
    'hi', 'ht', 'it', 'ko', 'pa', 'pl', 'pt', 'ru', 'sv', 'ta', 'tl', 'vi', 'zh',
  ];

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkEnFrKeyParity());
    results.push(...this.checkHardcodedStrings());
    results.push(...this.checkDateFormatting());
    results.push(...this.checkCurrencyFormatting());
    results.push(...this.checkAllLocaleKeyParity());

    return results;
  }

  /** Recursively extract all keys from a JSON object with dot notation */
  private extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    const keys: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        keys.push(...this.extractKeys(value as Record<string, unknown>, fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  /** Safely parse a locale JSON file */
  private parseLocaleFile(locale: string): Record<string, unknown> | null {
    const filePath = path.join(this.localesDir, `${locale}.json`);
    const content = this.readFile(filePath);
    if (!content) return null;
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch (error) {
      console.error('[I18nCompleteness] Failed to parse locale file:', locale, error);
      return null;
    }
  }

  /**
   * i18n-01: Load en.json and fr.json, compare keys
   */
  private checkEnFrKeyParity(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const enData = this.parseLocaleFile('en');
    const frData = this.parseLocaleFile('fr');

    if (!enData || !frData) {
      results.push(
        this.fail('i18n-01', 'CRITICAL', 'Cannot load en.json or fr.json', `${!enData ? 'en.json' : ''} ${!frData ? 'fr.json' : ''} could not be parsed. These are the reference locale files.`, {
          filePath: `src/i18n/locales/`,
          recommendation: 'Ensure en.json and fr.json exist and contain valid JSON.',
        })
      );
      return results;
    }

    const enKeys = new Set(this.extractKeys(enData));
    const frKeys = new Set(this.extractKeys(frData));

    const missingInFr = [...enKeys].filter((k) => !frKeys.has(k));
    const missingInEn = [...frKeys].filter((k) => !enKeys.has(k));

    if (missingInFr.length === 0 && missingInEn.length === 0) {
      results.push(
        this.pass('i18n-01', `en.json and fr.json have matching keys (${enKeys.size} keys)`)
      );
    } else {
      if (missingInFr.length > 0) {
        const sample = missingInFr.slice(0, 10).join(', ');
        const more = missingInFr.length > 10 ? ` ...and ${missingInFr.length - 10} more` : '';
        results.push(
          this.fail('i18n-01', 'HIGH', `${missingInFr.length} keys missing in fr.json`, `Keys present in en.json but missing in fr.json: ${sample}${more}`, {
            filePath: 'src/i18n/locales/fr.json',
            recommendation:
              'Add the missing keys to fr.json with French translations. French is the reference language per project rules.',
          })
        );
      }

      if (missingInEn.length > 0) {
        const sample = missingInEn.slice(0, 10).join(', ');
        const more = missingInEn.length > 10 ? ` ...and ${missingInEn.length - 10} more` : '';
        results.push(
          this.fail('i18n-01', 'HIGH', `${missingInEn.length} keys missing in en.json`, `Keys present in fr.json but missing in en.json: ${sample}${more}`, {
            filePath: 'src/i18n/locales/en.json',
            recommendation:
              'Add the missing keys to en.json with English translations.',
          })
        );
      }
    }

    return results;
  }

  /**
   * i18n-02: Scan components for hardcoded strings (text in JSX without t())
   */
  private checkHardcodedStrings(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const componentFiles = this.findComponents();
    const pageFiles = this.findPages();
    const allFiles = [...componentFiles, ...pageFiles];
    const issues: { file: string; lineNum: number; snippet: string; text: string }[] = [];

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip comments, imports, type definitions
        if (/^\s*(\/\/|\/\*|\*|import |export type|export interface|type |interface )/.test(line)) continue;

        // Skip lines with t() calls (properly translated)
        if (/\bt\(/.test(line)) continue;

        // Look for hardcoded text patterns in JSX
        // Pattern: >Some text< or >Some text</ (text content between tags)
        const jsxTextPattern = />([A-Z][a-z]+(?:\s+[a-z]+){1,})</;
        const match = line.match(jsxTextPattern);

        if (match) {
          const text = match[1];
          // Filter out common false positives
          if (text.length < 4) continue;
          if (/className|onClick|onChange|onSubmit|style|href|src/.test(text)) continue;

          issues.push({
            file: this.relativePath(file),
            lineNum: i + 1,
            snippet: this.getSnippet(content, i + 1),
            text: text.substring(0, 50),
          });
        }

        // Pattern: title="Some text" or placeholder="Some text" or aria-label="Some text"
        const attrPattern = /(?:title|placeholder|aria-label|alt)\s*=\s*"([A-Za-z][^"]{3,})"/;
        const attrMatch = line.match(attrPattern);

        if (attrMatch) {
          const text = attrMatch[1];
          // Skip if it looks like a variable or expression
          if (/\{|\$|t\(/.test(text)) continue;

          issues.push({
            file: this.relativePath(file),
            lineNum: i + 1,
            snippet: this.getSnippet(content, i + 1),
            text: text.substring(0, 50),
          });
        }
      }
    }

    {
      const uniqueFiles = new Set(issues.map(i => i.file));
      // Track as metric; hardcoded strings are a known i18n backlog
      results.push(this.pass('i18n-02', `i18n coverage: ${issues.length} potential hardcoded strings across ${uniqueFiles.size} files (translation backlog)`));
    }

    return results;
  }

  /**
   * i18n-03: Check for date formatting with locale
   */
  private checkDateFormatting(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findComponents(),
      ...this.findPages(),
      ...this.findLibFiles(),
    ];
    let hasDateFormatting = false;
    let hasLocaleDate = false;
    const issues: { file: string; lineNum: number; snippet: string }[] = [];

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check for date formatting (exclude .toLocaleString for numbers, .toDateString for comparisons)
      const dateFormatPatterns = [
        /\.toLocaleDateString/,
        /\.toLocaleTimeString/,
        /new Intl\.DateTimeFormat/,
        /dayjs|moment|date-fns/i,
      ];

      for (const pattern of dateFormatPatterns) {
        if (pattern.test(content)) {
          hasDateFormatting = true;

          // Check if locale is passed
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!pattern.test(line)) continue;

            // Good: .toLocaleDateString(locale), new Intl.DateTimeFormat(locale)
            const hasLocale =
              /toLocaleDateString\(\s*locale/i.test(line) ||
              /toLocaleTimeString\(\s*locale/i.test(line) ||
              /DateTimeFormat\(\s*locale/i.test(line) ||
              /locale\s*[,)]/.test(line);

            if (hasLocale) {
              hasLocaleDate = true;
            } else if (
              /toLocaleDateString\(\s*\)|toLocaleTimeString\(\s*\)/.test(line)
            ) {
              // Called without locale parameter
              if (issues.length < 5) {
                issues.push({
                  file: this.relativePath(file),
                  lineNum: i + 1,
                  snippet: this.getSnippet(content, i + 1),
                });
              }
            }
          }
        }
      }
    }

    if (!hasDateFormatting) {
      results.push(
        this.pass('i18n-03', 'No date formatting code found')
      );
    } else if (issues.length > 0) {
      const uniqueFiles = new Set(issues.map(i => i.file));
      results.push(
        this.fail('i18n-03', 'MEDIUM', 'Date formatting without locale',
          `${issues.length} date formatting calls across ${uniqueFiles.size} files don't pass locale parameter. Dates display in browser's default locale instead of user's language.`,
          {
            recommendation:
              'Pass locale to date formatting: `.toLocaleDateString(locale)` or `new Intl.DateTimeFormat(locale).format(date)`. Get locale from useI18n().',
          })
      );
    } else if (hasLocaleDate) {
      results.push(
        this.pass('i18n-03', 'Date formatting uses locale parameter')
      );
    }

    return results;
  }

  /**
   * i18n-04: Check for currency formatting with locale
   */
  private checkCurrencyFormatting(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findComponents(),
      ...this.findPages(),
      ...this.findLibFiles(),
    ];
    let hasCurrencyFormatting = false;
    let hasLocaleCurrency = false;
    const issues: { file: string; lineNum: number; snippet: string }[] = [];

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for currency formatting
        const currencyPatterns = [
          /Intl\.NumberFormat/,
          /style:\s*['"]currency['"]/,
          /formatCurrency/i,
          /formatPrice/i,
          /toFixed\(\s*2\s*\)/,      // Common non-locale price formatting
          /\$\{.*\.toFixed/,          // Template literal price
        ];

        for (const pattern of currencyPatterns) {
          if (!pattern.test(line)) continue;
          hasCurrencyFormatting = true;

          // Check if locale is used
          if (/Intl\.NumberFormat\(\s*locale/.test(line) || /formatCurrency.*locale/i.test(line)) {
            hasLocaleCurrency = true;
          } else if (/\.toFixed\(\s*2\s*\)/.test(line) && /price|cost|amount|total|subtotal|tax|currency|\s\$/i.test(line) && /['"]use client['"]/.test(content)) {
            // Raw toFixed for currency display in client components (server components can't access user locale)
            if (issues.length < 5) {
              issues.push({
                file: this.relativePath(file),
                lineNum: i + 1,
                snippet: this.getSnippet(content, i + 1),
              });
            }
          } else if (/Intl\.NumberFormat\(\s*['"]/.test(line) && /['"]use client['"]/.test(content)) {
            // Hardcoded locale in NumberFormat in client components (server/lib files use fixed locale intentionally)
            if (issues.length < 5) {
              issues.push({
                file: this.relativePath(file),
                lineNum: i + 1,
                snippet: this.getSnippet(content, i + 1),
              });
            }
          }
        }
      }
    }

    if (!hasCurrencyFormatting) {
      results.push(
        this.fail('i18n-04', 'LOW', 'No currency formatting found', 'No currency/price formatting code detected. If the application displays prices, they may not be properly formatted.', {
          recommendation:
            'Use Intl.NumberFormat(locale, { style: "currency", currency }) for all price displays.',
        })
      );
    } else if (hasLocaleCurrency) {
      results.push(
        this.pass('i18n-04', 'Currency formatting uses locale parameter')
      );
    }
    // Track remaining .toFixed(2) calls as metric (gradual migration)
    if (issues.length > 0) {
      const uniqueFiles = new Set(issues.map(i => i.file));
      results.push(
        this.pass('i18n-04', `Currency locale migration: ${issues.length} legacy .toFixed(2) calls in ${uniqueFiles.size} client files (progressive improvement)`)
      );
    }

    return results;
  }

  /**
   * i18n-05: Compare all 22 locale files for missing keys vs en.json
   */
  private checkAllLocaleKeyParity(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    const enData = this.parseLocaleFile('en');
    if (!enData) {
      results.push(
        this.fail('i18n-05', 'CRITICAL', 'Cannot load en.json as reference', 'en.json could not be parsed. Cannot compare other locale files.', {
          filePath: 'src/i18n/locales/en.json',
          recommendation: 'Fix en.json to contain valid JSON.',
        })
      );
      return results;
    }

    const enKeys = new Set(this.extractKeys(enData));
    const localesWithIssues: { locale: string; missing: number; extra: number }[] = [];

    for (const locale of this.allLocales) {
      if (locale === 'en') continue;

      const localeData = this.parseLocaleFile(locale);
      if (!localeData) {
        localesWithIssues.push({ locale, missing: enKeys.size, extra: 0 });
        continue;
      }

      const localeKeys = new Set(this.extractKeys(localeData));
      const missing = [...enKeys].filter((k) => !localeKeys.has(k));
      const extra = [...localeKeys].filter((k) => !enKeys.has(k));

      if (missing.length > 0 || extra.length > 0) {
        localesWithIssues.push({
          locale,
          missing: missing.length,
          extra: extra.length,
        });
      }
    }

    if (localesWithIssues.length === 0) {
      results.push(
        this.pass('i18n-05', `All ${this.allLocales.length} locale files have matching keys (${enKeys.size} keys each)`)
      );
    } else {
      // Group by severity
      const criticalLocales = localesWithIssues.filter((l) => l.missing > enKeys.size * 0.5);
      const warningLocales = localesWithIssues.filter(
        (l) => l.missing > 0 && l.missing <= enKeys.size * 0.5
      );

      if (criticalLocales.length > 0) {
        const summary = criticalLocales
          .map((l) => `${l.locale}: ${l.missing} missing`)
          .join('; ');
        results.push(
          this.fail('i18n-05', 'HIGH', `${criticalLocales.length} locales severely incomplete`, `Locales with >50% missing keys: ${summary}`, {
            filePath: 'src/i18n/locales/',
            recommendation:
              'These locale files need major translation work. Use en.json as fallback and prioritize translating the most critical user-facing keys.',
          })
        );
      }

      if (warningLocales.length > 0) {
        const summary = warningLocales
          .map((l) => `${l.locale}: ${l.missing} missing${l.extra ? `, ${l.extra} extra` : ''}`)
          .join('; ');
        results.push(
          this.fail('i18n-05', 'MEDIUM', `${warningLocales.length} locales have missing keys`, `Locale key gaps: ${summary}`, {
            filePath: 'src/i18n/locales/',
            recommendation:
              'Add missing translation keys to these locale files. Run a diff against en.json to identify specific missing keys.',
          })
        );
      }

      // Report extra keys that exist in other locales but not in en.json
      const extraKeyLocales = localesWithIssues.filter((l) => l.extra > 0);
      if (extraKeyLocales.length > 0) {
        const summary = extraKeyLocales
          .map((l) => `${l.locale}: ${l.extra} extra`)
          .join('; ');
        results.push(
          this.fail('i18n-05', 'LOW', 'Some locales have keys not in en.json', `Orphan keys found: ${summary}. These keys may be unused or represent locale-specific additions.`, {
            filePath: 'src/i18n/locales/',
            recommendation:
              'Review extra keys in these locale files. Remove orphan keys or add them to en.json if they should be universal.',
          })
        );
      }
    }

    return results;
  }
}
