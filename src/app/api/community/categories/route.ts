export const dynamic = 'force-dynamic';
/**
 * API - Forum Categories
 * GET: List all forum categories with post counts
 *
 * Public endpoint - no authentication required.
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

export async function GET(request: NextRequest) {
  try {
    const categories = await prisma.forumCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    const data = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      sortOrder: cat.sortOrder,
      postCount: cat._count.posts,
      createdAt: cat.createdAt.toISOString(),
    }));

    return apiSuccess(data, { request });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';
    console.error('Error fetching forum categories:', errMsg, errStack);
    return apiError(
      `Failed to fetch forum categories: ${errMsg}`,
      'Failed to fetch forum categories',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}
