export const dynamic = 'force-dynamic';
/**
 * API - Capturer un paiement PayPal
 * Creates a real Order record + accounting entries + inventory consumption
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { createAccountingEntriesForOrder } from '@/lib/accounting/webhook-accounting.service';
import { getPayPalAccessToken, PAYPAL_API_URL } from '@/lib/paypal';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

const cartItemSchema = z.object({
  productId: z.string().optional(),
  formatId: z.string().optional(),
  name: z.string().optional(),
  formatName: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().min(1).or(z.string().transform(Number)),
  price: z.number().or(z.string().transform(Number)).optional(),
  discount: z.number().optional(),
  productType: z.string().optional(),
});

const captureSchema = z.object({
  orderId: z.string().min(1, 'Order ID requis'),
  cartItems: z.array(cartItemSchema).optional(),
  shippingInfo: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    address: z.string().optional(),
    apartment: z.string().optional(),
    city: z.string().optional(),
    province: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  promoCode: z.string().optional(),
  promoDiscount: z.number().optional(),
  cartId: z.string().optional(),
  giftCardCode: z.string().optional(),
  giftCardDiscount: z.number().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting on payment capture
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/payments/paypal/capture');
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

    const session = await auth();
    const body = await request.json();
    const parsed = captureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const {
      orderId: paypalOrderId,
      cartItems,
      shippingInfo,
      promoCode,
      cartId,
      giftCardCode,
    } = parsed.data;

    // BUG 6: Require authentication BEFORE capturing payment
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }
    const userId = session.user.id;

    // Capture the PayPal payment
    const accessToken = await getPayPalAccessToken();

    const captureResponse = await fetch(
      `${PAYPAL_API_URL}/v2/checkout/orders/${paypalOrderId}/capture`,
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

      // SECURITY: Verify cart item prices from database and recalculate subtotal
      let serverSubtotal = 0;
      if (cartItems && cartItems.length > 0) {
        for (const item of cartItems) {
          if (item.formatId) {
            const format = await prisma.productFormat.findUnique({
              where: { id: item.formatId },
              select: { price: true, productId: true },
            });
            if (format) {
              // Verify format belongs to the product
              if (item.productId && format.productId !== item.productId) {
                return NextResponse.json({ error: 'Le format ne correspond pas au produit' }, { status: 400 });
              }
              item.price = Number(format.price);
            }
          } else if (item.productId) {
            const product = await prisma.product.findUnique({
              where: { id: item.productId },
              select: { price: true },
            });
            if (product) {
              item.price = Number(product.price);
            }
          }
          serverSubtotal += Number(item.price) * Number(item.quantity);
        }
      }
      serverSubtotal = Math.round(serverSubtotal * 100) / 100;

      // SECURITY: Validate promo code server-side
      // E-02 FIX: Always validate when promoCode is provided (never trust client-sent promoDiscount)
      let serverPromoDiscount = 0;
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
          }
        }
      }

      const discountedSubtotal = Math.max(0, serverSubtotal - serverPromoDiscount);

      // E-03 FIX: Apply gift card discount before calculating taxes (matches create-order flow)
      // E-02 FIX: Always validate gift card when code is provided (never trust client-sent discount amount)
      let serverGiftCardDiscount = 0;
      if (giftCardCode) {
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
          }
        }
      }

      const subtotalAfterAllDiscounts = Math.max(0, discountedSubtotal - serverGiftCardDiscount);

      // SECURITY: Calculate taxes server-side (never trust client values)
      // BE-PAY-11, BE-PAY-20: Fixed to handle PST for BC/MB/SK, not just QC+HST
      // E-03 FIX: Taxes computed on subtotalAfterAllDiscounts (promo + gift card) to match Stripe/PayPal create-order
      const province = shippingInfo?.province || 'QC';
      const CANADIAN_TAX_RATES: Record<string, { gst: number; pst?: number; hst?: number; qst?: number; rst?: number }> = {
        'AB': { gst: 0.05 }, 'BC': { gst: 0.05, pst: 0.07 }, 'MB': { gst: 0.05, rst: 0.07 },
        'NB': { gst: 0, hst: 0.15 }, 'NL': { gst: 0, hst: 0.15 }, 'NS': { gst: 0, hst: 0.14 },
        'NT': { gst: 0.05 }, 'NU': { gst: 0.05 }, 'ON': { gst: 0, hst: 0.13 },
        'PE': { gst: 0, hst: 0.15 }, 'QC': { gst: 0.05, qst: 0.09975 },
        'SK': { gst: 0.05, pst: 0.06 }, 'YT': { gst: 0.05 },
      };
      const rates = CANADIAN_TAX_RATES[province.toUpperCase()] || CANADIAN_TAX_RATES['QC'];
      let taxTps = 0, taxTvq = 0, taxTvh = 0, taxPst = 0;
      if (rates.hst) {
        taxTvh = Math.round(subtotalAfterAllDiscounts * rates.hst * 100) / 100;
      } else if (rates.qst) {
        taxTps = Math.round(subtotalAfterAllDiscounts * rates.gst * 100) / 100;
        taxTvq = Math.round(subtotalAfterAllDiscounts * rates.qst * 100) / 100;
      } else if (rates.pst || rates.rst) {
        taxTps = Math.round(subtotalAfterAllDiscounts * rates.gst * 100) / 100;
        taxPst = Math.round(subtotalAfterAllDiscounts * (rates.pst || rates.rst || 0) * 100) / 100;
      } else {
        taxTps = Math.round(subtotalAfterAllDiscounts * rates.gst * 100) / 100;
      }
      const totalTax = Math.round((taxTps + taxTvq + taxTvh + taxPst) * 100) / 100;

      // SECURITY: Calculate shipping server-side
      const country = shippingInfo?.country || 'CA';
      let serverShipping = 0;
      if (country === 'CA') {
        // BUG 7: Use 300 threshold for LAB_SUPPLY products to match create-checkout
        const hasLabSupply = cartItems?.some((item: Record<string, unknown>) => item.productType === 'LAB_SUPPLY');
        const freeShippingThreshold = hasLabSupply ? 300 : 100;
        serverShipping = serverSubtotal >= freeShippingThreshold ? 0 : 9.99;
      } else if (country === 'US') {
        serverShipping = 14.99;
      } else {
        serverShipping = 24.99;
      }

      // Find or create currency
      let currency = await prisma.currency.findUnique({
        where: { code: 'CAD' },
      });
      if (!currency) {
        currency = await prisma.currency.create({
          data: { code: 'CAD', name: 'Dollar canadien', symbol: '$', exchangeRate: 1 },
        });
      }

      // Create the order in a transaction with atomic order number
      const order = await prisma.$transaction(async (tx) => {
        // Atomic order number generation with advisory lock (prevents duplicates even on empty table)
        // E-01 FIX: pg_advisory_xact_lock serializes order number generation across all transactions.
        // Unlike FOR UPDATE, this works even when no rows exist yet (e.g., first order of a new year).
        const year = new Date().getFullYear();
        const prefix = `PP-${year}-`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(42)`;
        const lastRows = await tx.$queryRaw<{ order_number: string }[]>`
          SELECT "orderNumber" as order_number FROM "Order"
          WHERE "orderNumber" LIKE ${prefix + '%'}
          ORDER BY "orderNumber" DESC
          LIMIT 1
        `;
        const lastNum = lastRows.length > 0
          ? parseInt(lastRows[0].order_number.replace(prefix, ''), 10)
          : 0;
        const orderNumber = `${prefix}${String(lastNum + 1).padStart(6, '0')}`;

        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId,
            subtotal: serverSubtotal,
            shippingCost: serverShipping,
            discount: serverPromoDiscount + serverGiftCardDiscount,
            tax: totalTax,
            taxTps,
            taxTvq,
            taxTvh,
            taxPst,
            // SECURITY: Use PayPal's captured amount as source of truth
            total: Number(captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value || captureData.purchase_units?.[0]?.amount?.value || 0),
            currencyId: currency!.id,
            paymentMethod: 'PAYPAL',
            paymentStatus: 'PAID',
            status: 'CONFIRMED',
            paypalOrderId,
            promoCode: promoCode || null,
            promoDiscount: serverPromoDiscount || null,
            giftCardCode: giftCardCode ? giftCardCode.toUpperCase().trim() : null,
            giftCardDiscount: serverGiftCardDiscount || null,
            shippingName: shippingInfo ? `${shippingInfo.firstName} ${shippingInfo.lastName}` : '',
            shippingAddress1: shippingInfo?.address || '',
            shippingAddress2: shippingInfo?.apartment || null,
            shippingCity: shippingInfo?.city || '',
            shippingState: shippingInfo?.province || '',
            shippingPostal: shippingInfo?.postalCode || '',
            shippingCountry: shippingInfo?.country || 'CA',
            shippingPhone: shippingInfo?.phone || null,
            items: cartItems && cartItems.length > 0 ? {
              create: cartItems.map((item: Record<string, unknown>) => ({
                productId: String(item.productId),
                formatId: item.formatId ? String(item.formatId) : null,
                productName: String(item.name || ''),
                formatName: item.formatName ? String(item.formatName) : null,
                sku: item.sku ? String(item.sku) : null,
                quantity: Number(item.quantity) || 1,
                unitPrice: Number(item.price) || 0,
                discount: Number(item.discount) || 0,
                total: Number(item.price) * Number(item.quantity) - (Number(item.discount) || 0),
              })),
            } : undefined,
          },
        });

        // Consume inventory reservations
        if (cartId) {
          const reservations = await tx.inventoryReservation.findMany({
            where: { cartId, status: 'RESERVED' },
          });

          for (const reservation of reservations) {
            await tx.inventoryReservation.update({
              where: { id: reservation.id },
              data: { status: 'CONSUMED', orderId: newOrder.id, consumedAt: new Date() },
            });

            // E-08 FIX: Atomic conditional stock decrement — prevents negative inventory
            if (reservation.formatId) {
              const rowsAffected: number = await tx.$executeRaw`
                UPDATE "ProductFormat"
                SET "stockQuantity" = "stockQuantity" - ${reservation.quantity},
                    "updatedAt" = NOW()
                WHERE id = ${reservation.formatId}
                  AND "stockQuantity" >= ${reservation.quantity}
              `;
              if (rowsAffected === 0) {
                logger.warn(`[PayPal capture] Insufficient stock for format ${reservation.formatId}`, { wanted: reservation.quantity });
              }
            }

            // Look up current WAC for accurate COGS
            const lastTx = await tx.inventoryTransaction.findFirst({
              where: {
                productId: reservation.productId,
                formatId: reservation.formatId,
              },
              orderBy: { createdAt: 'desc' },
              select: { runningWAC: true },
            });
            const wac = lastTx ? Number(lastTx.runningWAC) : 0;

            await tx.inventoryTransaction.create({
              data: {
                productId: reservation.productId,
                formatId: reservation.formatId,
                type: 'SALE',
                quantity: -reservation.quantity,
                unitCost: wac,
                runningWAC: wac,
                orderId: newOrder.id,
              },
            });
          }
        }

        // E-06 FIX: Deduct gift card balance INSIDE the order transaction for atomicity.
        // Previously this was a separate $transaction outside the order creation, so if the
        // handler crashed between order creation and gift card deduction, the balance was
        // never reduced — allowing infinite reuse of the same gift card.
        if (giftCardCode && serverGiftCardDiscount > 0) {
          // Lock the gift card row to prevent concurrent balance modifications
          const [giftCard] = await tx.$queryRaw<{
            id: string; balance: number; is_active: boolean; expires_at: Date | null;
          }[]>`
            SELECT id, balance::float as balance, "isActive" as is_active, "expiresAt" as expires_at
            FROM "GiftCard"
            WHERE code = ${giftCardCode.toUpperCase().trim()}
            FOR UPDATE
          `;

          if (giftCard && giftCard.is_active && giftCard.balance > 0) {
            // Check expiration
            const isExpired = giftCard.expires_at && new Date() > giftCard.expires_at;
            if (!isExpired) {
              const amountToDeduct = Math.min(serverGiftCardDiscount, giftCard.balance);
              const newBalance = Math.round((giftCard.balance - amountToDeduct) * 100) / 100;

              await tx.giftCard.update({
                where: { id: giftCard.id },
                data: {
                  balance: newBalance,
                  // If balance reaches 0, deactivate the card
                  isActive: newBalance > 0,
                },
              });

              logger.info('Gift card balance decremented (atomic, PayPal)', {
                giftCardCode,
                amountDeducted: amountToDeduct,
                newBalance,
                orderNumber,
              });
            } else {
              logger.warn('Gift card expired during PayPal capture balance deduction', { giftCardCode, orderNumber });
            }
          } else {
            logger.warn('Gift card not found or inactive during PayPal capture balance deduction', {
              giftCardCode,
              serverGiftCardDiscount,
              orderNumber,
            });
          }
        }

        // E-12 FIX: Atomic promo code usage tracking inside the order transaction.
        // Uses a conditional UPDATE to prevent race conditions where two concurrent
        // captures both pass the usage check and both increment, exceeding the limit.
        // Also enforces per-user usage limits (usageLimitPerUser).
        if (promoCode && serverPromoDiscount > 0) {
          // Step 1: Atomic conditional increment — only succeeds if within global usage limit
          const promoRowsAffected: number = await tx.$executeRaw`
            UPDATE "PromoCode"
            SET "usageCount" = "usageCount" + 1, "updatedAt" = NOW()
            WHERE code = ${promoCode}
              AND "isActive" = true
              AND ("usageLimit" IS NULL OR "usageCount" < "usageLimit")
          `;

          if (promoRowsAffected === 0) {
            // Promo exceeded its global usage limit between validation and capture.
            // Payment is already captured so we log a warning but don't block the order.
            logger.warn('[PayPal capture] Promo code usage limit exceeded (atomic check failed)', {
              promoCode,
              orderNumber,
            });
          } else {
            // Step 2: Fetch the promo to get its ID and per-user limit
            const promoRecord = await tx.promoCode.findUnique({ where: { code: promoCode } });
            if (promoRecord) {
              // Step 3: Check per-user usage limit atomically
              const maxUsesPerUser = promoRecord.usageLimitPerUser ?? 1;
              const existingUserUsage = await tx.promoCodeUsage.count({
                where: { promoCodeId: promoRecord.id, userId },
              });

              if (existingUserUsage >= maxUsesPerUser) {
                // Per-user limit exceeded — rollback the global increment
                await tx.$executeRaw`
                  UPDATE "PromoCode"
                  SET "usageCount" = GREATEST("usageCount" - 1, 0), "updatedAt" = NOW()
                  WHERE code = ${promoCode}
                `;
                logger.warn('[PayPal capture] Promo code per-user limit reached', {
                  promoCode,
                  userId,
                  maxUsesPerUser,
                  existingUserUsage,
                  orderNumber,
                });
              } else {
                // Step 4: Create per-user usage record inside the transaction
                await tx.promoCodeUsage.create({
                  data: {
                    promoCodeId: promoRecord.id,
                    userId,
                    orderId: newOrder.id,
                    discount: serverPromoDiscount,
                  },
                });
              }
            }
          }
        }

        return newOrder;
      });

      // E-17 FIX: Verify server-calculated total matches PayPal captured amount
      // After capture, extract the actual captured amount from PayPal's response and compare
      // against our server-side calculation. If mismatch > $0.02, flag the order for admin review.
      const paypalCapturedAmount = Number(
        captureData.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value
        || captureData.purchase_units?.[0]?.amount?.value
        || 0
      );
      const serverCalculatedTotal = Math.round((subtotalAfterAllDiscounts + totalTax + serverShipping) * 100) / 100;
      const amountDifference = Math.abs(paypalCapturedAmount - serverCalculatedTotal);
      if (amountDifference > 0.02) {
        logger.warn('[PayPal capture] Amount mismatch between server calculation and PayPal captured amount', {
          paypalCapturedAmount,
          serverCalculatedTotal,
          difference: amountDifference,
          serverSubtotal,
          serverPromoDiscount,
          serverGiftCardDiscount,
          totalTax,
          serverShipping,
          orderNumber: order.orderNumber,
          orderId: order.id,
        });

        // Store mismatch flag on order adminNotes for admin review (non-blocking)
        try {
          const mismatchNote = `[AMOUNT MISMATCH] PayPal captured: $${paypalCapturedAmount.toFixed(2)}, Server expected: $${serverCalculatedTotal.toFixed(2)}, Difference: $${amountDifference.toFixed(2)}. Breakdown: subtotal=$${serverSubtotal}, promoDiscount=$${serverPromoDiscount}, giftCardDiscount=$${serverGiftCardDiscount}, tax=$${totalTax}, shipping=$${serverShipping}`;
          await prisma.order.update({
            where: { id: order.id },
            data: {
              adminNotes: mismatchNote,
            },
          });
        } catch (noteError) {
          logger.error('[PayPal capture] Failed to store amount mismatch note on order', {
            orderId: order.id,
            error: noteError instanceof Error ? noteError.message : String(noteError),
          });
        }
      }

      // Create accounting entries (non-blocking)
      try {
        await createAccountingEntriesForOrder(order.id);
      } catch (acctError) {
        logger.error('Failed to create PayPal accounting entries', { error: acctError instanceof Error ? acctError.message : String(acctError) });
      }

      // E-06 FIX: Gift card balance is now deducted INSIDE the main order $transaction above.
      // This ensures atomicity: if the deduction fails, the order also rolls back.

      // Create ambassador commission if the order used a referral code
      if (promoCode) {
        try {
          const ambassador = await prisma.ambassador.findUnique({
            where: { referralCode: promoCode },
          });

          if (ambassador && ambassador.status === 'ACTIVE') {
            const rate = Number(ambassador.commissionRate);
            // F-010 FIX: commissionRate is stored as an integer percentage (e.g. 10 = 10%).
            // Divide by 100 first to get the decimal multiplier, then round to 2 decimal places.
            const commissionAmount = Math.round(Number(order.total) * (rate / 100) * 100) / 100;

            await prisma.ambassadorCommission.upsert({
              where: {
                ambassadorId_orderId: {
                  ambassadorId: ambassador.id,
                  orderId: order.id,
                },
              },
              create: {
                ambassadorId: ambassador.id,
                orderId: order.id,
                orderNumber: order.orderNumber,
                orderTotal: Number(order.total),
                commissionRate: rate,
                commissionAmount,
              },
              update: {},
            });
            logger.info('Ambassador commission created', { commissionAmount, ambassadorName: ambassador.name, orderNumber: order.orderNumber });
          }
        } catch (commError) {
          logger.error('Failed to create ambassador commission', { error: commError instanceof Error ? commError.message : String(commError) });
        }
      }

      // Also update the legacy Purchase record if it exists
      try {
        const purchase = await prisma.purchase.findFirst({
          where: { paypalOrderId, userId },
        });
        if (purchase) {
          await prisma.purchase.update({
            where: { id: purchase.id },
            data: { status: 'COMPLETED' },
          });
        }
      } catch (error) {
        logger.error('[PaypalCapture] Legacy purchase update failed (non-critical)', { paypalOrderId, error: error instanceof Error ? error.message : String(error) });
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId,
          action: 'PAYPAL_PAYMENT_CAPTURED',
          entityType: 'Order',
          entityId: order.id,
          details: JSON.stringify({ paypalOrderId, orderNumber: order.orderNumber }),
        },
      });

      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
      });
    } else {
      // Payment failed
      return NextResponse.json(
        { error: 'Le paiement PayPal a échoué', status: captureData.status },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Error capturing PayPal payment', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la capture du paiement' },
      { status: 500 }
    );
  }
}
