export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';

// GET /api/admin/nav-sections/by-rail/:railId - Full hierarchy for a rail section
// This route returns an empty array gracefully when the user is not authenticated
// or the DB has no dynamic nav data, since the admin sidebar always has static
// navigation as a fallback (outlook-nav.ts). This prevents noisy 401/404 errors
// in the browser console during normal sidebar rendering.
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ railId: string }> }
) {
  try {
    // Soft auth check — return empty array if not authenticated (nav is non-sensitive)
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json([]);
    }

    const { railId } = await context.params;

    const sections = await prisma.adminNavSection.findMany({
      where: { railId, isActive: true },
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
    // Return empty array instead of 500 to avoid console noise — static nav is always available
    return NextResponse.json([]);
  }
}
