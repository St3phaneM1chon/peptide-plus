export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import { matchIntercoTransactions } from '@/lib/accounting/multi-entity.service';

/**
 * POST /api/accounting/interco/match
 * Auto-match pending intercompany transactions between entities.
 */
export const POST = withAdminGuard(async () => {
  try {
    const result = await matchIntercoTransactions();

    return NextResponse.json({
      success: true,
      matched: result.matched,
      pairs: result.pairs,
      message: result.matched > 0
        ? `${result.matched} paire(s) de transactions rapprochee(s)`
        : 'Aucune correspondance trouvee',
    });
  } catch (error) {
    logger.error('Match interco transactions error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors du rapprochement des transactions intercos' },
      { status: 500 },
    );
  }
});
