export const dynamic = 'force-dynamic';

/**
 * API Profil utilisateur
 * GET /api/user/profile - Récupère le profil
 * PUT /api/user/profile - Met à jour le profil
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { stripHtml, isValidPhone, isValidName } from '@/lib/validation';
import { locales } from '@/i18n/config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

const updateProfileSchema = z.object({
  name: z.string().max(100).optional(),
  phone: z.string().max(20).optional().nullable().or(z.literal('')),
  birthDate: z.string().optional().or(z.literal('')),
  locale: z.string().max(5).optional(),
});

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        birthDate: true,
        locale: true,
        loyaltyTier: true,
        loyaltyPoints: true,
        lifetimePoints: true,
        referralCode: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);

  } catch (error) {
    logger.error('Get profile error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/user/profile');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name: rawName, phone: rawPhone, birthDate, locale } = parsed.data;

    // SECURITY FIX (BE-SEC-05): Validate and sanitize all profile fields
    // Strip HTML to prevent stored XSS
    const name = rawName !== undefined ? stripHtml(String(rawName)).trim() : undefined;
    const phone = rawPhone !== undefined ? (rawPhone ? String(rawPhone).trim() : null) : undefined;

    if (name !== undefined && name !== '') {
      if (!isValidName(name, 2, 100)) {
        return NextResponse.json(
          { error: 'Name must be 2-100 characters, letters/spaces/hyphens/apostrophes only' },
          { status: 400 }
        );
      }
    }

    if (phone !== undefined && phone !== null) {
      if (!isValidPhone(phone)) {
        return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
      }
    }

    // Validate locale against ALL 22 supported locales (not just fr/en)
    if (locale && !(locales as readonly string[]).includes(locale)) {
      return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
    }

    // Préparer les données de mise à jour
    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (locale !== undefined) updateData.locale = locale;
    
    if (birthDate) {
      const parsedDate = new Date(birthDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid birth date' }, { status: 400 });
      }
      updateData.birthDate = parsedDate;
    } else if (birthDate === '') {
      updateData.birthDate = null;
    }

    const updatedUser = await db.user.update({
      where: { email: session.user.email },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        phone: true,
        birthDate: true,
        locale: true,
        loyaltyTier: true,
        loyaltyPoints: true,
        lifetimePoints: true,
        referralCode: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updatedUser);

  } catch (error) {
    logger.error('Update profile error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
