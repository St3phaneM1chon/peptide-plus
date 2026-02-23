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
import { safeParseJson } from '@/lib/email/utils';
import { validateNode } from '@/lib/email/automation-engine';
import { logger } from '@/lib/logger';

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
  async (request: NextRequest, { session: _session, params }: { session: unknown; params: { id: string } }) => {
    try {
      const flow = await prisma.emailAutomationFlow.findUnique({ where: { id: params.id } });
      if (!flow) {
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      }

      const url = new URL(request.url);
      const format = url.searchParams.get('format');

      // Export flow as downloadable JSON (excludes id and timestamps)
      if (format === 'json') {
        const exportData = {
          name: flow.name,
          description: flow.description,
          trigger: flow.trigger,
          nodes: safeParseJson(flow.nodes, []),
          edges: safeParseJson(flow.edges, []),
        };
        const jsonContent = JSON.stringify(exportData, null, 2);
        const safeName = flow.name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50);

        return new Response(jsonContent, {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="flow-${safeName}.json"`,
          },
        });
      }

      const includeHistory = url.searchParams.get('includeHistory') === 'true';

      const response: Record<string, unknown> = {
        flow: {
          ...flow,
          nodes: safeParseJson(flow.nodes, []),
          edges: safeParseJson(flow.edges, []),
          stats: safeParseJson(flow.stats, { triggered: 0, sent: 0, opened: 0, clicked: 0, revenue: 0 }),
        },
      };

      if (includeHistory) {
        const executions = await prisma.emailFlowExecution.findMany({
          where: { flowId: params.id },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            email: true,
            status: true,
            currentNode: true,
            context: true,
            executeAt: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        response.executions = executions.map((ex) => ({
          id: ex.id,
          email: ex.email,
          status: ex.status,
          currentNode: ex.currentNode,
          context: safeParseJson(ex.context, null),
          startedAt: ex.createdAt,
          completedAt: ex.status === 'COMPLETED' || ex.status === 'FAILED' ? ex.updatedAt : null,
          executeAt: ex.executeAt,
        }));
      }

      return NextResponse.json(response);
    } catch (error) {
      logger.error('[Flow Detail] Error', { error: error instanceof Error ? error.message : String(error) });
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
      logger.error('[Flow Update] Error', { error: error instanceof Error ? error.message : String(error) });
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
      logger.error('[Flow Delete] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);

// POST /api/admin/emails/flows/[id] - Dry-run validation (validate without executing)
export const POST = withAdminGuard(
  async (request: NextRequest, { session: _session, params }: { session: unknown; params: { id: string } }) => {
    try {
      const body = await request.json().catch(() => ({}));
      const action = body.action;

      if (action !== 'validate') {
        return NextResponse.json({ error: 'Unknown action. Use { "action": "validate" }' }, { status: 400 });
      }

      const flow = await prisma.emailAutomationFlow.findUnique({ where: { id: params.id } });
      if (!flow) {
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      }

      const nodes = safeParseJson<Array<{ id: string; type: string; data: Record<string, unknown> }>>(flow.nodes, []);
      const edges = safeParseJson<Array<{ source: string; target: string; sourceHandle?: string }>>(flow.edges, []);

      const errors: string[] = [];
      const warnings: string[] = [];

      // 1. Graph structure validation (orphans, edges, trigger)
      const graphResult = validateFlowGraph(nodes, edges);
      errors.push(...graphResult.errors);

      // 2. Per-node validation using the engine's validateNode
      const validNodeTypes = ['trigger', 'email', 'send_email', 'sms', 'delay', 'condition', 'push'];
      for (const node of nodes) {
        if (!validNodeTypes.includes(node.type)) {
          errors.push(`Node "${node.id}" has unknown type: "${node.type}"`);
          continue;
        }
        // Cast to FlowNode-compatible shape for validateNode
        const nodeError = validateNode(node as Parameters<typeof validateNode>[0]);
        if (nodeError) {
          errors.push(nodeError);
        }
      }

      // 3. Warnings for common issues
      if (nodes.length === 1 && nodes[0]?.type === 'trigger') {
        warnings.push('Flow has only a trigger node with no actions — it will do nothing when triggered');
      }

      const emailNodes = nodes.filter(n => n.type === 'email' || n.type === 'send_email');
      for (const en of emailNodes) {
        if (en.data.templateId) {
          // Check template exists
          const tmpl = await prisma.emailTemplate.findUnique({ where: { id: en.data.templateId as string } });
          if (!tmpl) {
            warnings.push(`Email node "${en.id}" references templateId "${en.data.templateId}" which does not exist`);
          } else if (!tmpl.isActive) {
            warnings.push(`Email node "${en.id}" references template "${tmpl.name}" which is inactive`);
          }
        }
      }

      // Check for unreachable nodes (nodes not reachable from trigger via BFS)
      const triggerNode = nodes.find(n => n.type === 'trigger');
      if (triggerNode) {
        const reachable = new Set<string>();
        const queue = [triggerNode.id];
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (reachable.has(current)) continue;
          reachable.add(current);
          for (const edge of edges) {
            if (edge.source === current && !reachable.has(edge.target)) {
              queue.push(edge.target);
            }
          }
        }
        for (const node of nodes) {
          if (!reachable.has(node.id)) {
            warnings.push(`Node "${node.id}" (${node.type}) is unreachable from the trigger`);
          }
        }
      }

      return NextResponse.json({
        flowId: flow.id,
        flowName: flow.name,
        valid: errors.length === 0,
        errors,
        warnings,
        summary: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          nodeTypes: nodes.reduce((acc, n) => {
            acc[n.type] = (acc[n.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
      });
    } catch (error) {
      logger.error('[Flow Validate] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
