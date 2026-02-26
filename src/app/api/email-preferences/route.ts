export const dynamic = 'force-dynamic';

/**
 * EMAIL PREFERENCE CENTER API
 *
 * Allows users to manage their email preferences via a token-based link
 * embedded in marketing/newsletter emails. No authentication required.
 *
 * GET  /api/email-preferences?token=JWT  -> Return current preferences
 * PUT  /api/email-preferences            -> Update preferences
 *
 * Token: JWT signed with UNSUBSCRIBE_SECRET or NEXTAUTH_SECRET
 * Payload: { email, category: 'preferences', userId?, iat, exp }
 *
 * Compliance: CAN-SPAM, CASL (Canada Anti-Spam Legislation), RGPD Art. 7(3)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import * as jose from 'jose';

// ---------------------------------------------------------------------------
// Token utilities
// ---------------------------------------------------------------------------

function getSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('UNSUBSCRIBE_SECRET or NEXTAUTH_SECRET must be configured');
  }
  return new TextEncoder().encode(secret);
}

interface PreferenceTokenPayload {
  email: string;
  category: string;
  userId?: string;
}

async function verifyToken(token: string): Promise<PreferenceTokenPayload> {
  const { payload } = await jose.jwtVerify(token, getSecret());
  return payload as unknown as PreferenceTokenPayload;
}

function getIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

// Security: Mask email for public display
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  if (local.length <= 2) {
    return `${local[0]}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
  }
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

// ---------------------------------------------------------------------------
// GET - Return current preferences for the token holder
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }

    // Rate limit
    const ip = getIp(request);
    const rl = await rateLimitMiddleware(ip, '/api/email-preferences:GET');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // Verify JWT
    let payload: PreferenceTokenPayload;
    try {
      payload = await verifyToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const email = payload.email.toLowerCase().trim();

    // Fetch data from all relevant models in parallel
    const [newsletterSub, mailingListSub, notificationPref] = await Promise.all([
      prisma.newsletterSubscriber
        .findUnique({ where: { email } })
        .catch(() => null),
      prisma.mailingListSubscriber
        .findUnique({
          where: { email },
          include: { preferences: true },
        })
        .catch(() => null),
      payload.userId
        ? prisma.notificationPreference
            .findUnique({ where: { userId: payload.userId } })
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    // Build consolidated preference state
    const preferences = {
      marketing:
        notificationPref?.promotions ??
        (mailingListSub?.status === 'ACTIVE' ? true : mailingListSub ? false : true),
      newsletter:
        notificationPref?.newsletter ?? newsletterSub?.isActive ?? true,
      weeklyDigest: notificationPref?.weeklyDigest ?? false,
      priceDrops:
        notificationPref?.priceDrops ??
        (mailingListSub?.preferences?.find((p) => p.category === 'specials')?.isEnabled ?? false),
      stockAlerts: notificationPref?.stockAlerts ?? true,
      productReviews: notificationPref?.productReviews ?? false,
      birthdayOffers: notificationPref?.birthdayOffers ?? true,
      loyaltyUpdates: notificationPref?.loyaltyUpdates ?? true,
    };

    // Check mailing list topic-level preferences
    if (mailingListSub?.preferences) {
      for (const pref of mailingListSub.preferences) {
        if (pref.category === 'promotions' && !pref.isEnabled) {
          preferences.marketing = false;
        }
        if (pref.category === 'new_products' && !pref.isEnabled) {
          preferences.priceDrops = false;
        }
      }
    }

    return NextResponse.json({
      email: maskEmail(email),
      preferences,
      hasAccount: !!payload.userId,
    });
  } catch (error) {
    logger.error('[email-preferences] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT - Update preferences
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  token: z.string().min(1).max(2000),
  preferences: z.object({
    marketing: z.boolean(),
    newsletter: z.boolean(),
    weeklyDigest: z.boolean(),
    priceDrops: z.boolean(),
    stockAlerts: z.boolean(),
    productReviews: z.boolean(),
    birthdayOffers: z.boolean(),
    loyaltyUpdates: z.boolean(),
  }),
});

export async function PUT(request: NextRequest) {
  try {
    // Rate limit
    const ip = getIp(request);
    const rl = await rateLimitMiddleware(ip, '/api/email-preferences:PUT');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { token, preferences } = parsed.data;

    // Verify JWT
    let payload: PreferenceTokenPayload;
    try {
      payload = await verifyToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    const email = payload.email.toLowerCase().trim();
    const now = new Date();
    const userAgent = request.headers.get('user-agent') || undefined;

    // 1. Update NewsletterSubscriber
    if (!preferences.newsletter) {
      await prisma.newsletterSubscriber
        .updateMany({
          where: { email },
          data: { isActive: false, unsubscribedAt: now },
        })
        .catch((err) =>
          logger.error('[email-preferences] NewsletterSubscriber update failed', {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    } else {
      // Re-enable if they toggled newsletter back on
      await prisma.newsletterSubscriber
        .updateMany({
          where: { email },
          data: { isActive: true, unsubscribedAt: null },
        })
        .catch((err) =>
          logger.error('[email-preferences] NewsletterSubscriber re-enable failed', {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    }

    // 2. Update MailingListSubscriber status
    const isAnyMarketingOn =
      preferences.marketing || preferences.priceDrops || preferences.stockAlerts;

    if (!isAnyMarketingOn && !preferences.newsletter) {
      // Unsubscribe from mailing list entirely
      await prisma.mailingListSubscriber
        .updateMany({
          where: { email, status: { not: 'UNSUBSCRIBED' } },
          data: { status: 'UNSUBSCRIBED', unsubscribedAt: now },
        })
        .catch((err) =>
          logger.error('[email-preferences] MailingListSubscriber unsubscribe failed', {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    } else {
      // Re-activate if they enable something
      await prisma.mailingListSubscriber
        .updateMany({
          where: { email, status: 'UNSUBSCRIBED' },
          data: { status: 'ACTIVE', unsubscribedAt: null },
        })
        .catch((err) =>
          logger.error('[email-preferences] MailingListSubscriber re-activate failed', {
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    }

    // 3. Update MailingListPreference topics
    const mailingListSub = await prisma.mailingListSubscriber
      .findUnique({ where: { email } })
      .catch(() => null);

    if (mailingListSub) {
      const topicMap: Record<string, boolean> = {
        promotions: preferences.marketing,
        new_products: preferences.priceDrops,
        specials: preferences.priceDrops,
        promo_codes: preferences.marketing,
      };

      for (const [category, isEnabled] of Object.entries(topicMap)) {
        await prisma.mailingListPreference
          .upsert({
            where: {
              subscriberId_category: {
                subscriberId: mailingListSub.id,
                category,
              },
            },
            update: { isEnabled },
            create: {
              subscriberId: mailingListSub.id,
              category,
              isEnabled,
            },
          })
          .catch((err) =>
            logger.error('[email-preferences] MailingListPreference upsert failed', {
              category,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
      }
    }

    // 4. Update NotificationPreference (if userId is known)
    if (payload.userId) {
      await prisma.notificationPreference
        .upsert({
          where: { userId: payload.userId },
          update: {
            promotions: preferences.marketing,
            newsletter: preferences.newsletter,
            weeklyDigest: preferences.weeklyDigest,
            priceDrops: preferences.priceDrops,
            stockAlerts: preferences.stockAlerts,
            productReviews: preferences.productReviews,
            birthdayOffers: preferences.birthdayOffers,
            loyaltyUpdates: preferences.loyaltyUpdates,
          },
          create: {
            userId: payload.userId,
            promotions: preferences.marketing,
            newsletter: preferences.newsletter,
            weeklyDigest: preferences.weeklyDigest,
            priceDrops: preferences.priceDrops,
            stockAlerts: preferences.stockAlerts,
            productReviews: preferences.productReviews,
            birthdayOffers: preferences.birthdayOffers,
            loyaltyUpdates: preferences.loyaltyUpdates,
          },
        })
        .catch((err) =>
          logger.error('[email-preferences] NotificationPreference upsert failed', {
            userId: payload.userId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    }

    // 5. Create ConsentRecord audit trail entries for each change
    const consentEntries = [
      {
        type: 'marketing',
        consentGiven: preferences.marketing,
        purpose: 'MARKETING',
      },
      {
        type: 'newsletter',
        consentGiven: preferences.newsletter,
        purpose: 'MARKETING',
      },
      {
        type: 'product_alerts',
        consentGiven: preferences.priceDrops || preferences.stockAlerts,
        purpose: 'MARKETING',
      },
    ];

    for (const entry of consentEntries) {
      await prisma.consentRecord
        .create({
          data: {
            email,
            userId: payload.userId || null,
            type: entry.type,
            purpose: entry.purpose,
            source: 'email_preference_center',
            consentText: entry.consentGiven
              ? `User opted in to ${entry.type} emails via preference center`
              : `User opted out of ${entry.type} emails via preference center`,
            grantedAt: now,
            revokedAt: entry.consentGiven ? null : now,
            ipAddress: ip,
            userAgent,
            lawfulBasis: 'CONSENT',
          },
        })
        .catch((err) =>
          logger.error('[email-preferences] ConsentRecord create failed', {
            type: entry.type,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
    }

    // 6. Audit log
    await prisma.auditLog
      .create({
        data: {
          id: `pref-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          userId: payload.userId || null,
          action: 'EMAIL_PREFERENCES_UPDATE',
          entityType: 'EmailPreference',
          details: JSON.stringify({
            email: maskEmail(email),
            preferences,
            source: 'preference_center',
          }),
        },
      })
      .catch((err) =>
        logger.error('[email-preferences] AuditLog create failed', {
          error: err instanceof Error ? err.message : String(err),
        }),
      );

    logger.info('[email-preferences] Updated preferences', {
      email: maskEmail(email),
      userId: payload.userId,
      preferences,
    });

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    logger.error('[email-preferences] PUT error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
