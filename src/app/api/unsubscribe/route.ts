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

// Re-export from the shared module for backwards compatibility
export { generateUnsubscribeUrl, generateUnsubscribeToken, type UnsubscribeCategory } from '@/lib/email/unsubscribe';

// ---------------------------------------------------------------------------
// Token utilities (verification only - generation moved to @/lib/email/unsubscribe)
// ---------------------------------------------------------------------------

function getUnsubscribeSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('UNSUBSCRIBE_SECRET or NEXTAUTH_SECRET must be configured');
  }
  return new TextEncoder().encode(secret);
}

interface UnsubscribePayload {
  email: string;
  category: 'marketing' | 'transactional' | 'newsletter' | 'all';
  userId?: string;
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
      const { payload: verified } = await jose.jwtVerify(token, getUnsubscribeSecret());
      payload = verified as unknown as UnsubscribePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    // GET is read-only: return info for the unsubscribe confirmation page
    // One-click unsubscribe MUST use POST per RFC 8058 — never mutate on GET
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
    // RFC 8058: Gmail/Yahoo send one-click unsubscribe as form-urlencoded
    // with body "List-Unsubscribe=One-Click" and the token in the URL
    const contentType = request.headers.get('content-type') || '';
    let token: string | null = null;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // RFC 8058 one-click POST: token comes from query string
      token = request.nextUrl.searchParams.get('token');
    } else {
      // Standard JSON POST from our own UI
      const body = await request.json().catch(() => ({}));
      token = body.token || request.nextUrl.searchParams.get('token');
    }

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    let payload: UnsubscribePayload;
    try {
      const { payload: verified } = await jose.jwtVerify(token, getUnsubscribeSecret());
      payload = verified as unknown as UnsubscribePayload;
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    // Always use the JWT-provided category — do not allow POST body to override
    // the token's category, as that would let an attacker unsubscribe a user from
    // a category they didn't intend to leave.
    const category = payload.category;
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
  if (category === 'newsletter' || category === 'all' || category === 'marketing') {
    await prisma.newsletterSubscriber.updateMany({
      where: { email: normalizedEmail },
      data: { isActive: false, unsubscribedAt: new Date() },
    }).catch(() => {});

    // Cross-sync: also unsubscribe from MailingListSubscriber
    await prisma.mailingListSubscriber.updateMany({
      where: { email: normalizedEmail, status: { not: 'UNSUBSCRIBED' } },
      data: { status: 'UNSUBSCRIBED', unsubscribedAt: new Date() },
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

  // 3. Revoke ConsentRecord (RGPD compliance)
  const consentTypes = category === 'all'
    ? ['newsletter', 'marketing']
    : category === 'transactional' ? [] : [category];

  if (consentTypes.length > 0) {
    await prisma.consentRecord.updateMany({
      where: {
        email: normalizedEmail,
        type: { in: consentTypes },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    }).catch((err) => {
      logger.error('[unsubscribe] Failed to revoke ConsentRecord', {
        email: normalizedEmail,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  // 4. Log the unsubscribe action
  await prisma.auditLog.create({
    data: {
      // AMELIORATION: Use crypto.randomUUID instead of Math.random for audit IDs
      id: `unsub-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
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

// Security #14: Improved email masking - show only first + last char before @
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  if (local.length <= 2) {
    return `${local[0]}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
  }
  const firstChar = local[0];
  const lastChar = local[local.length - 1];
  const masked = firstChar + '*'.repeat(local.length - 2) + lastChar;
  return `${masked}@${domain}`;
}
