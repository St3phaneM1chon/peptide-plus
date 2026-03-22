/**
 * API: /api/platform/subscription
 * Manages Koraline tenant subscriptions.
 *
 * GET: Get current subscription details for a tenant
 * PUT: Upgrade/downgrade plan
 * DELETE: Cancel subscription
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { getStripeAttitudes, KORALINE_PLANS, type KoralinePlan } from '@/lib/stripe-attitudes';
import { logger } from '@/lib/logger';

async function getAuthenticatedOwner() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'OWNER') {
    return null;
  }
  return session.user;
}

export async function GET() {
  const user = await getAuthenticatedOwner();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { ownerUserId: user.id },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    let stripeSubscription = null;
    if (tenant.stripeSubscriptionId) {
      try {
        const stripe = getStripeAttitudes();
        stripeSubscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
      } catch {
        // Subscription may not exist in test mode
      }
    }

    const planConfig = KORALINE_PLANS[tenant.plan as KoralinePlan] || KORALINE_PLANS.essential;

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        plan: tenant.plan,
        status: tenant.status,
        taxEnabled: tenant.taxEnabled,
      },
      plan: {
        ...planConfig,
        key: tenant.plan,
      },
      subscription: stripeSubscription ? {
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        currentPeriodEnd: stripeSubscription.current_period_end,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      } : null,
      modules: JSON.parse(tenant.modulesEnabled as string || '[]'),
    });
  } catch (error) {
    logger.error('Failed to get subscription', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getAuthenticatedOwner();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { plan } = body;

    if (!plan || !(plan in KORALINE_PLANS)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findFirst({
      where: { ownerUserId: user.id },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    if (tenant.plan === plan) {
      return NextResponse.json({ message: 'Déjà sur ce plan' });
    }

    // Update Stripe subscription if exists
    if (tenant.stripeSubscriptionId) {
      try {
        const stripe = getStripeAttitudes();
        const subscription = await stripe.subscriptions.retrieve(tenant.stripeSubscriptionId);
        const newPlanConfig = KORALINE_PLANS[plan as KoralinePlan];

        await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
          items: [
            {
              id: subscription.items.data[0].id,
              price_data: {
                currency: 'cad',
                product: subscription.items.data[0].price.product as string,
                unit_amount: newPlanConfig.monthlyPrice,
                recurring: { interval: 'month' },
              },
            },
          ],
          proration_behavior: 'create_prorations',
          metadata: { plan },
        });
      } catch (stripeError) {
        logger.error('Failed to update Stripe subscription', {
          error: stripeError instanceof Error ? stripeError.message : String(stripeError),
        });
      }
    }

    // Update tenant plan in DB
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan,
        maxEmployees: KORALINE_PLANS[plan as KoralinePlan].includedEmployees + 1,
      },
    });

    logger.info('Tenant plan updated', { tenantId: tenant.id, oldPlan: tenant.plan, newPlan: plan });

    return NextResponse.json({
      message: `Plan mis à jour vers ${KORALINE_PLANS[plan as KoralinePlan].name}`,
      plan,
    });
  } catch (error) {
    logger.error('Failed to update subscription', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getAuthenticatedOwner();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { ownerUserId: user.id },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Cancel Stripe subscription at period end (D71: access maintained until end of period)
    if (tenant.stripeSubscriptionId) {
      try {
        const stripe = getStripeAttitudes();
        await stripe.subscriptions.update(tenant.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      } catch (stripeError) {
        logger.error('Failed to cancel Stripe subscription', {
          error: stripeError instanceof Error ? stripeError.message : String(stripeError),
        });
      }
    }

    logger.info('Tenant subscription cancelled', { tenantId: tenant.id, slug: tenant.slug });

    return NextResponse.json({
      message: 'Abonnement annulé. Accès maintenu jusqu\'à la fin de la période payée.',
    });
  } catch (error) {
    logger.error('Failed to cancel subscription', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
