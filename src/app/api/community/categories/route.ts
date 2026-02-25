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
            posts: { where: { deletedAt: null } },
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
  } catch (error) {
    console.error('Error fetching forum categories:', error);
    return apiError(
      'Failed to fetch forum categories',
      'Failed to fetch forum categories',
      ErrorCode.INTERNAL_ERROR,
      { request }
    );
  }
}
