export const dynamic = 'force-dynamic';

/**
 * Admin Email Segments API
 * GET  - List audience segments with live counts
 * POST - Create custom segment
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const createSegmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  query: z.union([z.string().max(10000), z.record(z.unknown())]).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  sourceId: z.string().uuid().optional(),
}).refine(
  (data) => data.sourceId || (data.name && data.query),
  { message: 'Either sourceId (clone) or name+query (create) are required' }
);

// Pre-defined RFM segments
const RFM_SEGMENTS = [
  {
    id: 'rfm-champions',
    name: 'Champions',
    description: 'Achat recent, frequent, haute valeur',
    color: '#10B981',
    query: { minOrders: 5, minSpent: 500, lastOrderDays: 30 },
  },
  {
    id: 'rfm-loyal',
    name: 'Clients fideles',
    description: 'Achat frequent, bonne valeur',
    color: '#3B82F6',
    query: { minOrders: 3, minSpent: 200, lastOrderDays: 60 },
  },
  {
    id: 'rfm-potential',
    name: 'A potentiel',
    description: 'Achat recent, 1-2 commandes',
    color: '#F59E0B',
    query: { minOrders: 1, maxOrders: 2, lastOrderDays: 30 },
  },
  {
    id: 'rfm-at-risk',
    name: 'A risque',
    description: 'Etait fidele, pas d\'achat recent',
    color: '#EF4444',
    query: { minOrders: 3, lastOrderDaysMin: 60, lastOrderDaysMax: 120 },
  },
  {
    id: 'rfm-dormant',
    name: 'Endormis',
    description: 'Pas d\'achat depuis 120+ jours',
    color: '#6B7280',
    query: { minOrders: 1, lastOrderDaysMin: 120 },
  },
  {
    id: 'rfm-new',
    name: 'Nouveaux',
    description: 'Inscrits sans achat',
    color: '#8B5CF6',
    query: { maxOrders: 0 },
  },
];

export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const refreshCounts = searchParams.get('refreshCounts') === 'true';
    const now = new Date();

    // Calculate RFM segment counts
    const segmentsWithCounts = await Promise.all(
      RFM_SEGMENTS.map(async (segment) => {
        const count = await countSegment(segment.query, now);
        return { ...segment, count, lastCountedAt: now.toISOString(), type: 'rfm' as const };
      })
    );

    // Get total user count
    const totalUsers = await prisma.user.count({ where: { emailVerified: { not: null } } });

    // Built-in segments
    const builtInSegments = [
      {
        id: 'all-subscribers',
        name: 'Tous les abonnes',
        description: 'Tous les utilisateurs avec email verifie',
        color: '#1F2937',
        count: totalUsers,
        lastCountedAt: now.toISOString(),
        type: 'builtin' as const,
      },
      {
        id: 'vip-tier',
        name: 'Tier VIP+',
        description: 'Clients Gold, Platinum, Diamond',
        color: '#F59E0B',
        count: await prisma.user.count({
          where: { loyaltyTier: { in: ['GOLD', 'PLATINUM', 'DIAMOND'] } },
        }),
        lastCountedAt: now.toISOString(),
        type: 'builtin' as const,
      },
      {
        id: 'newsletter',
        name: 'Newsletter',
        description: 'Abonnes newsletter',
        color: '#10B981',
        count: await prisma.newsletterSubscriber.count({ where: { isActive: true } }),
        lastCountedAt: now.toISOString(),
        type: 'builtin' as const,
      },
      {
        id: 'locale-fr',
        name: 'Francophones',
        description: 'Clients en francais',
        color: '#3B82F6',
        count: await prisma.user.count({ where: { locale: 'fr' } }),
        lastCountedAt: now.toISOString(),
        type: 'builtin' as const,
      },
      {
        id: 'locale-en',
        name: 'Anglophones',
        description: 'Clients en anglais',
        color: '#EF4444',
        count: await prisma.user.count({ where: { locale: 'en' } }),
        lastCountedAt: now.toISOString(),
        type: 'builtin' as const,
      },
    ];

    // Load custom segments from DB
    const customSegments = await prisma.emailSegment.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // If refreshCounts=true, recalculate counts for custom segments and persist them
    let customWithType;
    if (refreshCounts && customSegments.length > 0) {
      customWithType = await Promise.all(
        customSegments.map(async (s) => {
          let queryObj: Record<string, unknown> = {};
          try {
            queryObj = JSON.parse(s.query);
          } catch (error) { logger.error('[EmailSegments] Failed to parse segment query JSON', { error: error instanceof Error ? error.message : String(error) }); /* use empty query */ }

          const count = await countSegment(queryObj, now);

          // Persist the recalculated count
          await prisma.emailSegment.update({
            where: { id: s.id },
            data: { contactCount: count },
          }).catch((error: unknown) => { logger.error('[EmailSegments] Non-blocking segment count update failed', { error: error instanceof Error ? error.message : String(error) }); }); // non-blocking

          return {
            id: s.id,
            name: s.name,
            description: s.description,
            color: s.color || '#6B7280',
            count,
            lastCountedAt: now.toISOString(),
            type: 'custom' as const,
            query: s.query,
          };
        })
      );
    } else {
      customWithType = customSegments.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        color: s.color || '#6B7280',
        count: s.contactCount,
        lastCountedAt: s.updatedAt.toISOString(),
        type: 'custom' as const,
        query: s.query,
      }));
    }

    return NextResponse.json({
      segments: [...segmentsWithCounts, ...builtInSegments, ...customWithType],
      totalUsers,
      countedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error('[Segments] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// Security: whitelist allowed query fields to prevent arbitrary Prisma injection
const ALLOWED_SEGMENT_FIELDS = new Set([
  'minOrders', 'maxOrders', 'minSpent', 'maxSpent',
  'lastOrderDays', 'lastOrderDaysMin', 'lastOrderDaysMax',
  'hasOrders', 'isVerified', 'newsletter', 'totalSpent',
]);

function sanitizeSegmentQuery(query: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(query)) {
    if (ALLOWED_SEGMENT_FIELDS.has(key)) {
      sanitized[key] = query[key];
    }
  }
  return sanitized;
}

async function countSegment(rawQuery: Record<string, unknown>, now: Date): Promise<number> {
  const query = sanitizeSegmentQuery(rawQuery);
  const where: Record<string, unknown> = { emailVerified: { not: null } };

  if (query.minOrders !== undefined || query.maxOrders !== undefined) {
    if (query.maxOrders === 0) {
      where.orders = { none: {} };
    } else {
      // We need raw query for order count filtering
      // Simplified: use approximate filtering
      if (query.minOrders) {
        where.orders = { some: {} };
      }
    }
  }

  if (query.lastOrderDays) {
    const since = new Date(now.getTime() - (query.lastOrderDays as number) * 86400000);
    where.orders = { ...(where.orders as object || {}), some: { createdAt: { gte: since } } };
  }

  if (query.lastOrderDaysMin) {
    const before = new Date(now.getTime() - (query.lastOrderDaysMin as number) * 86400000);
    // Has orders but none since X days
    if (!where.orders) where.orders = {};
    (where.orders as Record<string, unknown>).none = { createdAt: { gte: before } };
    (where.orders as Record<string, unknown>).some = {};
  }

  if (query.minSpent) {
    // Approximate: filter by loyalty tier as proxy
    // TODO: Use raw SQL for accurate monetary filtering
  }

  try {
    return await prisma.user.count({ where });
  } catch (error) {
    logger.error('[EmailSegments] Failed to count segment users', { error: error instanceof Error ? error.message : String(error) });
    return 0;
  }
}

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails/segments');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createSegmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name, description, query, color, sourceId } = parsed.data;

    // Clone mode: duplicate an existing custom segment
    if (sourceId) {
      const source = await prisma.emailSegment.findUnique({ where: { id: sourceId } });
      if (!source) {
        return NextResponse.json({ error: 'Source segment not found' }, { status: 404 });
      }

      // Recalculate the contact count for the cloned segment
      let queryObj: Record<string, unknown> = {};
      try { queryObj = JSON.parse(source.query); } catch { /* use empty */ }
      const count = await countSegment(queryObj, new Date());

      const cloned = await prisma.emailSegment.create({
        data: {
          name: name || `${source.name} (Copy)`,
          description: source.description,
          query: source.query,
          color: source.color || '#6B7280',
          contactCount: count,
          createdBy: session.user.id,
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'CLONE_EMAIL_SEGMENT',
        targetType: 'EmailSegment',
        targetId: cloned.id,
        newValue: { name: cloned.name, sourceId, contactCount: count },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((err: unknown) => { logger.error('[Segments] Non-blocking audit log for clone failed', { error: err instanceof Error ? err.message : String(err) }); });

      return NextResponse.json({
        segment: {
          id: cloned.id,
          name: cloned.name,
          description: cloned.description,
          color: cloned.color || '#6B7280',
          count,
          lastCountedAt: new Date().toISOString(),
          type: 'custom' as const,
          query: cloned.query,
        },
      });
    }

    // Normal creation mode
    if (!name || !query) {
      return NextResponse.json({ error: 'Name and query are required' }, { status: 400 });
    }

    // Security: reject oversized query strings to prevent DoS / injection
    if (typeof query === 'string' && query.length > 10000) {
      return NextResponse.json({ error: 'query too large (max 10KB)' }, { status: 400 });
    }

    // Validate query is a non-null object
    let queryStr: string;
    if (typeof query === 'string') {
      try { JSON.parse(query); queryStr = query; } catch {
        return NextResponse.json({ error: 'query must be valid JSON' }, { status: 400 });
      }
    } else if (typeof query === 'object' && query !== null) {
      queryStr = JSON.stringify(query);
    } else {
      return NextResponse.json({ error: 'query must be a JSON object or string' }, { status: 400 });
    }

    const segment = await prisma.emailSegment.create({
      data: {
        name,
        description: description || null,
        query: queryStr,
        color: color || '#6B7280',
        createdBy: session.user.id,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_EMAIL_SEGMENT',
      targetType: 'EmailSegment',
      targetId: segment.id,
      newValue: { name, description, color },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err: unknown) => { logger.error('[Segments] Non-blocking audit log for create failed', { error: err instanceof Error ? err.message : String(err) }); });

    return NextResponse.json({ segment: { ...segment, type: 'custom' } });
  } catch (error) {
    logger.error('[Segments] Create error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
