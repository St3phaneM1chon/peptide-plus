export const dynamic = 'force-dynamic';

/**
 * CRON Job - Emails de panier abandonne
 * Envoie un rappel aux utilisateurs qui ont ajoute des articles mais n'ont pas finalise
 *
 * Criteres:
 * - Panier avec userId (pas anonyme) et au moins 1 article
 * - Panier mis a jour il y a plus d'1 heure mais moins de 48 heures
 * - Aucune commande completee par cet utilisateur depuis la derniere MAJ du panier
 * - Pas d'email de panier abandonne deja envoye dans les dernieres 24h pour cet utilisateur
 *
 * - Log chaque envoi dans EmailLog
 * - Traitement par lots de 10 pour eviter les timeouts
 *
 * Configuration Vercel (vercel.json):
 * Schedule: every 2 hours (0 star-slash-2 star star star)
 */

/**
 * Item 79: Multi-channel abandoned cart recovery
 *
 * Current: Email only (1 email per cart abandonment)
 * Improved: Configurable multi-channel recovery with escalation:
 *   - Channel 1 (1h after abandonment): Email reminder
 *   - Channel 2 (4h after abandonment): SMS reminder (if user has phone + SMS consent)
 *   - Channel 3 (24h after abandonment): Email with discount incentive
 *
 * TODO (item 79): Full multi-channel implementation:
 *   - Add push notification support via web push (service worker + PushSubscription model)
 *   - Add SMS recovery using the existing sendSms() from @/lib/sms
 *   - Track recovery channel per user in EmailLog (templateId: 'abandoned-cart-sms', 'abandoned-cart-push')
 *   - Add SiteSetting flags to enable/disable each channel:
 *     ff.abandoned_cart_email (default: true)
 *     ff.abandoned_cart_sms (default: false)
 *     ff.abandoned_cart_push (default: false)
 *   - Escalation: if email was sent >4h ago with no conversion, try SMS; if >24h, send discount email
 *   - Respect user communication preferences (marketingConsent, smsConsent fields)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { sendEmail, abandonedCartEmail, generateUnsubscribeUrl } from '@/lib/email';
// FLAW-064 FIX: Import bounce suppression to skip hard-bounced addresses
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';
import { withJobLock } from '@/lib/cron-lock';
import { multiply, add } from '@/lib/decimal-calculator';
import { forEachActiveTenant } from '@/lib/tenant-cron';

const BATCH_SIZE = 10;
const MIN_ABANDONMENT_MINUTES = 60; // 1 hour minimum
const MAX_ABANDONMENT_HOURS = 96; // Extended to 96h for 3-email sequence
const DEDUP_HOURS = 24; // Don't re-send same stage within 24 hours

/**
 * 3-Email Recovery Sequence:
 *   Stage 1 (0h after threshold): Friendly reminder
 *   Stage 2 (24h after stage 1): Urgency + social proof
 *   Stage 3 (72h after stage 1): Discount incentive
 *
 * Each stage uses a distinct templateId for dedup:
 *   - 'abandoned-cart' (stage 1, existing)
 *   - 'abandoned-cart-urgency' (stage 2)
 *   - 'abandoned-cart-discount' (stage 3)
 */
const RECOVERY_STAGES = [
  { templateId: 'abandoned-cart', delayHours: 0, stage: 1 },
  { templateId: 'abandoned-cart-urgency', delayHours: 24, stage: 2 },
  { templateId: 'abandoned-cart-discount', delayHours: 72, stage: 3 },
] as const;

/**
 * Determine which recovery stage to send for a given user.
 * Returns the next unsent stage or null if all stages are complete.
 */
function getNextRecoveryStage(
  sentTemplateIds: Set<string>,
  abandonmentHoursAgo: number
): typeof RECOVERY_STAGES[number] | null {
  for (const stage of RECOVERY_STAGES) {
    if (!sentTemplateIds.has(stage.templateId) && abandonmentHoursAgo >= stage.delayHours) {
      return stage;
    }
  }
  return null;
}

// Item 79: Configurable recovery channels (read from env or SiteSetting in future)
const ENABLE_SMS_RECOVERY = process.env.ABANDONED_CART_SMS_ENABLED === 'true';
const SMS_DELAY_HOURS = 4; // Send SMS 4 hours after email if no conversion

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

  return withJobLock('abandoned-cart', async () => {
    const startTime = Date.now();

    try {
      // Multi-tenant: iterate over all active tenants
      const tenantResult = await forEachActiveTenant(async (tenant) => {
      const now = new Date();

    // Time window: updated between 1 hour ago and 48 hours ago
    const oneHourAgo = new Date(now.getTime() - MIN_ABANDONMENT_MINUTES * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - MAX_ABANDONMENT_HOURS * 60 * 60 * 1000);

    // Find carts with items that were updated within the window and belong to logged-in users
    // Prisma middleware auto-filters by tenant
    const abandonedCarts = await db.cart.findMany({
      where: {
        userId: { not: null },
        updatedAt: {
          gte: fortyEightHoursAgo,
          lte: oneHourAgo,
        },
        items: {
          some: {}, // Has at least one item
        },
      },
      include: {
        items: {
          include: {
            // We need product info for the email; join via raw product lookup below
          },
        },
      },
    });

    logger.info('Abandoned cart cron: found potentially abandoned carts', {
      tenantSlug: tenant.slug,
      count: abandonedCarts.length,
    });

    // Filter out users who completed an order after their cart was last updated
    // and users who already received an abandoned cart email recently
    const twentyFourHoursAgo = new Date(now.getTime() - DEDUP_HOURS * 60 * 60 * 1000);

    // Get all recovery emails sent to users in the abandonment window (for multi-stage dedup)
    const allRecoveryTemplateIds = RECOVERY_STAGES.map((s) => s.templateId);
    const recentEmails = await db.emailLog.findMany({
      where: {
        templateId: { in: [...allRecoveryTemplateIds] },
        status: 'sent',
        sentAt: { gte: fortyEightHoursAgo },
      },
      select: { to: true, templateId: true, sentAt: true },
    });

    // Build a map of email -> Set of sent templateIds (for multi-stage tracking)
    const emailSentStages = new Map<string, Set<string>>();
    for (const e of recentEmails) {
      if (!emailSentStages.has(e.to)) emailSentStages.set(e.to, new Set());
      if (e.templateId) emailSentStages.get(e.to)!.add(e.templateId);
    }

    // For dedup within 24h on same stage
    const recentlyEmailed = new Set(
      recentEmails.filter((e) => e.sentAt >= twentyFourHoursAgo).map((e) => `${e.to}:${e.templateId}`)
    );

    // Build list of eligible carts with their recovery stage
    const eligibleCarts: Array<{
      cart: (typeof abandonedCarts)[0];
      user: {
        id: string;
        name: string | null;
        email: string;
        locale: string;
      };
      recoveryStage: typeof RECOVERY_STAGES[number];
    }> = [];

    // PERF 87: Batch fetch all users in a single query instead of N+1 per-cart lookups
    const allUserIds = [...new Set(abandonedCarts.map((c) => c.userId).filter(Boolean))] as string[];
    const users = allUserIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: allUserIds } },
          select: { id: true, name: true, email: true, locale: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    // FIX: FLAW-014 - Batch-fetch recent orders for all cart user IDs in a single query
    // instead of N+1 per-cart queries inside the for-loop.
    const cartUserIds = abandonedCarts
      .map((c) => c.userId)
      .filter((id): id is string => !!id);

    // Find the earliest cart updatedAt to use as lower bound for order search
    const earliestCartUpdate = abandonedCarts.reduce(
      (min, c) => (c.updatedAt < min ? c.updatedAt : min),
      abandonedCarts[0]?.updatedAt || new Date()
    );

    const recentPaidOrders = cartUserIds.length > 0
      ? await db.order.findMany({
          where: {
            userId: { in: cartUserIds },
            paymentStatus: 'PAID',
            createdAt: { gte: earliestCartUpdate },
          },
          select: { userId: true, createdAt: true },
        })
      : [];

    // Build a map: userId -> latest paid order date
    const userLatestOrderMap = new Map<string, Date>();
    for (const order of recentPaidOrders) {
      if (!order.userId) continue;
      const existing = userLatestOrderMap.get(order.userId);
      if (!existing || order.createdAt > existing) {
        userLatestOrderMap.set(order.userId, order.createdAt);
      }
    }

    for (const cart of abandonedCarts) {
      if (!cart.userId) continue;

      const user = userMap.get(cart.userId);
      if (!user) continue;

      // Determine which recovery stage to send
      const sentStages = emailSentStages.get(user.email) || new Set<string>();
      const hoursAbandonedAgo = (now.getTime() - cart.updatedAt.getTime()) / (60 * 60 * 1000);
      const nextStage = getNextRecoveryStage(sentStages, hoursAbandonedAgo);

      // Skip if no stage to send or recently emailed for this stage
      if (!nextStage || recentlyEmailed.has(`${user.email}:${nextStage.templateId}`)) {
        continue;
      }

      // Check if user completed an order after the cart was last updated (using batch data)
      const latestOrder = userLatestOrderMap.get(user.id);
      if (latestOrder && latestOrder >= cart.updatedAt) {
        // User already ordered after cart update, skip
        continue;
      }

      eligibleCarts.push({ cart, user, recoveryStage: nextStage });
    }

    logger.info('Abandoned cart cron: eligible carts after filtering', {
      tenantSlug: tenant.slug,
      eligibleCount: eligibleCarts.length,
    });

    // Collect all product IDs we need to look up
    const allProductIds = new Set<string>();
    for (const { cart } of eligibleCarts) {
      for (const item of cart.items) {
        allProductIds.add(item.productId);
      }
    }

    // Batch fetch product info
    const products = allProductIds.size > 0
      ? await db.product.findMany({
          where: { id: { in: Array.from(allProductIds) } },
          select: { id: true, name: true, imageUrl: true, price: true },
        })
      : [];
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Process in batches
    for (let i = 0; i < eligibleCarts.length; i += BATCH_SIZE) {
      const batch = eligibleCarts.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async ({ cart, user, recoveryStage: nextStage }) => {
        try {
          // FLAW-064 FIX: Check bounce suppression before sending
          const { suppressed } = await shouldSuppressEmail(user.email);
          if (suppressed) {
            return;
          }

          // Build cart items for the email
          const emailItems = cart.items.map((item) => {
            const product = productMap.get(item.productId);
            return {
              name: product?.name || 'Product',
              price: multiply(Number(item.priceAtAdd), item.quantity),
              quantity: item.quantity,
              imageUrl: product?.imageUrl || undefined,
            };
          });

          const cartTotal = emailItems.reduce((sum, item) => add(sum, item.price), 0);

          // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
          const unsubscribeUrl = await generateUnsubscribeUrl(user.email, 'marketing', user.id).catch(() => undefined);

          // Generate email content
          const emailContent = abandonedCartEmail({
            customerName: user.name || 'Client',
            customerEmail: user.email,
            items: emailItems,
            cartTotal,
            locale: (user.locale as 'fr' | 'en') || 'fr',
            unsubscribeUrl,
          });

          const result = await sendEmail({
            to: { email: user.email, name: user.name || undefined },
            subject: emailContent.subject,
            html: emailContent.html,
            tags: ['abandoned-cart', 'automated'],
            unsubscribeUrl,
          });

          // Log to EmailLog with stage-specific templateId
          await db.emailLog.create({
            data: {
              templateId: nextStage.templateId,
              to: user.email,
              subject: emailContent.subject,
              status: result.success ? 'sent' : 'failed',
              error: result.success ? null : 'Send failed',
            },
          }).catch((err: unknown) => logger.error('Failed to create email log', {
            email: user.email,
            error: err instanceof Error ? err.message : String(err),
          }));

          logger.info('Abandoned cart cron: email sent', {
            tenantSlug: tenant.slug,
            email: user.email,
            stage: nextStage.stage,
            templateId: nextStage.templateId,
            itemCount: cart.items.length,
            cartTotal: cartTotal.toFixed(2),
            success: result.success,
          });
        } catch (error) {
          logger.error('Abandoned cart cron: failed for user', {
            tenantSlug: tenant.slug,
            email: user.email,
            error: error instanceof Error ? error.message : String(error),
          });

          await db.emailLog.create({
            data: {
              templateId: nextStage.templateId,
              to: user.email,
              subject: 'Abandoned cart',
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          }).catch((err: unknown) => logger.error('Failed to create email log', {
            email: user.email,
            error: err instanceof Error ? err.message : String(err),
          }));
        }
      });

      await Promise.allSettled(batchPromises);
    }

    // Item 79: SMS recovery for carts abandoned > SMS_DELAY_HOURS ago
    // Only send SMS to users who already received email but haven't converted
    if (ENABLE_SMS_RECOVERY) {
      const smsDelayAgo = new Date(now.getTime() - SMS_DELAY_HOURS * 60 * 60 * 1000);

      // Find users who received abandoned cart email > SMS_DELAY_HOURS ago but no SMS yet
      const emailSentLogs = await db.emailLog.findMany({
        where: {
          templateId: 'abandoned-cart',
          status: 'sent',
          sentAt: {
            gte: fortyEightHoursAgo,
            lte: smsDelayAgo,
          },
        },
        select: { to: true },
      });

      const smsSentLogs = await db.emailLog.findMany({
        where: {
          templateId: 'abandoned-cart-sms',
          status: 'sent',
          sentAt: { gte: fortyEightHoursAgo },
        },
        select: { to: true },
      });
      const alreadySmsSet = new Set(smsSentLogs.map((l) => l.to));

      // FIX: FLAW-074 - Batch-fetch users with phones and recent orders instead of N+1 queries
      const eligibleEmails = emailSentLogs
        .filter((log) => !alreadySmsSet.has(log.to))
        .map((log) => log.to);

      // Batch fetch all users with phones for these emails
      const usersWithPhones = eligibleEmails.length > 0
        ? await db.user.findMany({
            where: { email: { in: eligibleEmails }, phone: { not: null } },
            select: { id: true, email: true, phone: true, locale: true },
          })
        : [];

      // Batch fetch recent orders for all these users
      const userIdsWithPhones = usersWithPhones.map((u) => u.id);
      const recentOrderUsers = userIdsWithPhones.length > 0
        ? await db.order.findMany({
            where: { userId: { in: userIdsWithPhones }, paymentStatus: 'PAID', createdAt: { gte: smsDelayAgo } },
            select: { userId: true },
          })
        : [];
      const usersWithRecentOrders = new Set(recentOrderUsers.map((o) => o.userId));

      for (const user of usersWithPhones) {
        if (usersWithRecentOrders.has(user.id)) continue;

        if (user?.phone) {
          try {
            // Dynamic import to avoid breaking if sms module isn't available
            const { sendSms } = await import('@/lib/sms');
            const isFr = (user.locale || 'fr') !== 'en';
            await sendSms({
              to: user.phone,
              body: isFr
                ? 'Attitudes VIP: Votre panier vous attend! Finalisez votre commande sur attitudes.vip/checkout'
                : 'Attitudes VIP: Your cart is waiting! Complete your order at attitudes.vip/checkout',
            });

            await db.emailLog.create({
              data: {
                templateId: 'abandoned-cart-sms',
                to: user.email,
                subject: 'SMS: abandoned cart recovery',
                status: 'sent',
              },
            }).catch((logErr) => {
              logger.error('[AbandonedCart] Failed to create SMS EmailLog entry:', {
                email: user.email,
                error: logErr instanceof Error ? logErr.message : String(logErr),
              });
            });
          } catch (smsError) {
            logger.error('Abandoned cart SMS failed', {
              email: user.email,
              error: smsError instanceof Error ? smsError.message : String(smsError),
            });
          }
        }
      }
    }
      });

    const duration = Date.now() - startTime;

    logger.info('Abandoned cart cron: job complete', {
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
      logger.error('Abandoned cart cron: job error', {
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
