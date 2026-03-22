/**
 * API: POST /api/platform/provision
 * Provisions a new Koraline tenant after successful Stripe payment.
 * Called from the onboarding page after checkout success.
 *
 * Creates:
 * 1. Tenant record in DB
 * 2. Owner user account
 * 3. Default settings and permissions
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripeAttitudes, KORALINE_PLANS, type KoralinePlan } from '@/lib/stripe-attitudes';
import { logger } from '@/lib/logger';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, slug, password } = body;

    if (!sessionId || !slug) {
      return NextResponse.json({ error: 'sessionId et slug requis' }, { status: 400 });
    }

    // Verify the Stripe checkout session
    const stripe = getStripeAttitudes();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Paiement non confirmé' }, { status: 402 });
    }

    // Verify the slug matches
    if (session.metadata?.tenant_slug !== slug) {
      return NextResponse.json({ error: 'Slug ne correspond pas à la session' }, { status: 400 });
    }

    // Check if tenant already exists (idempotent)
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
    if (existingTenant) {
      return NextResponse.json({
        tenant: existingTenant,
        message: 'Tenant déjà provisionné',
        alreadyExists: true,
      });
    }

    const plan = (session.metadata?.plan || 'essential') as KoralinePlan;
    const tenantName = session.metadata?.tenant_name || slug;
    const customerEmail = session.customer_email || session.customer_details?.email || '';
    const stripeCustomerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id || null;
    const stripeSubscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id || null;

    // Get plan config for included employees
    const planConfig = KORALINE_PLANS[plan];

    // Create tenant + owner user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create tenant
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name: tenantName,
          domainKoraline: `${slug}.koraline.app`,
          plan,
          status: 'ACTIVE',
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
          stripeCustomerId,
          stripeSubscriptionId,
          maxEmployees: planConfig.includedEmployees + 1, // +1 for owner
        },
      });

      // 2. Create owner user
      const hashedPassword = password
        ? await bcrypt.hash(password, 12)
        : null;

      const ownerUser = await tx.user.create({
        data: {
          email: customerEmail,
          name: tenantName,
          password: hashedPassword,
          role: 'OWNER',
          tenantId: tenant.id,
          locale: 'fr',
          timezone: 'America/Toronto',
        },
      });

      // 3. Update tenant with owner user ID
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { ownerUserId: ownerUser.id },
      });

      return { tenant, ownerUser };
    });

    logger.info('New Koraline tenant provisioned', {
      tenantId: result.tenant.id,
      slug: result.tenant.slug,
      plan,
      ownerEmail: customerEmail,
    });

    return NextResponse.json({
      tenant: {
        id: result.tenant.id,
        slug: result.tenant.slug,
        name: result.tenant.name,
        plan: result.tenant.plan,
        domainKoraline: result.tenant.domainKoraline,
      },
      owner: {
        id: result.ownerUser.id,
        email: result.ownerUser.email,
      },
      message: 'Tenant provisionné avec succès',
    }, { status: 201 });
  } catch (error) {
    logger.error('Failed to provision tenant', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors du provisioning' },
      { status: 500 }
    );
  }
}
