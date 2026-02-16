export const dynamic = 'force-dynamic';

/**
 * API Route - Création de session Stripe Checkout
 * Supporte: Carte, Apple Pay, Google Pay
 * Stores tax breakdown & cart items in metadata for webhook processing
 *
 * SECURITY: All prices, taxes, shipping, and promo discounts are validated
 * server-side from the database. Client-sent values are NEVER trusted.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Server-side tax calculation (Quebec-based business)
function calculateServerTaxes(subtotal: number, province: string) {
  let tps = 0, tvq = 0, tvh = 0;
  const GST_RATE = 0.05;
  const QST_RATE = 0.09975;
  const HST_RATES: Record<string, number> = {
    ON: 0.13, NB: 0.15, NL: 0.15, NS: 0.15, PE: 0.15,
  };

  if (HST_RATES[province]) {
    tvh = Math.round(subtotal * HST_RATES[province] * 100) / 100;
  } else if (province === 'QC') {
    tps = Math.round(subtotal * GST_RATE * 100) / 100;
    tvq = Math.round(subtotal * QST_RATE * 100) / 100;
  } else {
    // AB, BC, SK, MB, YT, NT, NU -- GST only
    tps = Math.round(subtotal * GST_RATE * 100) / 100;
  }

  return { tps, tvq, tvh, total: Math.round((tps + tvq + tvh) * 100) / 100 };
}

// Server-side shipping calculation
function calculateServerShipping(subtotal: number, country: string): number {
  if (country === 'CA' && subtotal >= 100) return 0; // Free shipping over $100 CAD
  if (country === 'CA') return 9.99;
  if (country === 'US') return 14.99;
  return 24.99; // International
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const {
      items,
      shippingInfo,
      billingInfo,
      billingSameAsShipping,
      currency: currencyCode = 'CAD',
      promoCode,
      cartId,
      paymentMethod: clientPaymentMethod,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 });
    }

    // =====================================================
    // MULTI-CURRENCY: Look up exchange rate from DB
    // All product prices in DB are in CAD (base currency).
    // If the user selected a different currency, we convert
    // amounts using the stored exchange rate and tell Stripe
    // to charge in that currency.
    // =====================================================
    const currencyUpper = currencyCode.toUpperCase();
    let dbCurrency = await prisma.currency.findUnique({
      where: { code: currencyUpper },
    });

    // Fallback to CAD if requested currency not found
    if (!dbCurrency || !dbCurrency.isActive) {
      dbCurrency = await prisma.currency.findFirst({
        where: { isDefault: true },
      });
    }

    // If still no currency (empty DB), create CAD as default
    if (!dbCurrency) {
      dbCurrency = await prisma.currency.create({
        data: {
          code: 'CAD',
          name: 'Dollar canadien',
          symbol: '$',
          exchangeRate: 1,
          isDefault: true,
          isActive: true,
        },
      });
    }

    const exchangeRate = Number(dbCurrency.exchangeRate);
    const stripeCurrency = dbCurrency.code.toLowerCase();

    // =====================================================
    // SECURITY: Validate ALL prices from the database
    // =====================================================
    const verifiedItems: { productId: string; formatId: string | null; name: string; formatName: string | null; quantity: number; price: number; priceConverted: number; imageUrl: string | null }[] = [];
    let serverSubtotal = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return NextResponse.json({ error: 'Données article invalides' }, { status: 400 });
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, price: true, imageUrl: true, isActive: true },
      });

      if (!product || !product.isActive) {
        return NextResponse.json({ error: `Produit introuvable: ${item.productId}` }, { status: 400 });
      }

      let verifiedPrice = Number(product.price);
      let formatName: string | null = null;

      // If a format is specified, use its price instead
      if (item.formatId) {
        const format = await prisma.productFormat.findUnique({
          where: { id: item.formatId },
          select: { id: true, name: true, price: true, imageUrl: true },
        });
        if (!format) {
          return NextResponse.json({ error: `Format introuvable: ${item.formatId}` }, { status: 400 });
        }
        verifiedPrice = Number(format.price);
        formatName = format.name;
      }

      const quantity = Math.max(1, Math.floor(item.quantity));
      serverSubtotal += verifiedPrice * quantity;

      // Convert price to selected currency for Stripe display
      const priceConverted = Math.round(verifiedPrice * exchangeRate * 100) / 100;

      verifiedItems.push({
        productId: product.id,
        formatId: item.formatId || null,
        name: product.name,
        formatName,
        quantity,
        price: verifiedPrice, // CAD price (for accounting)
        priceConverted,       // Converted price (for Stripe)
        imageUrl: product.imageUrl,
      });
    }

    serverSubtotal = Math.round(serverSubtotal * 100) / 100;

    // =====================================================
    // SECURITY: Validate promo code server-side
    // =====================================================
    let serverPromoDiscount = 0;
    let validatedPromoCode = '';

    if (promoCode) {
      const promo = await prisma.promoCode.findUnique({ where: { code: promoCode } });
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
          validatedPromoCode = promoCode;
        }
      }
    }

    const discountedSubtotal = Math.max(0, serverSubtotal - serverPromoDiscount);

    // =====================================================
    // SECURITY: Calculate taxes and shipping server-side
    // =====================================================
    const province = shippingInfo?.province || 'QC';
    const country = shippingInfo?.country || 'CA';
    const serverTaxes = calculateServerTaxes(discountedSubtotal, province);
    const serverShipping = calculateServerShipping(serverSubtotal, country);

    // Reserve inventory before creating payment session
    const reservationIds: string[] = [];
    try {
      for (const item of verifiedItems) {
        if (item.formatId) {
          const format = await prisma.productFormat.findUnique({
            where: { id: item.formatId },
            select: { stockQuantity: true, trackInventory: true },
          });

          if (format?.trackInventory && format.stockQuantity < item.quantity) {
            return NextResponse.json(
              { error: `Stock insuffisant pour ${item.name}. Disponible: ${format.stockQuantity}` },
              { status: 400 }
            );
          }

          const reservation = await prisma.inventoryReservation.create({
            data: {
              productId: item.productId,
              formatId: item.formatId,
              quantity: item.quantity,
              cartId: cartId || undefined,
              expiresAt: new Date(Date.now() + 30 * 60 * 1000),
            },
          });
          reservationIds.push(reservation.id);
        }
      }
    } catch (stockError) {
      if (reservationIds.length > 0) {
        await prisma.inventoryReservation.updateMany({
          where: { id: { in: reservationIds } },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      }
      console.error('Stock reservation error:', stockError);
      return NextResponse.json(
        { error: 'Erreur lors de la réservation du stock' },
        { status: 500 }
      );
    }

    // Create line items for Stripe using CONVERTED prices
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = verifiedItems.map((item) => ({
      price_data: {
        currency: stripeCurrency,
        product_data: {
          name: item.name,
          description: item.formatName || undefined,
          images: item.imageUrl ? [item.imageUrl] : undefined,
        },
        unit_amount: Math.round(item.priceConverted * 100),
      },
      quantity: item.quantity,
    }));

    // Add promo discount as negative line item
    if (serverPromoDiscount > 0) {
      lineItems.push({
        price_data: {
          currency: stripeCurrency,
          product_data: { name: `Réduction (${validatedPromoCode})` },
          unit_amount: Math.round(serverPromoDiscount * exchangeRate * 100),
        },
        quantity: 1,
      });
      // Stripe doesn't support negative line items, use coupon approach or adjust total
      // Alternative: subtract from first item or use Stripe coupons
      // For now, we subtract from the item total via adjusted unit_amount
      // Actually, let's remove this line item and apply as metadata only
      lineItems.pop();
    }

    // Recalculate: apply discount proportionally to each item
    if (serverPromoDiscount > 0) {
      const discountRatio = serverPromoDiscount / serverSubtotal;
      lineItems.forEach((li) => {
        const originalAmount = li.price_data!.unit_amount!;
        const discountAmount = Math.round(originalAmount * discountRatio);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe line item type does not expose writable unit_amount
        (li.price_data as any).unit_amount = originalAmount - discountAmount;
      });
    }

    // Convert shipping and taxes to selected currency for Stripe
    const convertedShipping = Math.round(serverShipping * exchangeRate * 100) / 100;
    const convertedTaxTotal = Math.round(serverTaxes.total * exchangeRate * 100) / 100;

    // Add shipping
    if (convertedShipping > 0) {
      lineItems.push({
        price_data: {
          currency: stripeCurrency,
          product_data: { name: 'Frais de livraison' },
          unit_amount: Math.round(convertedShipping * 100),
        },
        quantity: 1,
      });
    }

    // Add taxes
    if (convertedTaxTotal > 0) {
      lineItems.push({
        price_data: {
          currency: stripeCurrency,
          product_data: { name: 'Taxes' },
          unit_amount: Math.round(convertedTaxTotal * 100),
        },
        quantity: 1,
      });
    }

    // Determine payment method types based on client selection
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] =
      clientPaymentMethod === 'interac'
        ? ['acss_debit']
        : ['card'];

    // Prepare cart items for metadata using VERIFIED data
    const cartItemsData = verifiedItems.map((item) => ({
      productId: item.productId,
      formatId: item.formatId,
      name: item.name,
      formatName: item.formatName,
      quantity: item.quantity,
      price: item.price,
    }));

    let cartItemsStr = JSON.stringify(cartItemsData);
    if (cartItemsStr.length > 490) {
      cartItemsStr = JSON.stringify(cartItemsData.map((item) => ({
        productId: item.productId,
        formatId: item.formatId,
        name: item.name.substring(0, 30),
        quantity: item.quantity,
        price: item.price,
      })));
    }
    if (cartItemsStr.length > 490) {
      cartItemsStr = '[]';
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes,
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout`,
      customer_email: session?.user?.email || shippingInfo?.email,
      ...(clientPaymentMethod === 'interac' ? {
        payment_intent_data: {
          payment_method_options: {
            acss_debit: {
              mandate_options: {
                payment_schedule: 'sporadic' as const,
                transaction_type: 'personal' as const,
              },
            },
          },
        },
      } : {}),
      metadata: {
        userId: session?.user?.id || 'guest',
        shippingAddress: JSON.stringify(shippingInfo),
        billingAddress: JSON.stringify(billingSameAsShipping ? shippingInfo : billingInfo),
        subtotal: String(serverSubtotal),
        shippingCost: String(serverShipping),
        taxTps: String(serverTaxes.tps),
        taxTvq: String(serverTaxes.tvq),
        taxTvh: String(serverTaxes.tvh),
        cartItems: cartItemsStr,
        promoCode: validatedPromoCode,
        promoDiscount: String(serverPromoDiscount),
        cartId: cartId || '',
        // Multi-currency metadata
        currencyCode: dbCurrency!.code,
        currencyId: dbCurrency!.id,
        exchangeRate: String(exchangeRate),
      },
      shipping_address_collection: {
        allowed_countries: ['CA', 'US', 'FR', 'DE', 'GB', 'AU', 'JP', 'MX', 'CL', 'PE', 'CO'],
      },
      billing_address_collection: 'required',
      payment_method_options: {
        card: {
          setup_future_usage: session?.user ? 'on_session' : undefined,
        },
      },
    });

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du paiement' },
      { status: 500 }
    );
  }
}
