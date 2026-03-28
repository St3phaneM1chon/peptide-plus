export const dynamic = 'force-dynamic';

/**
 * Membership Subscribe API (Public)
 * POST - Subscribe to a membership plan
 *   - Free plans: creates membership directly
 *   - Paid plans: creates Stripe Checkout session and returns URL
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const subscribeSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  /** Redirect URL after successful Stripe checkout */
  successUrl: z.string().url().optional(),
  /** Redirect URL if user cancels Stripe checkout */
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/membership/subscribe');
    if (!rl.success) {
      const res = NextResponse.json({ error: 'Too many requests' }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    // Auth required
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();
    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { planId, successUrl, cancelUrl } = parsed.data;

    // Fetch plan
    const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return NextResponse.json({ error: 'Plan not found or inactive' }, { status: 404 });
    }

    // Check max members
    if (plan.maxMembers) {
      const currentCount = await prisma.membership.count({
        where: { planId, status: { in: ['active', 'trialing'] } },
      });
      if (currentCount >= plan.maxMembers) {
        return NextResponse.json({ error: 'Plan is full' }, { status: 409 });
      }
    }

    // Check if already subscribed
    const existing = await prisma.membership.findFirst({
      where: { userId, planId, status: { in: ['active', 'trialing'] } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Already subscribed to this plan' }, { status: 409 });
    }

    const planPrice = Number(plan.price);

    // Free plan or $0 plan: create membership directly
    if (plan.interval === 'free' || planPrice === 0) {
      const membership = await prisma.membership.create({
        data: {
          userId,
          planId,
          status: plan.trialDays > 0 ? 'trialing' : 'active',
          trialEndsAt: plan.trialDays > 0
            ? new Date(Date.now() + plan.trialDays * 86400000)
            : null,
        },
        include: {
          plan: { select: { id: true, name: true, slug: true } },
        },
      });

      return NextResponse.json({ membership, type: 'direct' }, { status: 201 });
    }

    // Paid plan: create Stripe Checkout session
    if (!plan.stripePriceId) {
      return NextResponse.json(
        { error: 'Plan is not configured for payment (missing Stripe price)' },
        { status: 400 }
      );
    }

    // Lazy import Stripe to avoid top-level crash during build
    const Stripe = (await import('stripe')).default;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: 'Payment system not configured' }, { status: 503 });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });

    // Get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true, stripeCustomerId: true },
    });

    let customerId = user?.stripeCustomerId;
    if (!customerId && user?.email) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || 'https://attitudes.vip';
    const sessionConfig: Record<string, unknown> = {
      mode: plan.interval === 'one_time' ? 'payment' : 'subscription',
      customer: customerId || undefined,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: successUrl || `${baseUrl}/account/membership?success=true`,
      cancel_url: cancelUrl || `${baseUrl}/account/membership?cancelled=true`,
      metadata: { userId, planId, membershipType: 'membership_plan' },
    };

    if (plan.trialDays > 0 && plan.interval !== 'one_time') {
      sessionConfig.subscription_data = {
        trial_period_days: plan.trialDays,
        metadata: { userId, planId },
      };
    }

    const checkoutSession = await stripe.checkout.sessions.create(
      sessionConfig as Parameters<typeof stripe.checkout.sessions.create>[0]
    );

    return NextResponse.json({
      type: 'checkout',
      checkoutUrl: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    logger.error('[MembershipSubscribe] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
