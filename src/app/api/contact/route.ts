export const dynamic = 'force-dynamic';

/**
 * API Contact - BioCycle Peptides
 * Reçoit et traite les messages du formulaire de contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/email-service';
import { escapeHtml } from '@/lib/security';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { apiSuccess, apiError, validateContentType } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { contactFormSchema } from '@/lib/validations/contact';

// Status codes: 200 OK, 400 Bad Request, 415 Unsupported Media Type, 429 Rate Limited, 500 Internal Error
export async function POST(request: NextRequest) {
  try {
    // Item 12: Content-Type validation
    const ctError = validateContentType(request);
    if (ctError) return ctError;

    // BE-SEC-01: Rate limit contact form - 3 per IP per hour
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/contact');
    if (!rl.success) {
      return apiError(rl.error!.message, ErrorCode.RATE_LIMITED, { status: 429, request, headers: rl.headers });
    }

    const rawBody = await request.json();

    // Item 17: Validate with new Zod schema (includes sanitization transforms)
    const validation = contactFormSchema.safeParse(rawBody);
    if (!validation.success) {
      return apiError(
        validation.error.errors[0].message,
        ErrorCode.VALIDATION_ERROR,
        { details: validation.error.errors.map(e => ({ path: e.path.join('.'), message: e.message })), request }
      );
    }

    // BE-SEC-03: Sanitize all text fields - strip HTML and control characters
    // Note: contactFormSchema already applies sanitizedString transform; extra defense in depth
    const name = stripControlChars(stripHtml(String(validation.data.name))).trim();
    const email = String(validation.data.email).toLowerCase().trim();
    const company = validation.data.company ? stripControlChars(stripHtml(String(validation.data.company))).trim() : null;
    const phone = validation.data.phone ? stripControlChars(String(validation.data.phone)).trim() : null;
    const subject = stripControlChars(stripHtml(String(validation.data.subject))).trim();
    const message = stripControlChars(stripHtml(String(validation.data.message))).trim();

    const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@biocyclepeptides.com';

    // Envoyer le message par email au support
    const result = await sendEmail({
      to: { email: supportEmail, name: 'BioCycle Support' },
      subject: `[Contact] ${subject} - ${name}`,
      replyTo: email,
      html: `
        <h2>Nouveau message de contact</h2>
        <table style="border-collapse:collapse;width:100%;max-width:600px;">
          <tr><td style="padding:8px;font-weight:bold;">Nom:</td><td style="padding:8px;">${escapeHtml(name)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Email:</td><td style="padding:8px;">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Institution:</td><td style="padding:8px;">${escapeHtml(company || 'N/A')}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Téléphone:</td><td style="padding:8px;">${escapeHtml(phone || 'N/A')}</td></tr>
          <tr><td style="padding:8px;font-weight:bold;">Sujet:</td><td style="padding:8px;">${escapeHtml(subject)}</td></tr>
        </table>
        <h3>Message:</h3>
        <div style="padding:16px;background:#f5f5f5;border-radius:8px;white-space:pre-wrap;">${escapeHtml(message)}</div>
      `,
      tags: ['contact-form'],
    });

    if (!result.success) {
      console.error('Contact email failed:', result.error);
      return apiError('Erreur lors de l\'envoi du message. Veuillez réessayer.', ErrorCode.INTERNAL_ERROR, { request });
    }

    return apiSuccess({
      message: 'Votre message a été envoyé avec succès. Nous vous répondrons sous 24h.',
    }, { request });

  } catch (error) {
    console.error('Contact form error:', error);
    return apiError('Une erreur est survenue lors de l\'envoi du message', ErrorCode.INTERNAL_ERROR, { request });
  }
}
