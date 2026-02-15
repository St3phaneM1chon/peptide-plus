export const dynamic = 'force-dynamic';

/**
 * API Newsletter - BioCycle Peptides
 * Gère les inscriptions à la newsletter
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email, source, locale, birthDate } = await request.json();

    if (!email || !email.includes('@')) {
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

    // Log pour suivi
    console.log(JSON.stringify({
      event: 'newsletter_subscription',
      timestamp: new Date().toISOString(),
      email: email,
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

// Optionnel: GET pour vérifier le statut
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ subscribed: false });
  }

  try {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
    }).catch(() => null);

    return NextResponse.json({
      subscribed: !!subscriber,
    });
  } catch {
    return NextResponse.json({ subscribed: false });
  }
}
