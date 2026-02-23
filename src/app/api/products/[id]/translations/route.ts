export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth-config';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Translation statuses for a product
// BUG-031 FIX: Added auth check - translation status is internal admin data
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const translations = await prisma.productTranslation.findMany({
      where: { productId: id },
      select: {
        locale: true,
        isApproved: true,
        updatedAt: true,
      },
      orderBy: { locale: 'asc' },
    });

    return NextResponse.json({ translations });
  } catch (error) {
    logger.error('Error fetching product translations', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to fetch translations' },
      { status: 500 }
    );
  }
}
