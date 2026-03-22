export const dynamic = 'force-dynamic';
/**
 * API - Créer une commande PayPal
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { getPayPalAccessToken, PAYPAL_API_URL } from '@/lib/paypal';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { add } from '@/lib/decimal-calculator';
import { calculateTaxAmount } from '@/lib/tax-rates';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const paypalCreateSchema = z.object({
  productId: z.string().min(1, 'Product ID requis'),
  optionId: z.string().optional(), // COMMERCE-023: Accept optionId for stock validation
  companyId: z.string().optional(),
  province: z.string().max(2).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting on PayPal order creation
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/payments/paypal/create');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

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

    // Early PayPal configuration check
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return NextResponse.json({ error: 'PayPal n\'est pas configuré' }, { status: 503 });
    }

    const body = await request.json();
    const parsed = paypalCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }
    const { productId, optionId, companyId, province: reqProvince } = parsed.data;

    // Récupérer le produit
    const product = await prisma.product.findUnique({
      where: { id: productId, isActive: true },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }

    // COMMERCE-023 FIX: Validate stock at format level before creating PayPal order
    let unitPrice = Number(product.price);
    if (optionId) {
      const format = await prisma.productOption.findUnique({
        where: { id: optionId },
        select: { price: true, productId: true, stockQuantity: true, trackInventory: true },
      });
      if (!format) {
        return NextResponse.json({ error: 'Format not found' }, { status: 404 });
      }
      if (format.productId !== productId) {
        return NextResponse.json({ error: 'Format does not belong to product' }, { status: 400 });
      }
      if (format.trackInventory && format.stockQuantity < 1) {
        return NextResponse.json({ error: 'Product is out of stock' }, { status: 400 });
      }
      unitPrice = Number(format.price);
    }

    // COMMERCE-015 FIX: Use shared tax calculation instead of inline duplicated rates
    const subtotal = unitPrice;
    const province = (reqProvince || 'QC').toUpperCase();
    const taxAmount = calculateTaxAmount(subtotal, province);
    const total = add(subtotal, taxAmount).toFixed(2);
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
                category: 'PHYSICAL_GOODS',
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
      logger.error('PayPal error', { error: orderData.error });
      return NextResponse.json({ error: 'Erreur PayPal' }, { status: 500 });
    }

    // Créer l'achat en statut pending
    await prisma.purchase.create({
      data: {
        userId: session.user.id,
        productId,
        companyId: companyId || null,
        amount: parseFloat(total),
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
    logger.error('Error creating PayPal order', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la commande PayPal' },
      { status: 500 }
    );
  }
}
