/**
 * EMAIL-CASL Auditor
 * Checks email sending for CASL/CAN-SPAM compliance: unsubscribe links,
 * consent verification, transactional vs marketing separation, and sender identity.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class EmailCaslAuditor extends BaseAuditor {
  auditTypeCode = 'EMAIL-CASL';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    const emailFiles = this.findEmailFiles();

    results.push(...this.checkUnsubscribeLink(emailFiles));
    results.push(...this.checkConsentVerification(emailFiles));
    results.push(...this.checkEmailSeparation(emailFiles));
    results.push(...this.checkSenderIdentity(emailFiles));

    return results;
  }

  /** Find email-related files (templates, sending logic) */
  private findEmailFiles(): string[] {
    const emailFiles: string[] = [];

    // Search common email locations
    const searchDirs = [
      `${this.srcDir}/lib/email`,
      `${this.srcDir}/lib/mail`,
      `${this.srcDir}/lib/mailer`,
      `${this.srcDir}/emails`,
      `${this.srcDir}/templates/email`,
      `${this.srcDir}/components/email`,
      `${this.srcDir}/components/emails`,
      `${this.rootDir}/emails`,
      `${this.rootDir}/email-templates`,
    ];

    for (const dir of searchDirs) {
      emailFiles.push(...this.findFiles(dir, /\.(ts|tsx|js|jsx|html)$/));
    }

    // Find API routes and lib files that send emails
    const apiFiles = this.findApiRoutes();
    const libFiles = this.findLibFiles();
    const allFiles = [...apiFiles, ...libFiles];

    for (const file of allFiles) {
      if (emailFiles.includes(file)) continue;

      const content = this.readFile(file);
      if (!content) continue;

      const emailPatterns = [
        /sendEmail/i,
        /sendMail/i,
        /nodemailer/i,
        /resend/i,
        /sendgrid/i,
        /postmark/i,
        /mailgun/i,
        /ses\.send/i,
        /transporter\.send/i,
        /@react-email/i,
        /email.*send/i,
        /mail.*send/i,
      ];

      if (emailPatterns.some((p) => p.test(content))) {
        emailFiles.push(file);
      }
    }

    return emailFiles;
  }

  /**
   * casl-01: Check email templates/sending for unsubscribe link
   */
  private checkUnsubscribeLink(emailFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (emailFiles.length === 0) {
      results.push(
        this.fail('casl-01', 'INFO', 'No email sending code found', 'No email templates or sending logic detected. Cannot verify CASL compliance.', {
          recommendation:
            'When implementing email sending, ensure all marketing emails include an unsubscribe link as required by CASL, CAN-SPAM, and GDPR.',
        })
      );
      return results;
    }

    let hasUnsubscribe = false;
    let marketingEmailFound = false;

    for (const file of emailFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check if this is a marketing email (not purely transactional)
      const marketingPatterns = [
        /newsletter/i,
        /marketing/i,
        /promo/i,
        /campaign/i,
        /bulletin/i,
        /announcement/i,
        /digest/i,
      ];

      const isMarketing = marketingPatterns.some((p) => p.test(content));
      if (isMarketing) marketingEmailFound = true;

      // Check for unsubscribe patterns
      const unsubscribePatterns = [
        /unsubscribe/i,
        /opt.out/i,
        /desabonner/i,           // French: se desabonner
        /desinscription/i,       // French: desinscription
        /List-Unsubscribe/i,     // Email header
        /manage.*preferences/i,
        /email.*preferences/i,
      ];

      if (unsubscribePatterns.some((p) => p.test(content))) {
        hasUnsubscribe = true;
      }
    }

    if (marketingEmailFound && !hasUnsubscribe) {
      results.push(
        this.fail('casl-01', 'CRITICAL', 'Marketing emails missing unsubscribe link', 'Marketing email templates/logic detected but no unsubscribe mechanism found. This violates CASL (Canada), CAN-SPAM (USA), and GDPR (EU) regulations.', {
          recommendation:
            'Add an unsubscribe link to all marketing emails. Include a List-Unsubscribe header. Implement an /api/unsubscribe endpoint and an unsubscribe landing page.',
        })
      );
    } else if (!hasUnsubscribe && emailFiles.length > 0) {
      results.push(
        this.fail('casl-01', 'MEDIUM', 'No unsubscribe mechanism found in emails', 'Email sending code exists but no unsubscribe links or headers were found. Even if only transactional emails are sent now, plan for marketing emails.', {
          recommendation:
            'Implement an unsubscribe mechanism proactively. Add List-Unsubscribe headers and include unsubscribe links in email templates.',
        })
      );
    } else if (hasUnsubscribe) {
      results.push(this.pass('casl-01', 'Unsubscribe mechanism found in emails'));
    }

    return results;
  }

  /**
   * casl-02: Check for consent verification before marketing sends
   */
  private checkConsentVerification(emailFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (emailFiles.length === 0) {
      results.push(this.pass('casl-02', 'No email code to check for consent'));
      return results;
    }

    let hasConsentCheck = false;

    for (const file of emailFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const consentPatterns = [
        /consent/i,
        /optedIn/i,
        /opted_in/i,
        /subscribed/i,
        /isSubscribed/i,
        /emailConsent/i,
        /marketingConsent/i,
        /emailOptIn/i,
        /hasConsent/i,
        /checkConsent/i,
        /verifyConsent/i,
        /acceptsMarketing/i,
      ];

      if (consentPatterns.some((p) => p.test(content))) {
        hasConsentCheck = true;
      }
    }

    // Also check schema for consent fields
    const schema = this.readFile(`${this.rootDir}/prisma/schema.prisma`);
    const schemaConsentPatterns = [
      /emailConsent/i,
      /marketingConsent/i,
      /optedIn/i,
      /newsletter.*Boolean/i,
      /acceptsMarketing/i,
    ];
    const hasConsentField = schemaConsentPatterns.some((p) => p.test(schema));

    if (!hasConsentCheck && !hasConsentField) {
      results.push(
        this.fail('casl-02', 'HIGH', 'No consent verification for email sending', 'No consent checking logic or consent fields found. CASL requires express or implied consent before sending commercial emails. GDPR requires explicit opt-in.', {
          recommendation:
            'Add a consent field to the User model (e.g., `marketingConsent Boolean @default(false)`). Check consent before sending any marketing emails. Record consent timestamp and source.',
        })
      );
    } else if (hasConsentCheck || hasConsentField) {
      results.push(
        this.pass('casl-02', 'Email consent mechanism detected')
      );
    }

    return results;
  }

  /**
   * casl-03: Check transactional vs marketing email separation
   */
  private checkEmailSeparation(emailFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (emailFiles.length === 0) {
      results.push(this.pass('casl-03', 'No email code to check'));
      return results;
    }

    // Look for separate handling of transactional vs marketing emails
    let hasTransactional = false;
    let hasMarketing = false;
    let hasSeparation = false;

    for (const file of emailFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const transactionalPatterns = [
        /transactional/i,
        /order.*confirm/i,
        /password.*reset/i,
        /verification/i,
        /receipt/i,
        /invoice/i,
        /shipping.*confirm/i,
      ];

      const marketingPatterns = [
        /marketing/i,
        /newsletter/i,
        /promo/i,
        /campaign/i,
        /bulk/i,
        /mass.*email/i,
      ];

      if (transactionalPatterns.some((p) => p.test(content))) hasTransactional = true;
      if (marketingPatterns.some((p) => p.test(content))) hasMarketing = true;

      // Check for explicit separation patterns
      const separationPatterns = [
        /emailType|email_type/i,
        /isTransactional/i,
        /isMarketing/i,
        /enum.*EmailType/i,
        /TRANSACTIONAL|MARKETING/,
      ];

      if (separationPatterns.some((p) => p.test(content))) {
        hasSeparation = true;
      }
    }

    if (hasTransactional && hasMarketing && !hasSeparation) {
      results.push(
        this.fail('casl-03', 'MEDIUM', 'No clear transactional/marketing email separation', 'Both transactional and marketing email patterns found, but no explicit separation mechanism. Transactional emails (order confirmations, password resets) must not include marketing content under CASL/CAN-SPAM.', {
          recommendation:
            'Create separate email sending functions or services for transactional and marketing emails. Use an EmailType enum to classify emails. Ensure transactional emails do not include promotional content.',
        })
      );
    } else if (hasSeparation) {
      results.push(
        this.pass('casl-03', 'Transactional and marketing email separation detected')
      );
    } else {
      results.push(
        this.pass('casl-03', 'Single email type detected (no separation needed)')
      );
    }

    return results;
  }

  /**
   * casl-04: Check sender identity configuration (from field)
   */
  private checkSenderIdentity(emailFiles: string[]): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];

    if (emailFiles.length === 0) {
      results.push(this.pass('casl-04', 'No email code to check'));
      return results;
    }

    let hasSenderConfig = false;
    let hasValidSender = false;

    for (const file of emailFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check for from/sender configuration
      const senderPatterns = [
        /from\s*:/i,
        /sender\s*:/i,
        /FROM_EMAIL/i,
        /SENDER_EMAIL/i,
        /EMAIL_FROM/i,
        /replyTo/i,
        /reply.to/i,
      ];

      if (senderPatterns.some((p) => p.test(content))) {
        hasSenderConfig = true;

        // Check for proper sender identity (not generic noreply without domain)
        const validSenderPatterns = [
          /from.*@/i,
          /FROM_EMAIL/i,
          /process\.env\.\w*FROM/i,
          /process\.env\.\w*SENDER/i,
          /process\.env\.\w*EMAIL/i,
        ];

        if (validSenderPatterns.some((p) => p.test(content))) {
          hasValidSender = true;
        }
      }
    }

    // Also check env files for email sender config
    const envFile = this.readFile(`${this.rootDir}/.env`);
    const envExampleFile = this.readFile(`${this.rootDir}/.env.example`);
    const envContent = envFile + envExampleFile;

    if (/EMAIL_FROM|SENDER_EMAIL|FROM_EMAIL|RESEND_FROM/i.test(envContent)) {
      hasSenderConfig = true;
      hasValidSender = true;
    }

    if (!hasSenderConfig) {
      results.push(
        this.fail('casl-04', 'MEDIUM', 'No sender identity configuration', 'No email sender (from) configuration found. CASL and CAN-SPAM require clear sender identification with valid physical address.', {
          recommendation:
            'Configure a FROM_EMAIL environment variable with a proper sender address. Include the company name and physical address in email footers as required by CAN-SPAM/CASL.',
        })
      );
    } else if (!hasValidSender) {
      results.push(
        this.fail('casl-04', 'LOW', 'Sender identity may be incomplete', 'Sender configuration exists but may not include proper business identification. CASL requires the sender to be clearly identifiable.', {
          recommendation:
            'Ensure the from address uses your business domain. Include the legal business name, physical address, and contact information in email footers.',
        })
      );
    } else {
      results.push(
        this.pass('casl-04', 'Email sender identity configured')
      );
    }

    return results;
  }
}
