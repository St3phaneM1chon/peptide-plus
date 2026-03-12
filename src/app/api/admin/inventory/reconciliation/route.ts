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
    // ── 1. Fetch all active formats with their recorded stock ──────────
    // A7-P2-003: Add take limit to prevent unbounded result sets
    const formats = await prisma.productFormat.findMany({
      where: { isActive: true, trackInventory: true },
      select: {
        id: true,
        productId: true,
        name: true,
        stockQuantity: true,
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { product: { name: 'asc' } },
      take: 10000,
    });

    // ── 2. Compute calculated stock per (productId, formatId) ──────────
    //    Sum of all InventoryTransaction.quantity grouped by productId + formatId
    const calculatedRows = await prisma.$queryRaw<
      { productId: string; formatId: string | null; total: bigint }[]
    >`
      SELECT "productId", "formatId", SUM("quantity") AS total
      FROM "InventoryTransaction"
      GROUP BY "productId", "formatId"
    `;

    const calculatedMap = new Map<string, number>();
    for (const row of calculatedRows) {
      const key = `${row.productId}:${row.formatId ?? ''}`;
      calculatedMap.set(key, Number(row.total));
    }

    // ── 3. Get last reconciliation date (latest ADJUSTMENT transaction) ─
    const lastAdjustment = await prisma.inventoryTransaction.findFirst({
      where: { type: 'ADJUSTMENT', reason: { startsWith: 'Reconciliation:' } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    // ── 4. Build items list, comparing recorded vs calculated ──────────
    let matchCount = 0;
    let discrepancyCount = 0;

    const items = formats.map((format) => {
      const key = `${format.productId}:${format.id}`;
      const calculatedStock = calculatedMap.get(key) ?? 0;
      const recordedStock = format.stockQuantity;
      const discrepancy = recordedStock - calculatedStock;
      const status = discrepancy === 0 ? 'MATCH' : 'DISCREPANCY';

      if (status === 'MATCH') matchCount++;
      else discrepancyCount++;

      return {
        productId: format.productId,
        productName: format.product.name,
        formatId: format.id,
        formatName: format.name,
        recordedStock,
        calculatedStock,
        discrepancy,
        status,
      };
    });

    // ── 5. Also check base products (no format) that track inventory ───
    // A7-P2-003: Add take limit to prevent unbounded result sets
    const baseProducts = await prisma.product.findMany({
      where: { isActive: true, trackInventory: true },
      select: { id: true, name: true, stockQuantity: true },
      take: 10000,
    });

    for (const product of baseProducts) {
      const key = `${product.id}:`;
      const calculatedStock = calculatedMap.get(key) ?? 0;
      const recordedStock = product.stockQuantity;
      const discrepancy = recordedStock - calculatedStock;
      const status = discrepancy === 0 ? 'MATCH' : 'DISCREPANCY';

      if (status === 'MATCH') matchCount++;
      else discrepancyCount++;

      // Only include base-product rows when there are transactions or stock
      if (calculatedStock !== 0 || recordedStock !== 0) {
        items.push({
          productId: product.id,
          productName: product.name,
          formatId: '',
          formatName: '(base product)',
          recordedStock,
          calculatedStock,
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
        { error: 'Invalid data', details: parsed.error.errors },
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
    }).catch(() => {});

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
