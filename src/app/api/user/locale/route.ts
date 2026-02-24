export const dynamic = 'force-dynamic';
/**
 * API - UPDATE USER LOCALE
 * Met à jour la langue préférée de l'utilisateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { isValidLocale } from '@/i18n/config';
import { logger } from '@/lib/logger';

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { locale } = body;

    // Valider la locale
    if (!locale || !isValidLocale(locale)) {
      return NextResponse.json(
        { error: 'Langue invalide' },
        { status: 400 }
      );
    }

    // Mettre à jour l'utilisateur
    await prisma.user.update({
      where: { id: session.user.id },
      data: { locale },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        action: 'LOCALE_CHANGED',
        userId: session.user.id,
        entityType: 'User',
        details: JSON.stringify({ newLocale: locale }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ success: true, locale });
  } catch (error) {
    logger.error('Error updating locale', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la langue' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ locale: 'fr' });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { locale: true },
    });

    return NextResponse.json({ locale: user?.locale || 'fr' });
  } catch (error) {
    logger.error('Error getting locale', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ locale: 'fr' });
  }
}
