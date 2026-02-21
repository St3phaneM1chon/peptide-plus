export const dynamic = 'force-dynamic';

/**
 * API Newsletter - BioCycle Peptides
 * Gère les inscriptions à la newsletter
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { z } from 'zod';

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

    // Vérifier si l'email existe déjà
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
    }).catch(() => null);

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Vous êtes déjà inscrit à notre newsletter !',
        alreadySubscribed: true,
      });
    }

    // Créer l'inscription (no birthDate - data minimization principle)
    await prisma.newsletterSubscriber.create({
      data: {
        email: email.toLowerCase(),
        subscribedAt: new Date(),
        source: source || 'footer',
        locale: locale || 'fr',
      },
    });

    // Log pour suivi (email masked for privacy)
    const [localPart, domain] = email.split('@');
    const maskedEmail = localPart.slice(0, 2) + '***@' + domain;
    console.log(JSON.stringify({
      event: 'newsletter_subscription',
      timestamp: new Date().toISOString(),
      email: maskedEmail,
    }));

    return NextResponse.json({
      success: true,
      message: 'Merci ! Vous êtes maintenant inscrit à notre newsletter.',
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
