export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { getProject, updateProject, deleteProject } from '@/lib/accounting/rsde.service';

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  fiscalYear: z.number().int().min(2020).max(2035).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  technologicalUncertainty: z.string().max(5000).optional(),
  technologicalAdvancement: z.string().max(5000).optional(),
  systematicInvestigation: z.string().max(5000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  isSpcc: z.boolean().optional(),
});

export const GET = withAdminGuard(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 });
    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la récupération du projet' }, { status: 500 });
  }
});

export const PUT = withAdminGuard(async (request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    const project = await updateProject(id, parsed);
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du projet' }, { status: 500 });
  }
});

export const DELETE = withAdminGuard(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params;
    await deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de la suppression du projet' }, { status: 500 });
  }
});
