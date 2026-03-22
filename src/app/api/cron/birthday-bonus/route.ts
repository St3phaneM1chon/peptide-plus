export const dynamic = 'force-dynamic';

/**
 * CRON Job - Birthday Bonus Points
 * Awards loyalty points to users whose birthDate matches today.
 *
 * Separated from birthday-emails to allow independent scheduling.
 * - Checks birthDate month/day match (UTC)
 * - Checks lastBirthdayEmail to avoid duplicate awards in same year
 * - Awards tier-personalized bonus points
 * - Updates lastBirthdayEmail timestamp
 * - Logs transactions in LoyaltyTransaction table
 *
 * Schedule: "0 8 * * *" (daily at 8 AM UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { logAdminAction } from '@/lib/admin-audit';
import { withJobLock } from '@/lib/cron-lock';
import { timingSafeEqual } from 'crypto';
import { LOYALTY_POINTS_CONFIG } from '@/lib/constants';
import { sendEmail } from '@/lib/email/email-service';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { generateUnsubscribeUrl } from '@/lib/email';
import { baseTemplate, emailComponents } from '@/lib/email/templates/base-template';
import { forEachActiveTenant } from '@/lib/tenant-cron';

const BATCH_SIZE = 20;
const DEFAULT_BONUS_POINTS = LOYALTY_POINTS_CONFIG.birthdayBonus;

// ---------------------------------------------------------------------------
// Birthday bonus notification email helper
// ---------------------------------------------------------------------------

interface BirthdayBonusEmailParams {
  userId: string;
  email: string;
  name: string | null;
  locale: string | null;
  bonusPoints: number;
  tier: string;
}

async function sendBirthdayBonusEmail(params: BirthdayBonusEmailParams): Promise<void> {
  const { userId, email, name, locale, bonusPoints, tier } = params;

  // Skip suppressed addresses (bounced / unsubscribed)
  const { suppressed } = await shouldSuppressEmail(email);
  if (suppressed) {
    logger.info('Birthday bonus cron: email suppressed (bounce/unsubscribe)', { userId });
    return;
  }

  const isFr = locale !== 'en';
  const safeName = name
    ? name.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c] ?? c))
    : isFr ? 'Client' : 'Customer';

  const subject = isFr
    ? `🎂 Joyeux anniversaire ${name ?? ''}! ${bonusPoints} points bonus vous attendent`
    : `🎂 Happy birthday ${name ?? ''}! ${bonusPoints} bonus points are waiting for you`;

  const unsubscribeUrl = await generateUnsubscribeUrl(email, 'marketing', userId).catch(() => undefined);

  const tierLabel = isFr
    ? { DIAMOND: 'Diamant', PLATINUM: 'Platine', GOLD: 'Or', SILVER: 'Argent', BRONZE: 'Bronze' }[tier] ?? tier
    : tier;

  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <span style="font-size: 64px;">🎂🎉🎁</span>
    </div>

    <h1 style="color: #CC5500; margin-bottom: 8px; text-align: center;">
      ${isFr ? 'Joyeux anniversaire!' : 'Happy birthday!'}
    </h1>
    <p style="font-size: 18px; color: #4b5563; text-align: center;">
      ${isFr
        ? `${safeName}, toute l'équipe BioCycle Peptides vous souhaite un merveilleux anniversaire! 🎈`
        : `${safeName}, the entire BioCycle Peptides team wishes you a wonderful birthday! 🎈`}
    </p>

    <div style="background-color: #d1fae5; border-radius: 16px; padding: 32px; margin: 32px 0; text-align: center; border: 2px solid #34d399;">
      <p style="margin: 0 0 8px 0; font-size: 14px; color: #065f46; text-transform: uppercase; letter-spacing: 2px;">
        ${isFr ? 'Votre cadeau d\'anniversaire' : 'Your birthday gift'}
      </p>
      <p style="margin: 0; font-size: 48px; font-weight: bold; color: #065f46;">
        +${bonusPoints}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 18px; color: #065f46;">
        ${isFr ? 'points de fidélité' : 'loyalty points'}
      </p>
      <p style="margin: 16px 0 0 0; font-size: 13px; color: #6b7280;">
        ${isFr
          ? `Ajoutés à votre compte (niveau ${tierLabel})`
          : `Added to your account (${tierLabel} tier)`}
      </p>
    </div>

    ${emailComponents.button(
      isFr ? '🛒 Utiliser mes points' : '🛒 Use my points',
      `${process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://attitudes.vip'}/account/loyalty`
    )}

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">

    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      ${isFr
        ? 'Passez une excellente journée remplie de joie! 🎈'
        : 'Have an excellent day filled with joy! 🎈'}
    </p>
    <p style="font-size: 12px; color: #9ca3af; text-align: center;">
      ${isFr ? 'L\'équipe BioCycle Peptides' : 'The BioCycle Peptides Team'}
    </p>
  `;

  const html = baseTemplate({
    preheader: isFr
      ? `🎁 ${bonusPoints} points bonus ont été ajoutés à votre compte pour votre anniversaire!`
      : `🎁 ${bonusPoints} bonus points have been added to your account for your birthday!`,
    content,
    locale: isFr ? 'fr' : 'en',
    unsubscribeUrl,
  });

  const result = await sendEmail({
    to: { email, name: name ?? undefined },
    subject,
    html,
    tags: ['birthday', 'bonus', 'automated'],
    unsubscribeUrl,
  });

  logger.info('Birthday bonus cron: email sent', {
    userId,
    email,
    success: result.success,
    messageId: result.messageId,
    error: result.error,
  });
}

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

  return withJobLock('birthday-bonus', async () => {
    const startTime = Date.now();

    try {
      // Multi-tenant: iterate over all active tenants
      const tenantResult = await forEachActiveTenant(async (tenant) => {
      // Load configurable bonus from SiteSetting (if set)
      // Prisma middleware auto-filters by tenant
      const configEntry = await prisma.siteSetting.findUnique({
        where: { key: 'birthday_email.bonus_points' },
        select: { value: true },
      }).catch(() => null);
      const baseBonusPoints = configEntry
        ? (parseInt(configEntry.value, 10) || DEFAULT_BONUS_POINTS)
        : DEFAULT_BONUS_POINTS;

      const today = new Date();
      const currentMonth = today.getUTCMonth() + 1;
      const currentDay = today.getUTCDate();
      const yearStart = new Date(today.getFullYear(), 0, 1);

      // Find users with a birthDate who haven't received birthday bonus this year
      const usersWithBirthday = await prisma.user.findMany({
        where: {
          birthDate: { not: null },
          OR: [
            { lastBirthdayEmail: null },
            { lastBirthdayEmail: { lt: yearStart } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          locale: true,
          birthDate: true,
          loyaltyPoints: true,
          lifetimePoints: true,
          loyaltyTier: true,
        },
      });

      // Filter for today's birthdays (month/day match)
      const birthdayUsers = usersWithBirthday.filter((user) => {
        if (!user.birthDate) return false;
        try {
          const bd = user.birthDate instanceof Date ? user.birthDate : new Date(user.birthDate);
          if (isNaN(bd.getTime())) return false;
          return (bd.getUTCMonth() + 1) === currentMonth && bd.getUTCDate() === currentDay;
        } catch {
          logger.warn('Birthday bonus cron: invalid birthDate', { userId: user.id });
          return false;
        }
      });

      logger.info('Birthday bonus cron: found users', {
        tenantSlug: tenant.slug,
        count: birthdayUsers.length,
        date: `${currentMonth}/${currentDay}`,
      });

      // Tier-personalized bonus multipliers
      const tierMultipliers: Record<string, number> = {
        DIAMOND: 3,
        PLATINUM: 2.5,
        GOLD: 1.5,
        SILVER: 1,
        BRONZE: 1,
      };

      // Process in batches
      for (let i = 0; i < birthdayUsers.length; i += BATCH_SIZE) {
        const batch = birthdayUsers.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (user) => {
          try {
            const multiplier = tierMultipliers[user.loyaltyTier || 'BRONZE'] || 1;
            const bonusPoints = Math.round(baseBonusPoints * multiplier);

            // Track whether points were actually awarded (vs. already awarded this year)
            let pointsAwarded = false;

            await prisma.$transaction(async (tx) => {
              // Check for existing birthday bonus this year (inside transaction to prevent races)
              const currentYear = new Date().getFullYear();
              const existingTx = await tx.loyaltyTransaction.findFirst({
                where: {
                  userId: user.id,
                  type: 'EARN_BIRTHDAY',
                  createdAt: {
                    gte: new Date(currentYear, 0, 1),
                    lt: new Date(currentYear + 1, 0, 1),
                  },
                },
                select: { id: true },
              });

              if (existingTx) {
                // Already awarded this year - just update timestamp
                await tx.user.update({
                  where: { id: user.id },
                  data: { lastBirthdayEmail: new Date() },
                });
                return;
              }

              // Award points atomically
              const updatedUser = await tx.user.update({
                where: { id: user.id },
                data: {
                  loyaltyPoints: { increment: bonusPoints },
                  lifetimePoints: { increment: bonusPoints },
                  lastBirthdayEmail: new Date(),
                },
                select: { loyaltyPoints: true },
              });

              await tx.loyaltyTransaction.create({
                data: {
                  userId: user.id,
                  type: 'EARN_BIRTHDAY',
                  points: bonusPoints,
                  description: `Happy Birthday! Bonus points (${user.loyaltyTier || 'BRONZE'} tier)`,
                  balanceAfter: updatedUser.loyaltyPoints,
                },
              });

              pointsAwarded = true;
            });

            // Audit log (non-blocking)
            if (pointsAwarded) {
              logAdminAction({
                adminUserId: 'SYSTEM_CRON',
                action: 'BIRTHDAY_POINTS_AWARDED',
                targetType: 'User',
                targetId: user.id,
                newValue: {
                  points: bonusPoints,
                  tier: user.loyaltyTier || 'BRONZE',
                },
              }).catch((err) => { logger.error('[cron/birthday-bonus] Non-blocking operation failed:', err); });

              // Send birthday bonus email (non-blocking, best-effort)
              sendBirthdayBonusEmail({
                userId: user.id,
                email: user.email,
                name: user.name,
                locale: user.locale,
                bonusPoints,
                tier: user.loyaltyTier || 'BRONZE',
              }).catch((err: unknown) => {
                logger.warn('Birthday bonus cron: email send failed (non-fatal)', {
                  userId: user.id,
                  error: err instanceof Error ? err.message : String(err),
                });
              });
            }
          } catch (error) {
            logger.error('Birthday bonus cron: failed for user', {
              tenantSlug: tenant.slug,
              userId: user.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        });

        await Promise.allSettled(batchPromises);
      }
      });

      const duration = Date.now() - startTime;

      logger.info('Birthday bonus cron: complete', {
        tenants: tenantResult,
        durationMs: duration,
      });

      return NextResponse.json({
        success: true,
        date: new Date().toISOString(),
        tenants: tenantResult,
        durationMs: duration,
      });
    } catch (error) {
      logger.error('Birthday bonus cron: job error', {
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: 'Internal server error', durationMs: Date.now() - startTime },
        { status: 500 }
      );
    }
  });
}

// Allow POST for manual testing
export { GET as POST };
