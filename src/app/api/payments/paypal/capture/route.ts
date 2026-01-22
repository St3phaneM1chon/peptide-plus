/**
 * API - Capturer un paiement PayPal
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

const PAYPAL_API_URL = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  const authString = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authString}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { orderId } = await request.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID requis' }, { status: 400 });
    }

    // Récupérer l'achat
    const purchase = await prisma.purchase.findFirst({
      where: {
        paypalOrderId: orderId,
        userId: session.user.id,
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Achat non trouvé' }, { status: 404 });
    }

    // Capturer le paiement
    const accessToken = await getPayPalAccessToken();

    const captureResponse = await fetch(
      `${PAYPAL_API_URL}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const captureData = await captureResponse.json();

    if (captureData.status === 'COMPLETED') {
      // Mettre à jour l'achat
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: {
          status: 'COMPLETED',
        },
      });

      // Créer l'accès au cours
      await prisma.courseAccess.create({
        data: {
          userId: session.user.id,
          productId: purchase.productId,
          purchaseId: purchase.id,
        },
      });

      // Incrémenter le compteur d'achats
      await prisma.product.update({
        where: { id: purchase.productId },
        data: { purchaseCount: { increment: 1 } },
      });

      // Log d'audit
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'PAYPAL_PAYMENT_CAPTURED',
          entityType: 'Purchase',
          entityId: purchase.id,
          details: JSON.stringify({
            paypalOrderId: orderId,
          }),
        },
      });

      return NextResponse.json({
        success: true,
        purchaseId: purchase.id,
      });
    } else {
      // Paiement échoué
      await prisma.purchase.update({
        where: { id: purchase.id },
        data: { status: 'FAILED' },
      });

      return NextResponse.json(
        { error: 'Le paiement PayPal a échoué' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error capturing PayPal payment:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la capture du paiement' },
      { status: 500 }
    );
  }
}
