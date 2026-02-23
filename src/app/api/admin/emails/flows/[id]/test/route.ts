export const dynamic = 'force-dynamic';

/**
 * Admin Email Flow Test API
 * POST - Execute a flow in test mode against a test email address
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { safeParseJson } from '@/lib/email/utils';
import { sendEmail } from '@/lib/email/email-service';
import { logger } from '@/lib/logger';

/** Mock context with sample data for test flow execution */
function buildTestContext(testEmail: string) {
  return {
    email: testEmail,
    firstName: 'Test',
    lastName: 'User',
    name: 'Test User',
    locale: 'fr',
    orderId: 'test-order-000',
    orderNumber: 'ORD-TEST-000',
    orderTotal: '49.99',
    currency: 'EUR',
    productName: 'Sample Peptide BPC-157',
    trackingUrl: 'https://example.com/tracking/test',
    isTest: true,
  };
}

export const POST = withAdminGuard(
  async (request: NextRequest, { session, params }: { session: { user: { id: string } }; params: { id: string } }) => {
    try {
      const body = await request.json();
      const { testEmail } = body;

      if (!testEmail || typeof testEmail !== 'string') {
        return NextResponse.json({ error: 'testEmail is required' }, { status: 400 });
      }

      // Basic email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(testEmail)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }

      // Load the flow
      const flow = await prisma.emailAutomationFlow.findUnique({ where: { id: params.id } });
      if (!flow) {
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
      }

      const nodes = safeParseJson(flow.nodes, []) as Array<{
        id: string;
        type: string;
        data?: { subject?: string; templateId?: string; body?: string; delayMinutes?: number };
      }>;
      const edges = safeParseJson(flow.edges, []) as Array<{ source: string; target: string }>;

      if (nodes.length === 0) {
        return NextResponse.json({ error: 'Flow has no nodes' }, { status: 400 });
      }

      const context = buildTestContext(testEmail);
      const results: Array<{ nodeId: string; type: string; status: string; detail?: string }> = [];

      // Find the trigger node and walk the graph in order
      const triggerNode = nodes.find((n) => n.type === 'trigger');
      if (!triggerNode) {
        return NextResponse.json({ error: 'Flow has no trigger node' }, { status: 400 });
      }

      // Build adjacency list for traversal
      const adjacency = new Map<string, string[]>();
      for (const edge of edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
        adjacency.get(edge.source)!.push(edge.target);
      }

      // BFS walk from trigger to execute nodes in order
      const visited = new Set<string>();
      const queue = [triggerNode.id];
      visited.add(triggerNode.id);
      results.push({ nodeId: triggerNode.id, type: 'trigger', status: 'ok', detail: `Trigger: ${flow.trigger}` });

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const nextIds = adjacency.get(currentId) || [];

        for (const nextId of nextIds) {
          if (visited.has(nextId)) continue;
          visited.add(nextId);
          queue.push(nextId);

          const node = nodes.find((n) => n.id === nextId);
          if (!node) {
            results.push({ nodeId: nextId, type: 'unknown', status: 'skipped', detail: 'Node not found' });
            continue;
          }

          if (node.type === 'email' || node.type === 'send_email') {
            // Actually send a test email
            const subject = node.data?.subject || `[TEST] Flow: ${flow.name}`;
            const htmlBody = node.data?.body || `<p>Test email from flow "<strong>${flow.name}</strong>"</p><p>Node: ${node.id}</p>`;
            try {
              const emailResult = await sendEmail({
                to: testEmail,
                subject: `[TEST] ${subject}`,
                html: htmlBody,
              });

              // Log the test email with isTest flag
              await prisma.emailLog.create({
                data: {
                  to: testEmail,
                  subject: `[TEST] ${subject}`,
                  status: emailResult.success ? 'sent' : 'failed',
                  error: emailResult.error || null,
                  messageId: emailResult.messageId || null,
                  templateId: `flow-test:${flow.id}:${node.id}`,
                },
              }).catch(() => {}); // non-blocking

              results.push({
                nodeId: node.id,
                type: node.type,
                status: emailResult.success ? 'sent' : 'failed',
                detail: emailResult.success
                  ? `Sent to ${testEmail}`
                  : `Failed: ${emailResult.error || 'unknown error'}`,
              });
            } catch (err) {
              results.push({
                nodeId: node.id,
                type: node.type,
                status: 'error',
                detail: err instanceof Error ? err.message : 'Send failed',
              });
            }
          } else if (node.type === 'delay' || node.type === 'wait') {
            const minutes = node.data?.delayMinutes || 0;
            results.push({
              nodeId: node.id,
              type: node.type,
              status: 'skipped',
              detail: `Delay ${minutes}m (skipped in test mode)`,
            });
          } else if (node.type === 'condition' || node.type === 'filter') {
            results.push({
              nodeId: node.id,
              type: node.type,
              status: 'ok',
              detail: 'Condition evaluated as true (test mode always passes)',
            });
          } else {
            results.push({
              nodeId: node.id,
              type: node.type,
              status: 'ok',
              detail: `Node processed in test mode`,
            });
          }
        }
      }

      logAdminAction({
        adminUserId: session.user.id,
        action: 'TEST_EMAIL_FLOW',
        targetType: 'EmailAutomationFlow',
        targetId: params.id,
        newValue: { testEmail, nodesExecuted: results.length },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({
        flowId: flow.id,
        flowName: flow.name,
        testEmail,
        isTest: true,
        context,
        results,
        summary: {
          total: results.length,
          sent: results.filter((r) => r.status === 'sent').length,
          skipped: results.filter((r) => r.status === 'skipped').length,
          failed: results.filter((r) => r.status === 'failed' || r.status === 'error').length,
        },
      });
    } catch (error) {
      logger.error('[Flow Test] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
