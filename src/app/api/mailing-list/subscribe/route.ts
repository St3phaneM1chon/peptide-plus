export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, preferences, consentMethod } = body;

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    // Check if already subscribed
    const existing = await prisma.mailingListSubscriber.findUnique({ where: { email: email.toLowerCase() } });
    if (existing?.status === 'ACTIVE') {
      return NextResponse.json({ message: 'Already subscribed' });
    }

    // Get IP for CASL compliance
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const confirmToken = crypto.randomBytes(32).toString('hex');
    const unsubscribeToken = crypto.randomBytes(32).toString('hex');

    const defaultPreferences = ['promotions', 'promo_codes', 'specials', 'new_products'];
    const selectedPrefs = preferences?.length ? preferences : defaultPreferences;

    if (existing) {
      // Re-subscribe: update existing record
      await prisma.mailingListSubscriber.update({
        where: { id: existing.id },
        data: {
          status: 'PENDING',
          confirmToken,
          unsubscribeToken,
          consentDate: new Date(),
          consentIp: ip,
          consentMethod: consentMethod || 'website_form',
          unsubscribedAt: null,
          confirmedAt: null,
        },
      });
    } else {
      await prisma.mailingListSubscriber.create({
        data: {
          email: email.toLowerCase(),
          name: name?.trim() || null,
          status: 'PENDING',
          consentType: 'EXPRESS',
          consentIp: ip,
          consentMethod: consentMethod || 'website_form',
          confirmToken,
          unsubscribeToken,
          preferences: {
            create: selectedPrefs.map((cat: string) => ({
              category: cat,
              isEnabled: true,
            })),
          },
        },
      });
    }

    // Send double opt-in confirmation email (CASL requirement)
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com';
    const confirmUrl = `${baseUrl}/api/mailing-list/confirm?token=${confirmToken}`;

    const unsubscribeUrl = `${baseUrl}/api/mailing-list/unsubscribe?token=${unsubscribeToken}`;
    const consentDateStr = new Date().toLocaleDateString('fr-CA');

    await sendEmail({
      to: { email: email.toLowerCase() },
      subject: 'Confirmez votre inscription - BioCycle Peptides',
      html: `
        <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
          <h2>Confirmez votre inscription</h2>
          <p>Merci de votre int\u00e9r\u00eat pour BioCycle Peptides !</p>
          <p>Pour confirmer votre inscription \u00e0 notre liste de diffusion et recevoir nos promotions, codes promo, sp\u00e9ciaux et nouveaux produits, veuillez cliquer sur le bouton ci-dessous :</p>
          <p style="text-align:center;margin:30px 0;">
            <a href="${confirmUrl}" style="background:#0284c7;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
              Confirmer mon inscription
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
          <p style="font-size:12px;color:#666;">
            <strong>Avis LCAP/CASL (Loi canadienne anti-pourriel) :</strong><br/>
            Ce courriel vous est envoy\u00e9 suite \u00e0 votre demande d'inscription sur biocyclepeptides.com.
            Si vous n'avez pas fait cette demande, ignorez simplement ce message.
          </p>
          <p style="font-size:12px;color:#666;">
            <strong>Votre consentement :</strong> Enregistr\u00e9 le ${consentDateStr} depuis l'adresse IP ${ip}.<br/>
            <strong>Droit de retrait :</strong> Vous pouvez retirer votre consentement \u00e0 tout moment en cliquant sur le lien de d\u00e9sabonnement pr\u00e9sent dans chaque courriel, ou en visitant : <a href="${unsubscribeUrl}">${unsubscribeUrl}</a><br/>
            <strong>Cat\u00e9gories :</strong> ${selectedPrefs.join(', ')}
          </p>
          <p style="font-size:12px;color:#666;">
            <strong>Exp\u00e9diteur :</strong> BioCycle Peptides Inc.<br/>
            Montr\u00e9al, Qu\u00e9bec, Canada<br/>
            Contact : support@biocyclepeptides.com
          </p>
        </div>
      `,
      text: `Confirmez votre inscription: ${confirmUrl}\n\nDroit de retrait: ${unsubscribeUrl}`,
      tags: ['mailing-list-confirm'],
      unsubscribeUrl,
    });

    return NextResponse.json({ success: true, message: 'Confirmation email sent. Please check your inbox.' });
  } catch (error) {
    console.error('Mailing list subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
