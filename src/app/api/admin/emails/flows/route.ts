export const dynamic = 'force-dynamic';

/**
 * Admin Email Automation Flows API
 * GET  - List all flows
 * POST - Create a new flow
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

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
      nodes: JSON.parse(f.nodes),
      edges: JSON.parse(f.edges),
      stats: f.stats ? JSON.parse(f.stats) : { triggered: 0, sent: 0, opened: 0, clicked: 0, revenue: 0 },
    }));

    return NextResponse.json({ flows: flowsWithStats });
  } catch (error) {
    console.error('[Flows] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { name, description, trigger, nodes, edges, isActive } = body;

    if (!name || !trigger) {
      return NextResponse.json({ error: 'Name and trigger are required' }, { status: 400 });
    }

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
        nodes: JSON.parse(flow.nodes),
        edges: JSON.parse(flow.edges),
      },
    });
  } catch (error) {
    console.error('[Flows] Create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
