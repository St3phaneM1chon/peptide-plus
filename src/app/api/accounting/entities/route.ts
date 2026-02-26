export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  createEntity,
  getEntities,
} from '@/lib/accounting/multi-entity.service';

/**
 * GET /api/accounting/entities
 * List all legal entities with optional hierarchy.
 */
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const entities = await getEntities(includeInactive);

    return NextResponse.json({
      data: entities,
      total: entities.length,
    });
  } catch (error) {
    logger.error('Get entities error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des entites' },
      { status: 500 },
    );
  }
});

const createEntitySchema = z.object({
  name: z.string().min(1, 'Nom requis').max(200),
  code: z
    .string()
    .min(1, 'Code requis')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Code: lettres majuscules, chiffres, tirets et underscores uniquement'),
  legalName: z.string().max(300).optional(),
  taxNumber: z.string().max(50).optional(),
  gstNumber: z.string().max(50).optional(),
  qstNumber: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(10).default('CA'),
  currency: z.string().max(10).default('CAD'),
  fiscalYearStart: z.number().int().min(1).max(12).default(1),
  parentEntityId: z.string().nullish(),
  isActive: z.boolean().default(true),
});

/**
 * POST /api/accounting/entities
 * Create a new legal entity.
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createEntitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 },
      );
    }

    const entity = await createEntity(parsed.data);

    return NextResponse.json({ success: true, entity }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes('already exists')) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg.includes('not found')) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }

    logger.error('Create entity error', { error: msg });
    return NextResponse.json(
      { error: 'Erreur lors de la creation de l\'entite' },
      { status: 500 },
    );
  }
});
