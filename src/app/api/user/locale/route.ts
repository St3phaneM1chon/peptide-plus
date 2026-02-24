export const dynamic = 'force-dynamic';
/**
 * API - UPDATE USER LOCALE
 * Met à jour la langue préférée de l'utilisateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { locales, isValidLocale } from '@/i18n/config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

const localeSchema = z.object({
  locale: z.string().max(10).refine((val) => isValidLocale(val), {
    message: `Langue invalide. Valeurs acceptées: ${locales.join(', ')}`,
  }),
});

export async function PUT(request: NextRequest) {
  try {
    // SECURITY: CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/user/locale');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Zod schema validation
    const body = await request.json();
    const parsed = localeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const { locale } = parsed.data;

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
