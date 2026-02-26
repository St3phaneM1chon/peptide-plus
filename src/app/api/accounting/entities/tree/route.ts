export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { getEntityTree } from '@/lib/accounting/multi-entity.service';

/**
 * GET /api/accounting/entities/tree
 * Get entity hierarchy as a tree.
 */
export const GET = withAdminGuard(async () => {
  try {
    const tree = await getEntityTree();
    return NextResponse.json({ data: tree });
  } catch (error) {
    logger.error('Get entity tree error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation de la hierarchie' },
      { status: 500 },
    );
  }
});
