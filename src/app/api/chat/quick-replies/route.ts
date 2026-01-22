/**
 * API - QUICK REPLIES
 * Gestion des réponses rapides pré-configurées
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { z } from 'zod';

const quickReplySchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  category: z.string().max(50).optional(),
  sortOrder: z.number().optional(),
});

// GET - Liste des réponses rapides
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (![UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const quickReplies = await prisma.quickReply.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    return NextResponse.json({ quickReplies });
  } catch (error) {
    console.error('Error fetching quick replies:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST - Créer une réponse rapide
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (![UserRole.EMPLOYEE, UserRole.OWNER].includes(session.user.role as UserRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = quickReplySchema.parse(body);

    const quickReply = await prisma.quickReply.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        sortOrder: data.sortOrder || 0,
      },
    });

    return NextResponse.json({ quickReply }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.errors }, { status: 400 });
    }
    console.error('Error creating quick reply:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
