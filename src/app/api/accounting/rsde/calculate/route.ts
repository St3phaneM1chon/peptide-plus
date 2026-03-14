export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { calculateCredits } from '@/lib/accounting/rsde.service';
import { logger } from '@/lib/logger';

const schema = z.object({ projectId: z.string().min(1) });

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const result = await calculateCredits(parsed.data.projectId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('[accounting/rsde/calculate] Error calculating RS&DE credits', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur lors du calcul des crédits RS&DE' }, { status: 500 });
  }
});
