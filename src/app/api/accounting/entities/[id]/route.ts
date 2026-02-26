export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  getEntityById,
  updateEntity,
  deleteEntity,
  setDefaultEntity,
} from '@/lib/accounting/multi-entity.service';

/**
 * GET /api/accounting/entities/[id]
 * Get a single entity by ID.
 */
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const entity = await getEntityById(id);

    return NextResponse.json({ data: entity });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    logger.error('Get entity error', { error: msg });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation de l\'entite' },
      { status: 500 },
    );
  }
});

const updateEntitySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  legalName: z.string().max(300).nullish(),
  taxNumber: z.string().max(50).nullish(),
  gstNumber: z.string().max(50).nullish(),
  qstNumber: z.string().max(50).nullish(),
  address: z.string().max(500).nullish(),
  city: z.string().max(100).nullish(),
  province: z.string().max(100).nullish(),
  postalCode: z.string().max(20).nullish(),
  country: z.string().max(10).optional(),
  currency: z.string().max(10).optional(),
  fiscalYearStart: z.number().int().min(1).max(12).optional(),
  parentEntityId: z.string().nullish(),
  isActive: z.boolean().optional(),
  setDefault: z.boolean().optional(),
});

/**
 * PUT /api/accounting/entities/[id]
 * Update an existing entity.
 */
export const PUT = withAdminGuard(async (request, { params }) => {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateEntitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const { setDefault, ...updateData } = parsed.data;

    // Handle setDefault action
    if (setDefault) {
      const entity = await setDefaultEntity(id);
      return NextResponse.json({ success: true, entity });
    }

    const entity = await updateEntity(id, updateData);
    return NextResponse.json({ success: true, entity });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes('own parent') || msg.includes('Circular')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    logger.error('Update entity error', { error: msg });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de l\'entite' },
      { status: 500 },
    );
  }
});

/**
 * DELETE /api/accounting/entities/[id]
 * Soft-delete an entity.
 */
export const DELETE = withAdminGuard(async (_request, { params }) => {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    await deleteEntity(id);
    return NextResponse.json({ success: true, message: 'Entite supprimee' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes('Cannot delete')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    logger.error('Delete entity error', { error: msg });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'entite' },
      { status: 500 },
    );
  }
});
