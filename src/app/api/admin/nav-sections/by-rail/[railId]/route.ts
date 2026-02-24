import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

// GET /api/admin/nav-sections/by-rail/:railId - Full hierarchy for a rail section
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const sections = await prisma.adminNavSection.findMany({
      where: { railId: params?.railId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        subSections: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            pages: {
              where: { isActive: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    return NextResponse.json(sections);
  } catch (error) {
    logger.error('[admin/nav-sections/by-rail] GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
