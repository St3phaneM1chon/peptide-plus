export const dynamic = 'force-dynamic';

/**
 * Aurelia Chat Pending API — For Mac Studio daemon to fetch pending messages
 * GET /api/aurelia/chat/pending — Returns PENDING messages for the daemon to process
 * Secured by AURELIA_DAEMON_KEY header
 */

import { NextRequest, NextResponse } from 'next/server';
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

/**
 * GET — Fetch all PENDING messages for the daemon to process
 * Also marks them as PROCESSING to prevent double-processing
 */
export async function GET(request: NextRequest) {
  if (!validateDaemonKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find all PENDING user messages
    const pendingMessages = await prisma.aureliaChat.findMany({
      where: {
        status: 'PENDING',
        role: 'USER',
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      take: 10, // Process max 10 at a time
    });

    if (pendingMessages.length === 0) {
      return NextResponse.json({ messages: [], count: 0 });
    }

    // Mark them as PROCESSING to prevent double-processing
    const ids = pendingMessages.map(m => m.id);
    await prisma.aureliaChat.updateMany({
      where: { id: { in: ids } },
      data: { status: 'PROCESSING' },
    });

    // For each pending message, include conversation history
    const messagesWithHistory = await Promise.all(
      pendingMessages.map(async (msg) => {
        const history = await prisma.aureliaChat.findMany({
          where: {
            conversationId: msg.conversationId,
            createdAt: { lt: msg.createdAt },
            status: { in: ['ANSWERED', 'PENDING', 'PROCESSING'] },
          },
          orderBy: { createdAt: 'asc' },
          take: 20, // Last 20 messages for context
          select: {
            role: true,
            content: true,
            createdAt: true,
          },
        });

        return {
          id: msg.id,
          conversationId: msg.conversationId,
          content: msg.content,
          userId: msg.userId,
          userName: msg.user?.name || 'Utilisateur',
          userEmail: msg.user?.email,
          userRole: msg.user?.role || 'CUSTOMER',
          createdAt: msg.createdAt.toISOString(),
          history: history.map(h => ({
            role: h.role,
            content: h.content,
            createdAt: h.createdAt.toISOString(),
          })),
        };
      })
    );

    logger.info('[Aurelia Chat] Daemon fetched pending messages', {
      count: messagesWithHistory.length,
    });

    return NextResponse.json({
      messages: messagesWithHistory,
      count: messagesWithHistory.length,
    });
  } catch (error) {
    logger.error('[Aurelia Chat] Pending fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to fetch pending' }, { status: 500 });
  }
}
