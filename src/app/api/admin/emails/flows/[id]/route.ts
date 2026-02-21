export const dynamic = 'force-dynamic';

/**
 * Admin Email Automation Flow Detail API
 * GET    - Get flow detail
 * PUT    - Update flow (nodes, edges, active status)
 * DELETE - Delete flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

export const GET = withAdminGuard(
  async (_request: NextRequest, { session: _session, params }: { session: unknown; params: { id: string } }) => {
    try {
      const flow = await prisma.emailAutomationFlow.findUnique({ where: { id: params.id } });
      if (!flow) {
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      }
      return NextResponse.json({
        flow: {
          ...flow,
          nodes: JSON.parse(flow.nodes),
          edges: JSON.parse(flow.edges),
          stats: flow.stats ? JSON.parse(flow.stats) : { triggered: 0, sent: 0, opened: 0, clicked: 0, revenue: 0 },
        },
      });
    } catch (error) {
      console.error('[Flow Detail] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const PUT = withAdminGuard(
  async (request: NextRequest, { session: _session, params }: { session: unknown; params: { id: string } }) => {
    try {
      const body = await request.json();
      const { name, description, trigger, nodes, edges, isActive } = body;

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (trigger !== undefined) updates.trigger = trigger;
      if (nodes !== undefined) updates.nodes = JSON.stringify(nodes);
      if (edges !== undefined) updates.edges = JSON.stringify(edges);
      if (isActive !== undefined) updates.isActive = isActive;

      const flow = await prisma.emailAutomationFlow.update({
        where: { id: params.id },
        data: updates,
      });

      return NextResponse.json({
        flow: {
          ...flow,
          nodes: JSON.parse(flow.nodes),
          edges: JSON.parse(flow.edges),
        },
      });
    } catch (error) {
      console.error('[Flow Update] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const DELETE = withAdminGuard(
  async (_request: NextRequest, { session: _session, params }: { session: unknown; params: { id: string } }) => {
    try {
      await prisma.emailAutomationFlow.delete({ where: { id: params.id } });
      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('[Flow Delete] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
