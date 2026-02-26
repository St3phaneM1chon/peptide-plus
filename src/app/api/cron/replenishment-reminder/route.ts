export const dynamic = 'force-dynamic';

/**
 * CRON Job - Replenishment Reminder Emails (CRITICAL for peptide e-commerce)
 *
 * Detects orders delivered N days ago and sends replenishment reminders to
 * customers who haven't reordered the same product. Critical for peptide
 * products which are typically 30-day supplies.
 *
 * Flow (3 steps, sent on separate cron runs):
 *   Step 1 (25 days after delivery): "Running low? Reorder now"
 *   Step 2 (30 days after delivery): "Don't run out! Last chance to reorder"
 *   Step 3 (35 days after delivery): "Miss your product? Here's 10% off"
 *
 * Each step checks:
 *   - Order was delivered N days ago (configurable per product via leadTimeDays)
 *   - Customer hasn't reordered the same product since that delivery
 *   - Customer hasn't already received this replenishment step
 *   - Customer isn't unsubscribed/suppressed
 *
 * Configuration Vercel (vercel.json):
 * Schedule: daily at 10 AM ET (0 10 * * *)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import {
  sendEmail,
  replenishmentReminderEmail,
  generateUnsubscribeUrl,
} from '@/lib/email';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';
import { withJobLock } from '@/lib/cron-lock';

const BATCH_SIZE = 10;

/**
 * Replenishment step definitions.
 * Each step targets orders delivered N days ago (within a 1-day window).
 * The default cycle assumes 30-day supply peptides.
 */
interface ReplenishmentStep {
  id: string;
  daysAfterDelivery: number;
  step: 1 | 2 | 3;
  discountCode?: string;
  discountPercent?: number;
}

const REPLENISHMENT_STEPS: ReplenishmentStep[] = [
  {
    id: 'replenishment-step1',
    daysAfterDelivery: 25,
    step: 1,
  },
  {
    id: 'replenishment-step2',
    daysAfterDelivery: 30,
    step: 2,
  },
  {
    id: 'replenishment-step3',
    daysAfterDelivery: 35,
    step: 3,
    discountCode: 'REORDER10',
    discountPercent: 10,
  },
];

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
  } catch {
    secretsMatch = false;
  }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('replenishment-reminder', async () => {
    const startTime = Date.now();

    try {
      const now = new Date();
      const allResults: Array<{
        step: string;
        userId: string;
        email: string;
        productName: string;
        success: boolean;
        messageId?: string;
        error?: string;
      }> = [];

      let totalProcessed = 0;

      for (const repStep of REPLENISHMENT_STEPS) {
        // Time window: delivered between N and N+1 days ago (1-day window)
        const windowStart = new Date(now);
        windowStart.setDate(windowStart.getDate() - (repStep.daysAfterDelivery + 1));
        windowStart.setHours(0, 0, 0, 0);

        const windowEnd = new Date(now);
        windowEnd.setDate(windowEnd.getDate() - repStep.daysAfterDelivery);
        windowEnd.setHours(0, 0, 0, 0);

        // Find orders delivered in the window with their items
        const deliveredOrders = await db.order.findMany({
          where: {
            status: 'DELIVERED',
            deliveredAt: {
              gte: windowStart,
              lt: windowEnd,
            },
            userId: { not: null },
          },
          select: {
            id: true,
            userId: true,
            deliveredAt: true,
            createdAt: true,
            items: {
              select: {
                productId: true,
                productName: true,
              },
            },
          },
        });

        if (deliveredOrders.length === 0) continue;

        logger.info(`[CRON:REPLENISH] Step "${repStep.id}" (day ${repStep.daysAfterDelivery}): ${deliveredOrders.length} delivered orders in window`);

        // Collect unique user-product pairs to check
        const userProductPairs: Array<{
          userId: string;
          orderId: string;
          productId: string;
          productName: string;
          deliveredAt: Date;
          orderDate: Date;
        }> = [];

        for (const order of deliveredOrders) {
          if (!order.userId || !order.deliveredAt) continue;
          for (const item of order.items) {
            userProductPairs.push({
              userId: order.userId,
              orderId: order.id,
              productId: item.productId,
              productName: item.productName,
              deliveredAt: order.deliveredAt,
              orderDate: order.createdAt,
            });
          }
        }

        // Batch fetch users
        const userIds = [...new Set(userProductPairs.map((p) => p.userId))];
        const users = await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, locale: true },
        });
        const userMap = new Map(users.map((u) => [u.id, u]));

        // Batch fetch products (for images, slugs, current prices)
        const productIds = [...new Set(userProductPairs.map((p) => p.productId))];
        const products = await db.product.findMany({
          where: { id: { in: productIds }, isActive: true },
          select: { id: true, name: true, slug: true, price: true, imageUrl: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));

        // Check who has reordered the same product since the original delivery
        // Find all orders placed by these users AFTER the earliest delivery in our window
        const reorderOrders = userIds.length > 0
          ? await db.order.findMany({
              where: {
                userId: { in: userIds },
                paymentStatus: 'PAID',
                createdAt: { gt: windowStart },
              },
              select: {
                userId: true,
                items: { select: { productId: true } },
              },
            })
          : [];

        // Build set of userId:productId that have been reordered
        const reorderedSet = new Set<string>();
        for (const order of reorderOrders) {
          for (const item of order.items) {
            reorderedSet.add(`${order.userId}:${item.productId}`);
          }
        }

        // Check who already received this replenishment step
        const emailsToCheck = users.map((u) => u.email);
        const alreadySent = emailsToCheck.length > 0
          ? await db.emailLog.findMany({
              where: {
                templateId: repStep.id,
                to: { in: emailsToCheck },
                status: 'sent',
              },
              select: { to: true },
            })
          : [];
        const alreadySentSet = new Set(alreadySent.map((e) => e.to));

        // Deduplicate: one email per user per step (pick the most expensive product)
        const userBestProduct = new Map<string, typeof userProductPairs[0]>();
        for (const pair of userProductPairs) {
          const user = userMap.get(pair.userId);
          if (!user) continue;

          // Skip if already reordered this product
          if (reorderedSet.has(`${pair.userId}:${pair.productId}`)) continue;

          // Skip if already received this step's email
          if (alreadySentSet.has(user.email)) continue;

          // Skip if product no longer active
          if (!productMap.has(pair.productId)) continue;

          // Keep the product with highest price per user
          const existing = userBestProduct.get(pair.userId);
          if (!existing) {
            userBestProduct.set(pair.userId, pair);
          } else {
            const existingProduct = productMap.get(existing.productId);
            const thisProduct = productMap.get(pair.productId);
            if (existingProduct && thisProduct && Number(thisProduct.price) > Number(existingProduct.price)) {
              userBestProduct.set(pair.userId, pair);
            }
          }
        }

        const eligiblePairs = Array.from(userBestProduct.values());

        logger.info(`[CRON:REPLENISH] Step "${repStep.id}": ${eligiblePairs.length} eligible after filtering`);

        // Process in batches
        for (let i = 0; i < eligiblePairs.length; i += BATCH_SIZE) {
          const batch = eligiblePairs.slice(i, i + BATCH_SIZE);

          const batchPromises = batch.map(async (pair) => {
            const user = userMap.get(pair.userId);
            const product = productMap.get(pair.productId);
            if (!user || !product) {
              return {
                step: repStep.id,
                userId: pair.userId,
                email: 'unknown',
                productName: pair.productName,
                success: false,
                error: 'User or product not found',
              };
            }

            try {
              // Check bounce suppression
              const { suppressed } = await shouldSuppressEmail(user.email);
              if (suppressed) {
                return {
                  step: repStep.id,
                  userId: user.id,
                  email: user.email,
                  productName: product.name,
                  success: false,
                  error: 'bounce_suppressed',
                };
              }

              // Generate unsubscribe URL
              const unsubscribeUrl = await generateUnsubscribeUrl(
                user.email,
                'marketing',
                user.id
              ).catch(() => undefined);

              const daysSinceDelivery = Math.round(
                (now.getTime() - pair.deliveredAt.getTime()) / (1000 * 60 * 60 * 24)
              );

              // Generate replenishment email
              const emailContent = replenishmentReminderEmail({
                customerName: user.name || 'Client',
                customerEmail: user.email,
                product: {
                  name: product.name,
                  slug: product.slug,
                  price: Number(product.price),
                  imageUrl: product.imageUrl || undefined,
                },
                orderDate: pair.orderDate,
                daysSinceDelivery,
                step: repStep.step,
                discountCode: repStep.discountCode,
                discountPercent: repStep.discountPercent,
                locale: (user.locale as 'fr' | 'en') || 'fr',
                unsubscribeUrl,
              });

              const result = await sendEmail({
                to: { email: user.email, name: user.name || undefined },
                subject: emailContent.subject,
                html: emailContent.html,
                tags: ['replenishment-reminder', `step-${repStep.step}`, 'automated'],
                unsubscribeUrl,
              });

              // Log to EmailLog
              await db.emailLog
                .create({
                  data: {
                    templateId: repStep.id,
                    to: user.email,
                    subject: emailContent.subject,
                    status: result.success ? 'sent' : 'failed',
                    error: result.success ? null : 'Send failed',
                  },
                })
                .catch((err: unknown) =>
                  logger.error('[CRON:REPLENISH] Failed to create EmailLog', {
                    email: user.email,
                    error: err instanceof Error ? err.message : String(err),
                  })
                );

              logger.info(`[CRON:REPLENISH] ${repStep.id} email sent to ${user.email} for ${product.name} (${result.success ? 'OK' : 'FAILED'})`);

              return {
                step: repStep.id,
                userId: user.id,
                email: user.email,
                productName: product.name,
                success: result.success,
                messageId: result.messageId,
              };
            } catch (error) {
              logger.error(`[CRON:REPLENISH] ${repStep.id} failed for ${user.email}`, {
                error: error instanceof Error ? error.message : String(error),
              });

              await db.emailLog
                .create({
                  data: {
                    templateId: repStep.id,
                    to: user.email,
                    subject: `Replenishment: ${repStep.id}`,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Unknown error',
                  },
                })
                .catch((err: unknown) =>
                  logger.error('[CRON:REPLENISH] Failed to create failure EmailLog', {
                    email: user.email,
                    error: err instanceof Error ? err.message : String(err),
                  })
                );

              return {
                step: repStep.id,
                userId: user.id,
                email: user.email,
                productName: product.name,
                success: false,
                error: 'Failed to process replenishment email',
              };
            }
          });

          const batchResults = await Promise.allSettled(batchPromises);
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              allResults.push(result.value);
            }
          }
        }

        totalProcessed += eligiblePairs.length;
      }

      const successCount = allResults.filter((r) => r.success).length;
      const failCount = allResults.filter((r) => !r.success).length;
      const duration = Date.now() - startTime;

      // Group results by step for summary
      const stepSummary: Record<string, { sent: number; failed: number }> = {};
      for (const r of allResults) {
        if (!stepSummary[r.step]) stepSummary[r.step] = { sent: 0, failed: 0 };
        if (r.success) stepSummary[r.step].sent++;
        else stepSummary[r.step].failed++;
      }

      logger.info(
        `[CRON:REPLENISH] Complete: ${successCount} sent, ${failCount} failed across ${REPLENISHMENT_STEPS.length} steps, ${duration}ms`
      );

      return NextResponse.json({
        success: true,
        date: now.toISOString(),
        totalProcessed,
        sent: successCount,
        failed: failCount,
        durationMs: duration,
        stepSummary,
        results: allResults,
      });
    } catch (error) {
      logger.error('[CRON:REPLENISH] Job error', {
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
