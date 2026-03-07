export const dynamic = 'force-dynamic';

/**
 * Public Chat API
 * Handles live chat widget interactions, creating InboxConversation records.
 *
 * POST actions:
 * - start: Create a new chat conversation
 * - message: Send a message in an existing conversation
 * - end: Close a conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const chatPostSchema = z.object({
  action: z.enum(['start', 'message', 'end']),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  conversationId: z.string().optional(),
  message: z.string().max(5000).optional(),
  senderName: z.string().optional(),
});

// Simple rate limiter: max 30 requests per minute per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
  }

  try {
    const raw = await request.json();
    const parsed = chatPostSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const { action } = body;

    switch (action) {
      case 'start': {
        const { name, email } = body;

        // Try to find existing lead by email
        let leadId: string | null = null;
        if (email) {
          const lead = await prisma.crmLead.findFirst({
            where: { email },
            select: { id: true },
          });
          leadId = lead?.id || null;
        }

        // Create conversation
        const conversation = await prisma.inboxConversation.create({
          data: {
            channel: 'CHAT',
            status: 'OPEN',
            subject: `Chat from ${name || 'Visitor'}`,
            leadId,
            lastMessageAt: new Date(),
          },
        });

        // Add system message
        await prisma.inboxMessage.create({
          data: {
            conversationId: conversation.id,
            direction: 'INBOUND',
            content: `Chat started by ${name || 'Visitor'}${email ? ` (${email})` : ''}`,
            senderName: name || 'Visitor',
            senderEmail: email || null,
          },
        });

        return NextResponse.json({
          success: true,
          data: { conversationId: conversation.id },
        });
      }

      case 'message': {
        const { conversationId, message, senderName } = body;

        if (!conversationId || !message?.trim()) {
          return NextResponse.json({ success: false, error: 'conversationId and message required' }, { status: 400 });
        }

        // Verify conversation exists and is open
        const conversation = await prisma.inboxConversation.findUnique({
          where: { id: conversationId },
          select: { id: true, status: true },
        });

        if (!conversation) {
          return NextResponse.json({ success: false, error: 'Conversation not found' }, { status: 404 });
        }

        if (conversation.status === 'RESOLVED') {
          return NextResponse.json({ success: false, error: 'Conversation is closed' }, { status: 400 });
        }

        // Create message
        await prisma.inboxMessage.create({
          data: {
            conversationId,
            direction: 'INBOUND',
            content: message.trim(),
            senderName: senderName || 'Visitor',
          },
        });

        // Update conversation timestamp
        await prisma.inboxConversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date(), status: 'OPEN' },
        });

        // Check if there are recent agent replies to return
        const lastAgentMessage = await prisma.inboxMessage.findFirst({
          where: {
            conversationId,
            direction: 'OUTBOUND',
          },
          orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
          success: true,
          data: {
            reply: lastAgentMessage ? lastAgentMessage.content : null,
          },
        });
      }

      case 'end': {
        const { conversationId: endConvId } = body;
        if (!endConvId) {
          return NextResponse.json({ success: false, error: 'conversationId required' }, { status: 400 });
        }

        await prisma.inboxConversation.update({
          where: { id: endConvId },
          data: { status: 'RESOLVED' },
        });

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    logger.error('Public chat API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
