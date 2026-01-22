/**
 * API - Créer une commande PayPal
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

const PAYPAL_API_URL = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
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

    const { productId, companyId } = await request.json();

    if (!productId) {
      return NextResponse.json({ error: 'Product ID requis' }, { status: 400 });
    }

    // Récupérer le produit
    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }

    // Calculer le total avec taxes
    const subtotal = Number(product.price);
    const tps = subtotal * 0.05;
    const tvq = subtotal * 0.09975;
    const total = (subtotal + tps + tvq).toFixed(2);

    // Obtenir le token PayPal
    const accessToken = await getPayPalAccessToken();

    // Créer la commande PayPal
    const orderResponse = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: productId,
            description: product.name,
            amount: {
              currency_code: 'CAD',
              value: total,
              breakdown: {
                item_total: {
                  currency_code: 'CAD',
                  value: subtotal.toFixed(2),
                },
                tax_total: {
                  currency_code: 'CAD',
                  value: (tps + tvq).toFixed(2),
                },
              },
            },
            items: [
              {
                name: product.name,
                description: product.shortDescription || '',
                unit_amount: {
                  currency_code: 'CAD',
                  value: subtotal.toFixed(2),
                },
                quantity: '1',
                category: 'DIGITAL_GOODS',
              },
            ],
          },
        ],
        application_context: {
          brand_name: 'Formations Pro',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.NEXTAUTH_URL}/checkout/paypal/success?product=${productId}`,
          cancel_url: `${process.env.NEXTAUTH_URL}/checkout/${product.slug}`,
        },
      }),
    });

    const orderData = await orderResponse.json();

    if (orderData.error) {
      console.error('PayPal error:', orderData.error);
      return NextResponse.json({ error: 'Erreur PayPal' }, { status: 500 });
    }

    // Créer l'achat en statut pending
    await prisma.purchase.create({
      data: {
        userId: session.user.id,
        productId,
        companyId: companyId || null,
        amount: subtotal,
        currency: 'CAD',
        paymentMethod: 'PAYPAL',
        paypalOrderId: orderData.id,
        status: 'PENDING',
        receiptNumber: `REC-${Date.now()}`,
      },
    });

    // Trouver l'URL d'approbation
    const approvalUrl = orderData.links.find(
      (link: { rel: string }) => link.rel === 'approve'
    )?.href;

    return NextResponse.json({
      orderId: orderData.id,
      approvalUrl,
    });
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la commande PayPal' },
      { status: 500 }
    );
  }
}
