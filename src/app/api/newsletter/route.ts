export const dynamic = 'force-dynamic';

/**
 * API Newsletter - BioCycle Peptides
 * Gère les inscriptions à la newsletter
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

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

    // BE-SEC-05: Validate and enforce length limits
    const email = typeof rawBody.email === 'string' ? rawBody.email.trim().toLowerCase() : '';
    const source = typeof rawBody.source === 'string' ? rawBody.source.slice(0, 50) : 'footer';
    const locale = typeof rawBody.locale === 'string' ? rawBody.locale.slice(0, 10) : 'fr';
    const birthDate = rawBody.birthDate;

    if (!email || email.length > 254 || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Email invalide' },
        { status: 400 }
      );
    }

    // Parse and validate birthDate if provided
    let parsedBirthDate: Date | undefined;
    if (birthDate) {
      parsedBirthDate = new Date(birthDate);
      if (isNaN(parsedBirthDate.getTime())) {
        parsedBirthDate = undefined;
      }
    }

    // Vérifier si l'email existe déjà
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
    }).catch(() => null);

    if (existing) {
      // Update birthDate if not already set
      if (parsedBirthDate && !existing.birthDate) {
        await prisma.newsletterSubscriber.update({
          where: { id: existing.id },
          data: { birthDate: parsedBirthDate },
        }).catch(() => {});
      }
      return NextResponse.json({
        success: true,
        message: 'Vous êtes déjà inscrit à notre newsletter !',
        alreadySubscribed: true,
      });
    }

    // Créer l'inscription
    await prisma.newsletterSubscriber.create({
      data: {
        email: email.toLowerCase(),
        subscribedAt: new Date(),
        source: source || 'footer',
        locale: locale || 'fr',
        ...(parsedBirthDate && { birthDate: parsedBirthDate }),
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
    });

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
