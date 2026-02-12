/**
 * API Route - Création de session Stripe Checkout
 * Supporte: Carte, Apple Pay, Google Pay
 * Stores tax breakdown & cart items in metadata for webhook processing
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const {
      items,
      shippingInfo,
      paymentMethod,
      subtotal,
      shipping,
      taxes,
      taxBreakdown,
      total: _total,
      currency = 'cad',
      promoCode,
      promoDiscount,
      cartId,
    } = body;

    // Reserve inventory before creating payment session
    const reservationIds: string[] = [];
    try {
      for (const item of items) {
        if (item.formatId) {
          // Check stock availability
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

          // Create reservation
          const reservation = await prisma.inventoryReservation.create({
            data: {
              productId: item.productId,
              formatId: item.formatId,
              quantity: item.quantity,
              cartId: cartId || undefined,
              expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min TTL
            },
          });
          reservationIds.push(reservation.id);
        }
      }
    } catch (stockError) {
      // Clean up any reservations created
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

    // Create line items for Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: {
          name: item.name,
          description: item.format || undefined,
          images: item.image ? [item.image] : undefined,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // Add shipping
    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: 'Frais de livraison' },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      });
    }

    // Add taxes
    if (taxes > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: { name: 'Taxes' },
          unit_amount: Math.round(taxes * 100),
        },
        quantity: 1,
      });
    }

    // Payment method types
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = ['card'];

    // Prepare cart items for metadata (truncate to fit Stripe's 500 char limit per key)
    const cartItemsData = items.map((item: any) => ({
      productId: item.productId,
      formatId: item.formatId || null,
      name: item.name,
      formatName: item.format || null,
      sku: item.sku || null,
      quantity: item.quantity,
      price: item.price,
      discount: item.itemDiscount || 0,
    }));

    // Stripe metadata values must be strings <= 500 chars
    // If cart items JSON is too long, we'll store a reference instead
    let cartItemsStr = JSON.stringify(cartItemsData);
    if (cartItemsStr.length > 490) {
      // Store abbreviated version
      cartItemsStr = JSON.stringify(cartItemsData.map((item: any) => ({
        productId: item.productId,
        formatId: item.formatId,
        name: item.name.substring(0, 30),
        quantity: item.quantity,
        price: item.price,
      })));
    }
    // If still too long, skip (webhook will use Stripe line items)
    if (cartItemsStr.length > 490) {
      cartItemsStr = '[]';
    }

    // Create Stripe Checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: paymentMethodTypes,
      line_items: lineItems,
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/cart`,
      customer_email: session?.user?.email || shippingInfo.email,
      metadata: {
        userId: session?.user?.id || 'guest',
        shippingAddress: JSON.stringify(shippingInfo),
        // Tax breakdown
        subtotal: String(subtotal || 0),
        shippingCost: String(shipping || 0),
        taxTps: String(taxBreakdown?.tps || 0),
        taxTvq: String(taxBreakdown?.tvq || 0),
        taxTvh: String(taxBreakdown?.tvh || 0),
        // Cart items for order creation
        cartItems: cartItemsStr,
        // Promo
        promoCode: promoCode || '',
        promoDiscount: String(promoDiscount || 0),
        // Inventory
        cartId: cartId || '',
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
