export const dynamic = 'force-dynamic';
/**
 * API - Admin Product Questions Management
 * GET: List all questions with user and product info
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const { searchParams } = new URL(request.url);
    const answered = searchParams.get('answered'); // 'true' or 'false'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (answered === 'true') {
      where.answer = { not: null };
    } else if (answered === 'false') {
      where.answer = null;
    }

    const [dbQuestions, total] = await Promise.all([
      prisma.productQuestion.findMany({
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
        skip,
        take: limit,
      }),
      prisma.productQuestion.count({ where }),
    ]);

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

    return NextResponse.json({
      questions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des questions' },
      { status: 500 }
    );
  }
});
