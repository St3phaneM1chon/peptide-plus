export const dynamic = 'force-dynamic';
/**
 * API - CONVERSATION DETAIL
 * Récupérer, modifier, supprimer une conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { getApiTranslator } from '@/i18n/server';
import { UserRole } from '@/types';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { z } from 'zod';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const updateConversationSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.number().min(0).max(2).optional(),
  tags: z.string().nullable().optional(),
});

// GET - Détail d'une conversation avec messages
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    const { t } = await getApiTranslator();

    if (!session?.user) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true, role: true },
        },
        assignedTo: {
          select: { id: true, name: true, image: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, name: true, image: true, role: true },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Vérifier les permissions
    const isAdmin = [UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole);
    const isOwner = conversation.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: t('errors.forbidden') }, { status: 403 });
    }

    // Marquer les messages comme lus
    if (isAdmin) {
      // Admin lit les messages du client
      await prisma.message.updateMany({
        where: {
          conversationId: id,
          senderId: { not: session.user.id },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      
      // Reset unread count
      await prisma.conversation.update({
        where: { id },
        data: { unreadCount: 0 },
      });
    } else {
      // Client lit les messages de l'admin
      await prisma.message.updateMany({
        where: {
          conversationId: id,
          senderId: { not: session.user.id },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      // F-045 FIX: Reset unreadCount for client side too
      await prisma.conversation.update({
        where: { id },
        data: { unreadCount: 0 },
      });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('Error fetching conversation', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT - Modifier une conversation (admin uniquement)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // SECURITY: CSRF + rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/chat/conversations/update');
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

    const isAdmin = [UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole);
    if (!isAdmin) {
      return NextResponse.json({ error: t('errors.forbidden') }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    // Vérifier que la conversation existe
    const existing = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Créer un message système si assignation change
    const systemMessages: { senderId: string; type: string; content: string; isSystem: boolean }[] = [];
    
    if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
      if (data.assignedToId) {
        const assignee = await prisma.user.findUnique({
          where: { id: data.assignedToId },
          select: { name: true },
        });
        // FIX: F-065 - Use translated system messages instead of hardcoded French
        systemMessages.push({
          senderId: session.user.id,
          type: 'SYSTEM',
          content: t('admin.chat.assignedTo', { name: assignee?.name || t('admin.chat.anAgent') }),
          isSystem: true,
        });
      } else {
        systemMessages.push({
          senderId: session.user.id,
          type: 'SYSTEM',
          content: t('admin.chat.unassigned'),
          isSystem: true,
        });
      }
    }

    if (data.status && data.status !== existing.status) {
      // FIX: F-065 - Use translated status labels instead of hardcoded French
      const statusKeys: Record<string, string> = {
        OPEN: 'admin.chat.statusOpen',
        PENDING: 'admin.chat.statusPending',
        RESOLVED: 'admin.chat.statusResolved',
        CLOSED: 'admin.chat.statusClosed',
      };
      const statusLabel = t(statusKeys[data.status] || data.status);
      systemMessages.push({
        senderId: session.user.id,
        type: 'SYSTEM',
        content: t('admin.chat.statusChanged', { status: statusLabel }),
        isSystem: true,
      });
    }

    // F-079 FIX: Use typed object instead of `any`
    const updateData: Record<string, unknown> = { ...data };
    if (systemMessages.length > 0) {
      updateData.messages = { create: systemMessages };
      updateData.lastMessageAt = new Date();
    }
    const conversation = await prisma.conversation.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignedTo: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ conversation });
  } catch (error) {
    logger.error('Error updating conversation', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE - Supprimer une conversation (owner uniquement)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // SECURITY: CSRF validation
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

    if (session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: t('errors.forbidden') }, { status: 403 });
    }

    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting conversation', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
