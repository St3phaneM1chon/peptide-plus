export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/email-service';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  name: z.string().max(200).optional(),
  preferences: z.array(z.string().max(50)).max(20).optional(),
  consentMethod: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // FLAW-FIX: Rate limit newsletter signup - 5 per IP per hour (prevents spam/abuse)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/newsletter');
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();

    // Validate with Zod
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { email: rawEmail, name: rawName, preferences, consentMethod: rawConsentMethod } = parsed.data;

    // Sanitize string fields going to DB
    const email = stripControlChars(stripHtml(rawEmail));
    const name = rawName ? stripControlChars(stripHtml(rawName)) : undefined;
    const consentMethod = rawConsentMethod ? stripControlChars(stripHtml(rawConsentMethod)) : undefined;

    // Check if already subscribed
    const existing = await prisma.mailingListSubscriber.findUnique({ where: { email: email.toLowerCase() } });
    if (existing?.status === 'ACTIVE') {
      return NextResponse.json({ message: 'Already subscribed' });
    }

    // IP already extracted above for rate limiting; reuse for CASL compliance

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
            <strong>Votre consentement :</strong> Enregistr\u00e9 le ${consentDateStr}.<br/>
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
    logger.error('Mailing list subscribe error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
