import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { STRIPE_API_VERSION } from '@/lib/stripe';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  // Look up order by Stripe payment intent from the session
  // The checkout session's payment_intent is stored as stripePaymentId on Order
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: STRIPE_API_VERSION });
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session.payment_intent) {
      return NextResponse.json({ orderNumber: null });
    }

    const order = await prisma.order.findFirst({
      where: { stripePaymentId: session.payment_intent as string },
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
}
