/**
 * PRIVACY-COMPLIANCE Auditor
 * Checks GDPR/PIPEDA/Law 25 compliance: consent timestamps, data export,
 * data deletion, cookie consent, privacy policy versioning, and data retention.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';
import * as path from 'path';

export default class PrivacyComplianceAuditor extends BaseAuditor {
  auditTypeCode = 'PRIVACY-COMPLIANCE';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkConsentTimestamps());
    results.push(...this.checkDataExport());
    results.push(...this.checkDataDeletion());
    results.push(...this.checkCookieConsent());
    results.push(...this.checkPrivacyPolicyVersioning());
    results.push(...this.checkDataRetentionPolicy());

    return results;
  }

  /**
   * privacy-01: Consent timestamp fields must exist in schema or code
   */
  private checkConsentTimestamps(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Check Prisma schema
    const schemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schemaContent = this.readFile(schemaPath);

    const consentFields = /consentDate|consentAt|consentGranted|grantedAt|termsAcceptedAt|privacyAcceptedAt|consentTimestamp/i;

    let foundInSchema = false;
    if (schemaContent) {
      if (consentFields.test(schemaContent)) {
        foundInSchema = true;
        results.push(this.pass('privacy-01', 'Consent timestamp field found in Prisma schema'));
      }
    }

    // Check code files for consent handling
    if (!foundInSchema) {
      const allFiles = [
        ...this.findApiRoutes(),
        ...this.findLibFiles(),
        ...this.findComponents(),
      ];

      let foundInCode = false;
      for (const file of allFiles) {
        const content = this.readFile(file);
        if (!content) continue;

        if (consentFields.test(content) || /consent.*date|consent.*time|recordConsent/i.test(content)) {
          foundInCode = true;
          results.push(this.pass('privacy-01', `Consent timestamp handling found in ${this.relativePath(file)}`));
          break;
        }
      }

      if (!foundInCode) {
        results.push(
          this.fail(
            'privacy-01',
            'HIGH',
            'No consent timestamp fields found',
            'Neither the Prisma schema nor the codebase contains consent timestamp fields (consentDate, consentAt, grantedAt, termsAcceptedAt).',
            {
              recommendation: 'Add a consentAt DateTime field to the User model and record the exact timestamp when users accept terms/privacy policy. Required by PIPEDA, GDPR, and Quebec Law 25.',
            }
          )
        );
      }
    }

    return results;
  }

  /**
   * privacy-02: Data export endpoint or functionality must exist
   */
  private checkDataExport(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiRoutes = this.findApiRoutes();
    const libFiles = this.findLibFiles();
    const allFiles = [...apiRoutes, ...libFiles];

    let foundExport = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const rel = this.relativePath(file).toLowerCase();

      // Check route paths for data export
      const isExportRoute = rel.includes('export') && (rel.includes('user') || rel.includes('account') || rel.includes('data') || rel.includes('privacy'));

      // Check content for data export logic
      const hasExportLogic =
        /exportUserData|exportPersonalData|dataExport|downloadMyData|portability/i.test(content) ||
        /GDPR.*export|export.*GDPR|right.*access|subject.*access/i.test(content);

      if (isExportRoute || hasExportLogic) {
        foundExport = true;
        results.push(this.pass('privacy-02', `Data export functionality found in ${this.relativePath(file)}`));
        break;
      }
    }

    if (!foundExport) {
      results.push(
        this.fail(
          'privacy-02',
          'HIGH',
          'No user data export functionality found',
          'No API route or function found for exporting a user\'s personal data (right of access / data portability).',
          { recommendation: 'Implement a /api/account/export-data endpoint that collects all personal data (profile, orders, addresses, preferences) and returns it as JSON or CSV. Required by GDPR Article 15/20 and PIPEDA.' }
        )
      );
    }

    return results;
  }

  /**
   * privacy-03: Data deletion endpoint or functionality must exist
   */
  private checkDataDeletion(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const apiRoutes = this.findApiRoutes();
    const libFiles = this.findLibFiles();
    const allFiles = [...apiRoutes, ...libFiles];

    let foundDeletion = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const rel = this.relativePath(file).toLowerCase();

      // Check for data deletion routes or functionality
      const isDeletionRoute = (rel.includes('delete') || rel.includes('erase') || rel.includes('remove')) &&
        (rel.includes('user') || rel.includes('account') || rel.includes('data') || rel.includes('privacy'));

      const hasDeletionLogic =
        /deleteUserData|erasePersonalData|rightToErasure|deleteAccount|anonymize|pseudonymize|gdpr.*delete|delete.*gdpr/i.test(content) ||
        /forgetMe|rightToForget|dataErasure|removePersonalData/i.test(content);

      if (isDeletionRoute || hasDeletionLogic) {
        foundDeletion = true;
        results.push(this.pass('privacy-03', `Data deletion functionality found in ${this.relativePath(file)}`));
        break;
      }
    }

    if (!foundDeletion) {
      results.push(
        this.fail(
          'privacy-03',
          'HIGH',
          'No user data deletion functionality found',
          'No API route or function found for deleting/anonymizing a user\'s personal data (right to erasure).',
          { recommendation: 'Implement a /api/account/delete-data endpoint that anonymizes or deletes personal data while preserving required financial records. Required by GDPR Article 17 and PIPEDA.' }
        )
      );
    }

    return results;
  }

  /**
   * privacy-04: Cookie consent component or implementation must exist
   */
  private checkCookieConsent(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const components = this.findComponents();
    const allFiles = [
      ...components,
      ...this.findPages(),
      ...this.findLibFiles(),
    ];

    let foundCookieConsent = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const rel = this.relativePath(file).toLowerCase();

      // Check file names and content for cookie consent
      const isCookieFile = rel.includes('cookie') && (rel.includes('consent') || rel.includes('banner') || rel.includes('notice'));

      const hasCookieConsentLogic =
        /CookieConsent|CookieBanner|cookieConsent|cookie.*consent|consent.*cookie/i.test(content) ||
        /acceptCookies|rejectCookies|cookiePreferences|cookiePolicy/i.test(content) ||
        /import.*cookie.*consent|react-cookie-consent|@cookieyes/i.test(content);

      if (isCookieFile || hasCookieConsentLogic) {
        foundCookieConsent = true;
        results.push(this.pass('privacy-04', `Cookie consent implementation found in ${this.relativePath(file)}`));
        break;
      }
    }

    if (!foundCookieConsent) {
      results.push(
        this.fail(
          'privacy-04',
          'HIGH',
          'No cookie consent component or implementation found',
          'No cookie consent banner, component, or logic found in the codebase.',
          { recommendation: 'Add a cookie consent banner that appears on first visit, allows users to accept/reject non-essential cookies, and persists the choice. Required by Quebec Law 25 and ePrivacy regulations.' }
        )
      );
    }

    return results;
  }

  /**
   * privacy-05: Privacy policy must have versioning
   */
  private checkPrivacyPolicyVersioning(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    // Check Prisma schema for privacy policy versioning
    const schemaPath = path.join(this.rootDir, 'prisma', 'schema.prisma');
    const schemaContent = this.readFile(schemaPath);

    let foundVersioning = false;

    if (schemaContent) {
      if (/policyVersion|privacyVersion|termsVersion|PolicyVersion/i.test(schemaContent)) {
        foundVersioning = true;
        results.push(this.pass('privacy-05', 'Privacy policy versioning field found in Prisma schema'));
      }
    }

    // Check code files
    if (!foundVersioning) {
      const allFiles = [
        ...this.findApiRoutes(),
        ...this.findLibFiles(),
        ...this.findComponents(),
      ];

      for (const file of allFiles) {
        const content = this.readFile(file);
        if (!content) continue;

        if (/policyVersion|privacyPolicyVersion|termsVersion|policy.*version|version.*policy/i.test(content)) {
          foundVersioning = true;
          results.push(this.pass('privacy-05', `Privacy policy versioning found in ${this.relativePath(file)}`));
          break;
        }
      }
    }

    if (!foundVersioning) {
      results.push(
        this.fail(
          'privacy-05',
          'MEDIUM',
          'No privacy policy versioning found',
          'No version tracking for privacy policy or terms of service detected in schema or code.',
          { recommendation: 'Track which version of the privacy policy each user accepted. Add policyVersion to User model and increment when policy changes, prompting re-acceptance.' }
        )
      );
    }

    return results;
  }

  /**
   * privacy-06: Data retention policy configuration must exist
   */
  private checkDataRetentionPolicy(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
    ];

    let foundRetention = false;

    // Check for retention configuration or cleanup logic
    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const hasRetention =
        /retention|retentionPeriod|retentionPolicy|dataRetention/i.test(content) ||
        /purge.*old|cleanup.*expired|delete.*expired|archive.*old/i.test(content) ||
        /RETENTION_DAYS|RETENTION_PERIOD|MAX_AGE/i.test(content);

      if (hasRetention) {
        foundRetention = true;
        results.push(this.pass('privacy-06', `Data retention policy/logic found in ${this.relativePath(file)}`));
        break;
      }
    }

    // Also check for scheduled cleanup in cron/jobs
    if (!foundRetention) {
      const cronFiles = this.findFiles(this.srcDir, /cron|job|schedule|cleanup/i);
      for (const file of cronFiles) {
        const content = this.readFile(file);
        if (!content) continue;

        if (/retention|purge|cleanup|expire|archive/i.test(content)) {
          foundRetention = true;
          results.push(this.pass('privacy-06', `Data retention cleanup found in ${this.relativePath(file)}`));
          break;
        }
      }
    }

    if (!foundRetention) {
      results.push(
        this.fail(
          'privacy-06',
          'MEDIUM',
          'No data retention policy configuration found',
          'No data retention period, purge schedule, or archival logic found.',
          { recommendation: 'Define data retention periods (e.g., inactive accounts after 3 years, logs after 90 days) and implement automated cleanup. Required by PIPEDA principle 5 and GDPR Article 5(1)(e).' }
        )
      );
    }

    return results;
  }
}
