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
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

function safeParseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

/** Validate flow graph: check for orphan nodes, invalid edges, missing trigger */
function validateFlowGraph(
  nodes: Array<{ id: string; type: string }>,
  edges: Array<{ source: string; target: string }>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Must have exactly one trigger node
  const triggers = nodes.filter((n) => n.type === 'trigger');
  if (triggers.length === 0) errors.push('Flow must have at least one trigger node');
  if (triggers.length > 1) errors.push('Flow must have exactly one trigger node');

  // All edges must reference existing nodes
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) errors.push(`Edge references non-existent source node: ${edge.source}`);
    if (!nodeIds.has(edge.target)) errors.push(`Edge references non-existent target node: ${edge.target}`);
    if (edge.source === edge.target) errors.push(`Self-referencing edge on node: ${edge.source}`);
  }

  // Check for orphan nodes (not connected by any edge, except the trigger)
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }
  for (const node of nodes) {
    if (node.type !== 'trigger' && !connectedNodes.has(node.id)) {
      errors.push(`Orphan node not connected to any edge: ${node.id}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

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
          nodes: safeParseJson(flow.nodes, []),
          edges: safeParseJson(flow.edges, []),
          stats: safeParseJson(flow.stats, { triggered: 0, sent: 0, opened: 0, clicked: 0, revenue: 0 }),
        },
      });
    } catch (error) {
      console.error('[Flow Detail] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const PUT = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      const body = await request.json();
      const { name, description, trigger, nodes, edges, isActive } = body;

      // Validate flow graph integrity when nodes/edges are updated
      if (nodes && edges) {
        const validation = validateFlowGraph(nodes, edges);
        if (!validation.valid) {
          return NextResponse.json(
            { error: 'Invalid flow graph', details: validation.errors },
            { status: 400 },
          );
        }
      }

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

      logAdminAction({
        adminUserId: session.user.id,
        action: 'UPDATE_EMAIL_FLOW',
        targetType: 'EmailAutomationFlow',
        targetId: params.id,
        newValue: updates,
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
      console.error('[Flow Update] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

export const DELETE = withAdminGuard(
  async (_request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      // Clean up orphaned executions before deleting the flow
      await prisma.emailFlowExecution.updateMany({
        where: { flowId: params.id, status: 'WAITING' },
        data: { status: 'CANCELLED' },
      });

      await prisma.emailAutomationFlow.delete({ where: { id: params.id } });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'DELETE_EMAIL_FLOW',
        targetType: 'EmailAutomationFlow',
        targetId: params.id,
        ipAddress: getClientIpFromRequest(_request),
        userAgent: _request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('[Flow Delete] Error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
