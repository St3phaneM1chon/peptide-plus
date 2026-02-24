export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';
import { backInStockEmail } from '@/lib/email-templates';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { type Locale } from '@/i18n/config';
import { withJobLock } from '@/lib/cron-lock';
// FLAW-059 FIX: Use structured logger instead of raw console.log/console.error
import { logger } from '@/lib/logger';

/**
 * POST /api/cron/stock-alerts
 * Cron job to process back-in-stock notifications
 *
 * Runs periodically (e.g., every hour) to check products that have pending alerts
 * and are now back in stock. Sends notification emails and marks alerts as notified.
 *
 * Authentication: Requires CRON_SECRET in Authorization header
 */
export async function POST(request: NextRequest) {
  // Verify cron secret (timing-safe comparison)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error('CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Cron secret not configured' },
      { status: 500 }
    );
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch { secretsMatch = false; }

  if (!secretsMatch) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return withJobLock('stock-alerts', async () => {
    try {
      // Find all non-notified alerts
    // PERF 91: Select only needed product fields (name, slug, imageUrl) and
    // only the formats relevant to the alerts instead of ALL formats.
    const pendingAlerts = await prisma.stockAlert.findMany({
      where: {
        notified: false,
      },
      include: {
        product: {
          select: {
            name: true,
            slug: true,
            price: true,
            imageUrl: true,
            formats: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
                stockQuantity: true,
                inStock: true,
              },
            },
          },
        },
      },
      take: 100, // Process in batches of 100
    });

    logger.info(`Found ${pendingAlerts.length} pending stock alerts to process`);

    let processedCount = 0;
    let sentCount = 0;
    let errorCount = 0;

    // Process alerts in batches of 10 to avoid overwhelming email service
    const batchSize = 10;
    for (let i = 0; i < pendingAlerts.length; i += batchSize) {
      const batch = pendingAlerts.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (alert) => {
          try {
            // Determine if product/format is back in stock
            let isBackInStock = false;
            let formatName: string | undefined;
            let price: number = 0;
            let imageUrl: string | undefined;

            if (alert.formatId) {
              // Check specific format
              const format = alert.product.formats.find(f => f.id === alert.formatId);
              if (format && format.stockQuantity > 0 && format.inStock) {
                isBackInStock = true;
                formatName = format.name;
                price = Number(format.price);
                imageUrl = format.imageUrl || alert.product.imageUrl || undefined;
              }
            } else {
              // Check if any format is back in stock
              const anyInStock = alert.product.formats.some(
                f => f.stockQuantity > 0 && f.inStock
              );
              if (anyInStock) {
                isBackInStock = true;
                price = Number(alert.product.price);
                imageUrl = alert.product.imageUrl || undefined;
              }
            }

            processedCount++;

            if (!isBackInStock) {
              // Still out of stock, skip
              return;
            }

            // FIX: FLAW-057 - Look up user locale instead of hardcoding 'en'
            // TODO: FLAW-058 - Add optional userId field to StockAlert model for direct user relation
            let locale: Locale = 'en';
            const alertUser = await prisma.user.findFirst({
              where: { email: alert.email },
              select: { locale: true },
            }).catch(() => null);
            if (alertUser?.locale && (alertUser.locale === 'fr' || alertUser.locale === 'en')) {
              locale = alertUser.locale as Locale;
            }

            // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
            const unsubscribeUrl = await generateUnsubscribeUrl(alert.email, 'marketing').catch(() => undefined);

            const emailTemplate = backInStockEmail(
              {
                productName: alert.product.name,
                productSlug: alert.product.slug,
                formatName,
                price,
                currency: 'CAD',
                imageUrl,
              },
              locale,
              unsubscribeUrl
            );

            const emailResult = await sendEmail({
              to: { email: alert.email },
              subject: emailTemplate.subject,
              html: emailTemplate.html,
              tags: ['stock-alert', 'back-in-stock'],
              unsubscribeUrl,
            });

            if (emailResult.success) {
              // Mark alert as notified
              await prisma.stockAlert.update({
                where: { id: alert.id },
                data: {
                  notified: true,
                  notifiedAt: new Date(),
                },
              });

              sentCount++;
              logger.info(`Sent stock alert to ${alert.email} for product ${alert.product.slug}`);
            } else {
              errorCount++;
              logger.error(
                `Failed to send stock alert to ${alert.email}:`,
                emailResult.error
              );
            }
          } catch (error) {
            errorCount++;
            logger.error(`Error processing alert ${alert.id}:`, error);
          }
        })
      );

      // Small delay between batches to avoid rate limits
      if (i + batchSize < pendingAlerts.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

      return NextResponse.json({
        success: true,
        processed: processedCount,
        sent: sentCount,
        errors: errorCount,
        message: `Processed ${processedCount} alerts, sent ${sentCount} emails, ${errorCount} errors`,
      });
    } catch (error) {
      logger.error('Stock alerts cron error:', error);
      // BE-SEC-04: Don't leak error details in production
      return NextResponse.json(
        {
          error: 'Failed to process stock alerts',
          ...(process.env.NODE_ENV === 'development' ? { details: error instanceof Error ? error.message : 'Unknown error' } : {}),
        },
        { status: 500 }
      );
    }
  });
}

/**
 * GET /api/cron/stock-alerts
 * Health check endpoint
 * FIX: FLAW-011 - Require Authorization header to prevent unauthenticated access
 * to business data (pending/total alert counts).
 */
export async function GET(request: NextRequest) {
  // FIX: FLAW-011 - Add Authorization: Bearer CRON_SECRET check on GET too (timing-safe)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  let getSecretsMatch = false;
  if (cronSecret) {
    const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    try {
      const a = Buffer.from(cronSecret, 'utf8');
      const b = Buffer.from(providedSecret, 'utf8');
      getSecretsMatch = a.length === b.length && timingSafeEqual(a, b);
    } catch { getSecretsMatch = false; }
  }

  if (!getSecretsMatch) {
    // Return minimal health status without sensitive counts for unauthenticated requests
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const pendingCount = await prisma.stockAlert.count({
      where: { notified: false },
    });

    const totalCount = await prisma.stockAlert.count();

    return NextResponse.json({
      status: 'healthy',
      pendingAlerts: pendingCount,
      totalAlerts: totalCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Stock alerts GET health check error:', { error: error instanceof Error ? error.message : String(error) });
    // BE-SEC-04: Don't leak error details in production
    return NextResponse.json(
      {
        status: 'error',
        error: process.env.NODE_ENV === 'development'
          ? (error instanceof Error ? error.message : 'Unknown error')
          : 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
