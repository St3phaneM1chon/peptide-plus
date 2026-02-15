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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, abandonedCartEmail } from '@/lib/email';
import { logger } from '@/lib/logger';

const BATCH_SIZE = 10;
const MIN_ABANDONMENT_MINUTES = 60; // 1 hour minimum
const MAX_ABANDONMENT_HOURS = 48; // Don't email after 48 hours (too late)
const DEDUP_HOURS = 24; // Don't re-send within 24 hours

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret (fail-closed)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();

    // Time window: updated between 1 hour ago and 48 hours ago
    const oneHourAgo = new Date(now.getTime() - MIN_ABANDONMENT_MINUTES * 60 * 1000);
    const fortyEightHoursAgo = new Date(now.getTime() - MAX_ABANDONMENT_HOURS * 60 * 60 * 1000);

    // Find carts with items that were updated within the window and belong to logged-in users
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
      count: abandonedCarts.length,
    });

    // Filter out users who completed an order after their cart was last updated
    // and users who already received an abandoned cart email recently
    const twentyFourHoursAgo = new Date(now.getTime() - DEDUP_HOURS * 60 * 60 * 1000);

    // Get recent abandoned cart email recipients
    const recentEmails = await db.emailLog.findMany({
      where: {
        templateId: 'abandoned-cart',
        status: 'sent',
        sentAt: { gte: twentyFourHoursAgo },
      },
      select: { to: true },
    });
    const recentlyEmailed = new Set(recentEmails.map((e) => e.to));

    // Build list of eligible carts
    const eligibleCarts: Array<{
      cart: (typeof abandonedCarts)[0];
      user: {
        id: string;
        name: string | null;
        email: string;
        locale: string;
      };
    }> = [];

    for (const cart of abandonedCarts) {
      if (!cart.userId) continue;

      // Get user info
      const user = await db.user.findUnique({
        where: { id: cart.userId },
        select: { id: true, name: true, email: true, locale: true },
      });

      if (!user) continue;

      // Skip if already emailed recently
      if (recentlyEmailed.has(user.email)) {
        continue;
      }

      // Check if user completed an order after the cart was last updated
      const orderAfterCart = await db.order.findFirst({
        where: {
          userId: user.id,
          createdAt: { gte: cart.updatedAt },
          paymentStatus: 'PAID',
        },
        select: { id: true },
      });

      if (orderAfterCart) {
        // User already ordered, skip
        continue;
      }

      eligibleCarts.push({ cart, user });
    }

    logger.info('Abandoned cart cron: eligible carts after filtering', {
      eligibleCount: eligibleCarts.length,
    });

    const results: Array<{
      cartId: string;
      userId: string;
      email: string;
      itemCount: number;
      success: boolean;
      messageId?: string;
      error?: string;
    }> = [];

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

      const batchPromises = batch.map(async ({ cart, user }) => {
        try {
          // Build cart items for the email
          const emailItems = cart.items.map((item) => {
            const product = productMap.get(item.productId);
            return {
              name: product?.name || 'Product',
              price: Number(item.priceAtAdd) * item.quantity,
              quantity: item.quantity,
              imageUrl: product?.imageUrl || undefined,
            };
          });

          const cartTotal = emailItems.reduce((sum, item) => sum + item.price, 0);

          // Generate email content
          const emailContent = abandonedCartEmail({
            customerName: user.name || 'Client',
            customerEmail: user.email,
            items: emailItems,
            cartTotal,
            locale: (user.locale as 'fr' | 'en') || 'fr',
          });

          const result = await sendEmail({
            to: { email: user.email, name: user.name || undefined },
            subject: emailContent.subject,
            html: emailContent.html,
            tags: ['abandoned-cart', 'automated'],
          });

          // Log to EmailLog
          await db.emailLog.create({
            data: {
              templateId: 'abandoned-cart',
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
            email: user.email,
            itemCount: cart.items.length,
            cartTotal: cartTotal.toFixed(2),
            success: result.success,
          });

          return {
            cartId: cart.id,
            userId: user.id,
            email: user.email,
            itemCount: cart.items.length,
            success: result.success,
            messageId: result.messageId,
          };
        } catch (error) {
          logger.error('Abandoned cart cron: failed for user', {
            email: user.email,
            error: error instanceof Error ? error.message : String(error),
          });

          await db.emailLog.create({
            data: {
              templateId: 'abandoned-cart',
              to: user.email,
              subject: 'Abandoned cart',
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          }).catch((err: unknown) => logger.error('Failed to create email log', {
            email: user.email,
            error: err instanceof Error ? err.message : String(err),
          }));

          return {
            cartId: cart.id,
            userId: user.id,
            email: user.email,
            itemCount: cart.items.length,
            success: false,
            error: 'Failed to process abandoned cart email',
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

    logger.info('Abandoned cart cron: job complete', {
      totalCarts: abandonedCarts.length,
      eligible: eligibleCarts.length,
      sent: successCount,
      failed: failCount,
      durationMs: duration,
    });

    return NextResponse.json({
      success: true,
      date: now.toISOString(),
      totalCarts: abandonedCarts.length,
      eligible: eligibleCarts.length,
      sent: successCount,
      failed: failCount,
      durationMs: duration,
      results,
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
}

// Allow POST for manual testing
export { GET as POST };
