export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { calculateCredits } from '@/lib/accounting/rsde.service';

const schema = z.object({ projectId: z.string().min(1) });

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { projectId } = schema.parse(body);
    const result = await calculateCredits(projectId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'projectId requis' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur lors du calcul des crédits RS&DE' }, { status: 500 });
  }
});
