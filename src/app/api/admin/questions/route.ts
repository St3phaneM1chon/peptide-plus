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
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 200);
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

    const [rawQuestions, total] = await Promise.all([
      prisma.productQuestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          productId: true,
          userId: true,
          question: true,
          answer: true,
          answeredBy: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, email: true } },
          product: { select: { id: true, name: true } },
        },
      }),
      prisma.productQuestion.count({ where }),
    ]);

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

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: questions,
      total,
      page,
      limit,
      totalPages,
    });
  } catch (error) {
    logger.error('Admin questions GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
