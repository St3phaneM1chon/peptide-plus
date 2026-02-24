/**
 * WEBAUTHN-MFA Auditor
 * Checks for MFA/WebAuthn implementation: enrollment UI/API,
 * recovery codes, WebAuthn registration, and fallback mechanisms.
 */

import BaseAuditor from './base-auditor';
import type { AuditCheckResult } from '@/lib/audit-engine';

export default class WebauthnMfaAuditor extends BaseAuditor {
  auditTypeCode = 'WEBAUTHN-MFA';

  async run(): Promise<AuditCheckResult[]> {
    const results: AuditCheckResult[] = [];

    results.push(...this.checkMfaEnrollment());
    results.push(...this.checkRecoveryCodes());
    results.push(...this.checkWebauthnRegistration());
    results.push(...this.checkMfaFallback());

    return results;
  }

  /** Gather all files that might contain MFA/WebAuthn logic */
  private findMfaFiles(): string[] {
    const allFiles = [
      ...this.findApiRoutes(),
      ...this.findLibFiles(),
      ...this.findComponents(),
      ...this.findPages(),
    ];
    return allFiles;
  }

  /**
   * mfa-01: Check for MFA enrollment UI/API
   */
  private checkMfaEnrollment(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = this.findMfaFiles();
    let hasMfaEnrollment = false;
    let hasMfaUI = false;
    let hasMfaAPI = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      // Check for MFA enrollment patterns in code
      const mfaApiPatterns = [
        /mfa/i,
        /twoFactor/i,
        /two.factor/i,
        /2fa/i,
        /totp/i,
        /authenticator/i,
        /otp.*enroll/i,
        /enroll.*otp/i,
        /setupMfa/i,
        /enableMfa/i,
        /enableTwoFactor/i,
      ];

      const isMfaRelated = mfaApiPatterns.some((p) => p.test(content));
      if (!isMfaRelated) continue;

      // Check if this is API code
      const isApiFile = /app\/api/.test(file) || /lib\//.test(file);
      if (isApiFile) hasMfaAPI = true;

      // Check if this is UI code
      const isUiFile = /components|pages|app.*page/.test(file);
      if (isUiFile) hasMfaUI = true;

      hasMfaEnrollment = true;
    }

    // Also check schema for MFA fields
    const schema = this.readFile(`${this.rootDir}/prisma/schema.prisma`);
    const hasMfaSchema =
      /mfaEnabled|twoFactorEnabled|totpSecret|mfaSecret|authenticatorSecret/i.test(
        schema
      );

    if (!hasMfaEnrollment && !hasMfaSchema) {
      results.push(
        this.fail('mfa-01', 'HIGH', 'No MFA enrollment implementation', 'No MFA (Multi-Factor Authentication) enrollment UI or API found. MFA is a critical security feature for protecting user accounts, especially for e-commerce with payment information.', {
          recommendation:
            'Implement MFA enrollment: 1) Add mfaEnabled/totpSecret fields to User model. 2) Create /api/auth/mfa/setup endpoint for TOTP secret generation. 3) Create MFA enrollment page in account settings. 4) Use a library like otplib for TOTP generation.',
        })
      );
    } else if (hasMfaSchema && !hasMfaAPI) {
      results.push(
        this.fail('mfa-01', 'MEDIUM', 'MFA schema exists but no API implementation', 'MFA-related fields found in the database schema but no corresponding API endpoints for enrollment.', {
          recommendation:
            'Implement the MFA enrollment API endpoints: /api/auth/mfa/setup (generate secret), /api/auth/mfa/verify (verify and enable), /api/auth/mfa/disable.',
        })
      );
    } else if (hasMfaAPI && !hasMfaUI) {
      results.push(
        this.fail('mfa-01', 'LOW', 'MFA API exists but no enrollment UI', 'MFA API endpoints exist but no user-facing enrollment interface was found.', {
          recommendation:
            'Create an MFA enrollment component in account settings with QR code display, verification input, and recovery codes display.',
        })
      );
    } else if (hasMfaEnrollment) {
      results.push(this.pass('mfa-01', 'MFA enrollment implementation found'));
    }

    return results;
  }

  /**
   * mfa-02: Check for recovery codes implementation
   */
  private checkRecoveryCodes(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = this.findMfaFiles();
    let hasRecoveryCodes = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const recoveryPatterns = [
        /recoveryCodes?/i,
        /recovery.codes?/i,
        /backupCodes?/i,
        /backup.codes?/i,
        /emergencyCode/i,
        /recoveryToken/i,
      ];

      if (recoveryPatterns.some((p) => p.test(content))) {
        hasRecoveryCodes = true;
        break;
      }
    }

    // Also check schema
    const schema = this.readFile(`${this.rootDir}/prisma/schema.prisma`);
    if (/recoveryCodes|backupCodes|RecoveryCode/i.test(schema)) {
      hasRecoveryCodes = true;
    }

    if (!hasRecoveryCodes) {
      // Only flag as issue if MFA exists
      const hasMfa = allFiles.some((f) => {
        const c = this.readFile(f);
        return c && /mfa|twoFactor|2fa|totp|authenticator/i.test(c);
      });

      if (hasMfa) {
        results.push(
          this.fail('mfa-02', 'HIGH', 'MFA exists but no recovery codes', 'MFA implementation found but no recovery code mechanism. Users who lose their MFA device will be permanently locked out of their accounts.', {
            recommendation:
              'Generate 8-10 one-time recovery codes during MFA enrollment. Store hashed recovery codes in the database. Allow users to download/print codes. Provide a recovery code login flow.',
          })
        );
      } else {
        results.push(
          this.fail('mfa-02', 'MEDIUM', 'No recovery codes implementation', 'No MFA recovery codes found. When MFA is implemented, recovery codes are essential for account recovery.', {
            recommendation:
              'Plan recovery codes as part of the MFA implementation. Generate unique one-time codes, store them hashed, and present them to users during enrollment.',
          })
        );
      }
    } else {
      results.push(this.pass('mfa-02', 'Recovery codes implementation found'));
    }

    return results;
  }

  /**
   * mfa-03: Check for WebAuthn registration endpoint
   */
  private checkWebauthnRegistration(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = this.findMfaFiles();
    let hasWebauthn = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const webauthnPatterns = [
        /webauthn/i,
        /WebAuthn/,
        /fido2?/i,
        /FIDO/,
        /passkey/i,
        /publicKeyCredential/i,
        /navigator\.credentials/,
        /attestation/i,
        /authenticatorAttachment/i,
        /@simplewebauthn/,
        /fido2-lib/i,
        /cbor/i,
      ];

      if (webauthnPatterns.some((p) => p.test(content))) {
        hasWebauthn = true;
        break;
      }
    }

    // Check package.json for WebAuthn dependencies
    const packageJson = this.readFile(`${this.rootDir}/package.json`);
    if (/@simplewebauthn|fido2-lib|@passwordless-id|webauthn/i.test(packageJson)) {
      hasWebauthn = true;
    }

    if (!hasWebauthn) {
      results.push(
        this.fail('mfa-03', 'LOW', 'No WebAuthn/Passkey implementation', 'No WebAuthn or passkey registration endpoints found. WebAuthn provides phishing-resistant authentication and is increasingly expected by users.', {
          recommendation:
            'Consider implementing WebAuthn/Passkeys using @simplewebauthn/server and @simplewebauthn/browser. Create registration and authentication endpoints. Store credentials in a dedicated model.',
        })
      );
    } else {
      results.push(this.pass('mfa-03', 'WebAuthn/Passkey implementation found'));
    }

    return results;
  }

  /**
   * mfa-04: Check for MFA fallback/recovery mechanism
   */
  private checkMfaFallback(): AuditCheckResult[] {
    const results: AuditCheckResult[] = [];
    const allFiles = this.findMfaFiles();
    let hasFallback = false;

    for (const file of allFiles) {
      const content = this.readFile(file);
      if (!content) continue;

      const fallbackPatterns = [
        /fallback/i,
        /recovery/i,
        /backup.*method/i,
        /alternative.*auth/i,
        /sms.*verify/i,
        /email.*verify.*mfa/i,
        /disable.*mfa.*admin/i,
        /mfa.*bypass/i,
        /support.*reset.*mfa/i,
        /recoverAccount/i,
      ];

      if (fallbackPatterns.some((p) => p.test(content))) {
        hasFallback = true;
        break;
      }
    }

    if (!hasFallback) {
      // Only critical if MFA exists
      const hasMfa = allFiles.some((f) => {
        const c = this.readFile(f);
        return c && /mfa|twoFactor|2fa|totp|authenticator/i.test(c);
      });

      if (hasMfa) {
        results.push(
          this.fail('mfa-04', 'HIGH', 'No MFA fallback/recovery mechanism', 'MFA is implemented but no fallback or recovery mechanism was found. Users who lose access to their MFA device need an alternative way to authenticate.', {
            recommendation:
              'Implement at least 2 fallback mechanisms: 1) Recovery codes (one-time use). 2) Admin-assisted MFA reset with identity verification. Consider also: email-based recovery, SMS backup, or support ticket workflow.',
          })
        );
      } else {
        results.push(
          this.fail('mfa-04', 'LOW', 'No MFA fallback mechanism planned', 'No MFA or fallback mechanisms found. When implementing MFA, plan for account recovery from the start.', {
            recommendation:
              'Design the MFA recovery flow alongside the MFA implementation: recovery codes, admin reset capability, and support escalation process.',
          })
        );
      }
    } else {
      results.push(this.pass('mfa-04', 'MFA fallback/recovery mechanism found'));
    }

    return results;
  }
}
