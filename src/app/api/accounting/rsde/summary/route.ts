export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { getDashboardSummary } from '@/lib/accounting/rsde.service';

export const GET = withAdminGuard(async () => {
  try {
    const summary = await getDashboardSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération du résumé RS&DE' }, { status: 500 });
  }
});
