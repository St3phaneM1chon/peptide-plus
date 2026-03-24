export const dynamic = 'force-dynamic';

/**
 * Aurelia Chat Respond API — For Mac Studio daemon to post Aurelia's response
 * POST /api/aurelia/chat/respond — Saves Aurelia's response, marks as ANSWERED
 * Secured by AURELIA_DAEMON_KEY header
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// KB-PP-BUILD-002: Lazy init — NEVER throw at top-level (crashes next build)
function getDaemonKey(): string {
  const key = process.env.AURELIA_DAEMON_KEY;
  if (!key) throw new Error('AURELIA_DAEMON_KEY not configured');
  return key;
}

function validateDaemonKey(request: NextRequest): boolean {
  const key = request.headers.get('x-aurelia-daemon-key');
  return key === getDaemonKey();
}

const respondSchema = z.object({
  messageId: z.string(), // The original user message ID
  conversationId: z.string(),
  response: z.string().min(1).max(50000),
  contextUsed: z.any().optional(), // Vector results + knowledge used
  processingTimeMs: z.number().optional(),
});

/**
 * POST — Daemon posts Aurelia's response
 */
export async function POST(request: NextRequest) {
  if (!validateDaemonKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = respondSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 });
    }

    const { messageId, conversationId, response, contextUsed, processingTimeMs } = parsed.data;

    // Get the original message to find the userId
    const originalMsg = await prisma.aureliaChat.findUnique({
      where: { id: messageId },
      select: { userId: true, status: true },
    });

    if (!originalMsg) {
      return NextResponse.json({ error: 'Original message not found' }, { status: 404 });
    }

    // Mark original message as ANSWERED
    await prisma.aureliaChat.update({
      where: { id: messageId },
      data: {
        status: 'ANSWERED',
        processingTimeMs,
        contextUsed: contextUsed || undefined,
      },
    });

    // Create Aurelia's response message
    const aureliaMsg = await prisma.aureliaChat.create({
      data: {
        conversationId,
        userId: originalMsg.userId,
        content: response,
        role: 'AURELIA',
        status: 'ANSWERED',
        processingTimeMs,
        contextUsed: contextUsed || undefined,
      },
    });

    logger.info('[Aurelia Chat] Daemon posted response', {
      messageId,
      conversationId,
      responseLength: response.length,
      processingTimeMs,
    });

    return NextResponse.json({
      success: true,
      responseId: aureliaMsg.id,
      conversationId,
    });
  } catch (error) {
    logger.error('[Aurelia Chat] Respond failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to save response' }, { status: 500 });
  }
}
