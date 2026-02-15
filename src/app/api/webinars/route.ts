export const dynamic = 'force-dynamic';

/**
 * API - Webinars (public)
 * GET: Fetch all published webinars, ordered by scheduledAt desc
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET - List published webinars
export async function GET() {
  try {
    const webinars = await prisma.webinar.findMany({
      where: {
        isPublished: true,
      },
      include: {
        translations: true,
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });

    return NextResponse.json({ webinars }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Error fetching webinars:', error);
    return NextResponse.json(
      { error: 'Error fetching webinars' },
      { status: 500 }
    );
  }
}
