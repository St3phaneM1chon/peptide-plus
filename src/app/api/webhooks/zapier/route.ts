export const dynamic = 'force-dynamic';

/**
 * Zapier Connector Webhook (M3)
 * POST /api/webhooks/zapier - Handle Zapier action requests (create lead, create deal, etc.)
 * GET  /api/webhooks/zapier - Provide sample data for Zapier trigger setup
 *
 * Auth: API key header validation (x-api-key) + HMAC-SHA256 signature verification (T3-7)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const zapierPostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_lead'),
    contactName: z.string().min(1, 'contactName is required'),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    companyName: z.string().optional(),
    source: z.enum(['WEB', 'REFERRAL', 'IMPORT', 'CAMPAIGN', 'MANUAL', 'PARTNER', 'EMAIL', 'SOCIAL', 'CHATBOT']).optional(),
  }),
  z.object({
    action: z.literal('update_deal'),
    dealId: z.string().min(1, 'dealId is required'),
    title: z.string().optional(),
    value: z.number().optional(),
    stageId: z.string().optional(),
  }),
  z.object({
    action: z.literal('create_deal'),
    title: z.string().min(1, 'title is required'),
    value: z.number().optional(),
    pipelineId: z.string().min(1, 'pipelineId is required'),
    stageId: z.string().min(1, 'stageId is required'),
    assignedToId: z.string().min(1, 'assignedToId is required'),
  }),
]);

// ---------------------------------------------------------------------------
// API Key Validation (timing-safe)
// ---------------------------------------------------------------------------

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key');
  const expectedKey = process.env.ZAPIER_API_KEY;

  if (!expectedKey) {
    logger.warn('[zapier] ZAPIER_API_KEY not configured');
    return false;
  }

  if (!apiKey) return false;

  try {
    const a = Buffer.from(apiKey);
    const b = Buffer.from(expectedKey);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// HMAC Signature Verification (T3-7)
// ---------------------------------------------------------------------------

/**
 * Verify the HMAC-SHA256 signature of the request body.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * Headers checked (in order): x-zapier-signature, x-hook-secret
 *
 * If ZAPIER_WEBHOOK_SECRET is not set, verification is skipped with a warning
 * (graceful degradation for development environments).
 */
function verifyHmacSignature(
  rawBody: string,
  request: NextRequest
): { valid: boolean; skipped: boolean; error?: string } {
  const secret = process.env.ZAPIER_WEBHOOK_SECRET;

  if (!secret) {
    logger.warn(
      '[zapier] ZAPIER_WEBHOOK_SECRET not configured — HMAC signature verification DISABLED. ' +
        'Set this env var in production to secure the webhook endpoint.'
    );
    return { valid: true, skipped: true };
  }

  // Accept signature from either header (x-zapier-signature preferred)
  const signature =
    request.headers.get('x-zapier-signature') ||
    request.headers.get('x-hook-secret');

  if (!signature) {
    return { valid: false, skipped: false, error: 'Missing signature header (x-zapier-signature or x-hook-secret)' };
  }

  const computed = createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    const sigBuffer = Buffer.from(signature);
    const computedBuffer = Buffer.from(computed);

    // timingSafeEqual requires equal-length buffers
    if (sigBuffer.length !== computedBuffer.length) {
      return { valid: false, skipped: false, error: 'Invalid signature' };
    }

    const isValid = timingSafeEqual(sigBuffer, computedBuffer);
    return { valid: isValid, skipped: false, error: isValid ? undefined : 'Invalid signature' };
  } catch {
    return { valid: false, skipped: false, error: 'Signature comparison failed' };
  }
}

// ---------------------------------------------------------------------------
// GET: Provide sample data for Zapier trigger setup
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    if (!validateApiKey(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const trigger = searchParams.get('trigger') || 'new_lead';

    switch (trigger) {
      case 'new_lead': {
        // Return a sample lead for Zapier trigger setup
        const lead = await prisma.crmLead.findFirst({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            contactName: true,
            email: true,
            phone: true,
            companyName: true,
            source: true,
            status: true,
            score: true,
            createdAt: true,
          },
        });

        return NextResponse.json([
          lead || {
            id: 'sample_lead_001',
            contactName: 'John Doe',
            email: 'john@example.com',
            phone: '+15145551234',
            companyName: 'Acme Corp',
            source: 'WEB',
            status: 'NEW',
            score: 50,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      case 'new_deal': {
        const deal = await prisma.crmDeal.findFirst({
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            value: true,
            currency: true,
            createdAt: true,
          },
        });

        return NextResponse.json([
          deal || {
            id: 'sample_deal_001',
            title: 'Sample Deal',
            value: 5000,
            currency: 'CAD',
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      default:
        return NextResponse.json({ error: `Unknown trigger: ${trigger}` }, { status: 400 });
    }
  } catch (error) {
    logger.error('Zapier webhook GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST: Handle Zapier action requests
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Read raw body for HMAC verification (must be done before parsing JSON)
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    logger.error('[zapier] Failed to read request body', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // HMAC signature verification (T3-7)
  const hmacResult = verifyHmacSignature(rawBody, request);
  if (!hmacResult.valid) {
    logger.warn('[zapier] HMAC signature verification failed', {
      error: hmacResult.error,
      ip: getClientIpFromRequest(request),
    });
    return NextResponse.json({ error: hmacResult.error || 'Unauthorized' }, { status: 401 });
  }
  if (!hmacResult.skipped) {
    logger.debug('[zapier] HMAC signature verified successfully');
  }

  try {
    // Parse the raw body as JSON (already consumed via .text() above)
    let raw: unknown;
    try {
      raw = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = zapierPostSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { action } = parsed.data;

    // Idempotency check: skip if this exact request was already processed (Redis-based, TTL 1h)
    // Zapier may retry on timeout; use payload hash to deduplicate
    const zapierEventId = createHmac('sha256', 'zapier-dedup').update(JSON.stringify(raw)).digest('hex').slice(0, 32);
    try {
      const redis = await getRedisClient();
      if (redis) {
        const idempotencyKey = `webhook:zapier:${zapierEventId}`;
        const alreadyProcessed = await redis.get(idempotencyKey);
        if (alreadyProcessed) {
          logger.info('[zapier] Duplicate action skipped', { action, eventId: zapierEventId });
          return NextResponse.json({ success: true, status: 'already_processed' });
        }
        await redis.set(idempotencyKey, '1', 'EX', 3600); // 1h TTL for actions
      }
    } catch (redisErr) {
      // Redis unavailable — proceed without idempotency (prefer processing over skipping)
      logger.debug('[zapier] Redis idempotency check unavailable, proceeding', {
        error: redisErr instanceof Error ? redisErr.message : String(redisErr),
      });
    }

    logger.info('[zapier] Action received', { action, body: JSON.stringify(parsed.data).slice(0, 500) });

    switch (action) {
      case 'create_lead': {
        const { contactName, email, phone, companyName, source } = parsed.data;

        const lead = await prisma.crmLead.create({
          data: {
            contactName,
            email: email || null,
            phone: phone || null,
            companyName: companyName || null,
            source: source || 'WEB',
            status: 'NEW',
          },
        });

        logger.info('[zapier] Lead created via Zapier', { leadId: lead.id });
        return NextResponse.json({ success: true, data: { id: lead.id, contactName: lead.contactName } }, { status: 201 });
      }

      case 'update_deal': {
        const { dealId, title, value, stageId } = parsed.data;

        const existing = await prisma.crmDeal.findUnique({
          where: { id: dealId },
          select: { id: true },
        });

        if (!existing) {
          return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: Record<string, any> = {};
        if (title) updateData.title = title;
        if (value !== undefined) updateData.value = value;
        if (stageId) updateData.stageId = stageId;

        const deal = await prisma.crmDeal.update({
          where: { id: dealId },
          data: updateData,
          select: { id: true, title: true, value: true },
        });

        logger.info('[zapier] Deal updated via Zapier', { dealId: deal.id });
        return NextResponse.json({ success: true, data: deal });
      }

      case 'create_deal': {
        const { title: dealTitle, value: dealValue, pipelineId, stageId: dealStageId, assignedToId } = parsed.data;

        const newDeal = await prisma.crmDeal.create({
          data: {
            title: dealTitle,
            value: dealValue || 0,
            pipelineId,
            stageId: dealStageId,
            assignedToId,
          },
          select: { id: true, title: true, value: true },
        });

        logger.info('[zapier] Deal created via Zapier', { dealId: newDeal.id });
        return NextResponse.json({ success: true, data: newDeal }, { status: 201 });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (err) {
    logger.error('[zapier] Action failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
