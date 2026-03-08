export const dynamic = 'force-dynamic';

/**
 * Public API v1 - Webhooks
 * GET  /api/v1/webhooks - List registered webhooks for this API key
 * POST /api/v1/webhooks - Register a new webhook endpoint
 *
 * AUDIT: This is a webhook REGISTRATION endpoint, NOT a webhook receiver.
 * Auth: withApiAuth middleware validates API key on every request.
 */

import { NextRequest } from 'next/server';
import { randomBytes } from 'crypto';
import { z } from 'zod';
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

const createWebhookSchema = z.object({
  url: z.string().url().max(2048).refine(
    (u) => { try { return ['http:', 'https:'].includes(new URL(u).protocol); } catch { return false; } },
    'url must use HTTP or HTTPS protocol'
  ),
  name: z.string().max(255).optional(),
  events: z.array(z.enum(VALID_EVENTS as [string, ...string[]])).min(1, 'At least one event required'),
});

export const POST = withApiAuth(async (request: NextRequest) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createWebhookSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(
      parsed.error.errors[0]?.message || 'Invalid webhook data',
      400
    );
  }

  const { url, name, events } = parsed.data;

  // Generate signing secret
  const secret = `whsec_${randomBytes(24).toString('hex')}`;

  const webhook = await prisma.webhookEndpoint.create({
    data: {
      url,
      name: name || null,
      events,
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
