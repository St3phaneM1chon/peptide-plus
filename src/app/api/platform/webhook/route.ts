/**
 * API: POST /api/platform/webhook
 * Stripe webhook handler for Attitudes VIP (Koraline SaaS billing).
 * Handles subscription lifecycle events.
 *
 * Separate from BioCycle's /api/payments/webhook (different Stripe account).
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripeAttitudes } from '@/lib/stripe-attitudes';
import { logger } from '@/lib/logger';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  // PAY-F1 CRITICAL FIX: Reject when webhook secret not configured (was silently returning 200)
  const webhookSecret = process.env.STRIPE_ATTITUDES_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret.includes('to_configure')) {
    logger.error('STRIPE_ATTITUDES_WEBHOOK_SECRET not configured — rejecting webhook');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripeAttitudes();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Signature invalid' }, { status: 400 });
  }

  // PAY-F7 FIX: Idempotency — check if event already processed
  try {
    const existingEvent = await prisma.webhookEvent.findUnique({ where: { eventId: event.id } });
    if (existingEvent?.status === 'COMPLETED') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    await prisma.webhookEvent.upsert({
      where: { eventId: event.id },
      update: { status: 'PROCESSING' },
      create: { eventId: event.id, provider: 'stripe_attitudes', eventType: event.type, status: 'PROCESSING' },
    });
  } catch {
    // webhookEvent table may not exist yet — continue without dedup
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantSlug = subscription.metadata?.tenant_slug;
        if (tenantSlug) {
          await prisma.tenant.updateMany({
            where: { slug: tenantSlug },
            data: {
              stripeSubscriptionId: subscription.id,
              stripeCustomerId: subscription.customer as string,
              status: 'ACTIVE',
            },
          });
          logger.info('Tenant subscription created', { tenantSlug, subscriptionId: subscription.id });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenant = await prisma.tenant.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (tenant) {
          const newStatus = subscription.status === 'active' ? 'ACTIVE'
            : subscription.status === 'past_due' ? 'ACTIVE' // Grace period
            : subscription.status === 'canceled' ? 'CANCELLED'
            : subscription.status === 'unpaid' ? 'SUSPENDED'
            : 'ACTIVE';

          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              status: newStatus as 'ACTIVE' | 'SUSPENDED' | 'CANCELLED',
              ...(subscription.cancel_at_period_end ? {
                suspendedReason: 'Annulation programmée en fin de période',
              } : {}),
            },
          });
          logger.info('Tenant subscription updated', {
            tenantId: tenant.id,
            status: newStatus,
            stripeStatus: subscription.status,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const tenant = await prisma.tenant.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (tenant) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              status: 'CANCELLED',
              suspendedAt: new Date(),
              suspendedReason: 'Abonnement Stripe annulé',
            },
          });
          logger.info('Tenant subscription deleted', { tenantId: tenant.id });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const tenant = await prisma.tenant.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (tenant) {
          // D65: J1 rappel, J7 2e rappel, J14 mode maintenance, J30 suspendu
          logger.warn('Tenant payment failed', {
            tenantId: tenant.id,
            slug: tenant.slug,
            invoiceId: invoice.id,
            attemptCount: invoice.attempt_count,
          });

          // After 2+ failed attempts, suspend
          if ((invoice.attempt_count || 0) >= 2) {
            await prisma.tenant.update({
              where: { id: tenant.id },
              data: {
                status: 'SUSPENDED',
                suspendedAt: new Date(),
                suspendedReason: `Paiement échoué (${invoice.attempt_count} tentatives)`,
              },
            });
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        // Reactivate suspended tenant on successful payment
        const tenant = await prisma.tenant.findFirst({
          where: { stripeCustomerId: customerId, status: 'SUSPENDED' },
        });
        if (tenant) {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              status: 'ACTIVE',
              suspendedAt: null,
              suspendedReason: null,
            },
          });
          logger.info('Tenant reactivated after payment', { tenantId: tenant.id });
        }
        break;
      }

      default:
        logger.info('Unhandled Stripe event', { type: event.type });
    }

    // PAY-F7: Mark event as completed
    await prisma.webhookEvent.update({
      where: { eventId: event.id },
      data: { status: 'COMPLETED', processedAt: new Date() },
    }).catch(() => {});

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook processing error', {
      type: event.type,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Processing error' }, { status: 500 });
  }
}
