export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { assertPeriodOpen } from '@/lib/accounting/validation';
// CCA_CLASSES available if needed for validation: import { CCA_CLASSES } from '@/lib/accounting/canadian-tax-config';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createFixedAssetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  assetNumber: z.string().min(1),
  serialNumber: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  acquisitionDate: z.string().min(1),
  acquisitionCost: z.union([z.number(), z.string()]).refine((v) => !isNaN(Number(v)), 'Must be a number'),
  residualValue: z.union([z.number(), z.string()]).optional().nullable(),
  ccaClass: z.union([z.number(), z.string()]),
  ccaRate: z.union([z.number(), z.string()]),
  depreciationMethod: z.string().optional().default('DECLINING_BALANCE'),
  halfYearRuleApplied: z.boolean().optional().default(true),
  aiiApplied: z.boolean().optional().default(false),
  superDeduction: z.boolean().optional().default(false),
  gifiCode: z.string().optional().nullable(),
  assetAccountId: z.string().min(1),
  depreciationAccountId: z.string().min(1),
  expenseAccountId: z.string().min(1),
  notes: z.string().optional().nullable(),
});

const patchFixedAssetSchema = z.object({
  id: z.string().min(1),
  action: z.string().optional(),
  // Depreciation fields (when action === 'depreciate')
  fiscalYear: z.union([z.number(), z.string()]).optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  // Update fields
  name: z.string().optional(),
  description: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  gifiCode: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  halfYearRuleApplied: z.boolean().optional(),
  aiiApplied: z.boolean().optional(),
  superDeduction: z.boolean().optional(),
  assetAccountId: z.string().optional(),
  depreciationAccountId: z.string().optional(),
  expenseAccountId: z.string().optional(),
  status: z.string().optional(),
  disposalDate: z.string().optional().nullable(),
  disposalProceeds: z.union([z.number(), z.string()]).optional().nullable(),
}).passthrough();

// =============================================================================
// GET /api/accounting/fixed-assets
// List all fixed assets with optional filters + aggregated stats
// =============================================================================

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const ccaClass = searchParams.get('ccaClass');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {};

    if (status) {
      where.status = status;
    }

    if (ccaClass) {
      where.ccaClass = parseInt(ccaClass, 10);
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { assetNumber: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    const assets = await prisma.fixedAsset.findMany({
      where,
      include: {
        assetAccount: { select: { id: true, code: true, name: true } },
        depreciationAccount: { select: { id: true, code: true, name: true } },
        expenseAccount: { select: { id: true, code: true, name: true } },
        depreciationEntries: { orderBy: { fiscalYear: 'desc' } },
      },
      orderBy: { assetNumber: 'asc' },
    });

    // Aggregate stats across ALL assets (unfiltered) for the dashboard
    const allAssets = await prisma.fixedAsset.findMany({
      select: {
        acquisitionCost: true,
        currentBookValue: true,
        accumulatedDepreciation: true,
        status: true,
      },
    });

    const stats = {
      totalAssets: allAssets.length,
      totalCost: allAssets.reduce((sum: number, a: { acquisitionCost: unknown }) => sum + Number(a.acquisitionCost), 0),
      totalBookValue: allAssets.reduce((sum: number, a: { currentBookValue: unknown }) => sum + Number(a.currentBookValue), 0),
      totalDepreciation: allAssets.reduce((sum: number, a: { accumulatedDepreciation: unknown }) => sum + Number(a.accumulatedDepreciation), 0),
      activeCount: allAssets.filter((a: { status: string }) => a.status === 'ACTIVE').length,
    };

    return NextResponse.json({ assets, stats });
  } catch (error) {
    logger.error('GET fixed-assets error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des immobilisations' },
      { status: 500 }
    );
  }
});

// =============================================================================
// POST /api/accounting/fixed-assets
// Create a new fixed asset
// =============================================================================

export const POST = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/fixed-assets');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createFixedAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const {
      name,
      description,
      assetNumber,
      serialNumber,
      location,
      acquisitionDate,
      acquisitionCost,
      residualValue,
      ccaClass,
      ccaRate,
      depreciationMethod,
      halfYearRuleApplied,
      aiiApplied,
      superDeduction,
      gifiCode,
      assetAccountId,
      depreciationAccountId,
      expenseAccountId,
      notes,
    } = parsed.data;

    // IMP-A017: Check that the acquisition date is not in a closed/locked accounting period
    try {
      await assertPeriodOpen(new Date(acquisitionDate));
    } catch (periodError) {
      return NextResponse.json(
        { error: periodError instanceof Error ? periodError.message : 'Période comptable verrouillée' },
        { status: 400 }
      );
    }

    // Validate uniqueness of assetNumber
    const existing = await prisma.fixedAsset.findUnique({ where: { assetNumber } });
    if (existing) {
      return NextResponse.json(
        { error: `Le numero d'actif "${assetNumber}" existe deja` },
        { status: 409 }
      );
    }

    const asset = await prisma.fixedAsset.create({
      data: {
        name,
        description: description || null,
        assetNumber,
        serialNumber: serialNumber || null,
        location: location || null,
        acquisitionDate: new Date(acquisitionDate),
        acquisitionCost: parseFloat(String(acquisitionCost)),
        residualValue: residualValue ? parseFloat(String(residualValue)) : 0,
        currentBookValue: parseFloat(String(acquisitionCost)),
        accumulatedDepreciation: 0,
        ccaClass: parseInt(String(ccaClass), 10),
        ccaRate: parseFloat(String(ccaRate)),
        depreciationMethod: depreciationMethod || 'DECLINING_BALANCE',
        halfYearRuleApplied: halfYearRuleApplied ?? true,
        aiiApplied: aiiApplied ?? false,
        superDeduction: superDeduction ?? false,
        gifiCode: gifiCode || null,
        status: 'ACTIVE',
        assetAccountId,
        depreciationAccountId,
        expenseAccountId,
        notes: notes || null,
      },
      include: {
        assetAccount: { select: { id: true, code: true, name: true } },
        depreciationAccount: { select: { id: true, code: true, name: true } },
        expenseAccount: { select: { id: true, code: true, name: true } },
        depreciationEntries: true,
      },
    });

    logger.info('AUDIT: FixedAsset CREATE', {
      assetId: asset.id,
      assetNumber,
      name,
      cost: acquisitionCost,
      createdBy: session.user.id || session.user.email,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (error) {
    logger.error('POST fixed-assets error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la creation de l\'immobilisation' },
      { status: 500 }
    );
  }
});

// =============================================================================
// PATCH /api/accounting/fixed-assets
// Update a fixed asset OR calculate depreciation
// =============================================================================

export const PATCH = withAdminGuard(async (request, { session }) => {
  try {
    // CSRF + Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/fixed-assets');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = patchFixedAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id, action, ...updates } = parsed.data;

    const asset = await prisma.fixedAsset.findUnique({
      where: { id },
      include: { depreciationEntries: { orderBy: { fiscalYear: 'desc' } } },
    });

    if (!asset) {
      return NextResponse.json({ error: 'Immobilisation non trouvee' }, { status: 404 });
    }

    // -----------------------------------------------------------------
    // ACTION: Calculate CCA depreciation for a fiscal year
    // -----------------------------------------------------------------
    if (action === 'depreciate') {
      const { fiscalYear, periodStart, periodEnd } = updates;

      if (!fiscalYear || !periodStart || !periodEnd) {
        return NextResponse.json(
          { error: 'fiscalYear, periodStart et periodEnd sont requis pour l\'amortissement' },
          { status: 400 }
        );
      }

      if (asset.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'Seules les immobilisations actives peuvent etre amorties' },
          { status: 400 }
        );
      }

      // Check if depreciation already exists for this fiscal year
      const existingDepr = asset.depreciationEntries.find(
        (e: { fiscalYear: number }) => e.fiscalYear === parseInt(String(fiscalYear), 10)
      );
      if (existingDepr) {
        return NextResponse.json(
          { error: `L'amortissement pour l'annee ${fiscalYear} existe deja` },
          { status: 409 }
        );
      }

      const openingUCC = Number(asset.currentBookValue);
      const residual = Number(asset.residualValue);
      const rate = asset.ccaRate / 100;

      // Determine if this is the first year (acquisition year)
      const acquisitionYear = new Date(asset.acquisitionDate).getFullYear();
      const isFirstYear = parseInt(String(fiscalYear), 10) === acquisitionYear;

      let effectiveUCC = openingUCC;

      if (asset.superDeduction) {
        // 100% immediate expensing
        effectiveUCC = openingUCC;
        // CCA = full remaining UCC above residual
        const ccaClaimed = Math.max(0, effectiveUCC - residual);
        const closingUCC = openingUCC - ccaClaimed;

        const [depreciationEntry, updatedAsset] = await prisma.$transaction([
          prisma.fixedAssetDepreciation.create({
            data: {
              fixedAssetId: id,
              fiscalYear: parseInt(String(fiscalYear), 10),
              periodStart: new Date(periodStart),
              periodEnd: new Date(periodEnd),
              openingUCC,
              ccaClaimed,
              closingUCC,
              notes: 'Super deduction - 100% immediate expensing',
            },
          }),
          prisma.fixedAsset.update({
            where: { id },
            data: {
              currentBookValue: closingUCC,
              accumulatedDepreciation: Number(asset.accumulatedDepreciation) + ccaClaimed,
              status: closingUCC <= residual ? 'FULLY_DEPRECIATED' : 'ACTIVE',
            },
            include: {
              assetAccount: { select: { id: true, code: true, name: true } },
              depreciationAccount: { select: { id: true, code: true, name: true } },
              expenseAccount: { select: { id: true, code: true, name: true } },
              depreciationEntries: { orderBy: { fiscalYear: 'desc' } },
            },
          }),
        ]);

        logger.info('AUDIT: FixedAsset DEPRECIATE (super deduction)', {
          assetId: id,
          fiscalYear,
          ccaClaimed,
          closingUCC,
          calculatedBy: session.user.id || session.user.email,
        });

        return NextResponse.json({ success: true, asset: updatedAsset, depreciationEntry });
      }

      // Standard CCA calculation
      if (isFirstYear) {
        if (asset.aiiApplied) {
          // AII: 1.5x the UCC base (no half-year reduction)
          effectiveUCC = openingUCC * 1.5;
        } else if (asset.halfYearRuleApplied) {
          // Standard half-year rule: 50% of net addition
          effectiveUCC = openingUCC * 0.5;
        }
      }

      let ccaClaimed = Math.round(effectiveUCC * rate * 100) / 100;

      // CCA cannot exceed opening UCC minus residual
      ccaClaimed = Math.min(ccaClaimed, Math.max(0, openingUCC - residual));

      const closingUCC = Math.round((openingUCC - ccaClaimed) * 100) / 100;

      const [depreciationEntry, updatedAsset] = await prisma.$transaction([
        prisma.fixedAssetDepreciation.create({
          data: {
            fixedAssetId: id,
            fiscalYear: parseInt(String(fiscalYear), 10),
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            openingUCC,
            ccaClaimed,
            closingUCC,
            notes: isFirstYear
              ? asset.aiiApplied
                ? 'First year - AII applied (1.5x)'
                : asset.halfYearRuleApplied
                  ? 'First year - half-year rule applied'
                  : 'First year - no adjustment'
              : null,
          },
        }),
        prisma.fixedAsset.update({
          where: { id },
          data: {
            currentBookValue: closingUCC,
            accumulatedDepreciation: Number(asset.accumulatedDepreciation) + ccaClaimed,
            status: closingUCC <= residual ? 'FULLY_DEPRECIATED' : 'ACTIVE',
          },
          include: {
            assetAccount: { select: { id: true, code: true, name: true } },
            depreciationAccount: { select: { id: true, code: true, name: true } },
            expenseAccount: { select: { id: true, code: true, name: true } },
            depreciationEntries: { orderBy: { fiscalYear: 'desc' } },
          },
        }),
      ]);

      logger.info('AUDIT: FixedAsset DEPRECIATE', {
        assetId: id,
        fiscalYear,
        openingUCC,
        effectiveUCC,
        rate: asset.ccaRate,
        ccaClaimed,
        closingUCC,
        isFirstYear,
        halfYearRule: asset.halfYearRuleApplied,
        aii: asset.aiiApplied,
        calculatedBy: session.user.id || session.user.email,
      });

      return NextResponse.json({ success: true, asset: updatedAsset, depreciationEntry });
    }

    // -----------------------------------------------------------------
    // Standard update (including disposal)
    // -----------------------------------------------------------------
    const updateData: Record<string, unknown> = {};

    // Editable fields
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description || null;
    if (updates.serialNumber !== undefined) updateData.serialNumber = updates.serialNumber || null;
    if (updates.location !== undefined) updateData.location = updates.location || null;
    if (updates.gifiCode !== undefined) updateData.gifiCode = updates.gifiCode || null;
    if (updates.notes !== undefined) updateData.notes = updates.notes || null;
    if (updates.halfYearRuleApplied !== undefined) updateData.halfYearRuleApplied = updates.halfYearRuleApplied;
    if (updates.aiiApplied !== undefined) updateData.aiiApplied = updates.aiiApplied;
    if (updates.superDeduction !== undefined) updateData.superDeduction = updates.superDeduction;
    if (updates.assetAccountId !== undefined) updateData.assetAccountId = updates.assetAccountId;
    if (updates.depreciationAccountId !== undefined) updateData.depreciationAccountId = updates.depreciationAccountId;
    if (updates.expenseAccountId !== undefined) updateData.expenseAccountId = updates.expenseAccountId;

    // Handle disposal
    if (updates.status === 'DISPOSED') {
      updateData.status = 'DISPOSED';
      updateData.disposalDate = updates.disposalDate ? new Date(updates.disposalDate) : new Date();
      const proceeds = updates.disposalProceeds ? parseFloat(String(updates.disposalProceeds)) : 0;
      updateData.disposalProceeds = proceeds;
      updateData.disposalGainLoss = Math.round((proceeds - Number(asset.currentBookValue)) * 100) / 100;

      logger.info('AUDIT: FixedAsset DISPOSE', {
        assetId: id,
        assetNumber: asset.assetNumber,
        bookValue: Number(asset.currentBookValue),
        proceeds,
        gainLoss: updateData.disposalGainLoss,
        disposedBy: session.user.id || session.user.email,
      });
    } else if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    const updatedAsset = await prisma.fixedAsset.update({
      where: { id },
      data: updateData,
      include: {
        assetAccount: { select: { id: true, code: true, name: true } },
        depreciationAccount: { select: { id: true, code: true, name: true } },
        expenseAccount: { select: { id: true, code: true, name: true } },
        depreciationEntries: { orderBy: { fiscalYear: 'desc' } },
      },
    });

    logger.info('AUDIT: FixedAsset UPDATE', {
      assetId: id,
      assetNumber: asset.assetNumber,
      updatedBy: session.user.id || session.user.email,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, asset: updatedAsset });
  } catch (error) {
    logger.error('PATCH fixed-assets error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de l\'immobilisation' },
      { status: 500 }
    );
  }
});
