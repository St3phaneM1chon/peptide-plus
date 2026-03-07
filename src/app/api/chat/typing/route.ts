export const dynamic = 'force-dynamic';

/**
 * POST /api/chat/typing - Broadcast typing indicator via Redis Pub/Sub
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { publishChatEvent } from '@/lib/chat/realtime';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { conversationId, isTyping } = await request.json();
    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    await publishChatEvent({
      type: 'typing',
      conversationId,
      userId: session.user.id,
      userName: session.user.name || 'Admin',
      data: { isTyping: !!isTyping },
      timestamp: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
