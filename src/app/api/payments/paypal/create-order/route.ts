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
import { getPayPalAccessToken, PAYPAL_API_URL } from '@/lib/paypal';

export async function POST(request: NextRequest) {
  try {
    // Fix 4: Request body size limit (1MB)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1_000_000) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // BE-PAY-05: Idempotency key to prevent duplicate PayPal orders
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findFirst({
        where: { idempotencyKey },
      });
      if (existingOrder) {
        return NextResponse.json({
          orderId: existingOrder.paypalOrderId,
          message: 'Duplicate request - existing order returned',
        });
      }
    }

    const body = await request.json();
    const { items, currency = 'CAD', shippingInfo, promoCode, giftCardCode, giftCardDiscount: clientGiftCardDiscount } = body;

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return NextResponse.json({ error: 'PayPal n\'est pas configuré' }, { status: 503 });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    // SECURITY: Validate ALL prices from the database
    const verifiedItems: { productId: string; formatId: string | null; name: string; format: string; quantity: number; price: number; productType: string }[] = [];
    let serverSubtotal = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return NextResponse.json({ error: 'Données article invalides' }, { status: 400 });
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, price: true, isActive: true, productType: true },
      });

      if (!product || !product.isActive) {
        return NextResponse.json({ error: `Produit introuvable: ${item.productId}` }, { status: 400 });
      }

      let verifiedPrice = Number(product.price);
      let formatName = '';

      if (item.formatId) {
        const format = await prisma.productFormat.findUnique({
          where: { id: item.formatId },
          select: { name: true, price: true, productId: true },
        });
        if (!format) {
          return NextResponse.json({ error: `Format introuvable: ${item.formatId}` }, { status: 400 });
        }
        // SECURITY: Verify format belongs to the product
        if (format.productId !== item.productId) {
          return NextResponse.json({ error: 'Le format ne correspond pas au produit' }, { status: 400 });
        }
        verifiedPrice = Number(format.price);
        formatName = format.name;
      }

      const quantity = Math.max(1, Math.floor(item.quantity));
      serverSubtotal += verifiedPrice * quantity;

      verifiedItems.push({
        productId: product.id,
        formatId: item.formatId || null,
        name: product.name,
        format: formatName,
        quantity,
        price: verifiedPrice,
        productType: product.productType,
      });
    }

    serverSubtotal = Math.round(serverSubtotal * 100) / 100;

    // SECURITY: Validate promo code server-side
    // BE-PAY-06: Enforce single promo code per order (prevent stacking)
    let serverPromoDiscount = 0;
    if (promoCode) {
      if (Array.isArray(promoCode) || (typeof promoCode === 'string' && promoCode.includes(','))) {
        return NextResponse.json(
          { error: 'Un seul code promo par commande est autorisé' },
          { status: 400 }
        );
      }
      const singlePromoCode = String(promoCode).trim().toUpperCase();
      const promo = await prisma.promoCode.findUnique({ where: { code: singlePromoCode } });
      if (promo && promo.isActive) {
        const now = new Date();
        const notExpired = (!promo.startsAt || promo.startsAt <= now) && (!promo.endsAt || promo.endsAt >= now);
        const withinUsageLimit = !promo.usageLimit || promo.usageCount < promo.usageLimit;
        if (notExpired && withinUsageLimit) {
          if (promo.type === 'PERCENTAGE') {
            serverPromoDiscount = Math.round(serverSubtotal * (Number(promo.value) / 100) * 100) / 100;
          } else {
            serverPromoDiscount = Math.min(Number(promo.value), serverSubtotal);
          }
          if (promo.maxDiscount) {
            serverPromoDiscount = Math.min(serverPromoDiscount, Number(promo.maxDiscount));
          }
        }
      }
    }

    const discountedSubtotal = Math.max(0, serverSubtotal - serverPromoDiscount);

    // BE-PAY-04: Validate gift card server-side
    let serverGiftCardDiscount = 0;
    let validatedGiftCardCode = '';

    if (giftCardCode && clientGiftCardDiscount > 0) {
      const giftCard = await prisma.giftCard.findUnique({
        where: { code: giftCardCode.toUpperCase().trim() },
      });
      if (giftCard && giftCard.isActive && Number(giftCard.balance) > 0) {
        const isExpired = giftCard.expiresAt && new Date() > giftCard.expiresAt;
        if (!isExpired) {
          serverGiftCardDiscount = Math.min(
            Number(giftCard.balance),
            discountedSubtotal
          );
          validatedGiftCardCode = giftCard.code;
        }
      }
    }

    const subtotalAfterAllDiscounts = Math.max(0, discountedSubtotal - serverGiftCardDiscount);

    // SECURITY: Calculate taxes server-side - all Canadian provinces/territories
    // BE-PAY-11, BE-PAY-20: Fixed to handle PST for BC/MB/SK, not just QC+HST
    const province = shippingInfo?.province || 'QC';
    const country = shippingInfo?.country || 'CA';
    const CANADIAN_TAX_RATES: Record<string, { gst: number; pst?: number; hst?: number; qst?: number; rst?: number }> = {
      'AB': { gst: 0.05 },
      'BC': { gst: 0.05, pst: 0.07 },
      'MB': { gst: 0.05, rst: 0.07 },
      'NB': { gst: 0, hst: 0.15 },
      'NL': { gst: 0, hst: 0.15 },
      'NS': { gst: 0, hst: 0.14 },
      'NT': { gst: 0.05 },
      'NU': { gst: 0.05 },
      'ON': { gst: 0, hst: 0.13 },
      'PE': { gst: 0, hst: 0.15 },
      'QC': { gst: 0.05, qst: 0.09975 },
      'SK': { gst: 0.05, pst: 0.06 },
      'YT': { gst: 0.05 },
    };
    const rates = CANADIAN_TAX_RATES[province.toUpperCase()] || CANADIAN_TAX_RATES['QC'];
    let taxTotal = 0;
    if (rates.hst) {
      taxTotal = Math.round(subtotalAfterAllDiscounts * rates.hst * 100) / 100;
    } else if (rates.qst) {
      taxTotal = Math.round(subtotalAfterAllDiscounts * rates.gst * 100) / 100
        + Math.round(subtotalAfterAllDiscounts * rates.qst * 100) / 100;
    } else if (rates.pst || rates.rst) {
      taxTotal = Math.round(subtotalAfterAllDiscounts * rates.gst * 100) / 100
        + Math.round(subtotalAfterAllDiscounts * (rates.pst || rates.rst || 0) * 100) / 100;
    } else {
      taxTotal = Math.round(subtotalAfterAllDiscounts * rates.gst * 100) / 100;
    }

    // SECURITY: Calculate shipping server-side
    const productTypes = verifiedItems.map(i => i.productType);
    const hasLabSupply = productTypes.some(t => t === 'LAB_SUPPLY');
    let serverShipping = 0;
    if (country === 'CA') {
      const threshold = hasLabSupply ? 300 : 100;
      serverShipping = serverSubtotal >= threshold ? 0 : 9.99;
    } else if (country === 'US') {
      serverShipping = 14.99;
    } else {
      serverShipping = 24.99;
    }

    const serverTotal = Math.round((subtotalAfterAllDiscounts + taxTotal + serverShipping) * 100) / 100;

    // BE-PAY-10: Reserve inventory atomically (prevents overselling)
    let reservationIds: string[] = [];
    try {
      reservationIds = await prisma.$transaction(async (tx) => {
        const ids: string[] = [];
        for (const item of verifiedItems) {
          if (item.formatId) {
            // Lock the format row to prevent concurrent overselling
            const [format] = await tx.$queryRaw<{ stock_quantity: number; track_inventory: boolean }[]>`
              SELECT "stockQuantity" as stock_quantity, "trackInventory" as track_inventory
              FROM "ProductFormat"
              WHERE id = ${item.formatId}
              FOR UPDATE
            `;

            if (format?.track_inventory && format.stock_quantity < item.quantity) {
              throw new Error(`Stock insuffisant pour ${item.name}. Disponible: ${format.stock_quantity}`);
            }

            const reservation = await tx.inventoryReservation.create({
              data: {
                productId: item.productId,
                formatId: item.formatId,
                quantity: item.quantity,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min TTL
              },
            });
            ids.push(reservation.id);
          }
        }
        return ids;
      });
    } catch (stockError) {
      if (reservationIds.length > 0) {
        await prisma.inventoryReservation.updateMany({
          where: { id: { in: reservationIds } },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      }
      const errorMsg = stockError instanceof Error ? stockError.message : 'Erreur lors de la réservation du stock';
      console.error('Stock reservation error (PayPal):', stockError);
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

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
                value: subtotalAfterAllDiscounts.toFixed(2),
              },
              shipping: {
                currency_code: currency.toUpperCase(),
                value: serverShipping.toFixed(2),
              },
              tax_total: {
                currency_code: currency.toUpperCase(),
                value: taxTotal.toFixed(2),
              },
            },
          },
          items: verifiedItems.map((item) => {
            // Apply proportional discount (promo + gift card) to each item
            const totalDiscount = serverPromoDiscount + serverGiftCardDiscount;
            const discountRatio = totalDiscount > 0 ? totalDiscount / serverSubtotal : 0;
            const itemDiscount = Math.round(item.price * discountRatio * 100) / 100;
            const discountedPrice = Math.round((item.price - itemDiscount) * 100) / 100;
            return {
              name: item.name,
              description: item.format || '',
              quantity: item.quantity.toString(),
              unit_amount: {
                currency_code: currency.toUpperCase(),
                value: discountedPrice.toFixed(2),
              },
              category: 'PHYSICAL_GOODS',
            };
          }),
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
      // BE-PAY-04: Return validated gift card info for capture flow
      giftCardCode: validatedGiftCardCode || undefined,
      giftCardDiscount: serverGiftCardDiscount || undefined,
    });
  } catch (error) {
    console.error('PayPal error:', error);
    return NextResponse.json({ error: 'Erreur PayPal' }, { status: 500 });
  }
}
