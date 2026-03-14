export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getDashboardSummary } from '@/lib/accounting/rsde.service';
import { logger } from '@/lib/logger';

export const GET = withAdminGuard(async () => {
  try {
    const summary = await getDashboardSummary();
    return NextResponse.json(summary);
  } catch (error) {
    logger.error('[accounting/rsde/summary] Error fetching RS&DE summary', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur lors de la récupération du résumé RS&DE' }, { status: 500 });
  }
});
