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
import { z } from 'zod';

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
    const limit = parseInt(searchParams.get('limit') || '50');

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

    // Construire la query
    const where: { conversationId: string; createdAt?: { gt: Date } } = { conversationId: id };

    if (after) {
      // Récupérer les messages après un certain ID (pour le polling)
      const afterMessage = await prisma.message.findUnique({
        where: { id: after },
        select: { createdAt: true },
      });
      
      if (afterMessage) {
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
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Envoyer un message
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();
    const { t } = await getApiTranslator();

    if (!session?.user) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    const body = await request.json();
    const data = sendMessageSchema.parse(body);

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

    // Créer le message
    const message = await prisma.message.create({
      data: {
        conversationId: id,
        senderId: session.user.id,
        type: data.type,
        content: data.content,
        attachmentUrl: data.attachmentUrl,
        attachmentName: data.attachmentName,
        attachmentSize: data.attachmentSize,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true, role: true },
        },
      },
    });

    // Mettre à jour la conversation
    const updateData: any = {
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
