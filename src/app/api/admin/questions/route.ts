export const dynamic = 'force-dynamic';

/**
 * Admin Questions API
 * GET - List all product questions with user/product info
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

// GET /api/admin/questions - List all questions
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'answered' | 'unanswered'
    const search = searchParams.get('search');

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status === 'answered') {
      where.answer = { not: null };
    } else if (status === 'unanswered') {
      where.answer = null;
    }

    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const rawQuestions = await prisma.productQuestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        product: { select: { id: true, name: true } },
      },
    });

    const questions = rawQuestions.map((q) => ({
      id: q.id,
      productId: q.productId,
      productName: q.product.name,
      userId: q.userId,
      userName: q.user?.name || 'Unknown',
      userEmail: q.user?.email || '',
      question: q.question,
      answer: q.answer,
      answeredBy: q.answeredBy,
      answeredAt: q.updatedAt && q.answer ? q.updatedAt.toISOString() : null,
      isPublic: q.isPublished,
      createdAt: q.createdAt.toISOString(),
    }));

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Admin questions GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
