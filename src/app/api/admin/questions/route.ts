export const dynamic = 'force-dynamic';

/**
 * Admin Questions API
 * GET - List all product questions with user/product info
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GET /api/admin/questions - List all questions
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'answered' | 'unanswered'
    const search = searchParams.get('search');
    // FIX F-022: Add pagination to prevent loading all questions at once
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const skip = (page - 1) * limit;

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
      skip,
      take: limit,
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
    logger.error('Admin questions GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
