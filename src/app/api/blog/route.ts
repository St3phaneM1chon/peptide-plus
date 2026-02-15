export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true, title: true, slug: true, excerpt: true, imageUrl: true,
        author: true, category: true, readTime: true, isFeatured: true,
        publishedAt: true, locale: true,
      },
    });
    return NextResponse.json({ posts }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Blog API error:', error);
    return NextResponse.json({ posts: [] });
  }
}
