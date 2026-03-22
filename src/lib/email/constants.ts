/**
 * Centralized email address constants — Multi-Tenant Koraline
 *
 * All company email addresses used in backend code should reference these
 * constants instead of hardcoding strings. In multi-tenant mode, the tenant
 * name and email addresses come from the tenant config in DB.
 * These constants serve as fallbacks for the platform (Attitudes VIP).
 *
 * Frontend/i18n files may still reference addresses in locale JSON;
 * those are content-level and managed via translations.
 */

export const EMAIL_ADDRESSES = {
  /** Default sender for transactional emails */
  noreply: process.env.SMTP_FROM || 'noreply@biocyclepeptides.com',
  /** Customer support */
  support: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@biocyclepeptides.com',
  /** Privacy / RGPD inquiries */
  privacy: process.env.PRIVACY_EMAIL || 'privacy@biocyclepeptides.com',
  /** Legal department */
  legal: process.env.LEGAL_EMAIL || 'legal@biocyclepeptides.com',
  /** General info */
  info: process.env.INFO_EMAIL || 'info@biocyclepeptides.com',
  /** Admin alerts */
  admin: process.env.ADMIN_EMAIL || 'admin@biocyclepeptides.com',
  /** Billing */
  billing: process.env.BILLING_EMAIL || 'billing@biocyclepeptides.com',
  /** List-Unsubscribe mailto */
  unsubscribe: process.env.UNSUBSCRIBE_EMAIL || 'unsubscribe@biocyclepeptides.com',
} as const;

/** Company name used in email sender fields — reads from env or defaults to platform name */
export const EMAIL_SENDER_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';
