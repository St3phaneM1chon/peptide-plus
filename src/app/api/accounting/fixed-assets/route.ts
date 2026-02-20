export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
// CCA_CLASSES available if needed for validation: import { CCA_CLASSES } from '@/lib/accounting/canadian-tax-config';

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
    console.error('GET fixed-assets error:', error);
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
    const body = await request.json();

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
    } = body;

    // --- Validation ---
    if (!name || !assetNumber || !acquisitionDate || !acquisitionCost || ccaClass === undefined || ccaRate === undefined) {
      return NextResponse.json(
        { error: 'Champs requis: name, assetNumber, acquisitionDate, acquisitionCost, ccaClass, ccaRate' },
        { status: 400 }
      );
    }

    if (!assetAccountId || !depreciationAccountId || !expenseAccountId) {
      return NextResponse.json(
        { error: 'Les trois comptes (actif, amortissement, charge) sont requis' },
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
        acquisitionCost: parseFloat(acquisitionCost),
        residualValue: residualValue ? parseFloat(residualValue) : 0,
        currentBookValue: parseFloat(acquisitionCost),
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

    console.info('AUDIT: FixedAsset CREATE', {
      assetId: asset.id,
      assetNumber,
      name,
      cost: acquisitionCost,
      createdBy: session.user.id || session.user.email,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, asset }, { status: 201 });
  } catch (error) {
    console.error('POST fixed-assets error:', error);
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
    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

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

        console.info('AUDIT: FixedAsset DEPRECIATE (super deduction)', {
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

      console.info('AUDIT: FixedAsset DEPRECIATE', {
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
      const proceeds = updates.disposalProceeds ? parseFloat(updates.disposalProceeds) : 0;
      updateData.disposalProceeds = proceeds;
      updateData.disposalGainLoss = Math.round((proceeds - Number(asset.currentBookValue)) * 100) / 100;

      console.info('AUDIT: FixedAsset DISPOSE', {
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

    console.info('AUDIT: FixedAsset UPDATE', {
      assetId: id,
      assetNumber: asset.assetNumber,
      updatedBy: session.user.id || session.user.email,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, asset: updatedAsset });
  } catch (error) {
    console.error('PATCH fixed-assets error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de l\'immobilisation' },
      { status: 500 }
    );
  }
});
