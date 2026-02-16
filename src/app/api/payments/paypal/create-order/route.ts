export const dynamic = 'force-dynamic';

/**
 * API Route - Création de commande PayPal
 */

/**
 * API Route - Création de commande PayPal
 * SECURITY: All prices validated server-side from database
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

const PAYPAL_API_URL = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  const authStr = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authStr}`,
      'Content-Type': 'application/x-www-form-urlencoded',
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

    const body = await request.json();
    const { items, currency = 'CAD', shippingInfo } = body;

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return NextResponse.json({ error: 'PayPal n\'est pas configuré' }, { status: 503 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    // SECURITY: Validate ALL prices from the database
    const verifiedItems: { name: string; format: string; quantity: number; price: number }[] = [];
    let serverSubtotal = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return NextResponse.json({ error: 'Données article invalides' }, { status: 400 });
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true, price: true, isActive: true },
      });

      if (!product || !product.isActive) {
        return NextResponse.json({ error: `Produit introuvable: ${item.productId}` }, { status: 400 });
      }

      let verifiedPrice = Number(product.price);
      let formatName = '';

      if (item.formatId) {
        const format = await prisma.productFormat.findUnique({
          where: { id: item.formatId },
          select: { name: true, price: true },
        });
        if (!format) {
          return NextResponse.json({ error: `Format introuvable: ${item.formatId}` }, { status: 400 });
        }
        verifiedPrice = Number(format.price);
        formatName = format.name;
      }

      const quantity = Math.max(1, Math.floor(item.quantity));
      serverSubtotal += verifiedPrice * quantity;

      verifiedItems.push({
        name: product.name,
        format: formatName,
        quantity,
        price: verifiedPrice,
      });
    }

    serverSubtotal = Math.round(serverSubtotal * 100) / 100;
    const serverTotal = serverSubtotal; // Shipping/taxes handled by PayPal or added separately

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_API_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: `order_${Date.now()}`,
          description: 'Commande BioCycle Peptides',
          amount: {
            currency_code: currency.toUpperCase(),
            value: serverTotal.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: currency.toUpperCase(),
                value: serverSubtotal.toFixed(2),
              },
            },
          },
          items: verifiedItems.map((item) => ({
            name: item.name,
            description: item.format || '',
            quantity: item.quantity.toString(),
            unit_amount: {
              currency_code: currency.toUpperCase(),
              value: item.price.toFixed(2),
            },
            category: 'PHYSICAL_GOODS',
          })),
          shipping: shippingInfo ? {
            name: { full_name: `${shippingInfo.firstName} ${shippingInfo.lastName}` },
            address: {
              address_line_1: shippingInfo.address,
              address_line_2: shippingInfo.apartment || undefined,
              admin_area_2: shippingInfo.city,
              admin_area_1: shippingInfo.province,
              postal_code: shippingInfo.postalCode,
              country_code: shippingInfo.country,
            },
          } : undefined,
        }],
        application_context: {
          brand_name: 'BioCycle Peptides',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
        },
      }),
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('PayPal order creation error:', order);
      return NextResponse.json({ error: 'Erreur lors de la création de la commande PayPal' }, { status: 500 });
    }

    return NextResponse.json({
      orderId: order.id,
      approvalUrl: order.links.find((link: { rel: string; href: string }) => link.rel === 'approve')?.href,
    });
  } catch (error) {
    console.error('PayPal error:', error);
    return NextResponse.json({ error: 'Erreur PayPal' }, { status: 500 });
  }
}
