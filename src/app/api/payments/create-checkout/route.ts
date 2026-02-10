/**
 * API Route - Création de session Stripe Checkout
 * Supporte: Carte, Apple Pay, Google Pay
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { auth } from '@/lib/auth-config';

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
      subtotal: _subtotal,
      shipping,
      taxes,
      total: _total,
      currency = 'cad'
    } = body;

    // Créer les line items pour Stripe
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item: any) => ({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: {
          name: item.name,
          description: item.format || undefined,
          images: item.image ? [item.image] : undefined,
        },
        unit_amount: Math.round(item.price * 100), // Stripe utilise les centimes
      },
      quantity: item.quantity,
    }));

    // Ajouter les frais de livraison si applicable
    if (shipping > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: 'Frais de livraison',
          },
          unit_amount: Math.round(shipping * 100),
        },
        quantity: 1,
      });
    }

    // Ajouter les taxes
    if (taxes > 0) {
      lineItems.push({
        price_data: {
          currency: currency.toLowerCase(),
          product_data: {
            name: 'Taxes',
          },
          unit_amount: Math.round(taxes * 100),
        },
        quantity: 1,
      });
    }

    // Configurer les méthodes de paiement selon la sélection
    const paymentMethodTypes: Stripe.Checkout.SessionCreateParams.PaymentMethodType[] = [];
    
    switch (paymentMethod) {
      case 'apple_pay':
      case 'google_pay':
        // Apple Pay et Google Pay sont automatiquement inclus avec 'card'
        paymentMethodTypes.push('card');
        break;
      case 'card':
      default:
        paymentMethodTypes.push('card');
        break;
    }

    // Créer la session Stripe Checkout
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
      },
      shipping_address_collection: {
        allowed_countries: ['CA', 'US', 'FR', 'DE', 'GB', 'AU', 'JP', 'MX', 'CL', 'PE', 'CO'],
      },
      billing_address_collection: 'required',
      // Activer Apple Pay et Google Pay
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
