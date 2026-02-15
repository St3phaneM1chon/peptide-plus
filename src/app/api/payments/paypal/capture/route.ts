export const dynamic = 'force-dynamic';
/**
 * API - Capturer un paiement PayPal
 * Creates a real Order record + accounting entries + inventory consumption
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { createAccountingEntriesForOrder } from '@/lib/accounting/webhook-accounting.service';

const PAYPAL_API_URL = process.env.PAYPAL_SANDBOX === 'true'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

async function getPayPalAccessToken(): Promise<string> {
  const authString = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${PAYPAL_API_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authString}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  return data.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();
    const {
      orderId: paypalOrderId,
      cartItems,
      shippingInfo,
      subtotal,
      shippingCost,
      taxBreakdown,
      total: _total,
      promoCode,
      promoDiscount,
      cartId,
    } = body;

    if (!paypalOrderId) {
      return NextResponse.json({ error: 'Order ID requis' }, { status: 400 });
    }

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
      // SECURITY: Require authentication for order creation
      if (!session?.user?.id) {
        return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
      }
      const userId = session.user.id;

      // Find or create currency
      let currency = await prisma.currency.findUnique({
        where: { code: 'CAD' },
      });
      if (!currency) {
        currency = await prisma.currency.create({
          data: { code: 'CAD', name: 'Dollar canadien', symbol: '$', exchangeRate: 1 },
        });
      }

      const taxTps = taxBreakdown?.tps || 0;
      const taxTvq = taxBreakdown?.tvq || 0;
      const taxTvh = taxBreakdown?.tvh || 0;
      const totalTax = taxTps + taxTvq + taxTvh;

      // Generate order number
      const orderNumber = `PP-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // Create the order in a transaction
      const order = await prisma.$transaction(async (tx) => {
        const newOrder = await tx.order.create({
          data: {
            orderNumber,
            userId,
            subtotal: subtotal || 0,
            shippingCost: shippingCost || 0,
            discount: promoDiscount || 0,
            tax: totalTax,
            taxTps,
            taxTvq,
            taxTvh,
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

            if (reservation.formatId) {
              await tx.productFormat.update({
                where: { id: reservation.formatId },
                data: { stockQuantity: { decrement: reservation.quantity } },
              });
            }

            await tx.inventoryTransaction.create({
              data: {
                productId: reservation.productId,
                formatId: reservation.formatId,
                type: 'SALE',
                quantity: -reservation.quantity,
                unitCost: 0,
                runningWAC: 0,
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
      if (promoCode && promoDiscount > 0) {
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
                discount: promoDiscount,
              },
            });
          }
        } catch (promoError) {
          console.error('Failed to track promo code usage:', promoError);
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
            console.log(`Ambassador commission: ${commissionAmount}$ for ${ambassador.name} (order ${orderNumber})`);
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
          details: JSON.stringify({ paypalOrderId, orderNumber }),
        },
      });

      return NextResponse.json({
        success: true,
        orderId: order.id,
        orderNumber,
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
