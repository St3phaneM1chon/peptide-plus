/**
 * Public API v1 - Webhooks
 * GET  /api/v1/webhooks - List registered webhooks for this API key
 * POST /api/v1/webhooks - Register a new webhook endpoint
 */

import { NextRequest } from 'next/server';
import { randomBytes, createHmac } from 'crypto';
import { withApiAuth, jsonSuccess, jsonError } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

const VALID_EVENTS = [
  'order.created',
  'order.updated',
  'order.paid',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'product.created',
  'product.updated',
  'product.deleted',
  'customer.created',
  'customer.updated',
  'invoice.created',
  'invoice.paid',
  'invoice.overdue',
  'inventory.low',
  'inventory.out_of_stock',
];

export const GET = withApiAuth(async (request: NextRequest) => {
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const [webhooks, total] = await Promise.all([
    prisma.webhookEndpoint.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
    }),
    prisma.webhookEndpoint.count(),
  ]);

  // Mask secrets - never expose them via API
  const result = webhooks.map((wh) => ({
    ...wh,
    deliveryCount: wh._count.deliveries,
    _count: undefined,
  }));

  return jsonSuccess(result, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    availableEvents: VALID_EVENTS,
  });
}, 'webhooks:read');

export const POST = withApiAuth(async (request: NextRequest) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  // Validate required fields
  if (!body.url || typeof body.url !== 'string') {
    return jsonError('url is required and must be a string', 400);
  }

  if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
    return jsonError('events is required and must be a non-empty array', 400);
  }

  // Validate URL format
  try {
    const parsed = new URL(body.url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return jsonError('url must use HTTP or HTTPS protocol', 400);
    }
  } catch {
    return jsonError('url must be a valid URL', 400);
  }

  // Validate events
  const invalidEvents = body.events.filter((e: string) => !VALID_EVENTS.includes(e));
  if (invalidEvents.length > 0) {
    return jsonError(
      `Invalid events: ${invalidEvents.join(', ')}. Valid events: ${VALID_EVENTS.join(', ')}`,
      400
    );
  }

  // Generate signing secret
  const secret = `whsec_${randomBytes(24).toString('hex')}`;

  const webhook = await prisma.webhookEndpoint.create({
    data: {
      url: body.url,
      name: typeof body.name === 'string' ? body.name : null,
      events: body.events as string[],
      secret,
      active: true,
    },
    select: {
      id: true,
      name: true,
      url: true,
      events: true,
      active: true,
      createdAt: true,
    },
  });

  // Return the secret ONCE - it will not be shown again
  return jsonSuccess(
    {
      ...webhook,
      secret,
      _note: 'Save this secret securely. It will not be shown again. Use it to verify webhook signatures.',
    },
    undefined,
    201
  );
}, 'webhooks:write');

/**
 * Utility: Generate webhook signature for payload verification.
 * The receiving endpoint should compute HMAC-SHA256 of the raw body
 * with the webhook secret and compare to the X-Webhook-Signature header.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}
