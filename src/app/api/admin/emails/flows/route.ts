export const dynamic = 'force-dynamic';

/**
 * Admin Email Automation Flows API
 * GET  - List all flows
 * POST - Create a new flow
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { safeParseJson } from '@/lib/email/utils';
import { logger } from '@/lib/logger';

const createFlowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  trigger: z.string().min(1).max(100),
  nodes: z.array(z.unknown()).optional(),
  edges: z.array(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});

export const GET = withAdminGuard(async (request, { session: _session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');

    const where: Record<string, unknown> = {};
    if (active !== null && active !== '') {
      where.isActive = active === 'true';
    }

    const flows = await prisma.emailAutomationFlow.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    // Parse stats for each flow
    const flowsWithStats = flows.map(f => ({
      ...f,
      nodes: safeParseJson(f.nodes, []),
      edges: safeParseJson(f.edges, []),
      stats: safeParseJson(f.stats, { triggered: 0, sent: 0, opened: 0, clicked: 0, revenue: 0 }),
    }));

    return NextResponse.json({ flows: flowsWithStats });
  } catch (error) {
    logger.error('[Flows] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails/flows');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createFlowSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { name, description, trigger, nodes, edges, isActive } = parsed.data;

    const flow = await prisma.emailAutomationFlow.create({
      data: {
        name,
        description: description || null,
        trigger,
        nodes: JSON.stringify(nodes || []),
        edges: JSON.stringify(edges || []),
        isActive: isActive || false,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_EMAIL_FLOW',
      targetType: 'EmailAutomationFlow',
      targetId: flow.id,
      newValue: { name, trigger, isActive: isActive || false },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      flow: {
        ...flow,
        nodes: safeParseJson(flow.nodes, []),
        edges: safeParseJson(flow.edges, []),
      },
    });
  } catch (error) {
    logger.error('[Flows] Create error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
