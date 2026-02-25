export const dynamic = 'force-dynamic';

/**
 * Webhook Stripe - Traitement des evenements de paiement
 * Avec idempotence, creation comptable automatique, et envoi d'emails
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { sendEmail, orderConfirmationEmail, generateUnsubscribeUrl, type OrderData } from '@/lib/email';
import { createAccountingEntriesForOrder } from '@/lib/accounting/webhook-accounting.service';
import { generateCOGSEntry } from '@/lib/inventory';
import { qualifyReferral } from '@/lib/referral-qualify';
import { logger } from '@/lib/logger';
import { sendOrderNotificationSms, sendPaymentFailureAlertSms } from '@/lib/sms';
import { sanitizeWebhookPayload } from '@/lib/sanitize';
import { getRedisClient, isRedisAvailable } from '@/lib/redis';
import { clawbackAmbassadorCommission } from '@/lib/ambassador-commission';
import { STRIPE_API_VERSION } from '@/lib/stripe';
import { calculatePurchasePoints } from '@/lib/constants';

// Lazy-initialized Stripe client to avoid crashing during Next.js build/SSG
// when STRIPE_SECRET_KEY is not available in the CI environment.
// See KB-PP-BUILD-002 in deployment-azure.md.
let _stripeWebhook: Stripe | null = null;

function getStripeWebhook(): Stripe {
  if (!_stripeWebhook) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    _stripeWebhook = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return _stripeWebhook;
}

function getWebhookSecret(): string {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('STRIPE_WEBHOOK_SECRET is required');
  }
  return process.env.STRIPE_WEBHOOK_SECRET;
}

// ---------------------------------------------------------------------------
// Event Deduplication (in-memory + Redis)
// ---------------------------------------------------------------------------

/**
 * In-memory LRU cache for rapid deduplication of recently-seen event IDs.
 * Prevents duplicate processing even before hitting the database.
 * Entries auto-expire after 10 minutes (Map insertion order).
 */
const DEDUP_CACHE_MAX = 5000;
const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const recentEventIds = new Map<string, number>(); // eventId -> timestamp

function isDuplicateInMemory(eventId: string): boolean {
  const ts = recentEventIds.get(eventId);
  if (ts && Date.now() - ts < DEDUP_TTL_MS) {
    return true;
  }
  return false;
}

function markEventProcessed(eventId: string): void {
  // Evict oldest entries if cache is full
  if (recentEventIds.size >= DEDUP_CACHE_MAX) {
    const firstKey = recentEventIds.keys().next().value;
    if (firstKey) recentEventIds.delete(firstKey);
  }
  recentEventIds.set(eventId, Date.now());
}

/**
 * Check dedup in Redis (SET-based) for distributed environments.
 * Returns true if the event was already seen.
 */
async function isDuplicateInRedis(eventId: string): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  try {
    const redis = await getRedisClient();
    if (!redis) return false;
    const key = `webhook:dedup:${eventId}`;
    const exists = await redis.get(key);
    return exists !== null;
  } catch (error) {
    logger.error('[Webhook] Redis duplicate check failed, falling through', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

async function markEventInRedis(eventId: string): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    const key = `webhook:dedup:${eventId}`;
    // Store with 1-hour TTL
    await redis.set(key, '1', 'EX', 3600);
  } catch (error) {
    logger.error('[Webhook] Redis mark event failed (in-memory dedup is primary)', { error: error instanceof Error ? error.message : String(error) });
  }
}

// ---------------------------------------------------------------------------
// Raw Payload Storage for Replay
// ---------------------------------------------------------------------------

/**
 * Store the raw webhook payload for potential replay.
 * Stored alongside the WebhookEvent record.
 */
async function storeRawPayload(eventId: string, rawBody: string): Promise<void> {
  try {
    await prisma.webhookEvent.update({
      where: { eventId },
      data: { payload: rawBody.slice(0, 50000) }, // Truncate for safety
    });
  } catch (error) {
    logger.error('[Webhook] Raw payload storage failed (non-critical)', { eventId, error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Check idempotence: if this event was already processed, return true
 */
async function checkIdempotence(eventId: string): Promise<boolean> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { eventId },
  });
  return existing?.status === 'COMPLETED';
}

/**
 * Record webhook event for idempotence tracking
 */
async function recordWebhookEvent(eventId: string, eventType: string, payload?: string) {
  return prisma.webhookEvent.upsert({
    where: { eventId },
    update: { status: 'PROCESSING' },
    create: {
      eventId,
      provider: 'stripe',
      eventType,
      status: 'PROCESSING',
      payload,
    },
  });
}

/**
 * Mark webhook event as completed
 */
async function completeWebhookEvent(eventId: string, orderId?: string, journalEntryId?: string) {
  await prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status: 'COMPLETED',
      orderId,
      journalEntryId,
      processedAt: new Date(),
    },
  });
}

/**
 * Mark webhook event as failed, with retry tracking (item 72)
 *
 * Item 72: Webhook retry mechanism
 * Failed webhook events are recorded with status='FAILED' and can be retried.
 * The errorMessage contains the failure reason for diagnosis.
 *
 * Retry strategy (to be executed by cron or admin action):
 *   - Track retry attempts via the errorMessage prefix: "[Retry N]"
 *   - Max 3 retries with exponential backoff: 5min, 15min, 45min
 *   - After max retries, mark as permanently failed and alert admin
 *
 * TODO (item 72): Implement automatic retry execution via:
 *   a) A cron job at /api/cron/retry-webhooks (recommended) that runs every 5 minutes:
 *      - Query: SELECT * FROM "WebhookEvent" WHERE status='FAILED'
 *        AND "processedAt" < NOW() - INTERVAL '5 minutes'
 *        AND ("errorMessage" NOT LIKE '[Retry 3]%')
 *      - For each event: parse payload, reprocess the event, increment retry count
 *      - Exponential backoff: only retry if processedAt + backoff_interval < NOW()
 *   b) Add a retryCount Int @default(0) field to WebhookEvent model
 *   c) Admin UI button to manually retry a specific failed webhook event
 *   d) After max retries exhausted, send admin notification (email/Slack)
 *   e) Dashboard showing failed webhook events with retry status
 */
async function failWebhookEvent(eventId: string, errorMessage: string) {
  await prisma.webhookEvent.update({
    where: { eventId },
    data: {
      status: 'FAILED',
      errorMessage,
      processedAt: new Date(),
    },
  });

  logger.warn('Webhook event failed - eligible for retry', {
    eventId,
    error: errorMessage,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = getStripeWebhook().webhooks.constructEvent(body, signature, getWebhookSecret());
    } catch (err) {
      logger.error('Webhook signature verification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Fast dedup layer: in-memory check (no DB hit for recent duplicates)
    if (isDuplicateInMemory(event.id)) {
      logger.info('Webhook duplicate (in-memory)', { eventId: event.id, eventType: event.type });
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Redis dedup layer (distributed environments)
    if (await isDuplicateInRedis(event.id)) {
      logger.info('Webhook duplicate (Redis)', { eventId: event.id, eventType: event.type });
      markEventProcessed(event.id); // also populate memory cache
      return NextResponse.json({ received: true, duplicate: true });
    }

    // DB-level idempotence check: if already processed, return 200 immediately
    if (await checkIdempotence(event.id)) {
      logger.info('Webhook already processed, skipping', { eventId: event.id });
      markEventProcessed(event.id);
      await markEventInRedis(event.id);
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Record the event (BE-SEC-20: sanitize PCI/PII data before storing)
    const sanitizedPayload = sanitizeWebhookPayload(event.data.object);
    await recordWebhookEvent(event.id, event.type, JSON.stringify(sanitizedPayload).slice(0, 5000));

    // Store raw payload for potential replay (non-blocking)
    storeRawPayload(event.id, body).catch((err) => logger.error('Webhook payload storage failed', { error: err instanceof Error ? err.message : String(err) }));

    try {
      // Process the event
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutComplete(session, event.id);
          break;
        }

        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentSuccess(paymentIntent);
          await completeWebhookEvent(event.id);
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await handlePaymentFailure(paymentIntent);
          await completeWebhookEvent(event.id);
          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          await handleRefund(charge, event.id);
          break;
        }

        default:
          logger.info('Unhandled event type', { eventType: event.type });
          await completeWebhookEvent(event.id);
      }

      // Mark event in dedup caches after successful processing
      markEventProcessed(event.id);
      await markEventInRedis(event.id);

      return NextResponse.json({ received: true });
    } catch (processError) {
      const errorMsg = processError instanceof Error ? processError.message : 'Unknown error';
      logger.error('Webhook processing error', {
        eventId: event.id,
        eventType: event.type,
        error: errorMsg,
      });
      await failWebhookEvent(event.id, errorMsg);
      return NextResponse.json(
        { error: 'Webhook handler failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Webhook error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session, eventId: string) {
  logger.info('Checkout session completed', { sessionId: session.id });

  const metadata = session.metadata || {};
  const { userId, shippingAddress } = metadata;
  const shipping = shippingAddress ? JSON.parse(shippingAddress) : null;

  // Extract tax breakdown from metadata (set during create-checkout)
  const taxTps = parseFloat(metadata.taxTps || '0');
  const taxTvq = parseFloat(metadata.taxTvq || '0');
  const taxTvh = parseFloat(metadata.taxTvh || '0');
  const taxPst = parseFloat(metadata.taxPst || '0');
  const cartItems = metadata.cartItems ? JSON.parse(metadata.cartItems) : [];
  const promoCode = metadata.promoCode || null;
  const promoDiscount = parseFloat(metadata.promoDiscount || '0');
  const shippingCost = parseFloat(metadata.shippingCost || '0');
  const subtotal = parseFloat(metadata.subtotal || '0');
  // BE-PAY-04: Gift card info from checkout metadata
  const giftCardCode = metadata.giftCardCode || null;
  const giftCardDiscount = parseFloat(metadata.giftCardDiscount || '0');

  // Multi-currency: retrieve currency info from checkout metadata
  const checkoutCurrencyId = metadata.currencyId;
  const checkoutExchangeRate = parseFloat(metadata.exchangeRate || '1');

  // Find currency: prefer the ID stored at checkout time, then fall back to code lookup
  let currency = checkoutCurrencyId
    ? await prisma.currency.findUnique({ where: { id: checkoutCurrencyId } })
    : null;

  if (!currency) {
    const currencyCode = metadata.currencyCode || session.currency?.toUpperCase() || 'CAD';
    currency = await prisma.currency.findUnique({
      where: { code: currencyCode },
    });
  }

  if (!currency) {
    currency = await prisma.currency.create({
      data: {
        code: session.currency?.toUpperCase() || 'CAD',
        name: session.currency?.toUpperCase() === 'USD' ? 'US Dollar' : 'Dollar canadien',
        symbol: '$',
        exchangeRate: 1,
      },
    });
  }

  // Amounts in metadata are always in CAD (base currency).
  // Stripe charged the user in the selected currency, but we
  // record accounting values in CAD for consistency.
  const stripeSubtotal = subtotal || (session.amount_subtotal || 0) / 100;
  const stripeTotal = (session.amount_total || 0) / 100;
  const totalTax = taxTps + taxTvq + taxTvh + taxPst;

  // If the order was placed in a foreign currency, the Stripe total
  // is in that currency. We still record the CAD amounts from metadata
  // for accounting, plus the exchange rate used at checkout time.
  const cadTotal = subtotal
    ? subtotal - promoDiscount - giftCardDiscount + totalTax + shippingCost
    : stripeTotal; // fallback

  // BUG 15: Declare orderNumber before transaction so it's accessible outside
  let orderNumber = '';

  // Create the order with items in a transaction
  const order = await prisma.$transaction(async (tx) => {
    // Atomic order number generation with advisory lock (prevents duplicates even on empty table)
    // E-01 FIX: pg_advisory_xact_lock serializes order number generation across all transactions.
    // Unlike FOR UPDATE, this works even when no rows exist yet (e.g., first order of a new year).
    const year = new Date().getFullYear();
    const prefix = `PP-${year}-`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(42)`;
    const lastRows = await tx.$queryRaw<{ order_number: string }[]>`
      SELECT "orderNumber" as order_number FROM "Order"
      WHERE "orderNumber" LIKE ${prefix + '%'}
      ORDER BY "orderNumber" DESC
      LIMIT 1
    `;
    const lastNum = lastRows.length > 0
      ? parseInt(lastRows[0].order_number.replace(prefix, ''), 10)
      : 0;
    orderNumber = `${prefix}${String(lastNum + 1).padStart(6, '0')}`;

    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        userId: userId && userId !== 'guest' ? userId : `guest-${session.id}`,
        subtotal: stripeSubtotal,
        shippingCost,
        discount: promoDiscount + giftCardDiscount,
        tax: totalTax,
        taxTps,
        taxTvq,
        taxTvh,
        taxPst,
        total: cadTotal,
        currencyId: currency!.id,
        exchangeRate: checkoutExchangeRate,
        paymentMethod: 'STRIPE_CARD',
        paymentStatus: 'PAID',
        status: 'CONFIRMED',
        stripePaymentId: session.payment_intent as string,
        promoCode,
        promoDiscount: promoDiscount || null,
        shippingName: shipping ? `${shipping.firstName} ${shipping.lastName}` : '',
        shippingAddress1: shipping?.address || '',
        shippingAddress2: shipping?.apartment || null,
        shippingCity: shipping?.city || '',
        shippingState: shipping?.province || '',
        shippingPostal: shipping?.postalCode || '',
        shippingCountry: shipping?.country || 'CA',
        shippingPhone: shipping?.phone || null,
        items: cartItems.length > 0 ? {
          create: cartItems.map((item: Record<string, unknown>) => ({
            productId: item.productId,
            formatId: item.formatId || null,
            productName: item.name,
            formatName: item.formatName || null,
            sku: item.sku || null,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount || 0,
            total: Number(item.price) * Number(item.quantity) - (Number(item.discount) || 0),
          })),
        } : undefined,
      },
    });

    // Consume inventory reservations if they exist
    const reservations = await tx.inventoryReservation.findMany({
      where: {
        cartId: metadata.cartId || undefined,
        status: 'RESERVED',
      },
    });

    if (reservations.length > 0) {
      // N+1 FIX: Batch-update all reservation statuses
      await tx.inventoryReservation.updateMany({
        where: { id: { in: reservations.map(r => r.id) } },
        data: { status: 'CONSUMED', orderId: newOrder.id, consumedAt: new Date() },
      });

      // N+1 FIX: Batch-fetch latest WAC for all unique (productId, formatId) combos
      const wacKeys = reservations.map(r => ({ productId: r.productId, formatId: r.formatId }));
      const uniqueWacKeys = [...new Map(wacKeys.map(k => [`${k.productId}-${k.formatId}`, k])).values()];
      const wacMap = new Map<string, number>();
      if (uniqueWacKeys.length > 0) {
        for (const key of uniqueWacKeys) {
          const lastTx = await tx.inventoryTransaction.findFirst({
            where: { productId: key.productId, formatId: key.formatId },
            orderBy: { createdAt: 'desc' },
            select: { runningWAC: true },
          });
          wacMap.set(`${key.productId}-${key.formatId}`, lastTx ? Number(lastTx.runningWAC) : 0);
        }
      }

      for (const reservation of reservations) {
        // E-08 FIX: Atomic conditional stock decrement — prevents negative inventory
        // Uses a single UPDATE with a WHERE guard so the row is only modified when
        // sufficient stock exists.  The returned row-count tells us if the decrement
        // actually happened (race-condition-safe, no read-then-write gap).
        if (reservation.formatId) {
          const rowsAffected: number = await tx.$executeRaw`
            UPDATE "ProductFormat"
            SET "stockQuantity" = "stockQuantity" - ${reservation.quantity},
                "updatedAt" = NOW()
            WHERE id = ${reservation.formatId}
              AND "stockQuantity" >= ${reservation.quantity}
          `;
          if (rowsAffected === 0) {
            // Stock was insufficient — log and continue (order is already paid)
            logger.warn(`[Stripe webhook] Insufficient stock for format ${reservation.formatId}: wanted ${reservation.quantity}, atomic UPDATE matched 0 rows`);
          }
        }

        const wac = wacMap.get(`${reservation.productId}-${reservation.formatId}`) ?? 0;

        // Create inventory transaction
        await tx.inventoryTransaction.create({
          data: {
            productId: reservation.productId,
            formatId: reservation.formatId,
            type: 'SALE',
            quantity: -reservation.quantity,
            unitCost: wac,
            runningWAC: wac,
            orderId: newOrder.id,
          },
        });
      }
    }

    return newOrder;
  });

  logger.info('Order created', { orderId: order.id, orderNumber });

  // Create accounting entries (non-blocking - don't fail the webhook)
  let journalEntryId: string | undefined;
  try {
    const result = await createAccountingEntriesForOrder(order.id);
    journalEntryId = result.saleEntryId;
    logger.info('Accounting entries created', {
      orderNumber,
      saleEntryId: result.saleEntryId,
      feeEntryId: result.feeEntryId,
      invoiceId: result.invoiceId,
    });
  } catch (acctError) {
    logger.error('Failed to create accounting entries', {
      orderNumber,
      error: acctError instanceof Error ? acctError.message : String(acctError),
    });
    // Don't fail the webhook for accounting errors
  }

  // Generate COGS entry (non-blocking)
  try {
    await generateCOGSEntry(order.id);
    logger.info('COGS entry created', { orderNumber });
  } catch (cogsError) {
    logger.error('Failed to create COGS entry', {
      orderNumber,
      error: cogsError instanceof Error ? cogsError.message : String(cogsError),
    });
  }

  // Track promo code usage (with per-user limit check)
  if (promoCode && promoDiscount > 0) {
    try {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode } });
      if (promo) {
        // Check per-user usage limit (default: 1 use per user)
        const maxUsesPerUser = (promo as Record<string, unknown>).maxUsesPerUser as number || 1;
        const existingUsage = userId && userId !== 'guest'
          ? await prisma.promoCodeUsage.count({
              where: { promoCodeId: promo.id, userId },
            })
          : 0;

        if (existingUsage < maxUsesPerUser) {
          await prisma.promoCode.update({
            where: { id: promo.id },
            data: { usageCount: { increment: 1 } },
          });
          await prisma.promoCodeUsage.create({
            data: {
              promoCodeId: promo.id,
              userId: userId && userId !== 'guest' ? userId : 'anonymous',
              orderId: order.id,
              discount: promoDiscount,
            },
          });
        } else {
          logger.warn('Promo code per-user limit reached', { promoCode, userId });
        }
      }
    } catch (promoError) {
      logger.error('Failed to track promo code usage', {
        promoCode,
        error: promoError instanceof Error ? promoError.message : String(promoError),
      });
    }
  }

  // BE-PAY-04: Decrement gift card balance after successful payment
  if (giftCardCode && giftCardDiscount > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        // Lock the gift card row to prevent concurrent balance modifications
        const [giftCard] = await tx.$queryRaw<{
          id: string; balance: number; is_active: boolean;
        }[]>`
          SELECT id, balance::float as balance, "isActive" as is_active
          FROM "GiftCard"
          WHERE code = ${giftCardCode}
          FOR UPDATE
        `;

        if (giftCard && giftCard.is_active && giftCard.balance > 0) {
          const amountToDeduct = Math.min(giftCardDiscount, giftCard.balance);
          const newBalance = Math.round((giftCard.balance - amountToDeduct) * 100) / 100;

          await tx.giftCard.update({
            where: { id: giftCard.id },
            data: {
              balance: newBalance,
              // If balance reaches 0, deactivate the card
              isActive: newBalance > 0,
            },
          });

          logger.info('Gift card balance decremented', {
            giftCardCode,
            amountDeducted: amountToDeduct,
            newBalance,
            orderNumber: order.orderNumber,
          });
        }
      });
    } catch (gcError) {
      logger.error('Failed to decrement gift card balance', {
        giftCardCode,
        giftCardDiscount,
        orderNumber: order.orderNumber,
        error: gcError instanceof Error ? gcError.message : String(gcError),
      });
      // Don't fail the webhook for gift card errors
    }
  }

  // Create ambassador commission if the order used a referral code
  if (promoCode) {
    try {
      const ambassador = await prisma.ambassador.findUnique({
        where: { referralCode: promoCode },
        select: { id: true, name: true, commissionRate: true, status: true },
      });

      if (ambassador && ambassador.status === 'ACTIVE') {
        // commissionRate is stored as an integer percentage in the DB (e.g. 10 = 10%).
        // Divide by 100 to get the decimal multiplier before applying to order total.
        const rate = Number(ambassador.commissionRate);
        const commissionAmount = Math.round(Number(order.total) * (rate / 100) * 100) / 100;

        await prisma.ambassadorCommission.upsert({
          where: {
            ambassadorId_orderId: {
              ambassadorId: ambassador.id,
              orderId: order.id,
            },
          },
          create: {
            ambassadorId: ambassador.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderTotal: Number(order.total),
            commissionRate: rate,
            commissionAmount,
          },
          update: {},
        });
        logger.info('Ambassador commission created', {
          ambassadorName: ambassador.name,
          commissionAmount,
          orderNumber,
        });
      }
    } catch (commError) {
      logger.error('Failed to create ambassador commission', {
        orderNumber,
        error: commError instanceof Error ? commError.message : String(commError),
      });
    }
  }

  // Referral program: qualify referral if buyer was referred and this is their first paid order
  if (userId && userId !== 'guest') {
    try {
      const buyer = await prisma.user.findUnique({
        where: { id: userId },
        select: { referredById: true },
      });

      if (buyer?.referredById) {
        // Check if the buyer has any previous PAID orders (besides this one)
        const previousPaidOrders = await prisma.order.count({
          where: {
            userId,
            paymentStatus: 'PAID',
            id: { not: order.id },
          },
        });

        if (previousPaidOrders === 0) {
          const result = await qualifyReferral(userId, order.id, Number(cadTotal));
          if (result.success) {
            logger.info('Referral qualified', { orderNumber, message: result.message });
          } else {
            logger.info('Referral not qualified', { orderNumber, message: result.message });
          }
        }
      }
    } catch (refError) {
      logger.error('Failed to process referral qualification', {
        orderNumber,
        error: refError instanceof Error ? refError.message : String(refError),
      });
      // Don't fail the webhook for referral errors
    }
  }

  // N+1 FIX: Fetch user once for both loyalty points and automation engine
  if (userId && userId !== 'guest') {
    // Single user fetch with all needed fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, loyaltyPoints: true, lifetimePoints: true, loyaltyTier: true },
    });

    // G2-FLAW-10: Award loyalty points for purchase (non-blocking)
    if (user) {
      try {
        const tierMultiplier = user.loyaltyTier === 'VIP' ? 2 : user.loyaltyTier === 'GOLD' ? 1.5 : 1;
        const pointsToAward = calculatePurchasePoints(Number(cadTotal), tierMultiplier);

        if (pointsToAward > 0) {
          const newBalance = (user.loyaltyPoints || 0) + pointsToAward;
          await prisma.loyaltyTransaction.create({
            data: {
              userId,
              type: 'EARN_PURCHASE',
              points: pointsToAward,
              description: `Purchase ${orderNumber}`,
              balanceAfter: newBalance,
              metadata: JSON.stringify({ orderId: order.id, orderNumber, total: Number(cadTotal) }),
            },
          });
          await prisma.user.update({
            where: { id: userId },
            data: {
              loyaltyPoints: newBalance,
              lifetimePoints: (user.lifetimePoints || 0) + pointsToAward,
            },
          });
          logger.info('Loyalty points awarded', { userId, pointsToAward, newBalance, orderNumber });
        }
      } catch (loyaltyError) {
        logger.error('Failed to award loyalty points', {
          orderNumber,
          error: loyaltyError instanceof Error ? loyaltyError.message : String(loyaltyError),
        });
        // Don't fail the webhook for loyalty errors
      }
    }

    // Mark webhook as completed
    await completeWebhookEvent(eventId, order.id, journalEntryId);

    // Send confirmation email (non-blocking)
    await sendOrderConfirmationEmailAsync(order.id, userId);

    // Trigger automation engine for order.created (fire-and-forget) - reuse fetched user
    if (user) {
      try {
        const { handleEvent } = await import('@/lib/email/automation-engine');
        handleEvent('order.created', {
          email: user.email,
          name: user.name || undefined,
          userId,
          orderId: order.id,
          orderNumber,
          total: cadTotal,
        }).catch((err) => {
          logger.error('[AutomationEngine] Failed to handle order.created', { error: String(err) });
        });
      } catch (error) {
        logger.error('[Webhook] Automation engine trigger failed (non-blocking)', { error: error instanceof Error ? error.message : String(error) });
      }
    }
  } else {
    // Guest user - just mark webhook as completed
    await completeWebhookEvent(eventId, order.id, journalEntryId);
  }

  // Send SMS notification to admin (non-blocking)
  sendOrderNotificationSms(Number(cadTotal), orderNumber).catch((err) => {
    logger.error('Failed to send order SMS', { orderNumber, error: String(err) });
  });
}

async function handleRefund(charge: Stripe.Charge, eventId: string) {
  logger.info('Charge refunded', { chargeId: charge.id });

  // Find the order
  const order = await prisma.order.findFirst({
    where: { stripePaymentId: charge.payment_intent as string },
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      status: true,
      total: true,
      taxTps: true,
      taxTvq: true,
      taxTvh: true,
      taxPst: true,
      stripePaymentId: true,
    },
  });

  if (!order) {
    logger.error('Order not found for refund', { paymentIntent: charge.payment_intent });
    await completeWebhookEvent(eventId);
    return;
  }

  // Compute refund values outside try block so they're available for commission clawback
  const refundAmount = (charge.amount_refunded || 0) / 100;
  const orderTotal = Number(order.total);
  const isFullRefund = charge.amount_refunded === charge.amount;

  // BUG FIX: Wrap order status update + inventory restore in a single $transaction
  // to ensure atomicity. Previously the order status update was standalone, so if the
  // inventory restore failed the order would be marked REFUNDED without stock restoration.
  await prisma.$transaction(async (tx) => {
    // Update order status
    await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: isFullRefund ? 'REFUNDED' : 'PAID',
        status: isFullRefund ? 'CANCELLED' : order.status,
      },
    });

    // Restore inventory for full refunds
    if (isFullRefund) {
      const saleTxs = await tx.inventoryTransaction.findMany({
        where: { orderId: order.id, type: 'SALE' },
      });

      // N+1 FIX: Batch-create all RETURN transactions using individual creates
      // (stock increments must still be per-format for atomicity)
      for (const saleTx of saleTxs) {
        if (saleTx.formatId) {
          await tx.productFormat.update({
            where: { id: saleTx.formatId },
            data: { stockQuantity: { increment: Math.abs(saleTx.quantity) } },
          });
        }
      }
      // Batch-create all return inventory transactions
      if (saleTxs.length > 0) {
        await tx.inventoryTransaction.createMany({
          data: saleTxs.map(saleTx => ({
            productId: saleTx.productId,
            formatId: saleTx.formatId,
            type: 'RETURN' as const,
            quantity: Math.abs(saleTx.quantity),
            unitCost: saleTx.unitCost,
            runningWAC: saleTx.runningWAC,
            orderId: order.id,
            reason: 'Remboursement complet',
          })),
        });
      }
    }
  });

  // Create refund accounting entries (non-blocking - uses its own internal transaction)
  try {
    const { createRefundAccountingEntries } = await import('@/lib/accounting/webhook-accounting.service');
    const tps = Number(order.taxTps);
    const tvq = Number(order.taxTvq);
    const tvh = Number(order.taxTvh);
    const pst = Number(order.taxPst);
    const refundRatio = orderTotal > 0 ? refundAmount / orderTotal : 0;

    await createRefundAccountingEntries(
      order.id,
      refundAmount,
      Math.round(tps * refundRatio * 100) / 100,
      Math.round(tvq * refundRatio * 100) / 100,
      Math.round(tvh * refundRatio * 100) / 100,
      'Remboursement Stripe',
      Math.round(pst * refundRatio * 100) / 100
    );
  } catch (acctError) {
    logger.error('Failed to create refund accounting entries', {
      orderId: order.id,
      error: acctError instanceof Error ? acctError.message : String(acctError),
    });
  }

  // Clawback ambassador commission on refund (P2 #28 fix)
  try {
    const result = await clawbackAmbassadorCommission(
      order.id,
      refundAmount,
      orderTotal,
      isFullRefund
    );
    if (result.clawbackAmount && result.clawbackAmount > 0) {
      logger.info('Ambassador commission clawback on Stripe refund', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        clawbackAmount: result.clawbackAmount,
        wasPaidOut: result.wasPaidOut,
      });
    }
  } catch (commError) {
    logger.error('Failed to clawback ambassador commission', {
      orderId: order.id,
      error: commError instanceof Error ? commError.message : String(commError),
    });
  }

  await completeWebhookEvent(eventId, order.id);
}

/**
 * Send order confirmation email asynchronously
 */
async function sendOrderConfirmationEmailAsync(orderId: string, userId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        subtotal: true,
        shippingCost: true,
        tax: true,
        discount: true,
        total: true,
        shippingName: true,
        shippingAddress1: true,
        shippingAddress2: true,
        shippingCity: true,
        shippingState: true,
        shippingPostal: true,
        shippingCountry: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            unitPrice: true,
            sku: true,
          },
        },
        currency: { select: { code: true } },
      },
    });

    if (!order) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, locale: true },
    });

    if (!user) return;

    const orderData: OrderData = {
      orderNumber: order.orderNumber,
      customerName: user.name || 'Client',
      customerEmail: user.email,
      items: order.items.map(item => ({
        name: item.productName,
        quantity: item.quantity,
        price: Number(item.unitPrice),
        sku: item.sku || undefined,
      })),
      subtotal: Number(order.subtotal),
      shipping: Number(order.shippingCost),
      tax: Number(order.tax),
      discount: order.discount ? Number(order.discount) : undefined,
      total: Number(order.total),
      currency: order.currency?.code || 'CAD',
      shippingAddress: {
        name: order.shippingName,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2 || undefined,
        city: order.shippingCity,
        state: order.shippingState,
        postalCode: order.shippingPostal,
        country: order.shippingCountry,
      },
      locale: (user.locale as 'fr' | 'en') || 'fr',
      // CAN-SPAM / RGPD / LCAP compliance
      unsubscribeUrl: await generateUnsubscribeUrl(user.email, 'transactional', user.id).catch(() => undefined),
    };

    const emailContent = orderConfirmationEmail(orderData);

    const result = await sendEmail({
      to: { email: user.email, name: user.name || undefined },
      subject: emailContent.subject,
      html: emailContent.html,
      tags: ['order', 'confirmation', order.orderNumber],
      unsubscribeUrl: orderData.unsubscribeUrl,
    });

    if (result.success) {
      logger.info('Confirmation email sent', {
        orderNumber: order.orderNumber,
        to: user.email,
      });
    } else {
      logger.error('Failed to send confirmation email', {
        orderNumber: order.orderNumber,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error sending order confirmation email', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  logger.info('Payment succeeded', { paymentIntentId: paymentIntent.id });
  await prisma.order.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: { paymentStatus: 'PAID' },
  });
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  logger.warn('Payment failed', { paymentIntentId: paymentIntent.id });

  const errorMessage = paymentIntent.last_payment_error?.message || 'Unknown error';
  const errorCode = paymentIntent.last_payment_error?.code || 'unknown';
  const customerEmail = paymentIntent.receipt_email || paymentIntent.metadata?.customerEmail;
  const amount = paymentIntent.amount / 100;

  // Log payment error to database
  try {
    await prisma.paymentError.create({
      data: {
        orderId: paymentIntent.metadata?.orderId || null,
        stripePaymentId: paymentIntent.id,
        errorType: errorCode,
        errorMessage,
        amount,
        currency: paymentIntent.currency?.toUpperCase() || 'CAD',
        customerEmail: customerEmail || null,
        metadata: JSON.stringify({
          paymentMethodType: paymentIntent.payment_method_types,
          declineCode: paymentIntent.last_payment_error?.decline_code,
        }),
      },
    });
  } catch (logError) {
    logger.error('Failed to log payment error', { error: String(logError) });
  }

  // Send SMS alert (non-blocking)
  sendPaymentFailureAlertSms(errorCode, amount, customerEmail || undefined).catch((err) => {
    logger.error('Failed to send payment failure SMS', { error: String(err) });
  });

  await prisma.order.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
  });

  // Release any inventory reservations
  const order = await prisma.order.findFirst({
    where: { stripePaymentId: paymentIntent.id },
    select: { id: true },
  });
  if (order) {
    await prisma.inventoryReservation.updateMany({
      where: { orderId: order.id, status: 'RESERVED' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }
}
