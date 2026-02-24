export const dynamic = 'force-dynamic';

/**
 * Admin Email Flow Test API
 * POST - Execute a flow in test mode against a test email address
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { safeParseJson } from '@/lib/email/utils';
import { sendEmail } from '@/lib/email/email-service';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const flowTestSchema = z.object({
  testEmail: z.string().email().max(320),
});

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
      // Rate limiting
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip') || '127.0.0.1';
      const rl = await rateLimitMiddleware(ip, '/api/admin/emails/flows/test');
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
      const parsed = flowTestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
      }
      const { testEmail } = parsed.data;

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
                to: { email: testEmail },
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
