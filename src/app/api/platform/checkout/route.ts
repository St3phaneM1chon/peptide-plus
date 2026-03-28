/**
 * API: POST /api/platform/checkout
 * Creates a Stripe Checkout Session OR starts a free trial for a new Koraline tenant.
 * Public endpoint — no auth required (the customer is signing up).
 *
 * If `trial: true` is passed, the tenant is created immediately with a free trial
 * (no Stripe checkout). Otherwise, falls through to Stripe Checkout as before.
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { createTenantCheckoutSession, KORALINE_PLANS, KORALINE_TRIAL_DAYS, type KoralinePlan } from '@/lib/stripe-attitudes';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/admin-audit';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    // PAY-F2 FIX: Rate limit platform checkout (10/hour per IP)
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/platform/checkout');
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { plan, slug, name, email, trial, password } = body;

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

    const typedPlan = plan as KoralinePlan;

    // -----------------------------------------------------------------------
    // FREE TRIAL FLOW — Create tenant immediately, no payment required
    // -----------------------------------------------------------------------
    if (trial === true) {
      // Password is required for trial signup
      if (!password || typeof password !== 'string' || password.length < 8) {
        return NextResponse.json(
          { error: 'Un mot de passe d\'au moins 8 caractères est requis pour l\'essai gratuit' },
          { status: 400 }
        );
      }

      const trialDays = KORALINE_TRIAL_DAYS[typedPlan];
      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      const planConfig = KORALINE_PLANS[typedPlan];

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create tenant in trial mode
        const tenant = await tx.tenant.create({
          data: {
            slug,
            name,
            domainKoraline: `${slug}.koraline.app`,
            plan: typedPlan,
            status: 'ACTIVE',
            isTrialing: true,
            trialStartedAt: now,
            trialEndsAt,
            locale: 'fr',
            timezone: 'America/Toronto',
            currency: 'CAD',
            taxEnabled: false,
            taxProvince: 'QC',
            taxConfig: JSON.stringify({ note: 'Taxes désactivées par défaut' }),
            modulesEnabled: JSON.stringify([
              'commerce', 'catalogue', 'marketing', 'emails',
              'comptabilite', 'systeme', 'communaute',
            ]),
            featuresFlags: JSON.stringify({}),
            maxEmployees: planConfig.includedEmployees + 1,
          },
        });

        // 2. Create owner user
        const hashedPassword = await bcrypt.hash(password, 12);
        const ownerUser = await tx.user.create({
          data: {
            email,
            name,
            password: hashedPassword,
            role: 'OWNER',
            tenantId: tenant.id,
            locale: 'fr',
            timezone: 'America/Toronto',
          },
        });

        // 3. Link owner to tenant
        await tx.tenant.update({
          where: { id: tenant.id },
          data: { ownerUserId: ownerUser.id },
        });

        // 4. Log trial start event
        await tx.tenantEvent.create({
          data: {
            tenantId: tenant.id,
            type: 'trial_started',
            actor: email,
            details: {
              plan: typedPlan,
              trialDays,
              trialEndsAt: trialEndsAt.toISOString(),
            },
          },
        });

        return { tenant, ownerUser };
      });

      logger.info('Koraline free trial started', {
        tenantId: result.tenant.id,
        slug,
        plan: typedPlan,
        trialDays,
        trialEndsAt: trialEndsAt.toISOString(),
        email,
      });

      return NextResponse.json({
        trial: true,
        tenantId: result.tenant.id,
        slug: result.tenant.slug,
        trialEndsAt: trialEndsAt.toISOString(),
        trialDays,
        redirectUrl: `/onboarding?trial=true&slug=${slug}&tenantId=${result.tenant.id}`,
      }, { status: 201 });
    }

    // -----------------------------------------------------------------------
    // STANDARD STRIPE CHECKOUT FLOW (no trial)
    // -----------------------------------------------------------------------
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    const session = await createTenantCheckoutSession({
      plan: typedPlan,
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
