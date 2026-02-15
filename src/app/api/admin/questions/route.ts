export const dynamic = 'force-dynamic';
/**
 * API - Admin Product Questions Management
 * GET: List all questions with user and product info
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const answered = searchParams.get('answered'); // 'true' or 'false'

    const where: Record<string, unknown> = {};
    if (answered === 'true') {
      where.answer = { not: null };
    } else if (answered === 'false') {
      where.answer = null;
    }

    const dbQuestions = await prisma.productQuestion.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map DB model to frontend Question interface
    const questions = dbQuestions.map((q) => ({
      id: q.id,
      productId: q.product.id,
      productName: q.product.name,
      userId: q.user.id,
      userName: q.user.name || q.user.email,
      userEmail: q.user.email,
      question: q.question,
      answer: q.answer,
      answeredBy: q.answeredBy,
      answeredAt: q.updatedAt.toISOString(),
      isPublic: q.isPublished,
      createdAt: q.createdAt.toISOString(),
    }));

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des questions' },
      { status: 500 }
    );
  }
}
