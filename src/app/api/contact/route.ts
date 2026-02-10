/**
 * API Contact - BioCycle Peptides
 * Reçoit et traite les messages du formulaire de contact
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/email-service';
import { escapeHtml } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const { name, email, company, phone, subject, message } = await request.json();

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Tous les champs obligatoires doivent être remplis' },
        { status: 400 }
      );
    }

    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Adresse courriel invalide' },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { error: 'Erreur lors de l\'envoi du message. Veuillez réessayer.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Votre message a été envoyé avec succès. Nous vous répondrons sous 24h.',
    });

  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue lors de l\'envoi du message' },
      { status: 500 }
    );
  }
}
