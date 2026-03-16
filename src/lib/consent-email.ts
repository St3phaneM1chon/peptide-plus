/**
 * Consent System - Email Templates & Sending Functions
 *
 * Provides branded transactional emails for the consent workflow:
 *   1. sendConsentRequestEmail    - Ask a client to fill out a consent form
 *   2. sendConsentConfirmationEmail - Confirm that a client's consent was recorded
 *   3. sendConsentAdminNotification - Notify admin when consent is granted/revoked
 *
 * i18n: All client-facing emails support fr/en. Default locale is 'fr' (Quebec).
 * Admin notifications remain in the admin's preferred language (default fr).
 */

import { sendEmail, EmailResult } from '@/lib/email/email-service';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Shared constants & helpers
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NEXTAUTH_URL || 'https://biocyclepeptides.com';
const BRAND_COLOR = '#EA580C'; // Orange accent
const COMPANY_NAME = 'BioCycle Peptides';

type SupportedLocale = 'fr' | 'en';

/** Resolve locale to fr or en (default fr for Quebec business) */
function resolveLocale(locale?: string): SupportedLocale {
  if (locale && locale.startsWith('en')) return 'en';
  return 'fr';
}

// ---------------------------------------------------------------------------
// Translation strings
// ---------------------------------------------------------------------------

const translations: Record<SupportedLocale, Record<string, string>> = {
  fr: {
    // Layout
    tagline: 'Peptides de Qualité Recherche',
    footerTransactional: 'Ceci est un courriel transactionnel lié à votre demande de consentement.',
    footerRights: 'Tous droits réservés.',

    // Consent Request
    greeting: 'Bonjour',
    requestIntro: 'Nous vous contactons afin de solliciter votre consentement dans le cadre de notre collaboration avec',
    requestAction: 'Veuillez consulter et compléter le formulaire de consentement en cliquant sur le bouton ci-dessous.',
    videoRelated: 'Ce consentement concerne la vidéo :',
    consentType: 'Type de consentement :',
    requestedBy: 'Demandé par :',
    completeForm: 'Compléter le formulaire',
    buttonFallback: 'Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :',
    ignoreNotice: 'Si vous n\'attendiez pas ce courriel, vous pouvez l\'ignorer en toute sécurité.',
    subjectRequest: 'Demande de consentement',

    // Consent Confirmation
    thankYou: 'Merci d\'avoir complété le formulaire de consentement. Votre consentement a été enregistré avec succès.',
    video: 'Vidéo :',
    pdfAttached: 'Une copie de votre formulaire de consentement signé est jointe à ce courriel en format PDF pour vos dossiers.',
    revokeNotice: 'Si vous avez des questions ou souhaitez révoquer votre consentement à tout moment, veuillez nous contacter à',
    automatedConfirmation: 'Ceci est une confirmation automatique. Aucune autre action n\'est requise de votre part.',
    subjectConfirmed: 'Consentement confirmé',

    // Admin Notification
    consentAction: 'Un consentement a été',
    granted: 'accordé',
    revoked: 'révoqué',
    grantedLabel: 'Accordé',
    revokedLabel: 'Révoqué',
    client: 'Client',
    action: 'Action',
    consentId: 'ID consentement',
    viewConsents: 'Voir les consentements',
    automatedNotification: 'Ceci est une notification automatique du système de consentement',
    subjectGranted: 'Consentement accordé',
    subjectRevoked: 'Consentement révoqué',
  },
  en: {
    // Layout
    tagline: 'Research-Grade Peptides',
    footerTransactional: 'This is a transactional email related to your consent request.',
    footerRights: 'All rights reserved.',

    // Consent Request
    greeting: 'Hello',
    requestIntro: 'We are reaching out to request your consent as part of our collaboration with',
    requestAction: 'Please review and complete the consent form by clicking the button below.',
    videoRelated: 'This consent is related to the video:',
    consentType: 'Consent type:',
    requestedBy: 'Requested by:',
    completeForm: 'Complete Consent Form',
    buttonFallback: 'If the button does not work, copy and paste this link into your browser:',
    ignoreNotice: 'If you did not expect this email, you can safely ignore it.',
    subjectRequest: 'Consent Request',

    // Consent Confirmation
    thankYou: 'Thank you for completing the consent form. Your consent has been recorded successfully.',
    video: 'Video:',
    pdfAttached: 'A copy of your signed consent form is attached to this email as a PDF for your records.',
    revokeNotice: 'If you have any questions or wish to revoke your consent at any time, please contact us at',
    automatedConfirmation: 'This is an automated confirmation. No further action is required on your part.',
    subjectConfirmed: 'Consent Confirmed',

    // Admin Notification
    consentAction: 'A consent has been',
    granted: 'granted',
    revoked: 'revoked',
    grantedLabel: 'Granted',
    revokedLabel: 'Revoked',
    client: 'Client',
    action: 'Action',
    consentId: 'Consent ID',
    viewConsents: 'View Consents',
    automatedNotification: 'This is an automated notification from the consent system of',
    subjectGranted: 'Consent Granted',
    subjectRevoked: 'Consent Revoked',
  },
};

/**
 * Wrap email body content in the shared branded HTML shell.
 * Uses table-based layout for maximum email client compatibility.
 */
function wrapInLayout(bodyHtml: string, locale: SupportedLocale = 'fr'): string {
  const t = translations[locale];
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${COMPANY_NAME}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden;">
          <!-- Header bar -->
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:24px 32px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                ${COMPANY_NAME}
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.6;">
                ${COMPANY_NAME} &mdash; ${t.tagline}<br />
                ${t.footerTransactional}<br />
                &copy; ${new Date().getFullYear()} ${COMPANY_NAME}. ${t.footerRights}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// 1. Consent Request Email
// ---------------------------------------------------------------------------

export interface ConsentRequestEmailData {
  clientName: string;
  clientEmail: string;
  consentToken: string;
  videoTitle?: string | null;
  templateName?: string | null;
  templateDescription?: string | null;
  requestedByName?: string | null;
  locale?: string;
}

/**
 * Send an email to a client asking them to fill out a consent form.
 */
export async function sendConsentRequestEmail(
  data: ConsentRequestEmailData,
): Promise<EmailResult> {
  try {
    const locale = resolveLocale(data.locale);
    const t = translations[locale];
    const consentUrl = `${BASE_URL}/consent/${data.consentToken}`;

    const videoLine = data.videoTitle
      ? `<p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${t.videoRelated} <strong>${escapeHtml(data.videoTitle)}</strong>.</p>`
      : '';

    const templateLine = data.templateName
      ? `<p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${t.consentType} <strong>${escapeHtml(data.templateName)}</strong>${data.templateDescription ? ` &mdash; ${escapeHtml(data.templateDescription)}` : ''}.</p>`
      : '';

    const requestedByLine = data.requestedByName
      ? `<p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${t.requestedBy} ${escapeHtml(data.requestedByName)}.</p>`
      : '';

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
        ${t.greeting} ${escapeHtml(data.clientName)},
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
        ${t.requestIntro} ${COMPANY_NAME}.
        ${t.requestAction}
      </p>
      ${videoLine}
      ${templateLine}
      ${requestedByLine}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
        <tr>
          <td align="center" style="background-color:${BRAND_COLOR};border-radius:6px;">
            <a href="${consentUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
              ${t.completeForm}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 8px;font-size:13px;color:#a1a1aa;line-height:1.5;">
        ${t.buttonFallback}
      </p>
      <p style="margin:0 0 16px;font-size:13px;color:#a1a1aa;line-height:1.5;word-break:break-all;">
        <a href="${consentUrl}" style="color:${BRAND_COLOR};">${consentUrl}</a>
      </p>
      <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">
        ${t.ignoreNotice}
      </p>
    `;

    const html = wrapInLayout(bodyHtml, locale);

    return await sendEmail({
      to: { email: data.clientEmail, name: data.clientName },
      subject: `${COMPANY_NAME} \u2014 ${t.subjectRequest}`,
      html,
      emailType: 'transactional',
      tags: ['consent', 'consent-request'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[ConsentEmail] Failed to send consent request email', {
      clientEmail: data.clientEmail,
      error: message,
    });
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 2. Consent Confirmation Email
// ---------------------------------------------------------------------------

export interface ConsentConfirmationEmailData {
  clientName: string;
  clientEmail: string;
  videoTitle?: string | null;
  templateName?: string | null;
  pdfBytes?: Uint8Array;
  locale?: string;
}

/**
 * Send a confirmation email to a client after they submit the consent form.
 * Optionally attaches the signed consent PDF.
 */
export async function sendConsentConfirmationEmail(
  data: ConsentConfirmationEmailData,
): Promise<EmailResult> {
  try {
    const locale = resolveLocale(data.locale);
    const t = translations[locale];

    const videoLine = data.videoTitle
      ? `<p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${t.video} <strong>${escapeHtml(data.videoTitle)}</strong></p>`
      : '';

    const templateLine = data.templateName
      ? `<p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${t.consentType} <strong>${escapeHtml(data.templateName)}</strong></p>`
      : '';

    const pdfNotice = data.pdfBytes
      ? `<p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">${t.pdfAttached}</p>`
      : '';

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
        ${t.greeting} ${escapeHtml(data.clientName)},
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
        ${t.thankYou}
      </p>
      ${videoLine}
      ${templateLine}
      ${pdfNotice}
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
        ${t.revokeNotice}
        <a href="mailto:support@biocyclepeptides.com" style="color:${BRAND_COLOR};text-decoration:none;">support@biocyclepeptides.com</a>.
      </p>
      <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">
        ${t.automatedConfirmation}
      </p>
    `;

    const html = wrapInLayout(bodyHtml, locale);

    // Build attachments array
    const pdfFilename = locale === 'fr' ? 'formulaire-consentement.pdf' : 'consent-form.pdf';
    const attachments = data.pdfBytes
      ? [
          {
            filename: pdfFilename,
            content: Buffer.from(data.pdfBytes).toString('base64'),
            contentType: 'application/pdf',
          },
        ]
      : undefined;

    return await sendEmail({
      to: { email: data.clientEmail, name: data.clientName },
      subject: `${COMPANY_NAME} \u2014 ${t.subjectConfirmed}`,
      html,
      attachments,
      emailType: 'transactional',
      tags: ['consent', 'consent-confirmation'],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[ConsentEmail] Failed to send consent confirmation email', {
      clientEmail: data.clientEmail,
      error: message,
    });
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// 3. Consent Admin Notification
// ---------------------------------------------------------------------------

export interface ConsentAdminNotificationData {
  adminEmail: string;
  clientName: string;
  clientEmail: string;
  action: 'granted' | 'revoked';
  videoTitle?: string | null;
  consentId: string;
  locale?: string;
}

/**
 * Notify an admin when a client grants or revokes consent.
 */
export async function sendConsentAdminNotification(
  data: ConsentAdminNotificationData,
): Promise<EmailResult> {
  try {
    const locale = resolveLocale(data.locale);
    const t = translations[locale];
    const actionLabel = data.action === 'granted' ? t.grantedLabel : t.revokedLabel;
    const actionWord = data.action === 'granted' ? t.granted : t.revoked;
    const actionColor = data.action === 'granted' ? '#16a34a' : '#dc2626';
    const consentsUrl = `${BASE_URL}/admin/media/consents`;

    const videoLine = data.videoTitle
      ? `<tr>
          <td style="padding:8px 12px;font-size:14px;color:#71717a;border-bottom:1px solid #f4f4f5;">Video</td>
          <td style="padding:8px 12px;font-size:14px;color:#3f3f46;border-bottom:1px solid #f4f4f5;">${escapeHtml(data.videoTitle)}</td>
        </tr>`
      : '';

    const subjectAction = data.action === 'granted' ? t.subjectGranted : t.subjectRevoked;

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:15px;color:#3f3f46;line-height:1.6;">
        ${t.consentAction} <strong style="color:${actionColor};">${actionWord}</strong>.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e4e4e7;border-radius:6px;overflow:hidden;">
        <tr>
          <td style="padding:8px 12px;font-size:14px;color:#71717a;border-bottom:1px solid #f4f4f5;width:120px;">${t.client}</td>
          <td style="padding:8px 12px;font-size:14px;color:#3f3f46;border-bottom:1px solid #f4f4f5;">${escapeHtml(data.clientName)} (${escapeHtml(data.clientEmail)})</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-size:14px;color:#71717a;border-bottom:1px solid #f4f4f5;">${t.action}</td>
          <td style="padding:8px 12px;font-size:14px;font-weight:600;color:${actionColor};border-bottom:1px solid #f4f4f5;">${actionLabel}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;font-size:14px;color:#71717a;border-bottom:1px solid #f4f4f5;">${t.consentId}</td>
          <td style="padding:8px 12px;font-size:14px;color:#3f3f46;border-bottom:1px solid #f4f4f5;font-family:monospace;">${escapeHtml(data.consentId)}</td>
        </tr>
        ${videoLine}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr>
          <td align="center" style="background-color:${BRAND_COLOR};border-radius:6px;">
            <a href="${consentsUrl}" target="_blank" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">
              ${t.viewConsents}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#a1a1aa;line-height:1.5;">
        ${t.automatedNotification} ${COMPANY_NAME}.
      </p>
    `;

    const html = wrapInLayout(bodyHtml, locale);

    return await sendEmail({
      to: { email: data.adminEmail },
      subject: `${subjectAction} \u2014 ${data.clientName}`,
      html,
      emailType: 'transactional',
      tags: ['consent', `consent-${data.action}`],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[ConsentEmail] Failed to send admin notification', {
      adminEmail: data.adminEmail,
      consentId: data.consentId,
      error: message,
    });
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// HTML escaping utility
// ---------------------------------------------------------------------------

/**
 * Escape HTML special characters to prevent XSS in email templates.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
