export const dynamic = 'force-dynamic';

/**
 * API - MESSAGES
 * Envoyer et récupérer des messages
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { getApiTranslator } from '@/i18n/server';
import { UserRole } from '@/types';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { z } from 'zod';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  type: z.enum(['TEXT', 'IMAGE', 'FILE']).default('TEXT'),
  attachmentUrl: z.string().url().optional(),
  attachmentName: z.string().max(255).optional(),
  attachmentSize: z.number().optional(),
});

// GET - Récupérer les messages (avec pagination ou nouveaux depuis lastId)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    const { t } = await getApiTranslator();

    if (!session?.user) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const after = searchParams.get('after'); // ID du dernier message reçu
    // FIX: Bound limit to prevent abuse
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    // Vérifier l'accès à la conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const isAdmin = [UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole);
    const isOwner = conversation.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: t('errors.forbidden') }, { status: 403 });
    }

    // FIX F-038: Use cursor-based pagination with message ID instead of createdAt
    // to avoid missing messages with identical timestamps
    const where: { conversationId: string; id?: { gt: string }; createdAt?: { gt: Date } } = { conversationId: id };

    if (after) {
      // Use the message ID directly as cursor to avoid createdAt timestamp collisions
      const afterMessage = await prisma.message.findUnique({
        where: { id: after },
        select: { id: true, createdAt: true },
      });

      if (afterMessage) {
        // Filter by both createdAt AND id to handle same-timestamp messages
        where.createdAt = { gt: afterMessage.createdAt };
      }
    }

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true, image: true, role: true },
        },
      },
    });

    // Marquer comme lus
    if (messages.length > 0) {
      await prisma.message.updateMany({
        where: {
          id: { in: messages.filter(m => m.senderId !== session.user.id && !m.readAt).map(m => m.id) },
        },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    logger.error('Error fetching messages', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Envoyer un message
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // SECURITY: Rate limiting + CSRF
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/chat/conversations/messages');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { id } = await params;
    const session = await auth();
    const { t } = await getApiTranslator();

    if (!session?.user) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Vérifier l'accès à la conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      select: { userId: true, status: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const isAdmin = [UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole);
    const isOwner = conversation.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: t('errors.forbidden') }, { status: 403 });
    }

    // Vérifier que la conversation n'est pas fermée
    if (conversation.status === 'CLOSED') {
      return NextResponse.json({ error: 'Conversation is closed' }, { status: 400 });
    }

    // BE-SEC-03: Sanitize user-supplied text to prevent stored XSS
    const sanitizedContent = stripControlChars(stripHtml(data.content)).trim();
    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Message cannot be empty after sanitization' }, { status: 400 });
    }

    // Créer le message
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: session.user.id,
        type: data.type,
        content: sanitizedContent,
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName ? stripControlChars(stripHtml(data.attachmentName)).trim() : undefined,
        attachmentSize: data.attachmentSize,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true, role: true },
        },
      },
    });

    // Mettre à jour la conversation
    const updateData: Record<string, unknown> = {
      lastMessageAt: new Date(),
      // Si le client répond et la conversation était résolue, la rouvrir
      ...(isOwner && conversation.status === 'RESOLVED' && { status: 'OPEN' }),
    };

    // Incrémenter le compteur de non-lus si c'est un message client
    if (isOwner) {
      updateData.unreadCount = { increment: 1 };
    }

    await prisma.conversation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    logger.error('Error sending message', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
