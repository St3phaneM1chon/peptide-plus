export const dynamic = 'force-dynamic';

/**
 * Admin VoIP Caller ID / Local Presence Configuration
 *
 * GET    /api/admin/voip/caller-id — List phone numbers with routing config
 * PUT    /api/admin/voip/caller-id — Update caller ID for campaigns/outbound
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  matchLocalCallerId,
  matchLocalCallerIdBatch,
  getCallerIdPool,
  getPoolStats,
  addCallerIdToPool,
} from '@/lib/voip/local-presence';

const callerIdPostSchema = z.object({
  action: z.enum(['match', 'match-batch', 'pool', 'pool-add', 'pool-stats']),
  destinationNumber: z.string().optional(),
  destinationNumbers: z.array(z.string()).optional(),
  number: z.string().optional(),
  areaCode: z.string().optional(),
  region: z.string().optional(),
});

const callerIdPutSchema = z.object({
  campaignId: z.string().optional(),
  defaultCallerId: z.string().min(1),
  areaCodeMatching: z.boolean().optional(),
  displayName: z.string().optional(),
  routeToIvr: z.string().optional(),
  routeToQueue: z.string().optional(),
  routeToExt: z.string().optional(),
});

/**
 * GET - List PhoneNumber records with their routing configuration.
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country');
    const type = searchParams.get('type');
    const activeOnly = searchParams.get('activeOnly') !== 'false';

    const where: Record<string, unknown> = {};
    if (country) where.country = country.toUpperCase();
    if (type) where.type = type.toUpperCase();
    if (activeOnly) where.isActive = true;

    const phoneNumbers = await prisma.phoneNumber.findMany({
      where,
      include: {
        connection: {
          select: {
            id: true,
            provider: true,
          },
        },
      },
      orderBy: { number: 'asc' },
      take: 200,
    });

    return NextResponse.json({ data: phoneNumbers });
  } catch (error) {
    logger.error('[VoIP CallerID] Failed to list phone numbers', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list caller ID settings' }, { status: 500 });
  }
});

/**
 * POST - Local presence actions (match, batch match, pool management).
 */
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const raw = await request.json();
    const parsed = callerIdPostSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const { action } = body;

    switch (action) {
      case 'match': {
        const { destinationNumber } = body;
        if (!destinationNumber) {
          return NextResponse.json(
            { error: 'destinationNumber is required' },
            { status: 400 }
          );
        }
        const result = await matchLocalCallerId(destinationNumber);
        return NextResponse.json({ data: result });
      }

      case 'match-batch': {
        const { destinationNumbers } = body;
        if (!Array.isArray(destinationNumbers) || destinationNumbers.length === 0) {
          return NextResponse.json(
            { error: 'destinationNumbers must be a non-empty array' },
            { status: 400 }
          );
        }
        if (destinationNumbers.length > 100) {
          return NextResponse.json(
            { error: 'Maximum 100 numbers per batch' },
            { status: 400 }
          );
        }
        const results = await matchLocalCallerIdBatch(destinationNumbers);
        return NextResponse.json({
          data: {
            matches: results,
            total: results.length,
            matched: results.filter((r) => r.matchedCallerId !== null).length,
          },
        });
      }

      case 'pool': {
        const pool = await getCallerIdPool();
        const stats = await getPoolStats();
        return NextResponse.json({ data: { pool, stats } });
      }

      case 'pool-add': {
        const { number, areaCode, region } = body;
        if (!number || !areaCode || !region) {
          return NextResponse.json(
            { error: 'number, areaCode, and region are required' },
            { status: 400 }
          );
        }
        await addCallerIdToPool(number, areaCode, region);
        return NextResponse.json(
          { data: { added: { number, areaCode, region } } },
          { status: 201 }
        );
      }

      case 'pool-stats': {
        const stats = await getPoolStats();
        return NextResponse.json({ data: { stats } });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: match, match-batch, pool, pool-add, pool-stats` },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('[VoIP CallerID] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    return NextResponse.json({ error: 'Caller ID operation failed' }, { status: 500 });
  }
});

/**
 * PUT - Update caller ID configuration for campaigns/outbound.
 */
export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const raw = await request.json();
    const parsed = callerIdPutSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const { campaignId, defaultCallerId, areaCodeMatching } = body;

    // Verify the caller ID phone number exists
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { number: defaultCallerId },
    });

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // If a campaignId is provided, update the campaign's caller ID setting
    if (campaignId) {
      const campaign = await prisma.dialerCampaign.update({
        where: { id: campaignId },
        data: {
          callerIdNumber: defaultCallerId,
        },
      });

      // Store area code matching preference in SiteSetting
      if (areaCodeMatching !== undefined) {
        await prisma.siteSetting.upsert({
          where: { key: `voip:caller_id:area_code_matching:${campaignId}` },
          create: {
            key: `voip:caller_id:area_code_matching:${campaignId}`,
            value: JSON.stringify(areaCodeMatching),
            type: 'json',
            module: 'voip',
            description: 'Area code matching setting for campaign caller ID',
          },
          update: {
            value: JSON.stringify(areaCodeMatching),
          },
        });
      }

      return NextResponse.json({ data: campaign });
    }

    // Without campaignId, update the phone number's display name / routing
    const updated = await prisma.phoneNumber.update({
      where: { number: defaultCallerId },
      data: {
        displayName: body.displayName ?? phoneNumber.displayName,
        routeToIvr: body.routeToIvr ?? phoneNumber.routeToIvr,
        routeToQueue: body.routeToQueue ?? phoneNumber.routeToQueue,
        routeToExt: body.routeToExt ?? phoneNumber.routeToExt,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    logger.error('[VoIP CallerID] Failed to update caller ID', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update caller ID' }, { status: 500 });
  }
});
