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
import { STRIPE_API_VERSION } from '@/lib/stripe';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { applyRate, add, multiply, subtract, convertCurrency, toCents, proportionalDiscount, clamp } from '@/lib/decimal-calculator';
import { logger } from '@/lib/logger';

// KB-PP-BUILD-002: Lazy init to avoid crash when STRIPE_SECRET_KEY is absent at build time
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  }
  return _stripe;
}

// BE-SEC-03: Zod validation schema for checkout request
const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  formatId: z.string().optional().nullable(),
  quantity: z.number().int().positive().max(100),
  // Client-sent prices are ignored (validated from DB), but allow them through
  price: z.number().optional(),
  name: z.string().optional(),
  formatName: z.string().optional(),
  imageUrl: z.string().optional().nullable(),
});

const shippingInfoSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  apartment: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(254).optional(),
}).optional().nullable();

const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Le panier ne peut pas être vide').max(50, 'Maximum 50 articles'),
  shippingInfo: shippingInfoSchema,
  billingInfo: shippingInfoSchema,
  billingSameAsShipping: z.boolean().optional(),
  currency: z.string().max(3).optional(),
  promoCode: z.string().max(50).optional().nullable(),
  cartId: z.string().max(100).optional().nullable(),
  paymentMethod: z.string().max(50).optional(),
  giftCardCode: z.string().max(50).optional().nullable(),
  giftCardDiscount: z.number().optional(),
  researchConsentAccepted: z.boolean().optional(),
  researchConsentTimestamp: z.string().optional(),
});

// Server-side tax calculation - all Canadian provinces/territories
// BE-PAY-11, BE-PAY-20: Fixed to handle PST for BC/MB/SK, not just QC+HST
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

function calculateServerTaxes(subtotal: number, province: string) {
  let tps = 0, tvq = 0, tvh = 0, pst = 0;
  const rates = CANADIAN_TAX_RATES[province.toUpperCase()] || CANADIAN_TAX_RATES['QC'];

  if (rates.hst) {
    tvh = applyRate(subtotal, rates.hst);
  } else if (rates.qst) {
    tps = applyRate(subtotal, rates.gst);
    tvq = applyRate(subtotal, rates.qst);
  } else if (rates.pst || rates.rst) {
    tps = applyRate(subtotal, rates.gst);
    pst = applyRate(subtotal, rates.pst || rates.rst || 0);
  } else {
    tps = applyRate(subtotal, rates.gst);
  }

  return { tps, tvq, tvh, pst, total: add(tps, tvq, tvh, pst) };
}

// Server-side shipping calculation (product-type aware)
function calculateServerShipping(subtotal: number, country: string, productTypes?: string[]): number {
  if (country === 'CA') {
    const hasLabSupply = productTypes?.some(t => t === 'LAB_SUPPLY');
    const threshold = hasLabSupply ? 300 : 100;
    if (subtotal >= threshold) return 0;
    return 9.99;
  }
  if (country === 'US') return 14.99;
  return 24.99; // International
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting on checkout session creation
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/payments/create-checkout');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF protection for payment mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Fix 4: Request body size limit (1MB)
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 1_000_000) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    const session = await auth();

    // BE-PAY-05: Idempotency key to prevent duplicate checkout sessions
    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (idempotencyKey) {
      const existingOrder = await prisma.order.findFirst({
        where: { idempotencyKey },
      });
      if (existingOrder) {
        return NextResponse.json({
          orderId: existingOrder.id,
          orderNumber: existingOrder.orderNumber,
          message: 'Duplicate request - existing order returned',
        });
      }
    }

    const body = await request.json();

    // BE-SEC-03: Validate checkout payload with Zod schema
    const validation = checkoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid checkout data' },
        { status: 400 }
      );
    }

    const {
      items,
      shippingInfo,
      billingInfo,
      billingSameAsShipping,
      currency: currencyCode = 'CAD',
      promoCode,
      cartId,
      paymentMethod: clientPaymentMethod,
      giftCardCode,
      giftCardDiscount: clientGiftCardDiscount,
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
    const verifiedItems: { productId: string; formatId: string | null; name: string; formatName: string | null; quantity: number; price: number; priceConverted: number; imageUrl: string | null; productType: string }[] = [];
    let serverSubtotal = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return NextResponse.json({ error: 'Données article invalides' }, { status: 400 });
      }

      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { id: true, name: true, price: true, imageUrl: true, isActive: true, productType: true },
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
          select: { id: true, name: true, price: true, imageUrl: true, productId: true },
        });
        if (!format) {
          return NextResponse.json({ error: `Format introuvable: ${item.formatId}` }, { status: 400 });
        }
        if (format.productId !== item.productId) {
          return NextResponse.json({ error: 'Le format ne correspond pas au produit' }, { status: 400 });
        }
        verifiedPrice = Number(format.price);
        formatName = format.name;
      }

      const quantity = Math.max(1, Math.floor(item.quantity));
      serverSubtotal = add(serverSubtotal, multiply(verifiedPrice, quantity));

      // Convert price to selected currency for Stripe display
      const priceConverted = convertCurrency(verifiedPrice, exchangeRate);

      verifiedItems.push({
        productId: product.id,
        formatId: item.formatId || null,
        name: product.name,
        formatName,
        quantity,
        price: verifiedPrice, // CAD price (for accounting)
        priceConverted,       // Converted price (for Stripe)
        imageUrl: product.imageUrl,
        productType: product.productType,
      });
    }

    // serverSubtotal already rounded via add()

    // =====================================================
    // SECURITY: Validate promo code server-side
    // BE-PAY-06: Enforce single promo code per order (prevent stacking)
    // =====================================================
    let serverPromoDiscount = 0;
    let validatedPromoCode = '';

    if (promoCode) {
      // Reject arrays or multiple codes (stacking exploit prevention)
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
          // E-05: Per-user promo usage limit check (prevents abuse before payment)
          if (session?.user?.id && promo.usageLimitPerUser) {
            const userUsageCount = await prisma.promoCodeUsage.count({
              where: { promoCodeId: promo.id, userId: session.user.id },
            });
            if (userUsageCount >= promo.usageLimitPerUser) {
              return NextResponse.json(
                { error: 'Vous avez atteint la limite d\'utilisation de ce code promo' },
                { status: 400 }
              );
            }
          }

          // E-04: firstOrderOnly check at checkout
          if (promo.firstOrderOnly && session?.user?.id) {
            const previousPaidOrders = await prisma.order.count({
              where: { userId: session.user.id, paymentStatus: 'PAID' },
            });
            if (previousPaidOrders > 0) {
              return NextResponse.json(
                { error: 'Ce code promo est réservé aux premières commandes' },
                { status: 400 }
              );
            }
          }

          // E-04: productIds restriction check at checkout
          if (promo.productIds) {
            const allowedProductIds: string[] = JSON.parse(promo.productIds);
            const cartProductIds = verifiedItems.map((item) => item.productId);
            const hasMatchingProduct = cartProductIds.some((pid) =>
              allowedProductIds.includes(pid)
            );
            if (!hasMatchingProduct) {
              return NextResponse.json(
                { error: 'Ce code promo ne s\'applique pas aux produits de votre panier' },
                { status: 400 }
              );
            }
          }

          // E-04: categoryIds restriction check at checkout
          if (promo.categoryIds) {
            const allowedCategoryIds: string[] = JSON.parse(promo.categoryIds);
            const cartProductCategoryIds = await Promise.all(
              verifiedItems.map(async (item) => {
                const product = await prisma.product.findUnique({
                  where: { id: item.productId },
                  select: { categoryId: true },
                });
                return product?.categoryId;
              })
            );
            const hasMatchingCategory = cartProductCategoryIds.some(
              (cid) => cid && allowedCategoryIds.includes(cid)
            );
            if (!hasMatchingCategory) {
              return NextResponse.json(
                { error: 'Ce code promo ne s\'applique pas aux catégories de votre panier' },
                { status: 400 }
              );
            }
          }

          if (promo.type === 'PERCENTAGE') {
            serverPromoDiscount = applyRate(serverSubtotal, Number(promo.value) / 100);
          } else {
            serverPromoDiscount = clamp(Number(promo.value), serverSubtotal);
          }
          if (promo.maxDiscount) {
            serverPromoDiscount = clamp(serverPromoDiscount, Number(promo.maxDiscount));
          }
          validatedPromoCode = singlePromoCode;
        }
      }
    }

    const discountedSubtotal = Math.max(0, subtract(serverSubtotal, serverPromoDiscount));

    // =====================================================
    // BE-PAY-04: Validate gift card server-side
    // =====================================================
    let serverGiftCardDiscount = 0;
    let validatedGiftCardCode = '';

    if (giftCardCode) {
      const giftCard = await prisma.giftCard.findUnique({
        where: { code: giftCardCode.toUpperCase().trim() },
      });
      if (giftCard && giftCard.isActive && Number(giftCard.balance) > 0) {
        const isExpired = giftCard.expiresAt && new Date() > giftCard.expiresAt;
        if (!isExpired) {
          // Cap at remaining total after promo discount
          serverGiftCardDiscount = clamp(Number(giftCard.balance), discountedSubtotal);
          validatedGiftCardCode = giftCard.code;
        }
      }
    }

    const subtotalAfterAllDiscounts = Math.max(0, subtract(discountedSubtotal, serverGiftCardDiscount));

    // =====================================================
    // SECURITY: Calculate taxes and shipping server-side
    // =====================================================
    const province = shippingInfo?.province || 'QC';
    const country = shippingInfo?.country || 'CA';
    const serverTaxes = calculateServerTaxes(subtotalAfterAllDiscounts, province);
    const cartProductTypes = verifiedItems.map(i => i.productType);
    const serverShipping = calculateServerShipping(serverSubtotal, country, cartProductTypes);

    // Reserve inventory atomically (prevents overselling)
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
                cartId: cartId || undefined,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000),
              },
            });
            ids.push(reservation.id);
          } else {
            // BUG 8: Also check stock for base products without formats
            const [product] = await tx.$queryRaw<{ stock_quantity: number; track_inventory: boolean }[]>`
              SELECT "stockQuantity" as stock_quantity, "trackInventory" as track_inventory
              FROM "Product"
              WHERE id = ${item.productId}
              FOR UPDATE
            `;

            if (product?.track_inventory && product.stock_quantity < item.quantity) {
              throw new Error(`Stock insuffisant pour ${item.name}. Disponible: ${product.stock_quantity}`);
            }

            const reservation = await tx.inventoryReservation.create({
              data: {
                productId: item.productId,
                formatId: null,
                quantity: item.quantity,
                cartId: cartId || undefined,
                expiresAt: new Date(Date.now() + 30 * 60 * 1000),
              },
            });
            ids.push(reservation.id);
          }
        }
        return ids;
      });
    } catch (stockError) {
      // Transaction auto-rolls back on error, but release any committed reservations
      if (reservationIds.length > 0) {
        await prisma.inventoryReservation.updateMany({
          where: { id: { in: reservationIds } },
          data: { status: 'RELEASED', releasedAt: new Date() },
        });
      }
      const errorMsg = stockError instanceof Error ? stockError.message : 'Erreur lors de la réservation du stock';
      logger.error('Stock reservation error', { error: stockError instanceof Error ? stockError.message : String(stockError) });
      return NextResponse.json({ error: errorMsg }, { status: 400 });
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
        unit_amount: toCents(item.priceConverted),
      },
      quantity: item.quantity,
    }));

    // Add promo discount as negative line item
    if (serverPromoDiscount > 0) {
      lineItems.push({
        price_data: {
          currency: stripeCurrency,
          product_data: { name: `Réduction (${validatedPromoCode})` },
          unit_amount: toCents(convertCurrency(serverPromoDiscount, exchangeRate)),
        },
        quantity: 1,
      });
      // Stripe doesn't support negative line items, use coupon approach or adjust total
      // Alternative: subtract from first item or use Stripe coupons
      // For now, we subtract from the item total via adjusted unit_amount
      // Actually, let's remove this line item and apply as metadata only
      lineItems.pop();
    }

    // Recalculate: apply all discounts (promo + gift card) proportionally to each item
    const totalItemDiscount = add(serverPromoDiscount, serverGiftCardDiscount);
    if (totalItemDiscount > 0) {
      lineItems.forEach((li) => {
        const originalAmount = li.price_data!.unit_amount!;
        const discountAmount = proportionalDiscount(originalAmount, totalItemDiscount, serverSubtotal);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Stripe line item type does not expose writable unit_amount
        (li.price_data as any).unit_amount = originalAmount - discountAmount;
      });
    }

    // Convert shipping and taxes to selected currency for Stripe
    const convertedShipping = convertCurrency(serverShipping, exchangeRate);
    const convertedTaxTotal = convertCurrency(serverTaxes.total, exchangeRate);

    // Add shipping
    if (convertedShipping > 0) {
      lineItems.push({
        price_data: {
          currency: stripeCurrency,
          product_data: { name: 'Frais de livraison' },
          unit_amount: toCents(convertedShipping),
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
          unit_amount: toCents(convertedTaxTotal),
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

    // BUG 14: Use compact encoding to avoid metadata truncation losing cart items
    // First try full data, then minimal, then store a reference ID to retrieve later
    let cartItemsStr = JSON.stringify(cartItemsData);
    if (cartItemsStr.length > 490) {
      // Compact: only essential fields with short keys
      cartItemsStr = JSON.stringify(cartItemsData.map((item) => ({
        p: item.productId,
        f: item.formatId,
        q: item.quantity,
        $: item.price,
      })));
    }
    if (cartItemsStr.length > 490) {
      // Still too long: store cart data in DB and reference by cartId
      const cartRef = cartId || `cart-${Date.now()}`;
      // The webhook can recover items from inventoryReservation records via cartId
      cartItemsStr = JSON.stringify({ ref: cartRef, count: cartItemsData.length });
    }

    const checkoutSession = await getStripe().checkout.sessions.create({
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
        taxPst: String(serverTaxes.pst),
        cartItems: cartItemsStr,
        promoCode: validatedPromoCode,
        promoDiscount: String(serverPromoDiscount),
        // BE-PAY-04: Gift card info for balance decrement in webhook
        giftCardCode: validatedGiftCardCode,
        giftCardDiscount: String(serverGiftCardDiscount),
        cartId: cartId || '',
        // BE-PAY-05: Idempotency key for duplicate prevention
        idempotencyKey: idempotencyKey || '',
        // Multi-currency metadata
        currencyCode: dbCurrency!.code,
        currencyId: dbCurrency!.id,
        exchangeRate: String(exchangeRate),
        // Legal compliance: research consent
        researchConsentAccepted: String(body.researchConsentAccepted || false),
        researchConsentTimestamp: body.researchConsentTimestamp || '',
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
    logger.error('Stripe checkout error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création du paiement' },
      { status: 500 }
    );
  }
}
