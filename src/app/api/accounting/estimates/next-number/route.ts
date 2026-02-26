export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET /api/accounting/estimates/next-number
// Generate the next estimate number (EST-YYYY-NNNN)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async () => {
  try {
    const year = new Date().getFullYear();
    const prefix = `EST-${year}-`;

    const [maxRow] = await prisma.$queryRaw<{ max_num: string | null }[]>`
      SELECT MAX("estimateNumber") as max_num
      FROM "Estimate"
      WHERE "estimateNumber" LIKE ${prefix + '%'}
    `;

    let nextNum = 1;
    if (maxRow?.max_num) {
      const num = parseInt(maxRow.max_num.split('-').pop() || '0');
      if (!isNaN(num)) nextNum = num + 1;
    }

    const nextNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

    return NextResponse.json({ nextNumber });
  } catch (error) {
    logger.error('Get next estimate number error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la génération du numéro de devis' },
      { status: 500 }
    );
  }
});
