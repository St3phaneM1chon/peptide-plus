/**
 * API Route - Création de commande PayPal
 */

import { NextRequest, NextResponse } from 'next/server';

const PAYPAL_API_URL = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { total, currency = 'CAD', items, shippingInfo } = body;

    // Vérifier que PayPal est configuré
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'PayPal n\'est pas configuré' },
        { status: 503 }
      );
    }

    const accessToken = await getPayPalAccessToken();

    // Créer la commande PayPal
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
          description: 'Commande Peptide Plus+',
          amount: {
            currency_code: currency.toUpperCase(),
            value: total.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: currency.toUpperCase(),
                value: items.reduce((sum: number, item: any) => 
                  sum + (item.price * item.quantity), 0
                ).toFixed(2),
              },
            },
          },
          items: items.map((item: any) => ({
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
            name: {
              full_name: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
            },
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
          brand_name: 'Peptide Plus+',
          landing_page: 'LOGIN',
          user_action: 'PAY_NOW',
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cart`,
        },
      }),
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('PayPal order creation error:', order);
      return NextResponse.json(
        { error: 'Erreur lors de la création de la commande PayPal' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId: order.id,
      approvalUrl: order.links.find((link: any) => link.rel === 'approve')?.href,
    });
  } catch (error) {
    console.error('PayPal error:', error);
    return NextResponse.json(
      { error: 'Erreur PayPal' },
      { status: 500 }
    );
  }
}
