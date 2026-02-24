export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

const notificationPrefsSchema = z.object({
  orderUpdates: z.boolean().optional(),
  promotions: z.boolean().optional(),
  newsletter: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  priceDrops: z.boolean().optional(),
  stockAlerts: z.boolean().optional(),
  productReviews: z.boolean().optional(),
  birthdayOffers: z.boolean().optional(),
  loyaltyUpdates: z.boolean().optional(),
}).strict(); // reject unknown fields

// GET - Fetch user's notification preferences
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create notification preferences (select only preference fields)
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        userId: true,
        orderUpdates: true,
        promotions: true,
        newsletter: true,
        weeklyDigest: true,
        priceDrops: true,
        stockAlerts: true,
        productReviews: true,
        birthdayOffers: true,
        loyaltyUpdates: true,
      },
    });

    // Create default preferences if none exist
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          userId: session.user.id,
          orderUpdates: true,
          promotions: true,
          newsletter: true,
          weeklyDigest: false,
          priceDrops: false,
          stockAlerts: true,
          productReviews: false,
          birthdayOffers: true,
          loyaltyUpdates: true,
        },
        select: {
          id: true,
          userId: true,
          orderUpdates: true,
          promotions: true,
          newsletter: true,
          weeklyDigest: true,
          priceDrops: true,
          stockAlerts: true,
          productReviews: true,
          birthdayOffers: true,
          loyaltyUpdates: true,
        },
      });
    }

    return NextResponse.json(prefs);
  } catch (error) {
    logger.error('Error fetching notification preferences', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

// PUT - Update notification preferences
export async function PUT(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/notifications');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Zod schema validation
    const body = await request.json();
    const parsed = notificationPrefsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Build update object from validated data (only include provided fields)
    const updateData: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    // Update or create preferences
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData,
      },
      select: {
        id: true,
        userId: true,
        orderUpdates: true,
        promotions: true,
        newsletter: true,
        weeklyDigest: true,
        priceDrops: true,
        stockAlerts: true,
        productReviews: true,
        birthdayOffers: true,
        loyaltyUpdates: true,
      },
    });

    return NextResponse.json(prefs);
  } catch (error) {
    logger.error('Error updating notification preferences', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
