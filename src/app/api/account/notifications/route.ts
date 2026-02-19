export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';

// GET - Fetch user's notification preferences
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get or create notification preferences
    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
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
      });
    }

    return NextResponse.json(prefs);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
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

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate that all fields are booleans
    const validFields = [
      'orderUpdates',
      'promotions',
      'newsletter',
      'weeklyDigest',
      'priceDrops',
      'stockAlerts',
      'productReviews',
      'birthdayOffers',
      'loyaltyUpdates',
    ];

    const updateData: Record<string, boolean> = {};
    for (const field of validFields) {
      if (field in body) {
        if (typeof body[field] !== 'boolean') {
          return NextResponse.json(
            { error: `Field ${field} must be a boolean` },
            { status: 400 }
          );
        }
        updateData[field] = body[field];
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
    });

    return NextResponse.json(prefs);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
