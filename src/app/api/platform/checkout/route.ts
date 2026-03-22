/**
 * API: POST /api/platform/checkout
 * Creates a Stripe Checkout Session for a new Koraline tenant subscription.
 * Public endpoint — no auth required (the customer is signing up).
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { createTenantCheckoutSession, KORALINE_PLANS, type KoralinePlan } from '@/lib/stripe-attitudes';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, slug, name, email } = body;

    // Validate plan
    if (!plan || !(plan in KORALINE_PLANS)) {
      return NextResponse.json(
        { error: `Plan invalide. Plans disponibles: ${Object.keys(KORALINE_PLANS).join(', ')}` },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!slug || !name || !email) {
      return NextResponse.json(
        { error: 'slug, name et email sont requis' },
        { status: 400 }
      );
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug) || slug.length < 3 || slug.length > 30) {
      return NextResponse.json(
        { error: 'Le slug doit contenir 3-30 caractères (lettres minuscules, chiffres, tirets)' },
        { status: 400 }
      );
    }

    // Check slug availability
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: `Le slug "${slug}" est déjà pris` },
        { status: 409 }
      );
    }

    // Get base URL for redirect
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    // Create Stripe Checkout Session
    const session = await createTenantCheckoutSession({
      plan: plan as KoralinePlan,
      tenantSlug: slug,
      tenantName: name,
      customerEmail: email,
      successUrl: `${origin}/onboarding?session_id={CHECKOUT_SESSION_ID}&slug=${slug}`,
      cancelUrl: `${origin}/signup?cancelled=true`,
    });

    logger.info('Koraline checkout session created', {
      sessionId: session.id,
      plan,
      slug,
      email,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    logger.error('Failed to create checkout session', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la session de paiement' },
      { status: 500 }
    );
  }
}
