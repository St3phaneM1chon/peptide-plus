export const dynamic = 'force-dynamic';

/**
 * Public Chatbot API
 * POST: Handle chatbot messages from the website widget.
 *       Body: { message, conversationId?, name?, email? }
 *       Creates InboxConversation if new, generates AI response.
 *
 * NO admin guard - this is a public-facing endpoint.
 * Rate limited by IP to prevent abuse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { stripHtml } from '@/lib/sanitize';
import {
  processUserMessage,
  getDefaultChatbotConfig,
  shouldEscalateToHuman,
} from '@/lib/crm/chatbot-engine';
import { getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const chatbotRequestSchema = z.object({
  message: z.string().min(1).max(5000),
  conversationId: z.string().optional(),
  name: z.string().max(200).optional(),
  email: z.string().email().max(320).optional(),
});

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const ip = getClientIpFromRequest(request);
  const rl = await rateLimitMiddleware(ip, '/api/public/chatbot');
  if (!rl.success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests' },
      { status: 429 },
    );
  }

  try {
    const rawBody = await request.json();
    const parsed = chatbotRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request' },
        { status: 400 },
      );
    }

    const rawData = parsed.data;
    const message = stripHtml(rawData.message).trim();
    const conversationId = rawData.conversationId;
    const name = rawData.name ? stripHtml(rawData.name).trim() : undefined;
    const email = rawData.email;
    const config = getDefaultChatbotConfig();

    // -----------------------------------------------------------------------
    // Existing conversation: continue
    // -----------------------------------------------------------------------
    if (conversationId) {
      const conversation = await prisma.inboxConversation.findUnique({
        where: { id: conversationId },
        select: { id: true, status: true },
      });

      if (!conversation) {
        return NextResponse.json(
          { success: false, error: 'Conversation not found' },
          { status: 404 },
        );
      }

      if (conversation.status === 'RESOLVED' || conversation.status === 'CLOSED') {
        return NextResponse.json(
          { success: false, error: 'Conversation is closed' },
          { status: 400 },
        );
      }

      // Store user message
      await prisma.inboxMessage.create({
        data: {
          conversationId,
          direction: 'INBOUND',
          content: message,
          senderName: name || 'Visitor',
          senderEmail: email || null,
        },
      });

      // Load conversation history
      const history = await prisma.inboxMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 50,
        select: { direction: true, content: true },
      });

      const conversationHistory = history.map((msg) => ({
        role: msg.direction === 'INBOUND' ? 'user' : 'assistant',
        content: msg.content,
      }));

      // Generate AI response
      const reply = await processUserMessage(message, conversationHistory, config);

      // Check for escalation
      const needsEscalation = shouldEscalateToHuman(message, -1);

      // Store bot reply
      await prisma.inboxMessage.create({
        data: {
          conversationId,
          direction: 'OUTBOUND',
          content: reply,
          senderName: 'Attitudes VIP Bot',
          metadata: {
            aiGenerated: true,
            escalated: needsEscalation,
          },
        },
      });

      // Update conversation
      await prisma.inboxConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: new Date(),
          status: needsEscalation ? 'PENDING' : 'OPEN',
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          conversationId,
          reply,
          escalated: needsEscalation,
        },
      });
    }

    // -----------------------------------------------------------------------
    // New conversation
    // -----------------------------------------------------------------------

    // Try to find existing lead by email
    let leadId: string | null = null;
    if (email) {
      const lead = await prisma.crmLead.findFirst({
        where: { email: { equals: email.toLowerCase(), mode: 'insensitive' } },
        select: { id: true },
      });
      leadId = lead?.id || null;

      // Auto-create lead if not found
      if (!leadId) {
        const newLead = await prisma.crmLead.create({
          data: {
            contactName: name || email.split('@')[0],
            email: email.toLowerCase(),
            source: 'CHATBOT',
            status: 'NEW',
            score: 5,
            temperature: 'COLD',
            tags: ['chatbot', 'auto-created'],
            lastContactedAt: new Date(),
          },
        });
        leadId = newLead.id;

        logger.info('[Chatbot] Lead auto-created from chatbot', {
          leadId: newLead.id,
          email,
        });
      }
    }

    // Create conversation
    const conversation = await prisma.inboxConversation.create({
      data: {
        channel: 'CHAT',
        status: 'OPEN',
        subject: `Chatbot: ${name || 'Visitor'}`,
        leadId,
        lastMessageAt: new Date(),
      },
    });

    // Store user message
    await prisma.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: message,
        senderName: name || 'Visitor',
        senderEmail: email || null,
      },
    });

    // Generate AI response (no history for first message)
    const reply = await processUserMessage(message, [], config);

    // Check for escalation
    const needsEscalation = shouldEscalateToHuman(message, -1);

    // Store bot reply
    await prisma.inboxMessage.create({
      data: {
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        content: reply,
        senderName: 'Attitudes VIP Bot',
        metadata: {
          aiGenerated: true,
          escalated: needsEscalation,
        },
      },
    });

    if (needsEscalation) {
      await prisma.inboxConversation.update({
        where: { id: conversation.id },
        data: { status: 'PENDING' },
      });
    }

    logger.info('[Chatbot] New conversation started', {
      conversationId: conversation.id,
      leadId,
      name,
      email,
    });

    return NextResponse.json({
      success: true,
      data: {
        conversationId: conversation.id,
        reply,
        escalated: needsEscalation,
      },
    });
  } catch (error) {
    logger.error('[Chatbot] API error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
