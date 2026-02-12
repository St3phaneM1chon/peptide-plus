/**
 * Webhook Stripe - Traitement des événements de paiement
 * Avec idempotence, création comptable automatique, et envoi d'emails
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { sendEmail, orderConfirmationEmail, type OrderData } from '@/lib/email';
import { createAccountingEntriesForOrder } from '@/lib/accounting/webhook-accounting.service';
import { generateCOGSEntry } from '@/lib/inventory';

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
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Idempotence check: if already processed, return 200 immediately
    if (await checkIdempotence(event.id)) {
      console.log(`Webhook ${event.id} already processed, skipping`);
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
          console.log(`Unhandled event type: ${event.type}`);
          await completeWebhookEvent(event.id);
      }

      return NextResponse.json({ received: true });
    } catch (processError) {
      const errorMsg = processError instanceof Error ? processError.message : 'Unknown error';
      console.error(`Webhook processing error for ${event.id}:`, errorMsg);
      await failWebhookEvent(event.id, errorMsg);
      return NextResponse.json(
        { error: 'Webhook handler failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session, eventId: string) {
  console.log('Checkout session completed:', session.id);

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

  // Generate order number
  const orderNumber = `PP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

  // Find or create currency
  let currency = await prisma.currency.findUnique({
    where: { code: session.currency?.toUpperCase() || 'CAD' }
  });

  if (!currency) {
    currency = await prisma.currency.create({
      data: {
        code: session.currency?.toUpperCase() || 'CAD',
        name: session.currency?.toUpperCase() === 'USD' ? 'US Dollar' : 'Dollar canadien',
        symbol: '$',
        exchangeRate: 1,
      }
    });
  }

  // Calculate amounts from Stripe if not in metadata
  const stripeSubtotal = subtotal || (session.amount_subtotal || 0) / 100;
  const stripeTotal = (session.amount_total || 0) / 100;
  const totalTax = taxTps + taxTvq + taxTvh;

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
        total: stripeTotal,
        currencyId: currency!.id,
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
          create: cartItems.map((item: any) => ({
            productId: item.productId,
            formatId: item.formatId || null,
            productName: item.name,
            formatName: item.formatName || null,
            sku: item.sku || null,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount || 0,
            total: item.price * item.quantity - (item.discount || 0),
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

  console.log('Order created:', order.id, 'Number:', orderNumber);

  // Create accounting entries (non-blocking - don't fail the webhook)
  let journalEntryId: string | undefined;
  try {
    const result = await createAccountingEntriesForOrder(order.id);
    journalEntryId = result.saleEntryId;
    console.log(`Accounting entries created for ${orderNumber}: sale=${result.saleEntryId}, fee=${result.feeEntryId}, invoice=${result.invoiceId}`);
  } catch (acctError) {
    console.error(`Failed to create accounting entries for ${orderNumber}:`, acctError);
    // Don't fail the webhook for accounting errors
  }

  // Generate COGS entry (non-blocking)
  try {
    await generateCOGSEntry(order.id);
    console.log(`COGS entry created for ${orderNumber}`);
  } catch (cogsError) {
    console.error(`Failed to create COGS entry for ${orderNumber}:`, cogsError);
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
      console.error('Failed to track promo code usage:', promoError);
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
  console.log('Charge refunded:', charge.id);

  // Find the order
  const order = await prisma.order.findFirst({
    where: { stripePaymentId: charge.payment_intent as string },
  });

  if (!order) {
    console.error('Order not found for refund:', charge.payment_intent);
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
    const totalTax = tps + tvq + tvh;
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
    console.error('Failed to create refund accounting entries:', acctError);
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
      console.error('Failed to restore inventory for refund:', invError);
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
      console.log(`Confirmation email sent for order ${order.orderNumber} to ${user.email}`);
    } else {
      console.error(`Failed to send confirmation email: ${result.error}`);
    }
  } catch (error) {
    console.error('Error sending order confirmation email:', error);
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment succeeded:', paymentIntent.id);
  await prisma.order.updateMany({
    where: { stripePaymentId: paymentIntent.id },
    data: { paymentStatus: 'PAID' },
  });
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment failed:', paymentIntent.id);

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
