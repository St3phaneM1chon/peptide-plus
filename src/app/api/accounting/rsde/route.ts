export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { listProjects, createProject } from '@/lib/accounting/rsde.service';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  fiscalYear: z.number().int().min(2020).max(2035),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  technologicalUncertainty: z.string().max(5000).optional(),
  technologicalAdvancement: z.string().max(5000).optional(),
  systematicInvestigation: z.string().max(5000).optional(),
  isSpcc: z.boolean().optional(),
});

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const fiscalYear = searchParams.get('fiscalYear') ? parseInt(searchParams.get('fiscalYear')!) : undefined;
    const status = searchParams.get('status') as 'DRAFT' | 'ACTIVE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20')), 100);
    const result = await listProjects({ fiscalYear, status, page, limit });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération des projets RS&DE' }, { status: 500 });
  }
});

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createSchema.parse(body);
    const project = await createProject(parsed);
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur lors de la création du projet RS&DE' }, { status: 500 });
  }
});
