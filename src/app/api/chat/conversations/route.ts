export const dynamic = 'force-dynamic';
/**
 * API - CONVERSATIONS
 * Liste et création de conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { getApiTranslator } from '@/i18n/server';
import { UserRole } from '@/types';
import { z } from 'zod';

const createConversationSchema = z.object({
  subject: z.string().max(200).optional(),
  message: z.string().min(1).max(5000),
});

// GET - Liste des conversations
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const { t } = await getApiTranslator();

    if (!session?.user) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const isAdmin = [UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole);

    // Construire la query
    const where: Record<string, unknown> = {};

    if (isAdmin) {
      // Admin voit toutes les conversations ou celles qui lui sont assignées
      const assignedOnly = searchParams.get('assigned') === 'true';
      if (assignedOnly) {
        where.assignedToId = session.user.id;
      }
    } else {
      // Les clients/customers voient uniquement leurs conversations
      where.userId = session.user.id;
    }

    if (status) {
      where.status = status;
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
          assignedTo: {
            select: { id: true, name: true },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              content: true,
              createdAt: true,
              senderId: true,
            },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);

    return NextResponse.json({
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Créer une nouvelle conversation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const { t } = await getApiTranslator();

    if (!session?.user) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    const body = await request.json();
    const { subject, message } = createConversationSchema.parse(body);

    // Créer la conversation avec le premier message
    const conversation = await prisma.conversation.create({
      data: {
        userId: session.user.id,
        subject: subject || null,
        status: 'OPEN',
        messages: {
          create: {
            senderId: session.user.id,
            content: message,
            type: 'TEXT',
          },
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        messages: {
          include: {
            sender: {
              select: { id: true, name: true, image: true, role: true },
            },
          },
        },
      },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CONVERSATION_CREATED',
        entityType: 'Conversation',
        entityId: conversation.id,
      },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Error creating conversation:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
