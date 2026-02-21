export const dynamic = 'force-dynamic';
/**
 * API - Capturer un paiement PayPal
 * Creates a real Order record + accounting entries + inventory consumption
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { createAccountingEntriesForOrder } from '@/lib/accounting/webhook-accounting.service';
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
    const body = await request.json();
    const {
      orderId: paypalOrderId,
      cartItems,
      shippingInfo,
      promoCode,
      promoDiscount,
      cartId,
      giftCardCode,
      giftCardDiscount: clientGiftCardDiscount,
    } = body;

    if (!paypalOrderId) {
      return NextResponse.json({ error: 'Order ID requis' }, { status: 400 });
    }

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
      if (cartItems?.length > 0) {
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
      let serverPromoDiscount = 0;
      if (promoCode && promoDiscount > 0) {
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

      // SECURITY: Calculate taxes server-side (never trust client values)
      // BE-PAY-11, BE-PAY-20: Fixed to handle PST for BC/MB/SK, not just QC+HST
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
        taxTvh = Math.round(discountedSubtotal * rates.hst * 100) / 100;
      } else if (rates.qst) {
        taxTps = Math.round(discountedSubtotal * rates.gst * 100) / 100;
        taxTvq = Math.round(discountedSubtotal * rates.qst * 100) / 100;
      } else if (rates.pst || rates.rst) {
        taxTps = Math.round(discountedSubtotal * rates.gst * 100) / 100;
        taxPst = Math.round(discountedSubtotal * (rates.pst || rates.rst || 0) * 100) / 100;
      } else {
        taxTps = Math.round(discountedSubtotal * rates.gst * 100) / 100;
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
        // Atomic order number generation with row locking (prevents duplicates)
        const year = new Date().getFullYear();
        const prefix = `PP-${year}-`;
        const lastRows = await tx.$queryRaw<{ order_number: string }[]>`
          SELECT "orderNumber" as order_number FROM "Order"
          WHERE "orderNumber" LIKE ${prefix + '%'}
          ORDER BY "orderNumber" DESC
          LIMIT 1
          FOR UPDATE
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
            discount: serverPromoDiscount,
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
            promoDiscount: promoDiscount || null,
            shippingName: shippingInfo ? `${shippingInfo.firstName} ${shippingInfo.lastName}` : '',
            shippingAddress1: shippingInfo?.address || '',
            shippingAddress2: shippingInfo?.apartment || null,
            shippingCity: shippingInfo?.city || '',
            shippingState: shippingInfo?.province || '',
            shippingPostal: shippingInfo?.postalCode || '',
            shippingCountry: shippingInfo?.country || 'CA',
            shippingPhone: shippingInfo?.phone || null,
            items: cartItems?.length > 0 ? {
              create: cartItems.map((item: Record<string, unknown>) => ({
                productId: item.productId,
                formatId: item.formatId || null,
                productName: item.name,
                formatName: item.formatName || null,
                sku: item.sku || null,
                quantity: item.quantity,
                unitPrice: item.price,
                discount: item.discount || 0,
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

            // Decrement stock (floor at 0 to prevent negative inventory)
            if (reservation.formatId) {
              const currentFormat = await tx.productFormat.findUnique({
                where: { id: reservation.formatId },
                select: { stockQuantity: true },
              });
              const safeDecrement = Math.min(reservation.quantity, currentFormat?.stockQuantity ?? 0);
              if (safeDecrement > 0) {
                await tx.productFormat.update({
                  where: { id: reservation.formatId },
                  data: { stockQuantity: { decrement: safeDecrement } },
                });
              }
              if (safeDecrement < reservation.quantity) {
                console.warn(`[PayPal capture] Stock floor hit for format ${reservation.formatId}: wanted to decrement ${reservation.quantity}, only decremented ${safeDecrement}`);
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

        return newOrder;
      });

      // Create accounting entries (non-blocking)
      try {
        await createAccountingEntriesForOrder(order.id);
      } catch (acctError) {
        console.error('Failed to create PayPal accounting entries:', acctError);
      }

      // Track promo code usage
      if (promoCode && serverPromoDiscount > 0) {
        try {
          await prisma.promoCode.updateMany({
            where: { code: promoCode },
            data: { usageCount: { increment: 1 } },
          });
          const promo = await prisma.promoCode.findUnique({ where: { code: promoCode } });
          if (promo) {
            await prisma.promoCodeUsage.create({
              data: {
                promoCodeId: promo.id,
                userId,
                orderId: order.id,
                discount: serverPromoDiscount,
              },
            });
          }
        } catch (promoError) {
          console.error('Failed to track promo code usage:', promoError);
        }
      }

      // BE-PAY-04: Decrement gift card balance after successful PayPal payment
      // BUG 5: Re-validate gift card code and balance server-side (never trust client-sent discount)
      if (giftCardCode && clientGiftCardDiscount > 0) {
        try {
          await prisma.$transaction(async (tx) => {
            // Lock the gift card row to prevent concurrent balance modifications
            const [giftCard] = await tx.$queryRaw<{
              id: string; balance: number; is_active: boolean; expires_at: Date | null;
            }[]>`
              SELECT id, balance::float as balance, "isActive" as is_active, "expiresAt" as expires_at
              FROM "GiftCard"
              WHERE code = ${giftCardCode.toUpperCase().trim()}
              FOR UPDATE
            `;

            if (!giftCard || !giftCard.is_active || giftCard.balance <= 0) {
              console.warn(`Gift card ${giftCardCode} invalid or zero balance, skipping deduction`);
              return;
            }

            // Check expiration
            if (giftCard.expires_at && new Date() > giftCard.expires_at) {
              console.warn(`Gift card ${giftCardCode} expired, skipping deduction`);
              return;
            }

            if (giftCard && giftCard.is_active && giftCard.balance > 0) {
              // Server-side validation: cap the deduction to actual balance (never trust client value)
              const amountToDeduct = Math.min(clientGiftCardDiscount, giftCard.balance);
              const newBalance = Math.round((giftCard.balance - amountToDeduct) * 100) / 100;

              await tx.giftCard.update({
                where: { id: giftCard.id },
                data: {
                  balance: newBalance,
                  // If balance reaches 0, deactivate the card
                  isActive: newBalance > 0,
                },
              });

              console.log(`Gift card ${giftCardCode} decremented by $${amountToDeduct}, new balance: $${newBalance}`);
            }
          });
        } catch (gcError) {
          console.error('Failed to decrement gift card balance:', gcError);
          // Don't fail the order for gift card errors
        }
      }

      // Create ambassador commission if the order used a referral code
      if (promoCode) {
        try {
          const ambassador = await prisma.ambassador.findUnique({
            where: { referralCode: promoCode },
          });

          if (ambassador && ambassador.status === 'ACTIVE') {
            const rate = Number(ambassador.commissionRate);
            const commissionAmount = Math.round(Number(order.total) * rate) / 100;

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
            console.log(`Ambassador commission: ${commissionAmount}$ for ${ambassador.name} (order ${order.orderNumber})`);
          }
        } catch (commError) {
          console.error('Failed to create ambassador commission:', commError);
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
      } catch {
        // Legacy purchase not found, that's OK
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
    console.error('Error capturing PayPal payment:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la capture du paiement' },
      { status: 500 }
    );
  }
}
