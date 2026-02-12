/**
 * API pour envoyer des emails de commande
 * POST /api/emails/send-order-email
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import {
  sendEmail,
  orderConfirmationEmail,
  orderProcessingEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  satisfactionSurveyEmail,
  type OrderData,
} from '@/lib/email';

type EmailType = 'confirmation' | 'processing' | 'shipped' | 'delivered' | 'satisfaction';

export async function POST(request: NextRequest) {
  try {
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
    const { orderId, emailType, trackingNumber, trackingUrl, carrier, estimatedDelivery } = body as {
      orderId: string;
      emailType: EmailType;
      trackingNumber?: string;
      trackingUrl?: string;
      carrier?: string;
      estimatedDelivery?: string;
    };

    if (!orderId || !emailType) {
      return NextResponse.json({ error: 'orderId and emailType are required' }, { status: 400 });
    }

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
    });

    if (!result.success) {
      console.error('Failed to send order email:', result.error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    // Log l'envoi
    console.log(`📧 Order email sent: ${emailType} for order ${order.orderNumber} to ${user.email}`);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      emailType,
      orderId,
      recipient: user.email,
    });

  } catch (error) {
    console.error('Send order email error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
