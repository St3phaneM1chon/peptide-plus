export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { prepareT661 } from '@/lib/accounting/rsde.service';

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
    const formData = await prepareT661(parsed.data.projectId);
    return NextResponse.json(formData);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la préparation du formulaire T661' }, { status: 500 });
  }
});
