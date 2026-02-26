export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  processAccountingQuestion,
  getOrCreateSession,
  getSession,
  addMessage,
  clearSession,
  generateMessageId,
} from '@/lib/accounting/ai-accountant.service';
import type { ChatMessage } from '@/lib/accounting/ai-accountant.service';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// POST /api/accounting/ai-chat
// Accept a natural language message and return an AI response.
// Body: { message: string, sessionId?: string, action?: 'clear' }
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      const { message, sessionId: rawSessionId, action } = body as {
        message?: string;
        sessionId?: string;
        action?: string;
      };

      // Generate session ID if not provided
      const sessionId = rawSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Handle clear action
      if (action === 'clear') {
        clearSession(sessionId);
        return NextResponse.json({ success: true, sessionId });
      }

      // Validate message
      if (!message || typeof message !== 'string') {
        return NextResponse.json(
          { error: 'Message is required and must be a string' },
          { status: 400 },
        );
      }

      if (message.length > 1000) {
        return NextResponse.json(
          { error: 'Message must be 1000 characters or less' },
          { status: 400 },
        );
      }

      // Get or create session
      const session = getOrCreateSession(sessionId);

      // Add user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: message.trim(),
        timestamp: new Date(),
      };
      addMessage(session, userMessage);

      // Process the question
      const responseData = await processAccountingQuestion(message.trim());

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: responseData.answer,
        timestamp: new Date(),
        data: responseData,
      };
      addMessage(session, assistantMessage);

      logger.info('[AI Chat] Processed message', {
        sessionId,
        intent: responseData.intent,
        messageLength: message.length,
      });

      return NextResponse.json({
        sessionId,
        message: assistantMessage,
      });
    } catch (error) {
      logger.error('[AI Chat] POST error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Failed to process message' },
        { status: 500 },
      );
    }
  },
  { rateLimit: 30 },
);

// ---------------------------------------------------------------------------
// GET /api/accounting/ai-chat?sessionId=xxx
// Return chat history for a session.
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId query parameter is required' },
        { status: 400 },
      );
    }

    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json({
        sessionId,
        messages: [],
        createdAt: null,
      });
    }

    return NextResponse.json({
      sessionId: session.id,
      messages: session.messages,
      createdAt: session.createdAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      messageCount: session.messages.length,
    });
  } catch (error) {
    logger.error('[AI Chat] GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to retrieve chat history' },
      { status: 500 },
    );
  }
});
