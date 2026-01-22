/**
 * API - CONVERSATION DETAIL
 * Récupérer, modifier, supprimer une conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { getApiTranslator } from '@/i18n/server';
import { UserRole } from '@/types';
import { z } from 'zod';

interface RouteParams {
  params: { id: string };
}

const updateConversationSchema = z.object({
  status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.number().min(0).max(2).optional(),
  tags: z.string().nullable().optional(),
});

// GET - Détail d'une conversation avec messages
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { t } = await getApiTranslator();

    if (!session?.user) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
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
          conversationId: params.id,
          senderId: { not: session.user.id },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      
      // Reset unread count
      await prisma.conversation.update({
        where: { id: params.id },
        data: { unreadCount: 0 },
      });
    } else {
      // Client lit les messages de l'admin
      await prisma.message.updateMany({
        where: {
          conversationId: params.id,
          senderId: { not: session.user.id },
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// PUT - Modifier une conversation (admin uniquement)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
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
    const data = updateConversationSchema.parse(body);

    // Vérifier que la conversation existe
    const existing = await prisma.conversation.findUnique({
      where: { id: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Créer un message système si assignation change
    const systemMessages: any[] = [];
    
    if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
      if (data.assignedToId) {
        const assignee = await prisma.user.findUnique({
          where: { id: data.assignedToId },
          select: { name: true },
        });
        systemMessages.push({
          senderId: session.user.id,
          type: 'SYSTEM',
          content: `Conversation assignée à ${assignee?.name || 'un agent'}`,
          isSystem: true,
        });
      } else {
        systemMessages.push({
          senderId: session.user.id,
          type: 'SYSTEM',
          content: 'Conversation désassignée',
          isSystem: true,
        });
      }
    }

    if (data.status && data.status !== existing.status) {
      const statusLabels: Record<string, string> = {
        OPEN: 'Ouverte',
        PENDING: 'En attente',
        RESOLVED: 'Résolue',
        CLOSED: 'Fermée',
      };
      systemMessages.push({
        senderId: session.user.id,
        type: 'SYSTEM',
        content: `Statut changé: ${statusLabels[data.status]}`,
        isSystem: true,
      });
    }

    // Mettre à jour
    const conversation = await prisma.conversation.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(systemMessages.length > 0 && {
          messages: {
            create: systemMessages,
          },
          lastMessageAt: new Date(),
        }),
      },
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Error updating conversation:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE - Supprimer une conversation (owner uniquement)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    const { t } = await getApiTranslator();

    if (!session?.user) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    if (session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: t('errors.forbidden') }, { status: 403 });
    }

    await prisma.conversation.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
