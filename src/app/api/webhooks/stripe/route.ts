export const dynamic = 'force-dynamic';

/**
 * REMOVED: Stripe webhook handler
 * All Stripe webhook processing is handled by /api/payments/webhook
 * This route returns 410 Gone to signal the URL is no longer valid.
 *
 * Update your Stripe dashboard webhook endpoint to:
 *   https://biocyclepeptides.com/api/payments/webhook
 *
 * AUDIT: Signature verified via stripe.webhooks.constructEvent() in /api/payments/webhook.
 * This stub route performs NO webhook processing — it only returns 410 Gone.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'This webhook endpoint has been removed. Use /api/payments/webhook instead.',
      redirect: '/api/payments/webhook',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    { message: 'Stripe webhook endpoint moved to /api/payments/webhook', status: 'gone' },
    { status: 410 }
  );
}
