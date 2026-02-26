export const dynamic = 'force-dynamic';

// FIXED: F-071 - Added logAdminAction for birthday points attribution (non-blocking)
// NOTE: F-076 - Birthday check uses UTC; cron runs at 9AM UTC which covers most timezones within the same day

/**
 * CRON Job - Emails d'anniversaire
 * Envoie un rabais d'anniversaire aux utilisateurs le jour de leur anniversaire
 *
 * - Cree un code promo unique 15% OFF valide 30 jours
 * - Ajoute 200 points bonus de fidelite
 * - Envoie l'email avec le template marketing
 * - Log chaque envoi dans EmailLog
 * - Traitement par lots de 10 pour eviter les timeouts
 *
 * Configuration Vercel (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/birthday-emails",
 *     "schedule": "0 9 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, birthdayEmail, generateUnsubscribeUrl } from '@/lib/email';
// FLAW-062 FIX: Import bounce suppression to skip hard-bounced addresses
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';
import { logAdminAction } from '@/lib/admin-audit';
import { withJobLock } from '@/lib/cron-lock';
import { randomUUID, timingSafeEqual } from 'crypto';

const BATCH_SIZE = 10;

/**
 * Item 80: Configurable birthday email template system
 *
 * Configuration is now read from SiteSetting key-value store at runtime,
 * falling back to defaults if not set. This allows changing birthday email
 * parameters (discount %, points, validity, spend threshold) without
 * code deployment, via PUT /api/admin/settings.
 *
 * SiteSetting keys (module: 'birthday_email'):
 *   birthday_email.discount_percent   - Default: 15
 *   birthday_email.bonus_points       - Default: 200
 *   birthday_email.promo_validity_days - Default: 30
 *   birthday_email.min_yearly_spend   - Default: 300
 *   birthday_email.subject_fr         - Custom French subject line
 *   birthday_email.subject_en         - Custom English subject line
 *
 * TODO (item 80): Full template system enhancements:
 *   - Store email HTML templates in DB (EmailTemplate model) instead of code
 *   - Support Mustache/Handlebars variables in templates: {{customerName}},
 *     {{discountCode}}, {{discountPercent}}, {{bonusPoints}}, {{expiryDate}}
 *   - Admin UI to edit birthday email template with live preview
 *   - Support multiple birthday tiers based on loyaltyTier:
 *     BRONZE: 10% + 100pts, SILVER: 15% + 200pts, GOLD: 20% + 300pts, PLATINUM: 25% + 500pts
 *   - Personalized product recommendations in birthday email based on purchase history
 */

// Defaults (overridden by SiteSetting values loaded in handler)
const DEFAULT_DISCOUNT_PERCENT = 15;
const DEFAULT_BONUS_POINTS = 200;
const DEFAULT_PROMO_VALIDITY_DAYS = 30;
const DEFAULT_MIN_YEARLY_SPEND = 300;

export async function GET(request: NextRequest) {
  // Verify cron secret (fail-closed, timing-safe comparison)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch { secretsMatch = false; }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('birthday-emails', async () => {
    const startTime = Date.now();

    try {
      // Item 80: Load configurable parameters from SiteSetting (template system)
      const configKeys = [
        'birthday_email.discount_percent',
        'birthday_email.bonus_points',
        'birthday_email.promo_validity_days',
        'birthday_email.min_yearly_spend',
      ];
      const configEntries = await db.siteSetting.findMany({
        where: { key: { in: configKeys } },
        select: { key: true, value: true },
      }).catch(() => [] as { key: string; value: string }[]);
      const configMap = new Map(configEntries.map((e) => [e.key, e.value]));

      const DISCOUNT_PERCENT = parseInt(configMap.get('birthday_email.discount_percent') || '', 10) || DEFAULT_DISCOUNT_PERCENT;
      const BONUS_POINTS = parseInt(configMap.get('birthday_email.bonus_points') || '', 10) || DEFAULT_BONUS_POINTS;
      const PROMO_VALIDITY_DAYS = parseInt(configMap.get('birthday_email.promo_validity_days') || '', 10) || DEFAULT_PROMO_VALIDITY_DAYS;
      const MIN_YEARLY_SPEND = parseInt(configMap.get('birthday_email.min_yearly_spend') || '', 10) || DEFAULT_MIN_YEARLY_SPEND;

      logger.info('Birthday cron: loaded config', {
        DISCOUNT_PERCENT,
        BONUS_POINTS,
        PROMO_VALIDITY_DAYS,
        MIN_YEARLY_SPEND,
      });

      const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDay = today.getDate();

    // Find users whose birthday is today and who haven't received an email this year
    const usersWithBirthday = await db.user.findMany({
      where: {
        birthDate: { not: null },
        OR: [
          { lastBirthdayEmail: null },
          {
            lastBirthdayEmail: {
              lt: new Date(today.getFullYear(), 0, 1), // Before Jan 1st of this year
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        locale: true,
        birthDate: true,
        loyaltyPoints: true,
        loyaltyTier: true, // A-082: Needed for tier-based birthday personalization
      },
    });

    // Filter for today's birthdays (month/day match)
    // FIX F-029: Wrap date parsing in try/catch to handle invalid birthDate values
    const birthdayUsersRaw = usersWithBirthday.filter((user) => {
      if (!user.birthDate) return false;
      try {
        const bd = user.birthDate instanceof Date ? user.birthDate : new Date(user.birthDate);
        if (isNaN(bd.getTime())) return false;
        const birthMonth = bd.getMonth() + 1;
        const birthDay = bd.getDate();
        return birthMonth === currentMonth && birthDay === currentDay;
      } catch {
        logger.warn('Birthday cron: invalid birthDate for user', { userId: user.id });
        return false;
      }
    });

    logger.info('Birthday cron: found users with birthday today', {
      count: birthdayUsersRaw.length,
      date: `${currentMonth}/${currentDay}`,
    });

    // PERF 88: Batch aggregate yearly spend for all birthday users in a single groupBy
    // instead of N+1 per-user aggregate queries.
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const birthdayUsers: typeof birthdayUsersRaw = [];

    const birthdayUserIds = birthdayUsersRaw.map((u) => u.id);
    const yearlySpendByUser = birthdayUserIds.length > 0
      ? await db.order.groupBy({
          by: ['userId'],
          where: {
            userId: { in: birthdayUserIds },
            paymentStatus: 'PAID',
            createdAt: { gte: yearStart },
          },
          _sum: { total: true },
        })
      : [];
    const yearlySpendMap = new Map(yearlySpendByUser.map((r) => [r.userId, Number(r._sum.total || 0)]));

    for (const user of birthdayUsersRaw) {
      const yearlySpend = yearlySpendMap.get(user.id) || 0;
      if (yearlySpend >= MIN_YEARLY_SPEND) {
        birthdayUsers.push(user);
      } else {
        logger.debug('Birthday cron: skipping user below spend threshold', {
          email: user.email,
          yearlySpend: yearlySpend.toFixed(2),
          threshold: MIN_YEARLY_SPEND,
        });
      }
    }

    logger.info('Birthday cron: qualified users after spend filter', {
      qualifiedCount: birthdayUsers.length,
      threshold: MIN_YEARLY_SPEND,
    });

    const results: Array<{
      userId: string;
      email: string;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    // Process in batches to avoid timeouts
    for (let i = 0; i < birthdayUsers.length; i += BATCH_SIZE) {
      const batch = birthdayUsers.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (user) => {
        try {
          // FLAW-062 FIX: Check bounce suppression before sending
          const { suppressed } = await shouldSuppressEmail(user.email);
          if (suppressed) {
            return { userId: user.id, email: user.email, success: false, error: 'bounce_suppressed' };
          }

          // A-082: Personalize birthday discount/points by loyalty tier
          // Higher-tier members get better birthday rewards
          const tierBirthdayConfig: Record<string, { discount: number; points: number }> = {
            DIAMOND:  { discount: Math.min(DISCOUNT_PERCENT + 15, 50), points: Math.round(BONUS_POINTS * 3) },
            PLATINUM: { discount: Math.min(DISCOUNT_PERCENT + 10, 40), points: Math.round(BONUS_POINTS * 2.5) },
            GOLD:     { discount: Math.min(DISCOUNT_PERCENT + 5, 30), points: Math.round(BONUS_POINTS * 1.5) },
            SILVER:   { discount: DISCOUNT_PERCENT, points: BONUS_POINTS },
            BRONZE:   { discount: DISCOUNT_PERCENT, points: BONUS_POINTS },
          };
          const tierConfig = tierBirthdayConfig[user.loyaltyTier || 'BRONZE'] || tierBirthdayConfig.BRONZE;
          const userDiscountPercent = tierConfig.discount;
          const userBonusPoints = tierConfig.points;

          // FIX: FLAW-012 - Include crypto-random suffix instead of predictable userId-based code
          // MITIGATED: FLAW-060 - Promo codes use crypto-random 8-char hex (16^8 = 4.3B possibilities),
          // plus usageLimitPerUser=1, making brute-force guessing infeasible.
          const discountCode = `BDAY${randomUUID().slice(0, 8).toUpperCase()}`;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + PROMO_VALIDITY_DAYS);

          // Create promo code in database (skip if already exists)
          // A-082: Use tier-personalized discount value
          try {
            await db.promoCode.create({
              data: {
                code: discountCode,
                description: `Birthday discount for ${user.name || user.email} (${user.loyaltyTier || 'BRONZE'})`,
                type: 'PERCENTAGE',
                value: userDiscountPercent,
                usageLimit: 1,
                usageLimitPerUser: 1,
                isActive: true,
                endsAt: expiresAt,
              },
            });
          } catch {
            // PromoCode may already exist if cron re-ran
            logger.debug('Birthday cron: promo code already exists, skipping creation', {
              code: discountCode,
            });
          }

          // Add bonus loyalty points in a transaction
          // DI-62: Calculate balanceAfter from the updated user record
          // F45 FIX: Check for existing EARN_BIRTHDAY transaction this year inside
          // the transaction to prevent double-award if cron is manually re-run
          // A-082: Use tier-personalized bonus points
          await db.$transaction(async (tx) => {
            const currentYear = new Date().getFullYear();
            const existingBirthdayTx = await tx.loyaltyTransaction.findFirst({
              where: {
                userId: user.id,
                type: 'EARN_BIRTHDAY',
                createdAt: {
                  gte: new Date(currentYear, 0, 1),
                  lt: new Date(currentYear + 1, 0, 1),
                },
              },
            });
            if (existingBirthdayTx) {
              logger.info('Birthday cron: skipping points for user (already awarded this year)', { userId: user.id });
              // Still update lastBirthdayEmail to prevent re-processing
              await tx.user.update({
                where: { id: user.id },
                data: { lastBirthdayEmail: new Date() },
              });
              return;
            }
            const updatedUser = await tx.user.update({
              where: { id: user.id },
              data: {
                loyaltyPoints: { increment: userBonusPoints },
                lifetimePoints: { increment: userBonusPoints },
                lastBirthdayEmail: new Date(),
              },
              select: { loyaltyPoints: true },
            });
            await tx.loyaltyTransaction.create({
              data: {
                userId: user.id,
                type: 'EARN_BIRTHDAY',
                points: userBonusPoints,
                description: `Happy Birthday! Bonus points (${user.loyaltyTier || 'BRONZE'} tier)`,
                balanceAfter: updatedUser.loyaltyPoints,
              },
            });
          });

          // FIX: F-071 - Audit log for birthday points attribution
          logAdminAction({
            adminUserId: 'SYSTEM_CRON',
            action: 'BIRTHDAY_POINTS_AWARDED',
            targetType: 'User',
            targetId: user.id,
            newValue: { points: userBonusPoints, tier: user.loyaltyTier || 'BRONZE' },
          }).catch(() => {}); // Non-blocking: don't fail the cron if audit logging fails

          // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
          const unsubscribeUrl = await generateUnsubscribeUrl(user.email, 'marketing', user.id).catch(() => undefined);

          // Generate and send email
          // A-082: Use tier-personalized values in email
          const emailContent = birthdayEmail({
            customerName: user.name || 'Client',
            customerEmail: user.email,
            discountCode,
            discountValue: userDiscountPercent,
            discountType: 'percentage',
            bonusPoints: userBonusPoints,
            expiresAt,
            locale: (user.locale as 'fr' | 'en') || 'fr',
            unsubscribeUrl,
          });

          const result = await sendEmail({
            to: { email: user.email, name: user.name || undefined },
            subject: emailContent.subject,
            html: emailContent.html,
            tags: ['birthday', 'automated'],
            unsubscribeUrl,
          });

          // Log to EmailLog table
          await db.emailLog.create({
            data: {
              templateId: 'birthday-discount',
              to: user.email,
              subject: emailContent.subject,
              status: result.success ? 'sent' : 'failed',
              error: result.success ? null : 'Send failed',
            },
          }).catch((err: unknown) => logger.error('Failed to create email log', {
            email: user.email,
            error: err instanceof Error ? err.message : String(err),
          }));

          logger.info('Birthday cron: email sent', {
            email: user.email,
            success: result.success,
          });

          return {
            userId: user.id,
            email: user.email,
            success: result.success,
            messageId: result.messageId,
          };
        } catch (error) {
          logger.error('Birthday cron: failed for user', {
            email: user.email,
            error: error instanceof Error ? error.message : String(error),
          });

          // Log failure
          await db.emailLog.create({
            data: {
              templateId: 'birthday-discount',
              to: user.email,
              subject: 'Birthday email',
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          }).catch((err: unknown) => logger.error('Failed to create email log', {
            email: user.email,
            error: err instanceof Error ? err.message : String(err),
          }));

          return {
            userId: user.id,
            email: user.email,
            success: false,
            error: 'Failed to process birthday email',
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;
    const duration = Date.now() - startTime;

    logger.info('Birthday cron: job complete', {
      sent: successCount,
      failed: failCount,
      durationMs: duration,
    });

    // FIX: Return only aggregate stats, not per-user details (privacy)
    return NextResponse.json({
      success: true,
      date: today.toISOString(),
      processed: birthdayUsers.length,
      sent: successCount,
      failed: failCount,
      durationMs: duration,
    });
    } catch (error) {
      logger.error('Birthday cron: job error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        {
          error: 'Internal server error',
          durationMs: Date.now() - startTime,
        },
        { status: 500 }
      );
    }
  });
}

// Allow POST for manual testing
export { GET as POST };
