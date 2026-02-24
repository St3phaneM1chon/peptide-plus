export const dynamic = 'force-dynamic';

/**
 * API pour envoyer des emails de commande
 * POST /api/emails/send-order-email
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import {
  sendEmail,
  orderConfirmationEmail,
  orderProcessingEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
  orderRefundEmail,
  satisfactionSurveyEmail,
  generateUnsubscribeUrl,
  type OrderData,
} from '@/lib/email';

const orderEmailSchema = z.object({
  orderId: z.string().min(1, 'orderId is required'),
  emailType: z.enum(['confirmation', 'processing', 'shipped', 'delivered', 'cancelled', 'refund', 'satisfaction'], {
    errorMap: () => ({ message: 'Invalid emailType' }),
  }),
  trackingNumber: z.string().optional(),
  trackingUrl: z.string().url().optional().or(z.literal('')),
  carrier: z.string().optional(),
  estimatedDelivery: z.string().optional(),
  cancellationReason: z.string().optional(),
  refundAmount: z.number().optional(),
  refundIsPartial: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/emails/send-order-email');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Vérifier l'authentification (admin ou système)
    const session = await auth();
    const apiKey = request.headers.get('x-api-key');

    // Autoriser si admin ou si clé API valide
    const isAdmin = session?.user?.role === 'OWNER' || session?.user?.role === 'EMPLOYEE';
    const isValidApiKey = apiKey === process.env.INTERNAL_API_KEY;

    if (!isAdmin && !isValidApiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = orderEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { orderId, emailType, trackingNumber, trackingUrl, carrier, estimatedDelivery, cancellationReason, refundAmount, refundIsPartial } = parsed.data;

    // Récupérer la commande
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        currency: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Récupérer l'utilisateur
    const user = await db.user.findUnique({
      where: { id: order.userId },
      select: { name: true, email: true, locale: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Préparer les données de commande
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
      trackingNumber: trackingNumber || order.trackingNumber || undefined,
      trackingUrl: trackingUrl || order.trackingUrl || undefined,
      carrier: carrier || order.carrier || undefined,
      estimatedDelivery: estimatedDelivery,
      locale: (user.locale as 'fr' | 'en') || 'fr',
      cancellationReason,
      refundAmount,
      refundIsPartial,
      // CAN-SPAM / RGPD / LCAP compliance
      unsubscribeUrl: await generateUnsubscribeUrl(user.email, 'transactional', order.userId).catch(() => undefined),
    };

    // Générer l'email selon le type
    let emailContent: { subject: string; html: string };
    
    switch (emailType) {
      case 'confirmation':
        emailContent = orderConfirmationEmail(orderData);
        break;
      case 'processing':
        emailContent = orderProcessingEmail(orderData);
        break;
      case 'shipped':
        if (!orderData.trackingNumber) {
          return NextResponse.json({ error: 'trackingNumber is required for shipped email' }, { status: 400 });
        }
        emailContent = orderShippedEmail(orderData);
        break;
      case 'delivered':
        emailContent = orderDeliveredEmail(orderData);
        break;
      case 'cancelled':
        emailContent = orderCancelledEmail(orderData);
        break;
      case 'refund':
        emailContent = orderRefundEmail(orderData);
        break;
      case 'satisfaction':
        emailContent = satisfactionSurveyEmail(orderData);
        break;
      default:
        return NextResponse.json({ error: 'Invalid emailType' }, { status: 400 });
    }

    // Envoyer l'email
    const result = await sendEmail({
      to: { email: user.email, name: user.name || undefined },
      subject: emailContent.subject,
      html: emailContent.html,
      tags: ['order', emailType, order.orderNumber],
      unsubscribeUrl: orderData.unsubscribeUrl,
    });

    if (!result.success) {
      logger.error('Failed to send order email', { error: result.error || 'Unknown error' });
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    // Log l'envoi
    logger.info(`Order email sent: ${emailType} for order ${order.orderNumber} to ${user.email}`);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      emailType,
      orderId,
      recipient: user.email,
    });

  } catch (error) {
    logger.error('Send order email error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
