export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Check which models are available on the prisma client
    const modelNames = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
    const hasForumCategory = 'forumCategory' in prisma;
    const forumModels = modelNames.filter(k => k.toLowerCase().includes('forum') || k.toLowerCase().includes('contact'));

    // Try a simple raw query
    let tableCheck = null;
    try {
      tableCheck = await prisma.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'Forum%' ORDER BY tablename`;
    } catch (e: unknown) {
      tableCheck = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json({
      prismaType: typeof prisma,
      totalModels: modelNames.length,
      hasForumCategory,
      forumModels,
      allModels: modelNames.slice(0, 30),
      tableCheck,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
