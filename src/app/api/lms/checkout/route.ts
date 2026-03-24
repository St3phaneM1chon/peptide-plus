export const dynamic = 'force-dynamic';

/**
 * LMS Checkout API
 * POST /api/lms/checkout — Create Stripe checkout session for course or bundle
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { resolvePricing, enrollUser, enrollUserInBundle } from '@/lib/lms/lms-service';
import { STRIPE_API_VERSION } from '@/lib/stripe';

function getLmsStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY required');
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
}

const checkoutSchema = z.object({
  type: z.enum(['course', 'bundle']),
  id: z.string().min(1),
  promoCode: z.string().optional(),
});

export const POST = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant context' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { type, id } = parsed.data;
  const userId = session.user.id;
  const userEmail = session.user.email;

  // Check if user has a corporate account
  const corpEmployee = await prisma.corporateEmployee.findFirst({
    where: { tenantId, userId, isActive: true },
    include: { corporateAccount: true },
  });
  const corporateAccountId = corpEmployee?.corporateAccountId ?? null;

  // Resolve item details
  let itemName: string;
  let itemDescription: string;
  let isFree = false;

  if (type === 'course') {
    const course = await prisma.course.findFirst({ where: { id, tenantId } });
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    itemName = course.title;
    itemDescription = course.subtitle || course.description || '';
    isFree = course.isFree;

    // Free course — enroll directly
    if (isFree) {
      await enrollUser(tenantId, id, userId);
      return NextResponse.json({ data: { enrolled: true, free: true } });
    }

    const pricing = await resolvePricing(
      { price: course.price, corporatePrice: course.corporatePrice, currency: course.currency },
      corporateAccountId
    );

    // Corporate-sponsored free enrollment
    if (pricing.isCorporate && pricing.price === 0) {
      await enrollUser(tenantId, id, userId);
      await prisma.enrollment.updateMany({
        where: { tenantId, courseId: id, userId },
        data: { corporateAccountId, paymentType: 'corporate', enrollmentSource: 'corporate' },
      });
      return NextResponse.json({ data: { enrolled: true, corporate: true } });
    }

    // Create Stripe Checkout Session
    const stripe = getLmsStripe();
    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userEmail ?? undefined,
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: {
            name: itemName,
            description: itemDescription.slice(0, 500) || undefined,
          },
          unit_amount: Math.round(pricing.price * 100), // cents
        },
        quantity: 1,
      }],
      metadata: {
        type: 'course',
        itemId: id,
        userId,
        tenantId,
        corporateAccountId: corporateAccountId ?? '',
        originalPrice: pricing.originalPrice.toString(),
        discount: pricing.discount.toString(),
      },
      success_url: `${getBaseUrl(request)}/learn/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl(request)}/learn/${(await prisma.course.findUnique({ where: { id }, select: { slug: true } }))?.slug ?? ''}?checkout=cancelled`,
    });

    return NextResponse.json({
      data: {
        checkoutUrl: stripeSession.url,
        sessionId: stripeSession.id,
        pricing,
      },
    });

  } else {
    // Bundle
    const bundle = await prisma.courseBundle.findFirst({
      where: { id, tenantId, isActive: true },
      include: { items: { include: { course: { select: { id: true, title: true, slug: true, isFree: true } } } } },
    });
    if (!bundle) return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });

    const pricing = await resolvePricing(
      { price: bundle.price, corporatePrice: bundle.corporatePrice, currency: bundle.currency },
      corporateAccountId
    );

    // Corporate-sponsored free enrollment
    if (pricing.isCorporate && pricing.price === 0) {
      const result = await enrollUserInBundle(tenantId, id, userId, {
        corporateAccountId: corporateAccountId ?? undefined,
        paymentType: 'corporate',
      });
      return NextResponse.json({ data: { enrolled: true, corporate: true, ...result } });
    }

    // Create Stripe Checkout Session for bundle
    const stripe = getLmsStripe();
    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: userEmail ?? undefined,
      line_items: [{
        price_data: {
          currency: 'cad',
          product_data: {
            name: bundle.name,
            description: `Forfait: ${bundle.items.map(i => i.course.title).join(', ')}`.slice(0, 500),
          },
          unit_amount: Math.round(pricing.price * 100),
        },
        quantity: 1,
      }],
      metadata: {
        type: 'bundle',
        itemId: id,
        userId,
        tenantId,
        corporateAccountId: corporateAccountId ?? '',
        courseCount: bundle.items.length.toString(),
      },
      success_url: `${getBaseUrl(request)}/learn/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl(request)}/learn/forfaits/${bundle.slug}?checkout=cancelled`,
    });

    return NextResponse.json({
      data: {
        checkoutUrl: stripeSession.url,
        sessionId: stripeSession.id,
        pricing,
        courseCount: bundle.items.length,
      },
    });
  }
});

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host') ?? 'localhost:3000';
  const proto = request.headers.get('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}
