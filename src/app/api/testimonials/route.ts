export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 200);
    const skip = (page - 1) * limit;

    const where = { isPublished: true };

    const [testimonials, total] = await Promise.all([
      prisma.testimonial.findMany({
        where,
        orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.testimonial.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: testimonials,
      total,
      page,
      limit,
      totalPages,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  } catch (error) {
    logger.error('Testimonials API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Failed to fetch testimonials', data: [], total: 0, page: 1, limit: 50, totalPages: 0 }, { status: 500 });
  }
}
