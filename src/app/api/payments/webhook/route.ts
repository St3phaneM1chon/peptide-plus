export const dynamic = 'force-dynamic';

/**
 * Webhook Stripe - Traitement des evenements de paiement
 * Avec idempotence, creation comptable automatique, et envoi d'emails
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma, withPrismaRetry } from '@/lib/db';
import { sendEmail, orderConfirmationEmail, generateUnsubscribeUrl, type OrderData } from '@/lib/email';
import { createAccountingEntriesForOrder } from '@/lib/accounting/webhook-accounting.service';
import { generateCOGSEntry } from '@/lib/inventory';
import { qualifyReferral } from '@/lib/referral-qualify';
import { logger } from '@/lib/logger';
import { validateTransition } from '@/lib/order-status-machine';
import { sendOrderNotificationSms, sendPaymentFailureAlertSms } from '@/lib/sms';
import { sanitizeWebhookPayload } from '@/lib/sanitize';
import { getRedisClient, isRedisAvailable } from '@/lib/redis';
import { clawbackAmbassadorCommission } from '@/lib/ambassador-commission';
import { STRIPE_API_VERSION } from '@/lib/stripe';
import { calculatePurchasePoints, calculateTierFromPoints } from '@/lib/constants';
import { subtract, applyRate } from '@/lib/decimal-calculator';
import { checkEarningCaps } from '@/lib/loyalty/points-engine';

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
      // A9-P2-004 FIX: Return 500 so Stripe retries the event. The idempotence
      // layer (dedup cache + WebhookEvent record) prevents duplicate processing
      // on retry. Returning 200 here would silently swallow failures.
      return NextResponse.json({ error: 'Handler failed — logged for review' }, { status: 500 });
    }
  } catch (error) {
    logger.error('Webhook error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // A9-P2-004 FIX: Return 500 for unexpected errors so Stripe retries.
    // Idempotence checks at the top of the handler prevent duplicate processing.
    return NextResponse.json({ error: 'Unexpected error — logged for review' }, { status: 500 });
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
  // BUG E-14 FIX: Safe parsing of cartItems metadata.
  // Stripe metadata values are capped at 500 chars. If the JSON was truncated,
  // JSON.parse would throw and the order would be created with 0 items.
  // We now handle 3 formats:
  //   1. 'compact' — short keys: [{p, f, q, $}, ...] (names looked up from DB)
  //   2. 'ref'     — {ref, count} reference; items recovered from InventoryReservation + DB
  //   3. legacy    — full objects with productId, name, formatName, quantity, price
  let cartItems: Record<string, unknown>[] = [];
  const cartItemsFormat = metadata.cartItemsFormat || 'legacy';

  if (metadata.cartItems) {
    try {
      const parsed = JSON.parse(metadata.cartItems);

      if (cartItemsFormat === 'ref' || (parsed && typeof parsed === 'object' && 'ref' in parsed)) {
        // Format 'ref': recover from InventoryReservation records (handled below after reservation fetch)
        // cartItems stays empty here; we populate it from reservations + DB lookup later
        cartItems = [];
      } else if (cartItemsFormat === 'compact' || (Array.isArray(parsed) && parsed.length > 0 && 'p' in parsed[0])) {
        // Format 'compact': short keys {p, f, q, $} — need DB lookup for names
        cartItems = parsed.map((item: { p: string; f: string | null; q: number; $: number }) => ({
          productId: item.p,
          formatId: item.f,
          quantity: item.q,
          price: item.$,
          // name and formatName will be filled from DB below
          name: null,
          formatName: null,
        }));
      } else if (Array.isArray(parsed)) {
        // Legacy format: full objects
        cartItems = parsed;
      }
    } catch (parseError) {
      // E-14: Truncated JSON — fall back to recovering from InventoryReservation + DB
      logger.warn('[Webhook] cartItems metadata JSON parse failed (likely truncated), will recover from reservations', {
        sessionId: session.id,
        error: parseError instanceof Error ? parseError.message : String(parseError),
        rawLength: metadata.cartItems?.length,
      });
      cartItems = [];
    }
  }

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

  // BUG E-14 FIX: If cartItems is empty (truncated JSON or 'ref' format) or compact
  // (missing names), recover/enrich from InventoryReservation + Product/Format DB lookups.
  if (cartItems.length === 0) {
    // Recover items from InventoryReservation records using cartId
    const cartIdForLookup = metadata.cartId || undefined;
    if (cartIdForLookup) {
      const reservations = await prisma.inventoryReservation.findMany({
        where: { cartId: cartIdForLookup, status: 'RESERVED' },
        select: { productId: true, formatId: true, quantity: true },
      });
      if (reservations.length > 0) {
        // Look up product names and prices
        const productIds = [...new Set(reservations.map(r => r.productId))];
        const products = await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, price: true },
        });
        const productMap = new Map(products.map(p => [p.id, p]));

        const formatIds = reservations.map(r => r.formatId).filter((f): f is string => !!f);
        const formats = formatIds.length > 0
          ? await prisma.productFormat.findMany({
              where: { id: { in: formatIds } },
              select: { id: true, name: true, price: true },
            })
          : [];
        const formatMap = new Map(formats.map(f => [f.id, f]));

        cartItems = reservations.map(r => {
          const product = productMap.get(r.productId);
          const format = r.formatId ? formatMap.get(r.formatId) : null;
          return {
            productId: r.productId,
            formatId: r.formatId,
            quantity: r.quantity,
            price: format ? Number(format.price) : (product ? Number(product.price) : 0),
            name: product?.name || 'Unknown product',
            formatName: format?.name || null,
          };
        });
        logger.info('[Webhook] E-14: Recovered cart items from InventoryReservation', {
          sessionId: session.id,
          itemCount: cartItems.length,
        });
      }
    }
    // If still empty after reservation lookup, the order will be created with 0 items.
    // This is a data integrity issue but better than crashing the webhook.
    if (cartItems.length === 0) {
      logger.error('[Webhook] E-14: Could not recover cart items from any source', {
        sessionId: session.id,
        cartId: metadata.cartId,
        cartItemsFormat,
      });
    }
  }

  // BUG E-14 FIX: Enrich compact-format items that are missing product names
  const itemsMissingNames = cartItems.filter(item => !item.name);
  if (itemsMissingNames.length > 0) {
    const productIds = [...new Set(itemsMissingNames.map(i => String(i.productId)))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, price: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const formatIds = itemsMissingNames.map(i => i.formatId).filter((f): f is string => typeof f === 'string' && !!f);
    const formats = formatIds.length > 0
      ? await prisma.productFormat.findMany({
          where: { id: { in: formatIds } },
          select: { id: true, name: true, price: true },
        })
      : [];
    const formatMap = new Map(formats.map(f => [f.id, f]));

    for (const item of cartItems) {
      if (!item.name) {
        const product = productMap.get(String(item.productId));
        item.name = product?.name || 'Unknown product';
        if (!item.price && product) {
          item.price = Number(product.price);
        }
      }
      if (!item.formatName && item.formatId) {
        const format = formatMap.get(String(item.formatId));
        item.formatName = format?.name || null;
        if (!item.price && format) {
          item.price = Number(format.price);
        }
      }
    }
  }

  // BUG 15: Declare orderNumber before transaction so it's accessible outside
  let orderNumber = '';

  // Create the order with items in a transaction
  // Wrap the critical order-creation transaction with pool retry to handle
  // transient DB pool exhaustion under high webhook traffic.
  const order = await withPrismaRetry(() => prisma.$transaction(async (tx) => {
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
        userId: userId && userId !== 'guest' ? userId : null,
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
        giftCardCode: giftCardCode || null,
        giftCardDiscount: giftCardDiscount || null,
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
            productId: String(item.productId),
            formatId: item.formatId ? String(item.formatId) : null,
            productName: String(item.name || 'Unknown product'),
            formatName: item.formatName ? String(item.formatName) : null,
            sku: item.sku ? String(item.sku) : null,
            quantity: Number(item.quantity),
            unitPrice: Number(item.price),
            discount: Number(item.discount) || 0,
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
        } else {
          // E-07 FIX: Also decrement stock for base products (no formatId)
          const rowsAffected: number = await tx.$executeRaw`
            UPDATE "Product"
            SET "stockQuantity" = "stockQuantity" - ${reservation.quantity},
                "updatedAt" = NOW()
            WHERE id = ${reservation.productId}
              AND "trackInventory" = true
              AND "stockQuantity" >= ${reservation.quantity}
          `;
          if (rowsAffected === 0) {
            logger.warn(`[Stripe webhook] Insufficient stock for base product ${reservation.productId}: wanted ${reservation.quantity}, atomic UPDATE matched 0 rows`);
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

    // E-06 FIX: Deduct gift card balance INSIDE the order transaction for atomicity.
    // Previously this was a separate $transaction outside the order creation, so if the
    // webhook crashed between order creation and gift card deduction, the balance was
    // never reduced — allowing infinite reuse of the same gift card.
    if (giftCardCode && giftCardDiscount > 0) {
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
        const newBalance = subtract(giftCard.balance, amountToDeduct);

        await tx.giftCard.update({
          where: { id: giftCard.id },
          data: {
            balance: newBalance,
            // If balance reaches 0, deactivate the card
            isActive: newBalance > 0,
          },
        });

        logger.info('Gift card balance decremented (atomic)', {
          giftCardCode,
          amountDeducted: amountToDeduct,
          newBalance,
          orderNumber,
        });
      } else {
        logger.warn('Gift card not found or inactive during balance deduction', {
          giftCardCode,
          giftCardDiscount,
          orderNumber,
        });
      }
    }

    // E-12 FIX: Atomic promo code usage tracking inside the order transaction.
    // Uses a conditional UPDATE to prevent race conditions where two concurrent
    // webhooks both pass the usage check and both increment, exceeding the limit.
    // Also enforces per-user usage limits (usageLimitPerUser).
    if (promoCode && promoDiscount > 0) {
      // Step 1: Atomic conditional increment — only succeeds if within global usage limit
      const promoRowsAffected: number = await tx.$executeRaw`
        UPDATE "PromoCode"
        SET "usageCount" = "usageCount" + 1, "updatedAt" = NOW()
        WHERE code = ${promoCode}
          AND "isActive" = true
          AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")
      `;

      if (promoRowsAffected === 0) {
        // Promo exceeded its global usage limit between validation and capture.
        // Payment is already captured so we log a warning but don't block the order.
        logger.warn('[Stripe webhook] Promo code usage limit exceeded (atomic check failed)', {
          promoCode,
          orderNumber,
        });
      } else {
        // Step 2: Fetch the promo to get its ID and per-user limit
        const promoRecord = await tx.promoCode.findUnique({ where: { code: promoCode } });
        if (promoRecord) {
          // Step 3: Check per-user usage limit atomically
          const perUserLimit = promoRecord.usageLimitPerUser ?? 1;
          const existingUserUsage = await tx.promoCodeUsage.count({
            where: { promoCodeId: promoRecord.id, userId: userId || 'anonymous' },
          });

          if (existingUserUsage >= perUserLimit) {
            // Per-user limit exceeded — rollback the global increment
            await tx.$executeRaw`
              UPDATE "PromoCode"
              SET "usageCount" = GREATEST("usageCount" - 1, 0), "updatedAt" = NOW()
              WHERE code = ${promoCode}
            `;
            logger.warn('[Stripe webhook] Promo code per-user limit reached', {
              promoCode,
              userId,
              perUserLimit,
              existingUserUsage,
              orderNumber,
            });
          } else {
            // Step 4: Create per-user usage record inside the transaction
            await tx.promoCodeUsage.create({
              data: {
                promoCodeId: promoRecord.id,
                userId: userId || 'anonymous',
                orderId: newOrder.id,
                discount: promoDiscount,
              },
            });
          }
        }
      }
    }

    return newOrder;
  }));

  logger.info('Order created', { orderId: order.id, orderNumber });

  // ---------------------------------------------------------------------------
  // T3-5: Partial failure resilience — each independent side effect is wrapped
  // in its own try/catch so a failure in one (e.g. SMS) does not block the
  // others.  Results are collected and logged as a summary at the end.
  // Core operations (order creation above + webhook completion below) must
  // succeed; everything else is non-critical.
  // ---------------------------------------------------------------------------
  const sideEffectResults: Record<string, 'ok' | 'skipped' | string> = {};

  // 1. Accounting entries
  let journalEntryId: string | undefined;
  try {
    const result = await createAccountingEntriesForOrder(order.id);
    journalEntryId = result.saleEntryId;
    sideEffectResults.accounting = 'ok';
    logger.info('Accounting entries created', {
      orderNumber,
      saleEntryId: result.saleEntryId,
      feeEntryId: result.feeEntryId,
      invoiceId: result.invoiceId,
    });
  } catch (acctError) {
    const msg = acctError instanceof Error ? acctError.message : String(acctError);
    sideEffectResults.accounting = msg;
    logger.error('[webhook] accounting failed', { orderNumber, error: msg });
  }

  // 2. COGS entry
  try {
    await generateCOGSEntry(order.id);
    sideEffectResults.cogs = 'ok';
    logger.info('COGS entry created', { orderNumber });
  } catch (cogsError) {
    const msg = cogsError instanceof Error ? cogsError.message : String(cogsError);
    sideEffectResults.cogs = msg;
    logger.error('[webhook] cogs failed', { orderNumber, error: msg });
  }

  // 3. Ambassador commission (only if a promo code was used)
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
        const commissionAmount = applyRate(Number(order.total), rate / 100);

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
        sideEffectResults.ambassadorCommission = 'ok';
        logger.info('Ambassador commission created', {
          ambassadorName: ambassador.name,
          commissionAmount,
          orderNumber,
        });
      } else {
        sideEffectResults.ambassadorCommission = 'skipped';
      }
    } catch (commError) {
      const msg = commError instanceof Error ? commError.message : String(commError);
      sideEffectResults.ambassadorCommission = msg;
      logger.error('[webhook] ambassador commission failed', { orderNumber, error: msg });
    }
  } else {
    sideEffectResults.ambassadorCommission = 'skipped';
  }

  // 4. Referral qualification
  if (userId) {
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
            sideEffectResults.referral = 'ok';
            logger.info('Referral qualified', { orderNumber, message: result.message });
          } else {
            sideEffectResults.referral = 'skipped';
            logger.info('Referral not qualified', { orderNumber, message: result.message });
          }
        } else {
          sideEffectResults.referral = 'skipped';
        }
      } else {
        sideEffectResults.referral = 'skipped';
      }
    } catch (refError) {
      const msg = refError instanceof Error ? refError.message : String(refError);
      sideEffectResults.referral = msg;
      logger.error('[webhook] referral qualification failed', { orderNumber, error: msg });
    }
  } else {
    sideEffectResults.referral = 'skipped';
  }

  // 5. Loyalty points + 6. Confirmation email + 7. Automation engine (require user)
  // N+1 FIX: Fetch user once for both loyalty points and automation engine
  if (userId) {
    // Single user fetch with all needed fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, loyaltyPoints: true, lifetimePoints: true, loyaltyTier: true },
    });

    // 5. G2-FLAW-10: Award loyalty points for purchase (non-blocking)
    if (user) {
      try {
        // F-001 FIX: Use canonical tier multiplier from LOYALTY_TIER_THRESHOLDS
        // instead of hardcoded values that can drift out of sync.
        const canonicalTier = calculateTierFromPoints(user.lifetimePoints || 0);
        const tierMultiplier = canonicalTier.multiplier;
        let pointsToAward = calculatePurchasePoints(Number(cadTotal), tierMultiplier);

        if (pointsToAward > 0) {
          // T2-9: Check earning caps before awarding purchase points
          const capCheck = await checkEarningCaps(prisma, userId, pointsToAward, 'EARN_PURCHASE');
          if (capCheck.adjustedPoints <= 0) {
            sideEffectResults.loyaltyPoints = 'skipped';
            logger.warn('Purchase points skipped due to earning cap', {
              userId, orderNumber, requestedPoints: pointsToAward,
              capReason: capCheck.capReason,
              earnedToday: capCheck.earnedToday,
              earnedThisMonth: capCheck.earnedThisMonth,
            });
          } else {
            if (!capCheck.allowed) {
              logger.info('Purchase points reduced due to earning cap', {
                userId, orderNumber,
                originalPoints: pointsToAward,
                adjustedPoints: capCheck.adjustedPoints,
                capReason: capCheck.capReason,
              });
              pointsToAward = capCheck.adjustedPoints;
            }
            const newBalance = (user.loyaltyPoints || 0) + pointsToAward;
            await prisma.loyaltyTransaction.create({
              data: {
                userId,
                type: 'EARN_PURCHASE',
                points: pointsToAward,
                description: `Purchase ${orderNumber}`,
                balanceAfter: newBalance,
                // A8-P2-005 FIX: Set expiration on purchase points (12 months)
                expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
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
            sideEffectResults.loyaltyPoints = 'ok';
            logger.info('Loyalty points awarded', { userId, pointsToAward, newBalance, orderNumber });
          }
        } else {
          sideEffectResults.loyaltyPoints = 'skipped';
        }
      } catch (loyaltyError) {
        const msg = loyaltyError instanceof Error ? loyaltyError.message : String(loyaltyError);
        sideEffectResults.loyaltyPoints = msg;
        logger.error('[webhook] loyalty points failed', { orderNumber, error: msg });
      }
    } else {
      sideEffectResults.loyaltyPoints = 'skipped';
    }

    // Core: Mark webhook as completed (must succeed — not a side effect)
    await completeWebhookEvent(eventId, order.id, journalEntryId);

    // 6. Confirmation email
    try {
      await sendOrderConfirmationEmailAsync(order.id, userId);
      sideEffectResults.confirmationEmail = 'ok';
    } catch (emailError) {
      const msg = emailError instanceof Error ? emailError.message : String(emailError);
      sideEffectResults.confirmationEmail = msg;
      logger.error('[webhook] confirmation email failed', { orderNumber, error: msg });
    }

    // 7. Automation engine for order.created (fire-and-forget) - reuse fetched user
    if (user) {
      try {
        const { handleEvent } = await import('@/lib/email/automation-engine');
        await handleEvent('order.created', {
          email: user.email,
          name: user.name || undefined,
          userId,
          orderId: order.id,
          orderNumber,
          total: cadTotal,
        });
        sideEffectResults.automationEngine = 'ok';
      } catch (autoError) {
        const msg = autoError instanceof Error ? autoError.message : String(autoError);
        sideEffectResults.automationEngine = msg;
        logger.error('[webhook] automation engine failed', { orderNumber, error: msg });
      }
    } else {
      sideEffectResults.automationEngine = 'skipped';
    }
  } else {
    // Guest user — side effects that require a user are skipped
    sideEffectResults.loyaltyPoints = 'skipped';
    sideEffectResults.referral = 'skipped';
    sideEffectResults.confirmationEmail = 'skipped';
    sideEffectResults.automationEngine = 'skipped';

    // Core: Mark webhook as completed
    await completeWebhookEvent(eventId, order.id, journalEntryId);
  }

  // 8. SMS notification to admin
  try {
    await sendOrderNotificationSms(Number(cadTotal), orderNumber);
    sideEffectResults.smsNotification = 'ok';
  } catch (smsError) {
    const msg = smsError instanceof Error ? smsError.message : String(smsError);
    sideEffectResults.smsNotification = msg;
    logger.error('[webhook] SMS notification failed', { orderNumber, error: msg });
  }

  // ---------------------------------------------------------------------------
  // T3-5: Summary log — shows which side effects succeeded/failed/were skipped
  // ---------------------------------------------------------------------------
  const failures = Object.entries(sideEffectResults).filter(([, v]) => v !== 'ok' && v !== 'skipped');
  const succeeded = Object.entries(sideEffectResults).filter(([, v]) => v === 'ok').map(([k]) => k);
  const skipped = Object.entries(sideEffectResults).filter(([, v]) => v === 'skipped').map(([k]) => k);

  if (failures.length > 0) {
    logger.warn('[webhook] checkout.session.completed processed with partial failures', {
      orderNumber,
      orderId: order.id,
      succeeded,
      skipped,
      failures: Object.fromEntries(failures),
      totalEffects: Object.keys(sideEffectResults).length,
      failedCount: failures.length,
    });
  } else {
    logger.info('[webhook] checkout.session.completed all side effects succeeded', {
      orderNumber,
      orderId: order.id,
      succeeded,
      skipped,
      totalEffects: Object.keys(sideEffectResults).length,
    });
  }
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

  // Validate transition (webhook: log warning but proceed — Stripe data is authoritative)
  if (isFullRefund) {
    const refundTransition = validateTransition(order.status, 'CANCELLED');
    if (!refundTransition.valid) {
      logger.warn('[stripe-webhook] Unexpected refund transition (proceeding anyway)', {
        orderId: order.id,
        currentStatus: order.status,
        targetStatus: 'CANCELLED',
        reason: refundTransition.error,
      });
    }
  }

  // Wrap refund transaction with pool retry for resilience under load.
  await withPrismaRetry(() => prisma.$transaction(async (tx) => {
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
        } else {
          // E-07 FIX: Restore stock for base products (no formatId)
          await tx.product.update({
            where: { id: saleTx.productId },
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
  }));

  // ---------------------------------------------------------------------------
  // T3-5: Partial failure resilience for refund side effects
  // Core operation (order status + inventory restore) is the transaction above.
  // Everything below is non-critical — collect results and log summary.
  // ---------------------------------------------------------------------------
  const refundResults: Record<string, 'ok' | 'skipped' | string> = {};

  // 1. Refund accounting entries
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
      applyRate(tps, refundRatio),
      applyRate(tvq, refundRatio),
      applyRate(tvh, refundRatio),
      'Remboursement Stripe',
      applyRate(pst, refundRatio)
    );
    refundResults.refundAccounting = 'ok';
  } catch (acctError) {
    const msg = acctError instanceof Error ? acctError.message : String(acctError);
    refundResults.refundAccounting = msg;
    logger.error('[webhook] refund accounting failed', { orderId: order.id, error: msg });
  }

  // 2. Clawback ambassador commission on refund (P2 #28 fix)
  try {
    const result = await clawbackAmbassadorCommission(
      order.id,
      refundAmount,
      orderTotal,
      isFullRefund
    );
    if (result.clawbackAmount && result.clawbackAmount > 0) {
      refundResults.commissionClawback = 'ok';
      logger.info('Ambassador commission clawback on Stripe refund', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        clawbackAmount: result.clawbackAmount,
        wasPaidOut: result.wasPaidOut,
      });
    } else {
      refundResults.commissionClawback = 'skipped';
    }
  } catch (commError) {
    const msg = commError instanceof Error ? commError.message : String(commError);
    refundResults.commissionClawback = msg;
    logger.error('[webhook] commission clawback failed', { orderId: order.id, error: msg });
  }

  // 3. A5-P1-003: Revoke loyalty points awarded for this order on refund
  if (order.userId) {
    try {
      const earnTransactions = await prisma.loyaltyTransaction.findMany({
        where: {
          orderId: order.id,
          type: { in: ['EARN_PURCHASE', 'EARN_BONUS'] },
          points: { gt: 0 },
        },
        select: { id: true, points: true },
      });

      const totalEarnedPoints = earnTransactions.reduce((sum, t) => sum + t.points, 0);

      if (totalEarnedPoints > 0) {
        const pointsToRevoke = isFullRefund
          ? totalEarnedPoints
          : Math.floor(totalEarnedPoints * (refundAmount / orderTotal));

        if (pointsToRevoke > 0) {
          await prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
              where: { id: order.userId! },
              data: {
                loyaltyPoints: { decrement: pointsToRevoke },
              },
            });

            // Prevent negative balance
            if (updatedUser.loyaltyPoints < 0) {
              await tx.user.update({
                where: { id: order.userId! },
                data: { loyaltyPoints: 0 },
              });
            }

            const finalBalance = Math.max(updatedUser.loyaltyPoints, 0);

            await tx.loyaltyTransaction.create({
              data: {
                userId: order.userId!,
                type: 'ADJUST',
                points: -pointsToRevoke,
                description: `Points revoked: order ${order.orderNumber} refunded via Stripe ($${refundAmount}${isFullRefund ? ' - full' : ' - partial'})`,
                orderId: order.id,
                balanceAfter: finalBalance,
                metadata: JSON.stringify({
                  reason: 'refund_revocation',
                  refundAmount,
                  isFullRefund,
                  originalPointsEarned: totalEarnedPoints,
                  source: 'stripe_webhook',
                }),
              },
            });
          });

          refundResults.loyaltyRevocation = 'ok';
          logger.info('Loyalty points revoked on Stripe refund', {
            orderId: order.id,
            userId: order.userId,
            pointsRevoked: pointsToRevoke,
          });
        } else {
          refundResults.loyaltyRevocation = 'skipped';
        }
      } else {
        refundResults.loyaltyRevocation = 'skipped';
      }
    } catch (loyaltyError) {
      const msg = loyaltyError instanceof Error ? loyaltyError.message : String(loyaltyError);
      refundResults.loyaltyRevocation = msg;
      logger.error('[webhook] loyalty points revocation failed', { orderId: order.id, error: msg });
    }
  } else {
    refundResults.loyaltyRevocation = 'skipped';
  }

  // Core: Mark webhook as completed
  await completeWebhookEvent(eventId, order.id);

  // ---------------------------------------------------------------------------
  // T3-5: Refund side-effect summary log
  // ---------------------------------------------------------------------------
  const refundFailures = Object.entries(refundResults).filter(([, v]) => v !== 'ok' && v !== 'skipped');
  const refundSucceeded = Object.entries(refundResults).filter(([, v]) => v === 'ok').map(([k]) => k);
  const refundSkipped = Object.entries(refundResults).filter(([, v]) => v === 'skipped').map(([k]) => k);

  if (refundFailures.length > 0) {
    logger.warn('[webhook] charge.refunded processed with partial failures', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      succeeded: refundSucceeded,
      skipped: refundSkipped,
      failures: Object.fromEntries(refundFailures),
      totalEffects: Object.keys(refundResults).length,
      failedCount: refundFailures.length,
    });
  } else {
    logger.info('[webhook] charge.refunded all side effects succeeded', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      succeeded: refundSucceeded,
      skipped: refundSkipped,
      totalEffects: Object.keys(refundResults).length,
    });
  }
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

/**
 * Determine if a Stripe payment error is retryable.
 * Card declines, insufficient funds, and processing errors may succeed on retry.
 * Authentication failures, stolen cards, and fraud are not retryable.
 */
function isPaymentErrorRetryable(declineCode?: string, errorCode?: string): boolean {
  // Non-retryable decline codes (permanent failures)
  const nonRetryable = new Set([
    'stolen_card', 'lost_card', 'fraudulent', 'do_not_honor',
    'invalid_account', 'card_not_supported', 'expired_card',
    'incorrect_number', 'invalid_cvc', 'authentication_required',
    'card_declined', // generic decline — usually not retryable
  ]);
  if (declineCode && nonRetryable.has(declineCode)) return false;
  if (errorCode === 'card_declined' && !declineCode) return false;
  // Retryable: processing_error, insufficient_funds, rate_limit, etc.
  return true;
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  logger.warn('Payment failed', { paymentIntentId: paymentIntent.id });

  const errorMessage = paymentIntent.last_payment_error?.message || 'Unknown error';
  const errorCode = paymentIntent.last_payment_error?.code || 'unknown';
  const declineCode = paymentIntent.last_payment_error?.decline_code;
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
          declineCode,
        }),
      },
    });
  } catch (logError) {
    logger.error('Failed to log payment error', { error: String(logError) });
  }

  // Payment retry logic: attempt up to 2 retries for retryable errors
  // Uses Stripe's built-in idempotency via payment intent ID
  const MAX_PAYMENT_RETRIES = 2;
  const retryable = isPaymentErrorRetryable(declineCode || undefined, errorCode);

  if (retryable && paymentIntent.status !== 'canceled') {
    logger.info('Payment error is retryable, attempting retry', {
      paymentIntentId: paymentIntent.id,
      errorCode,
      declineCode,
    });

    for (let attempt = 1; attempt <= MAX_PAYMENT_RETRIES; attempt++) {
      try {
        // Exponential backoff: 2s, 8s
        const delay = 2000 * Math.pow(4, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Attempt to confirm the payment intent again
        const stripe = getStripeWebhook();
        const retryResult = await stripe.paymentIntents.confirm(paymentIntent.id);

        if (retryResult.status === 'succeeded') {
          logger.info('Payment retry succeeded', {
            paymentIntentId: paymentIntent.id,
            attempt,
          });

          // Update order status to reflect successful payment
          await prisma.order.updateMany({
            where: { stripePaymentId: paymentIntent.id },
            data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
          });

          // Log the successful retry
          await prisma.paymentError.create({
            data: {
              orderId: paymentIntent.metadata?.orderId || null,
              stripePaymentId: paymentIntent.id,
              errorType: 'retry_success',
              errorMessage: `Payment succeeded on retry attempt ${attempt}`,
              amount,
              currency: paymentIntent.currency?.toUpperCase() || 'CAD',
              customerEmail: customerEmail || null,
              metadata: JSON.stringify({ retryAttempt: attempt }),
            },
          });

          return; // Payment succeeded, no need to mark as failed
        }

        if (retryResult.status === 'requires_action' || retryResult.status === 'requires_payment_method') {
          logger.info('Payment retry requires customer action, stopping retries', {
            paymentIntentId: paymentIntent.id,
            status: retryResult.status,
            attempt,
          });
          break; // Can't retry without customer interaction
        }
      } catch (retryError) {
        logger.warn('Payment retry attempt failed', {
          paymentIntentId: paymentIntent.id,
          attempt,
          error: retryError instanceof Error ? retryError.message : String(retryError),
        });
        // Continue to next retry attempt
      }
    }

    logger.warn('All payment retries exhausted', {
      paymentIntentId: paymentIntent.id,
      attempts: MAX_PAYMENT_RETRIES,
    });
  }

  // Send SMS alert (non-blocking)
  sendPaymentFailureAlertSms(errorCode, amount, customerEmail || undefined).catch((err) => {
    logger.error('Failed to send payment failure SMS', { error: String(err) });
  });

  // Validate transition (webhook: log warning but proceed — payment failure is authoritative)
  const failedOrder = await prisma.order.findFirst({
    where: { stripePaymentId: paymentIntent.id },
    select: { id: true, status: true },
  });
  if (failedOrder) {
    const failTransition = validateTransition(failedOrder.status, 'CANCELLED');
    if (!failTransition.valid) {
      logger.warn('[stripe-webhook] Unexpected payment failure transition (proceeding anyway)', {
        orderId: failedOrder.id,
        currentStatus: failedOrder.status,
        targetStatus: 'CANCELLED',
        reason: failTransition.error,
      });
    }
  }

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
