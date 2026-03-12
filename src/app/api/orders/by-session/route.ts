export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { STRIPE_API_VERSION } from '@/lib/stripe';
import { auth } from '@/lib/auth-config';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

export async function GET(request: NextRequest) {
  try {
    // Rate limit to prevent session ID brute-force
    const ip = request.headers.get('x-azure-clientip')
      || (() => {
        const xff = request.headers.get('x-forwarded-for');
        if (!xff) return null;
        const ips = xff.split(',').map(i => i.trim()).filter(i => /^[\d.:a-fA-F]{3,45}$/.test(i));
        return ips[ips.length - 1] || null;
      })()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/orders/by-session');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // COMMERCE-004 FIX: Require authentication to prevent unauthenticated order data exposure
    const userSession = await auth();
    if (!userSession?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    // Validate session_id format (Stripe checkout sessions start with cs_)
    if (!/^cs_(test_|live_)[a-zA-Z0-9]+$/.test(sessionId)) {
      return NextResponse.json({ error: 'Invalid session_id format' }, { status: 400 });
    }

    // Look up order by Stripe payment intent from the session
    // The checkout session's payment_intent is stored as stripePaymentId on Order
    try {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: STRIPE_API_VERSION });
      const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

      if (!stripeSession.payment_intent) {
        return NextResponse.json({ orderNumber: null });
      }

      // COMMERCE-004 FIX: Only return order if it belongs to the authenticated user
      const order = await prisma.order.findFirst({
        where: {
          stripePaymentId: stripeSession.payment_intent as string,
          userId: userSession.user.id,
        },
        select: { orderNumber: true, status: true, total: true, createdAt: true },
      });

      if (!order) {
        return NextResponse.json({ orderNumber: null });
      }

      // SEC-17: Return only minimal confirmation data
      return NextResponse.json({
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
        createdAt: order.createdAt,
      });
    } catch {
      return NextResponse.json({ orderNumber: null });
    }
  } catch (error) {
    console.error('[orders/by-session] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
