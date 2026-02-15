export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const faqs = await prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      include: {
        translations: true,
      },
    });

    // Group by category
    const byCategory: Record<string, { question: string; answer: string }[]> = {};
    for (const faq of faqs) {
      if (!byCategory[faq.category]) byCategory[faq.category] = [];
      byCategory[faq.category].push({ question: faq.question, answer: faq.answer });
    }

    return NextResponse.json({ faqs, byCategory }, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' },
    });
  } catch (error) {
    console.error('FAQ API error:', error);
    return NextResponse.json({ faqs: [], byCategory: {} });
  }
}
