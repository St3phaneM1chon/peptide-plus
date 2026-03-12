export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
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
import { validateBody } from '@/lib/api-validation';

const aiChatSchema = z.object({
  message: z.string().min(1).max(1000).optional(),
  sessionId: z.string().max(100).optional(),
  action: z.enum(['clear']).optional(),
}).strict();

// ---------------------------------------------------------------------------
// POST /api/accounting/ai-chat
// Accept a natural language message and return an AI response.
// Body: { message: string, sessionId?: string, action?: 'clear' }
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(
  async (request: NextRequest) => {
    try {
      const body = await request.json();

      // Validate with Zod
      const validation = validateBody(aiChatSchema, body);
      if (!validation.success) return validation.response;
      const { message, sessionId: rawSessionId, action } = validation.data;

      // Generate session ID if not provided
      const sessionId = rawSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // Handle clear action
      if (action === 'clear') {
        clearSession(sessionId);
        return NextResponse.json({ success: true, sessionId });
      }

      // Validate message is present when not clearing
      if (!message) {
        return NextResponse.json(
          { error: 'Message is required' },
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
