export const dynamic = 'force-dynamic';

/**
 * Webhook Stripe - Traitement des evenements de paiement
 * Avec idempotence, creation comptable automatique, et envoi d'emails
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { sendEmail, orderConfirmationEmail, type OrderData } from '@/lib/email';
import { createAccountingEntriesForOrder } from '@/lib/accounting/webhook-accounting.service';
import { generateCOGSEntry } from '@/lib/inventory';
import { qualifyReferral } from '@/app/api/referrals/qualify/route';
import { logger } from '@/lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

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
 * Mark webhook event as failed
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
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Idempotence check: if already processed, return 200 immediately
    if (await checkIdempotence(event.id)) {
      logger.info('Webhook already processed, skipping', { eventId: event.id });
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Record the event
    await recordWebhookEvent(event.id, event.type, JSON.stringify(event.data.object).slice(0, 5000));

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
  const cartItems = metadata.cartItems ? JSON.parse(metadata.cartItems) : [];
  const promoCode = metadata.promoCode || null;
  const promoDiscount = parseFloat(metadata.promoDiscount || '0');
  const shippingCost = parseFloat(metadata.shippingCost || '0');
  const subtotal = parseFloat(metadata.subtotal || '0');

  // Multi-currency: retrieve currency info from checkout metadata
  const checkoutCurrencyId = metadata.currencyId;
  const checkoutExchangeRate = parseFloat(metadata.exchangeRate || '1');

  // Generate order number
  const orderNumber = `PP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

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
  const totalTax = taxTps + taxTvq + taxTvh;

  // If the order was placed in a foreign currency, the Stripe total
  // is in that currency. We still record the CAD amounts from metadata
  // for accounting, plus the exchange rate used at checkout time.
  const cadTotal = subtotal
    ? subtotal - promoDiscount + totalTax + shippingCost
    : stripeTotal; // fallback

  // Create the order with items in a transaction
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        orderNumber,
        userId: userId && userId !== 'guest' ? userId : 'guest',
        subtotal: stripeSubtotal,
        shippingCost,
        discount: promoDiscount,
        tax: totalTax,
        taxTps,
        taxTvq,
        taxTvh,
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

    for (const reservation of reservations) {
      // Update reservation status
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: 'CONSUMED', orderId: newOrder.id, consumedAt: new Date() },
      });

      // Decrement stock
      if (reservation.formatId) {
        await tx.productFormat.update({
          where: { id: reservation.formatId },
          data: { stockQuantity: { decrement: reservation.quantity } },
        });
      }

      // Create inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          productId: reservation.productId,
          formatId: reservation.formatId,
          type: 'SALE',
          quantity: -reservation.quantity,
          unitCost: 0, // Will be updated when WAC is calculated
          runningWAC: 0,
          orderId: newOrder.id,
        },
      });
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

  // Track promo code usage
  if (promoCode && promoDiscount > 0) {
    try {
      await prisma.promoCode.updateMany({
        where: { code: promoCode },
        data: { usageCount: { increment: 1 } },
      });
      await prisma.promoCodeUsage.create({
        data: {
          promoCodeId: (await prisma.promoCode.findUnique({ where: { code: promoCode } }))?.id || '',
          userId: userId && userId !== 'guest' ? userId : 'anonymous',
          orderId: order.id,
          discount: promoDiscount,
        },
      });
    } catch (promoError) {
      logger.error('Failed to track promo code usage', {
        promoCode,
        error: promoError instanceof Error ? promoError.message : String(promoError),
      });
    }
  }

  // Create ambassador commission if the order used a referral code
  if (promoCode) {
    try {
      const ambassador = await prisma.ambassador.findUnique({
        where: { referralCode: promoCode },
      });

      if (ambassador && ambassador.status === 'ACTIVE') {
        const rate = Number(ambassador.commissionRate);
        const commissionAmount = Math.round(Number(order.total) * rate) / 100;

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

  // Mark webhook as completed
  await completeWebhookEvent(eventId, order.id, journalEntryId);

  // Send confirmation email (non-blocking)
  if (userId && userId !== 'guest') {
    await sendOrderConfirmationEmailAsync(order.id, userId);
  }
}

async function handleRefund(charge: Stripe.Charge, eventId: string) {
  logger.info('Charge refunded', { chargeId: charge.id });

  // Find the order
  const order = await prisma.order.findFirst({
    where: { stripePaymentId: charge.payment_intent as string },
  });

  if (!order) {
    logger.error('Order not found for refund', { paymentIntent: charge.payment_intent });
    await completeWebhookEvent(eventId);
    return;
  }

  // Update order status
  await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: charge.amount_refunded === charge.amount ? 'REFUNDED' : 'PAID',
      status: charge.amount_refunded === charge.amount ? 'CANCELLED' : order.status,
    },
  });

  // Create refund accounting entries
  try {
    const { createRefundAccountingEntries } = await import('@/lib/accounting/webhook-accounting.service');
    const refundAmount = (charge.amount_refunded || 0) / 100;
    const tps = Number(order.taxTps);
    const tvq = Number(order.taxTvq);
    const tvh = Number(order.taxTvh);
    const orderTotal = Number(order.total);
    const refundRatio = refundAmount / orderTotal;

    await createRefundAccountingEntries(
      order.id,
      refundAmount,
      Math.round(tps * refundRatio * 100) / 100,
      Math.round(tvq * refundRatio * 100) / 100,
      Math.round(tvh * refundRatio * 100) / 100,
      'Remboursement Stripe'
    );
  } catch (acctError) {
    logger.error('Failed to create refund accounting entries', {
      orderId: order.id,
      error: acctError instanceof Error ? acctError.message : String(acctError),
    });
  }

  // Restore inventory for full refunds
  if (charge.amount_refunded === charge.amount) {
    try {
      const transactions = await prisma.inventoryTransaction.findMany({
        where: { orderId: order.id, type: 'SALE' },
      });
      for (const tx of transactions) {
        if (tx.formatId) {
          await prisma.productFormat.update({
            where: { id: tx.formatId },
            data: { stockQuantity: { increment: Math.abs(tx.quantity) } },
          });
        }
        await prisma.inventoryTransaction.create({
          data: {
            productId: tx.productId,
            formatId: tx.formatId,
            type: 'RETURN',
            quantity: Math.abs(tx.quantity),
            unitCost: tx.unitCost,
            runningWAC: tx.runningWAC,
            orderId: order.id,
            reason: 'Remboursement complet',
          },
        });
      }
    } catch (invError) {
      logger.error('Failed to restore inventory for refund', {
        orderId: order.id,
        error: invError instanceof Error ? invError.message : String(invError),
      });
    }
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
      include: { items: true, currency: true },
    });

    if (!order) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, locale: true },
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
    };

    const emailContent = orderConfirmationEmail(orderData);

    const result = await sendEmail({
      to: { email: user.email, name: user.name || undefined },
      subject: emailContent.subject,
      html: emailContent.html,
      tags: ['order', 'confirmation', order.orderNumber],
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

  await prisma.order.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
  });

  // Release any inventory reservations
  const order = await prisma.order.findFirst({
    where: { stripePaymentId: paymentIntent.id },
  });
  if (order) {
    await prisma.inventoryReservation.updateMany({
      where: { orderId: order.id, status: 'RESERVED' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });
  }
}
