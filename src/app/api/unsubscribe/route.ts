export const dynamic = 'force-dynamic';

/**
 * EMAIL UNSUBSCRIBE MANAGEMENT
 *
 * Improvement #47: Token-based unsubscribe with category support
 *
 * GET  /api/unsubscribe?token=xxx         -> Show unsubscribe confirmation page data
 * POST /api/unsubscribe                   -> Process unsubscribe
 *
 * Categories: marketing, transactional, newsletter
 * Token: JWT containing { email, category, exp }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as jose from 'jose';

// ---------------------------------------------------------------------------
// Token utilities
// ---------------------------------------------------------------------------

const UNSUBSCRIBE_SECRET = new TextEncoder().encode(
  process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET || 'unsubscribe-fallback-secret-change-me'
);

export type UnsubscribeCategory = 'marketing' | 'transactional' | 'newsletter' | 'all';

interface UnsubscribePayload {
  email: string;
  category: UnsubscribeCategory;
  userId?: string;
}

/**
 * Generate an unsubscribe token (used in email templates)
 */
export async function generateUnsubscribeToken(
  email: string,
  category: UnsubscribeCategory = 'marketing',
  userId?: string
): Promise<string> {
  const token = await new jose.SignJWT({ email, category, userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('90d') // Token valid for 90 days
    .setIssuedAt()
    .sign(UNSUBSCRIBE_SECRET);

  return token;
}

/**
 * Generate the full unsubscribe URL
 */
export async function generateUnsubscribeUrl(
  email: string,
  category: UnsubscribeCategory = 'marketing',
  userId?: string
): Promise<string> {
  const token = await generateUnsubscribeToken(email, category, userId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://biocyclepeptides.com';
  return `${baseUrl}/api/unsubscribe?token=${token}`;
}

// ---------------------------------------------------------------------------
// GET - Validate token and return unsubscribe info
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Verify token
    let payload: UnsubscribePayload;
    try {
      const { payload: verified } = await jose.jwtVerify(token, UNSUBSCRIBE_SECRET);
      payload = verified as unknown as UnsubscribePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    // For one-click unsubscribe (List-Unsubscribe-Post header), process immediately
    const oneClick = request.nextUrl.searchParams.get('oneclick');
    if (oneClick === 'true') {
      await processUnsubscribe(payload.email, payload.category, payload.userId);
      return NextResponse.json({
        success: true,
        message: 'You have been unsubscribed',
        email: maskEmail(payload.email),
        category: payload.category,
      });
    }

    return NextResponse.json({
      email: maskEmail(payload.email),
      category: payload.category,
      message: 'POST to this endpoint to confirm unsubscribe',
    });
  } catch (error) {
    logger.error('[unsubscribe] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST - Process unsubscribe
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const token = body.token || request.nextUrl.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    let payload: UnsubscribePayload;
    try {
      const { payload: verified } = await jose.jwtVerify(token, UNSUBSCRIBE_SECRET);
      payload = verified as unknown as UnsubscribePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const category = body.category || payload.category;
    await processUnsubscribe(payload.email, category, payload.userId);

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed',
      email: maskEmail(payload.email),
      category,
    });
  } catch (error) {
    logger.error('[unsubscribe] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

async function processUnsubscribe(
  email: string,
  category: UnsubscribeCategory,
  userId?: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Update NewsletterSubscriber if category is newsletter or all
  if (category === 'newsletter' || category === 'all') {
    await prisma.newsletterSubscriber.updateMany({
      where: { email: normalizedEmail },
      data: { isActive: false, unsubscribedAt: new Date() },
    }).catch(() => {});
  }

  // 2. Update NotificationPreference if userId is known
  if (userId) {
    const updates: Record<string, boolean> = {};

    switch (category) {
      case 'marketing':
        updates.promotions = false;
        updates.priceDrops = false;
        break;
      case 'newsletter':
        updates.newsletter = false;
        updates.weeklyDigest = false;
        break;
      case 'transactional':
        // Generally we don't allow unsubscribing from transactional emails
        // but we can disable non-essential ones
        updates.productReviews = false;
        break;
      case 'all':
        updates.promotions = false;
        updates.newsletter = false;
        updates.weeklyDigest = false;
        updates.priceDrops = false;
        updates.productReviews = false;
        break;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.notificationPreference.upsert({
        where: { userId },
        update: updates,
        create: {
          id: `notif-${userId}`,
          userId,
          ...updates,
        },
      }).catch((err) => {
        logger.error('[unsubscribe] Failed to update notification preferences', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  // 3. Log the unsubscribe action
  await prisma.auditLog.create({
    data: {
      id: `unsub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      userId: userId || null,
      action: 'UNSUBSCRIBE',
      entityType: 'Email',
      details: JSON.stringify({ email: normalizedEmail, category }),
    },
  }).catch(() => {});

  logger.info('[unsubscribe] Processed unsubscribe', {
    email: normalizedEmail,
    category,
    userId,
  });
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  const masked = local.slice(0, 2) + '***';
  return `${masked}@${domain}`;
}
