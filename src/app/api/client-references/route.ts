export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    const references = await prisma.clientReference.findMany({
      where: { isPublished: true },
      orderBy: [{ industry: 'asc' }, { sortOrder: 'asc' }],
    });
    // Group by industry
    const byIndustry: Record<string, typeof references> = {};
    for (const ref of references) {
      const ind = ref.industry || 'Other';
      if (!byIndustry[ind]) byIndustry[ind] = [];
      byIndustry[ind].push(ref);
    }
    return NextResponse.json({ references, byIndustry }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    logger.error('Client references API error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ references: [], byIndustry: {} });
  }
}
