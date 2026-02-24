export const dynamic = 'force-dynamic';

/**
 * CRON Job - Price Drop Alerts
 * Checks for price drops on watched products and sends email notifications
 *
 * Criteria:
 * - PriceWatch entries where notified=false
 * - Current product price is less than originalPrice (any drop)
 * - OR current price <= targetPrice (if targetPrice is set)
 * - Mark as notified after sending email
 * - Log each email sent
 *
 * Configuration Vercel (vercel.json):
 * Schedule: every 6 hours (0 star-slash-6 star star star)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail, priceDropEmail, generateUnsubscribeUrl } from '@/lib/email';
// FLAW-061 FIX: Import bounce suppression to skip hard-bounced addresses
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';
import { withJobLock } from '@/lib/cron-lock';

const BATCH_SIZE = 10;

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

  return withJobLock('price-drop-alerts', async () => {
    const startTime = Date.now();

    try {
      // PERF 92: Only fetch watches where the product is active, avoiding processing
      // inactive products. The price comparison is done in JS below since Prisma
      // doesn't support cross-field comparisons (currentPrice < originalPrice) in where.
    const priceWatches = await prisma.priceWatch.findMany({
      where: {
        notified: false,
        product: {
          isActive: true,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            locale: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            imageUrl: true,
            isActive: true,
          },
        },
      },
    });

    logger.info('Price drop alerts cron: found active price watches', {
      count: priceWatches.length,
    });

    // Filter watches where price has actually dropped
    const eligibleWatches = priceWatches.filter((watch) => {
      const currentPrice = Number(watch.product.price);
      const originalPrice = Number(watch.originalPrice);
      const targetPrice = watch.targetPrice ? Number(watch.targetPrice) : null;

      // Product must be active
      if (!watch.product.isActive) return false;

      // If target price is set, current price must be <= target
      if (targetPrice !== null) {
        return currentPrice <= targetPrice;
      }

      // Otherwise, any price drop qualifies
      return currentPrice < originalPrice;
    });

    logger.info('Price drop alerts cron: eligible watches after filtering', {
      eligibleCount: eligibleWatches.length,
    });

    const results: Array<{
      watchId: string;
      userId: string;
      productId: string;
      productName: string;
      email: string;
      priceDrop: number;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    // Process in batches
    for (let i = 0; i < eligibleWatches.length; i += BATCH_SIZE) {
      const batch = eligibleWatches.slice(i, i + BATCH_SIZE);

      const batchPromises = batch.map(async (watch) => {
        try {
          // FLAW-061 FIX: Check bounce suppression before sending
          const { suppressed } = await shouldSuppressEmail(watch.user.email);
          if (suppressed) {
            return { watchId: watch.id, userId: watch.user.id, productId: watch.product.id, productName: watch.product.name, email: watch.user.email, priceDrop: 0, success: false, error: 'bounce_suppressed' };
          }

          const currentPrice = Number(watch.product.price);
          const originalPrice = Number(watch.originalPrice);
          const targetPrice = watch.targetPrice ? Number(watch.targetPrice) : undefined;
          const priceDrop = originalPrice - currentPrice;
          const priceDropPercent = (priceDrop / originalPrice) * 100;

          // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
          const unsubscribeUrl = await generateUnsubscribeUrl(watch.user.email, 'marketing', watch.userId).catch(() => undefined);

          // Generate email content
          const emailContent = priceDropEmail({
            customerName: watch.user.name || 'Customer',
            customerEmail: watch.user.email,
            productName: watch.product.name,
            productSlug: watch.product.slug,
            productImageUrl: watch.product.imageUrl || undefined,
            originalPrice,
            currentPrice,
            priceDrop,
            priceDropPercent,
            targetPrice,
            locale: (watch.user.locale as 'fr' | 'en') || 'fr',
            unsubscribeUrl,
          });

          const result = await sendEmail({
            to: { email: watch.user.email, name: watch.user.name || undefined },
            subject: emailContent.subject,
            html: emailContent.html,
            tags: ['price-drop', 'automated'],
            unsubscribeUrl,
          });

          // Mark as notified
          if (result.success) {
            await prisma.priceWatch.update({
              where: { id: watch.id },
              data: {
                notified: true,
                notifiedAt: new Date(),
              },
            });
          }

          // Log to EmailLog
          await prisma.emailLog
            .create({
              data: {
                templateId: 'price-drop-alert',
                to: watch.user.email,
                subject: emailContent.subject,
                status: result.success ? 'sent' : 'failed',
                error: result.success ? null : 'Send failed',
              },
            })
            .catch((err: unknown) =>
              logger.error('Failed to create email log', {
                email: watch.user.email,
                error: err instanceof Error ? err.message : String(err),
              })
            );

          logger.info('Price drop alert: email sent', {
            email: watch.user.email,
            productName: watch.product.name,
            originalPrice: originalPrice.toFixed(2),
            currentPrice: currentPrice.toFixed(2),
            priceDrop: priceDrop.toFixed(2),
            success: result.success,
          });

          return {
            watchId: watch.id,
            userId: watch.user.id,
            productId: watch.product.id,
            productName: watch.product.name,
            email: watch.user.email,
            priceDrop,
            success: result.success,
            messageId: result.messageId,
          };
        } catch (error) {
          logger.error('Price drop alert: failed for watch', {
            watchId: watch.id,
            email: watch.user.email,
            error: error instanceof Error ? error.message : String(error),
          });

          await prisma.emailLog
            .create({
              data: {
                templateId: 'price-drop-alert',
                to: watch.user.email,
                subject: 'Price drop alert',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            })
            .catch((err: unknown) =>
              logger.error('Failed to create email log', {
                email: watch.user.email,
                error: err instanceof Error ? err.message : String(err),
              })
            );

          return {
            watchId: watch.id,
            userId: watch.user.id,
            productId: watch.product.id,
            productName: watch.product.name,
            email: watch.user.email,
            priceDrop: 0,
            success: false,
            error: 'Failed to send price drop alert',
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

    logger.info('Price drop alerts cron: job complete', {
      totalWatches: priceWatches.length,
      eligible: eligibleWatches.length,
      sent: successCount,
      failed: failCount,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
      totalWatches: priceWatches.length,
      eligible: eligibleWatches.length,
      sent: successCount,
      failed: failCount,
      durationMs: duration,
      results,
    });
    } catch (error) {
      logger.error('Price drop alerts cron: job error', {
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
