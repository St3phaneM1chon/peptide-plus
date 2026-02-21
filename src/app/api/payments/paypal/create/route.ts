export const dynamic = 'force-dynamic';
/**
 * API - Créer une commande PayPal
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { getPayPalAccessToken, PAYPAL_API_URL } from '@/lib/paypal';
import { validateCsrf } from '@/lib/csrf-middleware';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: CSRF protection for payment mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // BE-PAY-05: Idempotency key to prevent duplicate payments
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const existingPurchase = await prisma.purchase.findFirst({
        where: { idempotencyKey },
      });
      if (existingPurchase) {
        return NextResponse.json({
          orderId: existingPurchase.paypalOrderId,
          message: 'Duplicate request - existing payment returned',
        });
      }
    }

    const { productId, companyId, province: reqProvince } = await request.json();

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

    // BUG 3: Province-aware tax calculation (not hardcoded to QC)
    const subtotal = Number(product.price);
    const province = (reqProvince || 'QC').toUpperCase();
    const TAX_RATES: Record<string, { gst: number; pst?: number; hst?: number; qst?: number; rst?: number }> = {
      'AB': { gst: 0.05 }, 'BC': { gst: 0.05, pst: 0.07 }, 'MB': { gst: 0.05, rst: 0.07 },
      'NB': { gst: 0, hst: 0.15 }, 'NL': { gst: 0, hst: 0.15 }, 'NS': { gst: 0, hst: 0.14 },
      'NT': { gst: 0.05 }, 'NU': { gst: 0.05 }, 'ON': { gst: 0, hst: 0.13 },
      'PE': { gst: 0, hst: 0.15 }, 'QC': { gst: 0.05, qst: 0.09975 },
      'SK': { gst: 0.05, pst: 0.06 }, 'YT': { gst: 0.05 },
    };
    const rates = TAX_RATES[province] || TAX_RATES['QC'];
    let taxAmount = 0;
    if (rates.hst) {
      taxAmount = subtotal * rates.hst;
    } else {
      taxAmount = subtotal * rates.gst + subtotal * (rates.qst || rates.pst || rates.rst || 0);
    }
    const total = (subtotal + taxAmount).toFixed(2);
    const taxTotal = taxAmount.toFixed(2);

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
                  value: taxTotal,
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
          brand_name: 'BioCycle Peptides',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/paypal/success?product=${productId}`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${product.slug}`,
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
        receiptNumber: `REC-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
        idempotencyKey: idempotencyKey || undefined,
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
