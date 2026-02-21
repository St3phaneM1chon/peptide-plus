export const dynamic = 'force-dynamic';

/**
 * API Profil utilisateur
 * GET /api/user/profile - Récupère le profil
 * PUT /api/user/profile - Met à jour le profil
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { stripHtml, isValidPhone, isValidName } from '@/lib/validation';
import { locales } from '@/i18n/config';

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
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name: rawName, phone: rawPhone, birthDate, locale } = body;

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
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
