/**
 * API: POST /api/platform/webhook
 * Stripe webhook handler for Attitudes VIP (Koraline SaaS billing).
 * Handles subscription lifecycle events.
 *
 * Separate from the main /api/payments/webhook (different Stripe account).
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
          const updated = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
          if (updated) {
            await prisma.tenant.update({
              where: { id: updated.id },
              data: {
                stripeSubscriptionId: subscription.id,
                stripeCustomerId: subscription.customer as string,
                status: 'ACTIVE',
              },
            });
            await prisma.tenantEvent.create({
              data: {
                tenantId: updated.id,
                type: 'SUBSCRIPTION_CREATED',
                actor: 'stripe-webhook',
                details: {
                  subscriptionId: subscription.id,
                  customerId: String(subscription.customer),
                  status: subscription.status,
                },
              },
            });
          }
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
          const previousStatus = tenant.status;
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
                suspendedReason: 'Annulation programmee en fin de periode',
              } : {}),
            },
          });

          // Detect plan change from metadata
          const newPlan = subscription.metadata?.plan;
          const eventType = newPlan && newPlan !== tenant.plan ? 'PLAN_CHANGED' : 'SUBSCRIPTION_UPDATED';

          await prisma.tenantEvent.create({
            data: {
              tenantId: tenant.id,
              type: eventType,
              actor: 'stripe-webhook',
              details: {
                previousStatus,
                newStatus,
                stripeStatus: subscription.status,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                ...(newPlan ? { previousPlan: tenant.plan, newPlan } : {}),
              },
            },
          });

          // Update plan if changed
          if (newPlan && newPlan !== tenant.plan) {
            await prisma.tenant.update({
              where: { id: tenant.id },
              data: { plan: newPlan },
            });
          }

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
              status: 'SUSPENDED',
              suspendedAt: new Date(),
              suspendedReason: 'Abonnement Stripe annule',
            },
          });

          await prisma.tenantEvent.create({
            data: {
              tenantId: tenant.id,
              type: 'SUBSCRIPTION_CANCELLED',
              actor: 'stripe-webhook',
              details: {
                subscriptionId: subscription.id,
                canceledAt: subscription.canceled_at,
              },
            },
          });

          await prisma.tenantNotification.create({
            data: {
              tenantId: tenant.id,
              title: 'Abonnement annule',
              message: 'Votre abonnement Koraline a ete annule. Votre acces sera limite. Veuillez contacter le support pour reactiver votre compte.',
              type: 'urgent',
              createdBy: 'system',
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
          const attemptCount = invoice.attempt_count || 0;

          // D65: J1 rappel, J7 2e rappel, J14 mode maintenance, J30 suspendu
          logger.warn('Tenant payment failed', {
            tenantId: tenant.id,
            slug: tenant.slug,
            invoiceId: invoice.id,
            attemptCount,
          });

          // Create event for every failed attempt
          await prisma.tenantEvent.create({
            data: {
              tenantId: tenant.id,
              type: 'PAYMENT_FAILED',
              actor: 'stripe-webhook',
              details: {
                invoiceId: invoice.id,
                attemptCount,
                amountDue: invoice.amount_due,
                currency: invoice.currency,
              },
            },
          });

          // Create notification for the tenant
          await prisma.tenantNotification.create({
            data: {
              tenantId: tenant.id,
              title: 'Paiement echoue',
              message: attemptCount >= 2
                ? `Le paiement de votre facture a echoue apres ${attemptCount} tentatives. Votre compte sera suspendu si le probleme persiste. Veuillez verifier votre moyen de paiement.`
                : `Le paiement de votre facture a echoue (tentative ${attemptCount}). Veuillez verifier votre moyen de paiement pour eviter une interruption de service.`,
              type: attemptCount >= 2 ? 'urgent' : 'warning',
              createdBy: 'system',
            },
          });

          // After 2+ failed attempts, suspend
          if (attemptCount >= 2) {
            await prisma.tenant.update({
              where: { id: tenant.id },
              data: {
                status: 'SUSPENDED',
                suspendedAt: new Date(),
                suspendedReason: `Paiement echoue (${attemptCount} tentatives)`,
              },
            });
          }
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Find tenant by stripeCustomerId (any status)
        const tenantForEvent = await prisma.tenant.findFirst({
          where: { stripeCustomerId: customerId },
        });

        if (tenantForEvent) {
          // Create PAYMENT_SUCCESS event
          await prisma.tenantEvent.create({
            data: {
              tenantId: tenantForEvent.id,
              type: 'PAYMENT_SUCCESS',
              actor: 'stripe-webhook',
              details: {
                invoiceId: invoice.id,
                invoiceNumber: invoice.number,
                amountPaid: invoice.amount_paid,
                currency: invoice.currency,
              },
            },
          });

          // Reactivate if suspended
          if (tenantForEvent.status === 'SUSPENDED') {
            await prisma.tenant.update({
              where: { id: tenantForEvent.id },
              data: {
                status: 'ACTIVE',
                suspendedAt: null,
                suspendedReason: null,
              },
            });

            await prisma.tenantNotification.create({
              data: {
                tenantId: tenantForEvent.id,
                title: 'Compte reactive',
                message: 'Votre paiement a ete recu avec succes. Votre compte est de nouveau actif.',
                type: 'info',
                createdBy: 'system',
              },
            });

            logger.info('Tenant reactivated after payment', { tenantId: tenantForEvent.id });
          } else {
            logger.info('Tenant invoice paid', { tenantId: tenantForEvent.id, invoiceId: invoice.id });
          }
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
