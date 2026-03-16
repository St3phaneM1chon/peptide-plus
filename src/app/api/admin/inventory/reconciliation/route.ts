export const dynamic = 'force-dynamic';

/**
 * Admin Inventory Reconciliation API
 * GET  - Compare calculated stock (sum of InventoryTransaction quantities)
 *        vs recorded stock (ProductFormat.stockQuantity / Product.stockQuantity)
 * POST - Apply a reconciliation adjustment to align stock
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logStockChange } from '@/lib/inventory';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// GET - Reconciliation report
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request: NextRequest) => {
  try {
    // ── 1-4. Single query: formats with calculated stock via LEFT JOIN ──
    // Combines format fetch + inventory transaction sum into one round-trip
    const formatReconciliation = await prisma.$queryRaw<
      Array<{
        productId: string;
        productName: string;
        formatId: string;
        formatName: string;
        recordedStock: number;
        calculatedStock: number;
      }>
    >`
      SELECT
        pf."productId",
        p.name AS "productName",
        pf.id AS "formatId",
        pf.name AS "formatName",
        pf."stockQuantity"::int AS "recordedStock",
        COALESCE(SUM(it.quantity), 0)::int AS "calculatedStock"
      FROM "ProductFormat" pf
      JOIN "Product" p ON pf."productId" = p.id
      LEFT JOIN "InventoryTransaction" it
        ON pf."productId" = it."productId" AND pf.id = it."formatId"
      WHERE pf."isActive" = true AND pf."trackInventory" = true
      GROUP BY pf.id, pf."productId", p.name, pf.name, pf."stockQuantity"
      ORDER BY p.name ASC
      LIMIT 10000
    `;

    // ── Base products (no format) with calculated stock via LEFT JOIN ──
    const baseReconciliation = await prisma.$queryRaw<
      Array<{
        productId: string;
        productName: string;
        recordedStock: number;
        calculatedStock: number;
      }>
    >`
      SELECT
        p.id AS "productId",
        p.name AS "productName",
        p."stockQuantity"::int AS "recordedStock",
        COALESCE(SUM(it.quantity), 0)::int AS "calculatedStock"
      FROM "Product" p
      LEFT JOIN "InventoryTransaction" it
        ON p.id = it."productId" AND it."formatId" IS NULL
      WHERE p."isActive" = true AND p."trackInventory" = true
      GROUP BY p.id, p.name, p."stockQuantity"
      LIMIT 10000
    `;

    // ── Get last reconciliation date (latest ADJUSTMENT transaction) ─
    const lastAdjustment = await prisma.inventoryTransaction.findFirst({
      where: { type: 'ADJUSTMENT', reason: { startsWith: 'Reconciliation:' } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // ── Build items list from combined results ──────────
    let matchCount = 0;
    let discrepancyCount = 0;

    const items = formatReconciliation.map((row) => {
      const discrepancy = row.recordedStock - row.calculatedStock;
      const status = discrepancy === 0 ? 'MATCH' : 'DISCREPANCY';
      if (status === 'MATCH') matchCount++;
      else discrepancyCount++;

      return {
        productId: row.productId,
        productName: row.productName,
        formatId: row.formatId,
        formatName: row.formatName,
        recordedStock: row.recordedStock,
        calculatedStock: row.calculatedStock,
        discrepancy,
        status,
      };
    });

    for (const row of baseReconciliation) {
      const discrepancy = row.recordedStock - row.calculatedStock;
      const status = discrepancy === 0 ? 'MATCH' : 'DISCREPANCY';
      if (status === 'MATCH') matchCount++;
      else discrepancyCount++;

      // Only include base-product rows when there are transactions or stock
      if (row.calculatedStock !== 0 || row.recordedStock !== 0) {
        items.push({
          productId: row.productId,
          productName: row.productName,
          formatId: '',
          formatName: '(base product)',
          recordedStock: row.recordedStock,
          calculatedStock: row.calculatedStock,
          discrepancy,
          status,
        });
      }
    }

    return NextResponse.json({
      data: {
        totalProducts: items.length,
        matchCount,
        discrepancyCount,
        lastReconciled: lastAdjustment?.createdAt?.toISOString() ?? null,
        items,
      },
    });
  } catch (error) {
    logger.error('Inventory reconciliation GET error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST - Apply reconciliation adjustment
// ---------------------------------------------------------------------------

const reconcileSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  formatId: z.string().optional(),
  adjustedStock: z.number().int().min(0, 'adjustedStock must be >= 0'),
  reason: z.string().min(1, 'reason is required'),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }: { session: { user: { id: string } } }) => {
  try {
    const body = await request.json();
    const parsed = reconcileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data' },
        { status: 400 }
      );
    }

    const { productId, formatId, adjustedStock, reason } = parsed.data;
    const effectiveFormatId = formatId || null;

    // ── 1. Get current recorded stock ──────────────────────────────────
    let currentStock = 0;
    if (effectiveFormatId) {
      const format = await prisma.productFormat.findUnique({
        where: { id: effectiveFormatId },
        select: { stockQuantity: true },
      });
      if (!format) {
        return NextResponse.json(
          { error: 'Format not found' },
          { status: 404 }
        );
      }
      currentStock = format.stockQuantity;
    } else {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { stockQuantity: true },
      });
      if (!product) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        );
      }
      currentStock = product.stockQuantity;
    }

    // ── 2. Calculate adjustment delta ──────────────────────────────────
    const delta = adjustedStock - currentStock;

    if (delta === 0) {
      return NextResponse.json({
        success: true,
        message: 'No adjustment needed, stock already matches',
        adjustment: 0,
      });
    }

    // ── 3. Get current WAC for the inventory transaction ───────────────
    const lastTransaction = await prisma.inventoryTransaction.findFirst({
      where: { productId, formatId: effectiveFormatId },
      orderBy: { createdAt: 'desc' },
      select: { runningWAC: true },
    });
    const wac = lastTransaction ? Number(lastTransaction.runningWAC) : 0;

    // ── 4. Apply the adjustment in a transaction ───────────────────────
    await prisma.$transaction(async (tx) => {
      // Update stock directly to the adjusted value
      if (effectiveFormatId) {
        await tx.productFormat.update({
          where: { id: effectiveFormatId },
          data: { stockQuantity: adjustedStock },
        });
      } else {
        await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: adjustedStock },
        });
      }

      // Create an ADJUSTMENT inventory transaction for the delta
      await tx.inventoryTransaction.create({
        data: {
          productId,
          formatId: effectiveFormatId,
          type: 'ADJUSTMENT',
          quantity: delta,
          unitCost: wac,
          runningWAC: wac,
          reason: `Reconciliation: ${reason}`,
          createdBy: session.user.id,
        },
      });
    });

    // ── 5. Audit log (fire-and-forget) ─────────────────────────────────
    logStockChange({
      productId,
      formatId: effectiveFormatId,
      changeType: 'RECONCILIATION',
      oldQuantity: currentStock,
      newQuantity: adjustedStock,
      quantity: delta,
      reason: `Reconciliation: ${reason}`,
      changedBy: session.user.id,
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'RECONCILE_STOCK',
      targetType: 'Inventory',
      targetId: effectiveFormatId || productId,
      newValue: { productId, formatId: effectiveFormatId, oldStock: currentStock, adjustedStock, delta, reason },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((err) => { logger.error('[admin/inventory/reconciliation] Non-blocking operation failed:', err); });

    logger.info('Inventory reconciliation applied', {
      productId,
      formatId: effectiveFormatId,
      oldStock: currentStock,
      adjustedStock,
      delta,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      message: `Stock reconciled: ${currentStock} -> ${adjustedStock} (delta: ${delta > 0 ? '+' : ''}${delta})`,
      adjustment: delta,
    });
  } catch (error) {
    logger.error('Inventory reconciliation POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
