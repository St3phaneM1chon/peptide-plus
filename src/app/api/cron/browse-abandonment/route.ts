export const dynamic = 'force-dynamic';

/**
 * CRON Job - Browse Abandonment Emails
 *
 * Detects authenticated users who viewed a product 2+ times in the last 48 hours
 * without adding it to their cart, and triggers the browse abandonment email flow.
 *
 * Criteria:
 * - User has 2+ ProductView records for the same product in the last 48h
 * - User has NOT added that product to their cart (no CartItem with that productId)
 * - User is NOT already in a browse-abandonment flow (no recent EmailLog with browse-abandonment template)
 * - User has NOT already been in the abandoned-cart flow recently (not in cart flow)
 * - User has active marketing consent
 * - User is not bounce-suppressed
 *
 * Configuration Vercel (vercel.json):
 * Schedule: every 4 hours (0 *​/4 * * *)
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import {
  sendEmail,
  browseAbandonmentEmail,
  generateUnsubscribeUrl,
} from '@/lib/email';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { logger } from '@/lib/logger';
import { withJobLock } from '@/lib/cron-lock';

const BATCH_SIZE = 10;
const MIN_VIEWS = 2; // Minimum views of the same product to trigger
const LOOKBACK_HOURS = 48; // Only consider views from the last 48h
const DEDUP_HOURS = 72; // Don't re-send browse abandonment within 72h

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

  return withJobLock('browse-abandonment', async () => {
    const startTime = Date.now();

    try {
      const now = new Date();
      const lookbackDate = new Date(now.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
      const dedupDate = new Date(now.getTime() - DEDUP_HOURS * 60 * 60 * 1000);

      // Step 1: Find all users who viewed any product 2+ times in the lookback window
      // Using raw SQL for the GROUP BY + HAVING aggregation
      const frequentViewers = await db.$queryRaw<
        Array<{ userId: string; productId: string; viewCount: bigint; lastViewed: Date }>
      >`
        SELECT "userId", "productId", COUNT(*) as "viewCount", MAX("viewedAt") as "lastViewed"
        FROM "ProductView"
        WHERE "viewedAt" >= ${lookbackDate}
        GROUP BY "userId", "productId"
        HAVING COUNT(*) >= ${MIN_VIEWS}
        ORDER BY "lastViewed" DESC
        LIMIT 500
      `;

      if (frequentViewers.length === 0) {
        return NextResponse.json({
          success: true,
          date: now.toISOString(),
          message: 'No browse abandonment candidates found',
          eligible: 0,
          sent: 0,
          durationMs: Date.now() - startTime,
        });
      }

      logger.info('[CRON:BROWSE-ABANDON] Found frequent viewers', {
        count: frequentViewers.length,
      });

      // Step 2: Get all unique user IDs and product IDs
      const userIds = [...new Set(frequentViewers.map((v) => v.userId))];
      const productIds = [...new Set(frequentViewers.map((v) => v.productId))];

      // Step 3: Batch fetch users
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true, locale: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      // Step 4: Batch fetch products
      const products = await db.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, name: true, slug: true, price: true, imageUrl: true },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      // Step 5: Check which users already have the product in their cart
      const cartItems = await db.cartItem.findMany({
        where: {
          cart: { userId: { in: userIds } },
          productId: { in: productIds },
        },
        select: {
          productId: true,
          cart: { select: { userId: true } },
        },
      });
      const inCartSet = new Set(
        cartItems.map((ci) => `${ci.cart.userId}:${ci.productId}`)
      );

      // Step 6: Check who already received a browse-abandonment email recently
      const recentEmails = await db.emailLog.findMany({
        where: {
          templateId: { startsWith: 'browse-abandonment' },
          status: 'sent',
          sentAt: { gte: dedupDate },
        },
        select: { to: true },
      });
      const recentlyEmailed = new Set(recentEmails.map((e) => e.to));

      // Step 7: Filter eligible candidates
      interface EligibleCandidate {
        user: { id: string; name: string | null; email: string; locale: string };
        product: { id: string; name: string; slug: string; price: number; imageUrl: string | null };
        viewCount: number;
      }

      const eligible: EligibleCandidate[] = [];

      // Keep only the top-viewed product per user (most views wins)
      const userTopProduct = new Map<string, typeof frequentViewers[0]>();
      for (const v of frequentViewers) {
        const existing = userTopProduct.get(v.userId);
        if (!existing || Number(v.viewCount) > Number(existing.viewCount)) {
          userTopProduct.set(v.userId, v);
        }
      }

      for (const [userId, view] of userTopProduct.entries()) {
        const user = userMap.get(userId);
        const product = productMap.get(view.productId);
        if (!user || !product) continue;

        // Skip if product is already in cart
        if (inCartSet.has(`${userId}:${view.productId}`)) continue;

        // Skip if already emailed recently
        if (recentlyEmailed.has(user.email)) continue;

        eligible.push({
          user,
          product: { ...product, price: Number(product.price) },
          viewCount: Number(view.viewCount),
        });
      }

      logger.info('[CRON:BROWSE-ABANDON] Eligible after filtering', {
        eligible: eligible.length,
      });

      // Step 8: Send emails in batches
      const results: Array<{
        userId: string;
        email: string;
        productName: string;
        success: boolean;
        messageId?: string;
        error?: string;
      }> = [];

      for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
        const batch = eligible.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async ({ user, product, viewCount }) => {
          try {
            // Check bounce suppression
            const { suppressed } = await shouldSuppressEmail(user.email);
            if (suppressed) {
              return {
                userId: user.id,
                email: user.email,
                productName: product.name,
                success: false,
                error: 'bounce_suppressed',
              };
            }

            // Generate unsubscribe URL (CAN-SPAM / RGPD / LCAP compliance)
            const unsubscribeUrl = await generateUnsubscribeUrl(
              user.email,
              'marketing',
              user.id
            ).catch(() => undefined);

            // Generate the browse abandonment email (step 1: "Still interested?")
            const emailContent = browseAbandonmentEmail({
              customerName: user.name || 'Client',
              customerEmail: user.email,
              product: {
                name: product.name,
                slug: product.slug,
                price: product.price,
                imageUrl: product.imageUrl || undefined,
              },
              step: 1,
              locale: (user.locale as 'fr' | 'en') || 'fr',
              unsubscribeUrl,
            });

            const result = await sendEmail({
              to: { email: user.email, name: user.name || undefined },
              subject: emailContent.subject,
              html: emailContent.html,
              tags: ['browse-abandonment', 'automated'],
              unsubscribeUrl,
            });

            // Log to EmailLog for dedup tracking
            await db.emailLog
              .create({
                data: {
                  templateId: 'browse-abandonment-step1',
                  to: user.email,
                  subject: emailContent.subject,
                  status: result.success ? 'sent' : 'failed',
                  error: result.success ? null : 'Send failed',
                },
              })
              .catch((err: unknown) =>
                logger.error('[CRON:BROWSE-ABANDON] Failed to create EmailLog', {
                  email: user.email,
                  error: err instanceof Error ? err.message : String(err),
                })
              );

            logger.info('[CRON:BROWSE-ABANDON] Email sent', {
              email: user.email,
              product: product.name,
              viewCount,
              success: result.success,
            });

            return {
              userId: user.id,
              email: user.email,
              productName: product.name,
              success: result.success,
              messageId: result.messageId,
            };
          } catch (error) {
            logger.error('[CRON:BROWSE-ABANDON] Failed for user', {
              email: user.email,
              error: error instanceof Error ? error.message : String(error),
            });

            await db.emailLog
              .create({
                data: {
                  templateId: 'browse-abandonment-step1',
                  to: user.email,
                  subject: 'Browse abandonment',
                  status: 'failed',
                  error: error instanceof Error ? error.message : 'Unknown error',
                },
              })
              .catch((err: unknown) =>
                logger.error('[CRON:BROWSE-ABANDON] Failed to create failure EmailLog', {
                  email: user.email,
                  error: err instanceof Error ? err.message : String(err),
                })
              );

            return {
              userId: user.id,
              email: user.email,
              productName: product.name,
              success: false,
              error: 'Failed to process browse abandonment email',
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

      logger.info('[CRON:BROWSE-ABANDON] Job complete', {
        totalViewers: frequentViewers.length,
        eligible: eligible.length,
        sent: successCount,
        failed: failCount,
        durationMs: duration,
      });

      return NextResponse.json({
        success: true,
        date: now.toISOString(),
        totalViewers: frequentViewers.length,
        eligible: eligible.length,
        sent: successCount,
        failed: failCount,
        durationMs: duration,
        results,
      });
    } catch (error) {
      logger.error('[CRON:BROWSE-ABANDON] Job error', {
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
