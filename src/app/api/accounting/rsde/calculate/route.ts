export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { calculateCredits } from '@/lib/accounting/rsde.service';

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
    return NextResponse.json({ error: 'Erreur lors du calcul des crédits RS&DE' }, { status: 500 });
  }
});
