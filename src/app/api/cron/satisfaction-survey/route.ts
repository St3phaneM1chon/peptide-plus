/**
 * CRON Job - Emails de satisfaction
 * Envoie un email de demande d'avis 5 jours après la livraison
 * 
 * Configuration Vercel (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/satisfaction-survey",
 *     "schedule": "0 10 * * *"
 *   }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, satisfactionSurveyEmail, type OrderData } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    // Vérifier la clé de sécurité
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Trouver les commandes livrées il y a 5 jours
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    fiveDaysAgo.setHours(0, 0, 0, 0);

    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
    sixDaysAgo.setHours(0, 0, 0, 0);

    // Commandes livrées entre 5 et 6 jours
    const deliveredOrders = await db.order.findMany({
      where: {
        status: 'DELIVERED',
        deliveredAt: {
          gte: sixDaysAgo,
          lt: fiveDaysAgo,
        },
        // Vérifier qu'on n'a pas déjà envoyé un email de satisfaction
        // On pourrait ajouter un champ satisfactionEmailSent au modèle Order
      },
      include: {
        items: true,
        currency: true,
      },
    });

    console.log(`📊 Found ${deliveredOrders.length} orders to send satisfaction survey`);

    const results = [];

    for (const order of deliveredOrders) {
      try {
        // Récupérer l'utilisateur
        const user = await db.user.findUnique({
          where: { id: order.userId },
          select: { name: true, email: true, locale: true },
        });

        if (!user) continue;

        // Préparer les données
        const orderData: OrderData = {
          orderNumber: order.orderNumber,
          customerName: user.name || 'Client',
          customerEmail: user.email,
          items: order.items.map(item => ({
            name: item.productName,
            quantity: item.quantity,
            price: Number(item.unitPrice),
          })),
          subtotal: Number(order.subtotal),
          shipping: Number(order.shippingCost),
          tax: Number(order.tax),
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

        const emailContent = satisfactionSurveyEmail(orderData);

        const result = await sendEmail({
          to: { email: user.email, name: user.name || undefined },
          subject: emailContent.subject,
          html: emailContent.html,
          tags: ['satisfaction', 'automated', order.orderNumber],
        });

        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          email: user.email,
          success: result.success,
          messageId: result.messageId,
        });

        console.log(`📊 Satisfaction survey sent for order ${order.orderNumber} to ${user.email}`);

      } catch (error) {
        console.error(`Failed to send satisfaction email for order ${order.id}:`, error);
        results.push({
          orderId: order.id,
          orderNumber: order.orderNumber,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      date: new Date().toISOString(),
      processed: deliveredOrders.length,
      results,
    });

  } catch (error) {
    console.error('Satisfaction survey cron job error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export { GET as POST };
