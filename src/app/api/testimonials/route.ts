export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isPublished: true },
      orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'asc' }],
    });
    return NextResponse.json({ testimonials }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  } catch (error) {
    logger.error('Testimonials API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ testimonials: [] });
  }
}
