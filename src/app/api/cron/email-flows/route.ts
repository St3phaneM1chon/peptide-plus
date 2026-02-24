export const dynamic = 'force-dynamic';

/**
 * CRON - Process delayed email flow executions
 * GET /api/cron/email-flows
 *
 * Called periodically (e.g. every minute via external cron) to process
 * EmailFlowExecution records whose executeAt has arrived.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';

import { escapeHtml } from '@/lib/email/templates/base-template';

export async function GET(request: NextRequest) {
  // FLAW-006 FIX: Only accept cron secret via Authorization header, not query string.
  // Query string secrets appear in server logs, browser history, CDN logs, and Referer headers.
  // Timing-safe comparison to prevent timing attacks on the secret.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let secretsMatch = false;
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    secretsMatch = a.length === b.length && timingSafeEqual(a, b);
  } catch { secretsMatch = false; }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('email-flows', async () => {
  try {
    // Find all executions that are ready to run
    const readyExecutions = await prisma.emailFlowExecution.findMany({
      where: {
        status: 'WAITING',
        executeAt: { lte: new Date() },
      },
      take: 50,
      orderBy: { executeAt: 'asc' },
    });

    if (readyExecutions.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let processed = 0;
    let failed = 0;

    // FIX: FLAW-032 - Process executions in parallel batches of 10 instead of sequentially.
    // With 50 executions and network latency per email, sequential processing can timeout on serverless.
    const BATCH_SIZE = 10;
    for (let batchStart = 0; batchStart < readyExecutions.length; batchStart += BATCH_SIZE) {
      const batch = readyExecutions.slice(batchStart, batchStart + BATCH_SIZE);

      const results = await Promise.allSettled(batch.map(async (execution) => {
        // Mark as running (prevents re-processing on concurrent cron calls)
        await prisma.emailFlowExecution.update({
          where: { id: execution.id },
          data: { status: 'RUNNING' },
        });

        // Load the flow
        const flow = await prisma.emailAutomationFlow.findUnique({
          where: { id: execution.flowId },
        });

        if (!flow || !flow.isActive) {
          await prisma.emailFlowExecution.update({
            where: { id: execution.id },
            data: { status: 'FAILED' },
          });
          throw new Error('Flow inactive or not found');
        }

        let nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>;
        let edges: Array<{ id: string; source: string; target: string; sourceHandle?: string }>;
        let context: Record<string, unknown>;
        try {
          nodes = JSON.parse(flow.nodes);
          edges = JSON.parse(flow.edges);
          context = JSON.parse(execution.context);
        } catch (parseErr) {
          logger.error(`[CronEmailFlows] Corrupt JSON in flow ${flow.id} or execution ${execution.id}`, { error: parseErr instanceof Error ? parseErr.message : String(parseErr) });
          await prisma.emailFlowExecution.update({
            where: { id: execution.id },
            data: { status: 'FAILED' },
          });
          throw parseErr;
        }

        // The currentNode is a delay node. Get outgoing edges to find the next nodes to process.
        const outgoingEdges = edges.filter(e => e.source === execution.currentNode);

        // Process each next node after the delay
        for (const edge of outgoingEdges) {
          await processNode(edge.target, nodes, edges, context, execution.flowId, context.email as string);
        }

        // Mark original execution as completed
        await prisma.emailFlowExecution.update({
          where: { id: execution.id },
          data: { status: 'COMPLETED' },
        });
      }));

      for (let i = 0; i < results.length; i++) {
        if (results[i].status === 'fulfilled') {
          processed++;
        } else {
          failed++;
          const execution = batch[i];
          logger.error(`[CronEmailFlows] Error processing execution ${execution.id}`, { error: (results[i] as PromiseRejectedResult).reason instanceof Error ? ((results[i] as PromiseRejectedResult).reason as Error).message : String((results[i] as PromiseRejectedResult).reason) });
          await prisma.emailFlowExecution.update({
            where: { id: execution.id },
            data: { status: 'FAILED' },
          }).catch((updateErr) => {
            logger.error('[CronEmailFlows] Failed to mark execution as FAILED', { executionId: execution.id, error: updateErr instanceof Error ? updateErr.message : String(updateErr) });
          });
        }
      }
    }

    return NextResponse.json({ processed, failed, total: readyExecutions.length });
  } catch (error) {
    logger.error('[CronEmailFlows] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  });
}

/**
 * Recursively process a node and its successors.
 * Stops at delay nodes (schedules a new EmailFlowExecution).
 * Prevents cycles via visited set.
 */
async function processNode(
  nodeId: string,
  nodes: Array<{ id: string; type: string; data: Record<string, unknown> }>,
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string }>,
  context: Record<string, unknown>,
  flowId: string,
  email: string,
  visited: Set<string> = new Set(),
): Promise<void> {
  // Cycle detection
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = nodes.find(n => n.id === nodeId);
  if (!node) return;

  if (node.type === 'email') {
    // Send the email with bounce check and XSS protection
    if (email && node.data.subject) {
      const { sendEmail } = await import('@/lib/email/email-service');
      const { generateUnsubscribeUrl } = await import('@/lib/email/unsubscribe');
      const { shouldSuppressEmail } = await import('@/lib/email/bounce-handler');

      const { suppressed } = await shouldSuppressEmail(email);
      if (!suppressed) {
        const subject = String(node.data.subject).replace(
          /\{\{(\w+)\}\}/g,
          (_, key: string) => String(context[key] ?? `{{${key}}}`)
        );
        const html = String(node.data.htmlContent || '').replace(
          /\{\{(\w+)\}\}/g,
          (_, key: string) => {
            const val = context[key];
            if (val === undefined || val === null) return `{{${key}}}`;
            return escapeHtml(String(val));
          }
        );
        const unsubscribeUrl = await generateUnsubscribeUrl(
          email, 'marketing', (context.userId as string) || undefined
        ).catch(() => undefined);

        const result = await sendEmail({
          to: { email, name: (context.name as string) || undefined },
          subject,
          html,
          unsubscribeUrl,
        });

        // FIX: FLAW-072 - Log EmailLog on both success and failure
        await prisma.emailLog.create({
          data: {
            to: email,
            subject,
            status: result.success ? 'sent' : 'failed',
            templateId: `flow:${flowId}`,
            messageId: result.messageId || undefined,
            error: result.success ? null : 'Send failed',
          },
        }).catch((logErr) => {
          logger.error('[CronEmailFlows] Failed to create EmailLog entry', { error: logErr instanceof Error ? logErr.message : String(logErr) });
        });

        if (result.success) {
          // Atomically increment 'sent' stat
          try {
            await prisma.$executeRaw`
              UPDATE "EmailAutomationFlow"
              SET stats = jsonb_set(
                COALESCE(stats::jsonb, '{"triggered":0,"sent":0,"opened":0,"clicked":0,"revenue":0}'::jsonb),
                '{"sent"}'::text[],
                (COALESCE((stats::jsonb->>'sent')::int, 0) + 1)::text::jsonb
              )
              WHERE id = ${flowId}
            `;
          } catch (error) {
            logger.error('[CronEmailFlows] Stat increment for flow failed (best-effort)', {
              flowId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }

    // Continue to next nodes after this email
    const nextEdges = edges.filter(e => e.source === nodeId);
    for (const ne of nextEdges) {
      await processNode(ne.target, nodes, edges, context, flowId, email, visited);
    }
  } else if (node.type === 'delay') {
    // Schedule a new execution for after the delay — stop recursion here
    const delayMs = getDelayMs(node.data);
    await prisma.emailFlowExecution.create({
      data: {
        flowId,
        email,
        currentNode: node.id,
        context: JSON.stringify(context),
        status: 'WAITING',
        executeAt: new Date(Date.now() + delayMs),
      },
    });
    // Do NOT continue past the delay — cron will pick up later
  } else if (node.type === 'condition') {
    const fieldValue = String(context[String(node.data.conditionField) || ''] ?? '');
    const compareValue = String(node.data.conditionValue || '');
    let result = false;
    switch (node.data.conditionOperator) {
      case 'equals': result = fieldValue === compareValue; break;
      case 'not_equals': result = fieldValue !== compareValue; break;
      case 'greater_than': result = Number(fieldValue) > Number(compareValue); break;
      case 'less_than': result = Number(fieldValue) < Number(compareValue); break;
      case 'contains': result = fieldValue.toLowerCase().includes(compareValue.toLowerCase()); break;
    }
    // Follow only the matching branch
    const branchEdges = edges.filter(
      e => e.source === nodeId && e.sourceHandle === String(result)
    );
    for (const be of branchEdges) {
      await processNode(be.target, nodes, edges, context, flowId, email, visited);
    }
  } else {
    // Unknown node type or trigger — just follow edges
    const nextEdges = edges.filter(e => e.source === nodeId);
    for (const ne of nextEdges) {
      await processNode(ne.target, nodes, edges, context, flowId, email, visited);
    }
  }
}

function getDelayMs(data: Record<string, unknown>): number {
  const amount = Number(data.delayAmount) || 1;
  const unit = String(data.delayUnit || 'hours');
  switch (unit) {
    case 'minutes': return amount * 60 * 1000;
    case 'hours': return amount * 60 * 60 * 1000;
    case 'days': return amount * 24 * 60 * 60 * 1000;
    case 'weeks': return amount * 7 * 24 * 60 * 60 * 1000;
    default: return amount * 60 * 60 * 1000;
  }
}
