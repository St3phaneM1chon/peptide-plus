export const dynamic = 'force-dynamic';

/**
 * API Newsletter - BioCycle Peptides
 * Gère les inscriptions à la newsletter
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { z } from 'zod';
import crypto from 'crypto';

// API-003: Zod schema for newsletter subscription
const newsletterSubscribeSchema = z.object({
  email: z.string().email('Email invalide').max(254).transform(v => v.toLowerCase().trim()),
  source: z.string().max(50).default('footer'),
  locale: z.string().max(10).default('fr'),
}).strict();

export async function POST(request: NextRequest) {
  try {
    // BE-SEC-01: Rate limit newsletter subscribe - 5 per IP per hour
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

    const rawBody = await request.json();

    // API-003: Validate input with Zod schema
    const validation = newsletterSubscribeSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    // RGPD Art. 5(1)(c) - Data minimization: birthDate is NOT collected here.
    // Birthday offers are only available for authenticated users who provide
    // their birthDate voluntarily in their account profile settings.
    const { email, source, locale } = validation.data;

    // CASL compliance: Forward to double opt-in mailing list flow
    // Also save to legacy NewsletterSubscriber for backward compat
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
    }).catch(() => null);

    if (!existing) {
      await prisma.newsletterSubscriber.create({
        data: {
          id: crypto.randomUUID(),
          email: email.toLowerCase(),
          subscribedAt: new Date(),
          source: source || 'footer',
          locale: locale || 'fr',
        },
      });

      // RGPD Art. 6/7: Create ConsentRecord for provable consent trail
      await prisma.consentRecord.create({
        data: {
          email: email.toLowerCase(),
          type: 'newsletter',
          source: `website_${source || 'footer'}`,
          consentText: 'J\'accepte de recevoir la newsletter et les promotions de BioCycle Peptides.',
          grantedAt: new Date(),
          ipAddress: ip,
        },
      }).catch(() => {}); // Best-effort: don't fail subscribe if consent record fails
    }

    // Forward to CASL-compliant double opt-in endpoint
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://biocyclepeptides.com';
    try {
      await fetch(`${baseUrl}/api/mailing-list/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ip,
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          consentMethod: source || 'footer',
          preferences: ['promotions', 'promo_codes', 'specials', 'new_products'],
        }),
      });
    } catch (fwdError) {
      console.error('Forward to mailing-list/subscribe failed:', fwdError);
    }

    // Log pour suivi (email masked for privacy)
    const [localPart, domain] = email.split('@');
    const maskedEmail = localPart.slice(0, 2) + '***@' + domain;
    console.log(JSON.stringify({
      event: 'newsletter_subscription_with_double_optin',
      timestamp: new Date().toISOString(),
      email: maskedEmail,
    }));

    return NextResponse.json({
      success: true,
      message: 'A confirmation email has been sent. Please check your inbox.',
    }, { status: 201 });

  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}

// SEC-23: Always return generic response to prevent subscription status enumeration
export async function GET() {
  return NextResponse.json({
    message: 'If this email is subscribed, you will continue to receive emails',
  });
}
