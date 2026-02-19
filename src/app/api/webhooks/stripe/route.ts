export const dynamic = 'force-dynamic';

/**
 * DEPRECATED: Stripe webhook handler
 * All Stripe webhook processing is now handled by /api/payments/webhook
 * This route exists only as a fallback redirect.
 *
 * Update your Stripe dashboard webhook endpoint to:
 *   https://biocyclepeptides.com/api/payments/webhook
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Forward the raw request to the canonical webhook handler
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  const url = new URL('/api/payments/webhook', request.url);

  const forwardResponse = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'stripe-signature': signature,
    },
    body,
  });

  const result = await forwardResponse.json();
  return NextResponse.json(result, { status: forwardResponse.status });
}
