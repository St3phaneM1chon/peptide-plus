export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  createPortalAccess,
  listPortalAccesses,
} from '@/lib/accounting/client-portal.service';

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const createPortalAccessSchema = z.object({
  email: z.string().email('Email invalide'),
  clientName: z.string().min(1, 'Nom du client requis').max(200),
  companyName: z.string().max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/client-portal
// List all portal accesses (admin only)
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async () => {
  try {
    const accesses = await listPortalAccesses();

    return NextResponse.json({
      success: true,
      data: accesses,
      total: accesses.length,
    });
  } catch (error) {
    logger.error('List portal accesses error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des acces portail' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/client-portal
// Create a new portal access (admin only)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    const body = await request.json();
    const parsed = createPortalAccessSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { email, clientName, companyName, expiresInDays } = parsed.data;
    const createdBy = session?.user?.email || session?.user?.id || undefined;

    const access = await createPortalAccess(
      email,
      clientName,
      companyName,
      expiresInDays,
      createdBy
    );

    return NextResponse.json(
      { success: true, data: access },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Create portal access error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la creation de l\'acces portail' },
      { status: 500 }
    );
  }
});
