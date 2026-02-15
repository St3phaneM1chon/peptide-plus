export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const guides = await prisma.guide.findMany({
      where: { isPublished: true },
      orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true, title: true, slug: true, description: true, category: true,
        fileUrl: true, thumbnailUrl: true, format: true, pageCount: true,
        isFeatured: true, downloadCount: true, locale: true,
      },
    });
    return NextResponse.json({ guides }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  } catch (error) {
    console.error('Guides API error:', error);
    return NextResponse.json({ guides: [] });
  }
}
