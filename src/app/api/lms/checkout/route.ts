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

// PAY-F4 FIX: Lazy singleton (was creating new Stripe instance per request)
let _lmsStripe: Stripe | null = null;
function getLmsStripe(): Stripe {
  if (!_lmsStripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY required');
    _lmsStripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
  }
  return _lmsStripe;
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
    // FIX P1: Don't leak Zod error details to client
    return NextResponse.json({ error: 'Invalid checkout request' }, { status: 400 });
  }

  const { type, id } = parsed.data;
  const userId = session.user.id;
  const userEmail = session.user.email;

  // FIX P2: Defense in depth — null check on userId
  if (!userId) {
    return NextResponse.json({ error: 'User ID not found in session' }, { status: 403 });
  }

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

    // V2 P0 FIX: Check if already enrolled before creating payment
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { tenantId_courseId_userId: { tenantId, courseId: id, userId } },
      select: { id: true, status: true },
    });
    if (existingEnrollment && existingEnrollment.status !== 'CANCELLED') {
      return NextResponse.json({ error: 'Already enrolled in this course' }, { status: 409 });
    }
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
      corporateAccountId, tenantId
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
      success_url: `${getBaseUrl()}/learn/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl()}/learn/${course.slug}?checkout=cancelled`,
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
      corporateAccountId, tenantId
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
      success_url: `${getBaseUrl()}/learn/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${getBaseUrl()}/learn/forfaits/${bundle.slug}?checkout=cancelled`,
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

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://attitudes.vip';
}
