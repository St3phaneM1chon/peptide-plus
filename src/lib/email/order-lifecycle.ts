/**
 * Order Lifecycle Email Dispatcher - BioCycle Peptides
 *
 * Centralised module that:
 *  1. Loads full order + user data from the database
 *  2. Builds the OrderData payload
 *  3. Picks the right template based on the event
 *  4. Sends the email via the configured provider
 *  5. Logs the result to the audit table
 *
 * Usage (fire-and-forget, never blocks the caller):
 *   sendOrderLifecycleEmail(orderId, 'SHIPPED').catch(console.error);
 */

import { prisma } from '@/lib/db';
import { sendEmail } from './email-service';
import {
  orderConfirmationEmail,
  orderProcessingEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
  orderRefundEmail,
  type OrderData,
} from './templates/order-emails';

// ─── Public types ────────────────────────────────────────────────────────────

export type OrderEmailEvent =
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface OrderEmailOptions {
  /** Override tracking number (e.g. just set in the same request) */
  trackingNumber?: string;
  /** Override carrier */
  carrier?: string;
  /** Override tracking URL */
  trackingUrl?: string;
  /** Estimated delivery date string */
  estimatedDelivery?: string;
  /** Cancellation reason (for CANCELLED emails) */
  cancellationReason?: string;
  /** Refund amount in the order currency (for REFUNDED emails) */
  refundAmount?: number;
  /** Whether the refund is partial (for REFUNDED emails) */
  refundIsPartial?: boolean;
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────

/**
 * Send the appropriate lifecycle email for an order event.
 *
 * This function is designed to be called asynchronously (fire-and-forget)
 * so it never throws — all errors are caught and logged.
 */
export async function sendOrderLifecycleEmail(
  orderId: string,
  event: OrderEmailEvent,
  options: OrderEmailOptions = {},
): Promise<void> {
  try {
    // ── 1. Load order with items + currency ───────────────────────────────
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        currency: { select: { code: true } },
      },
    });

    if (!order) {
      console.error(`[OrderLifecycleEmail] Order ${orderId} not found — skipping ${event} email`);
      return;
    }

    // ── 2. Load user ──────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { id: true, name: true, email: true, locale: true },
    });

    if (!user) {
      console.error(`[OrderLifecycleEmail] User ${order.userId} not found — skipping ${event} email for order ${order.orderNumber}`);
      return;
    }

    // ── 3. Build OrderData ────────────────────────────────────────────────
    const locale = (user.locale === 'en' ? 'en' : 'fr') as 'fr' | 'en';

    const orderData: OrderData = {
      orderNumber: order.orderNumber,
      customerName: user.name || (locale === 'fr' ? 'Client' : 'Customer'),
      customerEmail: user.email,
      items: order.items.map((item) => ({
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
      trackingNumber: options.trackingNumber || order.trackingNumber || undefined,
      trackingUrl: options.trackingUrl || order.trackingUrl || undefined,
      carrier: options.carrier || order.carrier || undefined,
      estimatedDelivery: options.estimatedDelivery,
      locale,
      cancellationReason: options.cancellationReason,
      refundAmount: options.refundAmount,
      refundIsPartial: options.refundIsPartial,
    };

    // ── 4. Pick template ──────────────────────────────────────────────────
    let emailContent: { subject: string; html: string };

    switch (event) {
      case 'CONFIRMED':
        emailContent = orderConfirmationEmail(orderData);
        break;
      case 'PROCESSING':
        emailContent = orderProcessingEmail(orderData);
        break;
      case 'SHIPPED':
        emailContent = orderShippedEmail(orderData);
        break;
      case 'DELIVERED':
        emailContent = orderDeliveredEmail(orderData);
        break;
      case 'CANCELLED':
        emailContent = orderCancelledEmail(orderData);
        break;
      case 'REFUNDED':
        emailContent = orderRefundEmail(orderData);
        break;
      default:
        console.error(`[OrderLifecycleEmail] Unknown event: ${event}`);
        return;
    }

    // ── 5. Send ───────────────────────────────────────────────────────────
    const result = await sendEmail({
      to: { email: user.email, name: user.name || undefined },
      subject: emailContent.subject,
      html: emailContent.html,
      tags: ['order', event.toLowerCase(), order.orderNumber],
    });

    // ── 6. Audit log ──────────────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EMAIL_SENT',
        entityType: 'Email',
        details: JSON.stringify({
          type: `ORDER_${event}`,
          orderNumber: order.orderNumber,
          orderId: order.id,
          locale,
          sent: result.success,
          messageId: result.messageId,
          error: result.error,
        }),
      },
    }).catch((err) => {
      console.error('[OrderLifecycleEmail] Failed to write audit log:', err);
    });

    if (result.success) {
      console.log(
        `[OrderLifecycleEmail] ${event} email sent for order ${order.orderNumber} to ${user.email} (msgId: ${result.messageId})`,
      );
    } else {
      console.error(
        `[OrderLifecycleEmail] Failed to send ${event} email for order ${order.orderNumber}: ${result.error}`,
      );
    }
  } catch (error) {
    console.error(`[OrderLifecycleEmail] Unexpected error sending ${event} email for order ${orderId}:`, error);
  }
}
