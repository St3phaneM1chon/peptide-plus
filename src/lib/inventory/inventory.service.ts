/**
 * Inventory Service
 * Manages stock reservations, consumption, WAC calculation, and COGS entries
 */

import { prisma } from '@/lib/db';
import { ACCOUNT_CODES } from '@/lib/accounting/types';
import { assertJournalBalance, assertPeriodOpen } from '@/lib/accounting/validation';
import { logger } from '@/lib/logger';

/**
 * Reserve stock for a checkout session
 * Creates InventoryReservation records and temporarily holds stock
 */
export async function reserveStock(
  items: { productId: string; formatId?: string; quantity: number }[],
  cartId: string,
  ttlMinutes = 30
): Promise<string[]> {
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  // E-19 FIX: Self-healing — release expired reservations for the requested products/formats
  // before checking available stock. This prevents permanently locked inventory if the
  // cron job (releaseExpiredReservations) stops running.
  // N+1 FIX: Release all expired reservations for all requested items in a single query
  // instead of one query per item.
  const now = new Date();
  const formatItemIds = items.filter(i => i.formatId).map(i => i.formatId!);
  const productOnlyItemIds = items.filter(i => !i.formatId).map(i => i.productId);

  const releaseConditions: Array<Record<string, unknown>> = [];
  if (formatItemIds.length > 0) {
    releaseConditions.push({ formatId: { in: formatItemIds } });
  }
  if (productOnlyItemIds.length > 0) {
    releaseConditions.push({ productId: { in: productOnlyItemIds }, formatId: null });
  }

  if (releaseConditions.length > 0) {
    const released = await prisma.inventoryReservation.updateMany({
      where: {
        status: 'RESERVED',
        expiresAt: { lt: now },
        OR: releaseConditions,
      },
      data: { status: 'RELEASED', releasedAt: now },
    });
    if (released.count > 0) {
      logger.info('[reserveStock] E-19 self-healing: released expired reservations', {
        releasedCount: released.count,
        formatIds: formatItemIds,
        productIds: productOnlyItemIds,
      });
    }
  }

  // Wrap entire reservation in a single transaction to prevent race conditions
  return prisma.$transaction(async (tx) => {
    const reservationIds: string[] = [];

    // N+1 FIX: Batch-fetch all format and product stock data before the loop
    // instead of individual findUnique per item (was 2-5 queries per item, now 2 queries total)
    const formatIdsToCheck = items.filter(i => i.formatId).map(i => i.formatId!);
    const productIdsToCheck = items.filter(i => !i.formatId).map(i => i.productId);

    const [allFormats, allProducts] = await Promise.all([
      formatIdsToCheck.length > 0
        ? tx.productFormat.findMany({
            where: { id: { in: formatIdsToCheck } },
            select: { id: true, stockQuantity: true, trackInventory: true },
          })
        : [],
      productIdsToCheck.length > 0
        ? tx.product.findMany({
            where: { id: { in: productIdsToCheck } },
            select: { id: true, stockQuantity: true, trackInventory: true },
          })
        : [],
    ]);

    const formatMap = new Map(allFormats.map(f => [f.id, f]));
    const productMap = new Map(allProducts.map(p => [p.id, p]));

    // Batch-fetch all existing reservations for all requested formats and products
    const allFormatReservations = formatIdsToCheck.length > 0
      ? await tx.inventoryReservation.groupBy({
          by: ['formatId'],
          where: {
            formatId: { in: formatIdsToCheck },
            status: 'RESERVED',
            expiresAt: { gt: new Date() },
          },
          _sum: { quantity: true },
        })
      : [];
    const allProductReservations = productIdsToCheck.length > 0
      ? await tx.inventoryReservation.groupBy({
          by: ['productId'],
          where: {
            productId: { in: productIdsToCheck },
            formatId: null,
            status: 'RESERVED',
            expiresAt: { gt: new Date() },
          },
          _sum: { quantity: true },
        })
      : [];

    const formatReservedMap = new Map(allFormatReservations.map(r => [r.formatId, r._sum.quantity || 0]));
    const productReservedMap = new Map(allProductReservations.map(r => [r.productId, r._sum.quantity || 0]));

    for (const item of items) {
      // Check available stock using pre-fetched data
      if (item.formatId) {
        const format = formatMap.get(item.formatId);

        if (format?.trackInventory) {
          const reservedQty = formatReservedMap.get(item.formatId) || 0;
          const available = format.stockQuantity - reservedQty;
          if (available < item.quantity) {
            throw new Error(
              `Stock insuffisant pour format ${item.formatId}: demandé ${item.quantity}, disponible ${available}`
            );
          }
        }
      } else {
        // E-07 FIX: Check stock for base products (no formatId)
        const product = productMap.get(item.productId);

        if (product?.trackInventory) {
          const reservedQty = productReservedMap.get(item.productId) || 0;
          const available = product.stockQuantity - reservedQty;
          if (available < item.quantity) {
            throw new Error(
              `Stock insuffisant pour produit ${item.productId}: demandé ${item.quantity}, disponible ${available}`
            );
          }
        }
      }

      const reservation = await tx.inventoryReservation.create({
        data: {
          productId: item.productId,
          formatId: item.formatId || null,
          quantity: item.quantity,
          cartId,
          expiresAt,
        },
      });
      reservationIds.push(reservation.id);
    }

    return reservationIds;
  });
}

/**
 * Release a reservation (payment failed or expired)
 */
export async function releaseReservation(reservationId: string): Promise<void> {
  await prisma.inventoryReservation.update({
    where: { id: reservationId },
    data: { status: 'RELEASED', releasedAt: new Date() },
  });
}

/**
 * Release all expired reservations (called by cron)
 */
export async function releaseExpiredReservations(): Promise<number> {
  const result = await prisma.inventoryReservation.updateMany({
    where: {
      status: 'RESERVED',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'RELEASED', releasedAt: new Date() },
  });
  return result.count;
}

/**
 * Consume reservations after successful payment
 * Decrements stock and creates InventoryTransaction records
 * BUG-036 FIX: Process all reservations in a single transaction (was one tx per reservation)
 */
export async function consumeReservation(
  orderId: string,
  cartId?: string
): Promise<void> {
  const where: Record<string, unknown> = { status: 'RESERVED' as const };
  if (cartId) where.cartId = cartId;
  else where.orderId = orderId;

  const reservations = await prisma.inventoryReservation.findMany({ where });

  if (reservations.length === 0) return;

  await prisma.$transaction(async (tx) => {
    // Batch mark all reservations as consumed
    const reservationIds = reservations.map((r) => r.id);
    await tx.inventoryReservation.updateMany({
      where: { id: { in: reservationIds } },
      data: { status: 'CONSUMED', orderId, consumedAt: new Date() },
    });

    // N+1 FIX: Batch-fetch WAC for all product/format pairs before the loop
    // instead of individual findFirst per reservation (was 1 query per reservation, now 1 query total)
    const wacPairs = reservations.map(r => ({ productId: r.productId, formatId: r.formatId }));
    const uniquePairs = Array.from(
      new Map(wacPairs.map(p => [`${p.productId}:${p.formatId || 'null'}`, p])).values()
    );
    const allWacTransactions = await tx.inventoryTransaction.findMany({
      where: {
        OR: uniquePairs.map(p => ({
          productId: p.productId,
          formatId: p.formatId,
        })),
      },
      orderBy: { createdAt: 'desc' },
      select: { productId: true, formatId: true, runningWAC: true, createdAt: true },
    });
    // Build WAC map: keep only the most recent transaction per product/format pair
    const wacMap = new Map<string, number>();
    for (const wt of allWacTransactions) {
      const key = `${wt.productId}:${wt.formatId || 'null'}`;
      if (!wacMap.has(key)) {
        wacMap.set(key, Number(wt.runningWAC));
      }
    }

    // Process stock decrements and inventory transactions for each reservation
    for (const reservation of reservations) {
      // E-08 FIX: Atomic conditional stock decrement — prevents negative inventory
      if (reservation.formatId) {
        const rowsAffected: number = await tx.$executeRaw`
          UPDATE "ProductFormat"
          SET "stockQuantity" = "stockQuantity" - ${reservation.quantity},
              "updatedAt" = NOW()
          WHERE id = ${reservation.formatId}
            AND "stockQuantity" >= ${reservation.quantity}
        `;
        if (rowsAffected === 0) {
          logger.warn('[consumeReservation] Insufficient stock', { formatId: reservation.formatId, requested: reservation.quantity });
        }
      } else {
        // E-07 FIX: Decrement stock for base products (no formatId)
        const rowsAffected: number = await tx.$executeRaw`
          UPDATE "Product"
          SET "stockQuantity" = "stockQuantity" - ${reservation.quantity},
              "updatedAt" = NOW()
          WHERE id = ${reservation.productId}
            AND "trackInventory" = true
            AND "stockQuantity" >= ${reservation.quantity}
        `;
        if (rowsAffected === 0) {
          logger.warn('[consumeReservation] Insufficient stock for base product', { productId: reservation.productId, requested: reservation.quantity });
        }
      }

      // Get current WAC from pre-fetched map
      const wacKey = `${reservation.productId}:${reservation.formatId || 'null'}`;
      const wac = wacMap.get(wacKey) || 0;

      // Create inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          productId: reservation.productId,
          formatId: reservation.formatId,
          type: 'SALE',
          quantity: -reservation.quantity,
          unitCost: wac,
          runningWAC: wac,
          orderId,
        },
      });
    }
  });
}

/**
 * Record stock purchase (inbound) and recalculate WAC
 * WAC = (existing_qty * existing_wac + new_qty * new_cost) / (existing_qty + new_qty)
 */
export async function purchaseStock(
  items: {
    productId: string;
    formatId?: string;
    quantity: number;
    unitCost: number;
  }[],
  supplierInvoiceId?: string,
  createdBy?: string
): Promise<void> {
  // N+1 FIX: Batch-fetch old stock values for audit logging instead of individual lookups per item
  const oldQuantities: Map<string, number> = new Map();
  const formatIds = items.filter(i => i.formatId).map(i => i.formatId!);
  const productOnlyIds = items.filter(i => !i.formatId).map(i => i.productId);

  const [formats, products] = await Promise.all([
    formatIds.length > 0
      ? prisma.productFormat.findMany({
          where: { id: { in: formatIds } },
          select: { id: true, stockQuantity: true },
        })
      : [],
    productOnlyIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: productOnlyIds } },
          select: { id: true, stockQuantity: true },
        })
      : [],
  ]);

  for (const fmt of formats) oldQuantities.set(fmt.id, fmt.stockQuantity);
  for (const prod of products) oldQuantities.set(prod.id, prod.stockQuantity);

  // Wrap ALL items in a single transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // N+1 FIX: Batch-fetch current stock quantities and WAC for all items before the loop
    // instead of individual findUnique + findFirst per item (was 3 queries per item, now 3 queries total)
    const txFormatIds = items.filter(i => i.formatId).map(i => i.formatId!);
    const txProductOnlyIds = items.filter(i => !i.formatId).map(i => i.productId);

    const [txFormats, txProducts] = await Promise.all([
      txFormatIds.length > 0
        ? tx.productFormat.findMany({
            where: { id: { in: txFormatIds } },
            select: { id: true, stockQuantity: true },
          })
        : [],
      txProductOnlyIds.length > 0
        ? tx.product.findMany({
            where: { id: { in: txProductOnlyIds } },
            select: { id: true, stockQuantity: true },
          })
        : [],
    ]);

    const txFormatQtyMap = new Map(txFormats.map(f => [f.id, f.stockQuantity]));
    const txProductQtyMap = new Map(txProducts.map(p => [p.id, p.stockQuantity]));

    // Batch-fetch WAC for all product/format pairs
    const wacPairs = items.map(i => ({ productId: i.productId, formatId: i.formatId || null }));
    const uniqueWacPairs = Array.from(
      new Map(wacPairs.map(p => [`${p.productId}:${p.formatId || 'null'}`, p])).values()
    );
    const allWacTransactions = await tx.inventoryTransaction.findMany({
      where: {
        OR: uniqueWacPairs.map(p => ({
          productId: p.productId,
          formatId: p.formatId,
        })),
      },
      orderBy: { createdAt: 'desc' },
      select: { productId: true, formatId: true, runningWAC: true, createdAt: true },
    });
    const txWacMap = new Map<string, number>();
    for (const wt of allWacTransactions) {
      const key = `${wt.productId}:${wt.formatId || 'null'}`;
      if (!txWacMap.has(key)) {
        txWacMap.set(key, Number(wt.runningWAC));
      }
    }

    for (const item of items) {
      // Get current stock quantity and WAC from pre-fetched maps
      let currentQty = 0;

      if (item.formatId) {
        currentQty = txFormatQtyMap.get(item.formatId) || 0;
      } else {
        currentQty = txProductQtyMap.get(item.productId) || 0;
      }

      const wacKey = `${item.productId}:${(item.formatId || null) || 'null'}`;
      const currentWAC = txWacMap.get(wacKey) || 0;

      // Calculate new WAC
      const totalCurrentValue = currentQty * currentWAC;
      const newValue = item.quantity * item.unitCost;
      const newTotalQty = currentQty + item.quantity;
      const newWAC = newTotalQty > 0
        ? (totalCurrentValue + newValue) / newTotalQty
        : item.unitCost;

      // Increment stock
      if (item.formatId) {
        await tx.productFormat.update({
          where: { id: item.formatId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      // Create inventory transaction
      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          formatId: item.formatId || null,
          type: 'PURCHASE',
          quantity: item.quantity,
          unitCost: item.unitCost,
          runningWAC: Math.round(newWAC * 10000) / 10000,
          supplierInvoiceId,
          createdBy,
        },
      });
    }
  });

  // Fire-and-forget audit logs after successful transaction
  for (const item of items) {
    const key = item.formatId || item.productId;
    const oldQty = oldQuantities.get(key) || 0;
    logStockChange({
      productId: item.productId,
      formatId: item.formatId || null,
      changeType: 'PURCHASE',
      oldQuantity: oldQty,
      newQuantity: oldQty + item.quantity,
      quantity: item.quantity,
      reason: supplierInvoiceId
        ? `Purchase (invoice: ${supplierInvoiceId})`
        : 'Purchase',
      changedBy: createdBy || null,
    });
  }
}

/**
 * Log a stock change to the AuditLog table for inventory audit trail.
 * Fire-and-forget: errors are logged but do not block the caller.
 */
export function logStockChange(params: {
  productId: string;
  formatId: string | null;
  changeType: string;
  oldQuantity: number;
  newQuantity: number;
  quantity: number;
  reason: string;
  changedBy: string | null;
}): void {
  const { productId, formatId, changeType, oldQuantity, newQuantity, quantity, reason, changedBy } = params;

  prisma.auditLog
    .create({
      data: {
        userId: changedBy,
        action: 'INVENTORY_CHANGE',
        entityType: 'ProductFormat',
        entityId: formatId || productId,
        details: JSON.stringify({
          productId,
          formatId,
          changeType,
          oldQuantity,
          newQuantity,
          quantityChanged: quantity,
          reason,
          changedBy,
          timestamp: new Date().toISOString(),
        }),
      },
    })
    .catch((err) => {
      logger.error('[logStockChange] Failed to write audit log', {
        error: err instanceof Error ? err.message : String(err),
        productId,
        formatId,
      });
    });
}

/**
 * Manual stock adjustment
 * Logs the change in both InventoryTransaction and AuditLog for audit trail.
 */
export async function adjustStock(
  productId: string,
  formatId: string | null,
  quantity: number,
  reason: string,
  createdBy?: string
): Promise<void> {
  // Capture old stock value for audit logging
  let oldQuantity = 0;
  if (formatId) {
    const format = await prisma.productFormat.findUnique({
      where: { id: formatId },
      select: { stockQuantity: true },
    });
    oldQuantity = format?.stockQuantity || 0;
  } else {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stockQuantity: true },
    });
    oldQuantity = product?.stockQuantity || 0;
  }

  await prisma.$transaction(async (tx) => {
    if (formatId) {
      if (quantity > 0) {
        await tx.productFormat.update({
          where: { id: formatId },
          data: { stockQuantity: { increment: quantity } },
        });
      } else {
        // E-08 FIX: Atomic conditional stock decrement — prevents negative inventory
        const absQuantity = Math.abs(quantity);
        const rowsAffected: number = await tx.$executeRaw`
          UPDATE "ProductFormat"
          SET "stockQuantity" = "stockQuantity" - ${absQuantity},
              "updatedAt" = NOW()
          WHERE id = ${formatId}
            AND "stockQuantity" >= ${absQuantity}
        `;
        if (rowsAffected === 0) {
          logger.warn('[adjustStock] Insufficient stock', { formatId, requested: absQuantity });
        }
      }
    } else {
      // E-07 FIX: Adjust stock for base products (no formatId)
      if (quantity > 0) {
        await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: { increment: quantity } },
        });
      } else {
        const absQuantity = Math.abs(quantity);
        const rowsAffected: number = await tx.$executeRaw`
          UPDATE "Product"
          SET "stockQuantity" = "stockQuantity" - ${absQuantity},
              "updatedAt" = NOW()
          WHERE id = ${productId}
            AND "trackInventory" = true
            AND "stockQuantity" >= ${absQuantity}
        `;
        if (rowsAffected === 0) {
          logger.warn('[adjustStock] Insufficient stock for base product', { productId, requested: absQuantity });
        }
      }
    }

    const lastTransaction = await tx.inventoryTransaction.findFirst({
      where: { productId, formatId },
      orderBy: { createdAt: 'desc' },
      select: { runningWAC: true },
    });
    const wac = lastTransaction ? Number(lastTransaction.runningWAC) : 0;

    await tx.inventoryTransaction.create({
      data: {
        productId,
        formatId,
        type: 'ADJUSTMENT',
        quantity,
        unitCost: wac,
        runningWAC: wac,
        reason,
        createdBy,
      },
    });
  });

  // Fire-and-forget audit log for stock change
  const expectedNew = quantity > 0
    ? oldQuantity + quantity
    : Math.max(0, oldQuantity + quantity);

  logStockChange({
    productId,
    formatId,
    changeType: 'ADJUSTMENT',
    oldQuantity,
    newQuantity: expectedNew,
    quantity,
    reason,
    changedBy: createdBy || null,
  });
}

/**
 * Generate COGS journal entry for an order
 * Debit: 5010 (CMV/COGS)
 * Credit: 1210 (Stock)
 */
export async function generateCOGSEntry(orderId: string): Promise<string | null> {
  const transactions = await prisma.inventoryTransaction.findMany({
    where: { orderId, type: 'SALE' },
  });

  if (transactions.length === 0) return null;

  // Calculate total COGS
  let totalCOGS = 0;
  for (const tx of transactions) {
    totalCOGS += Math.abs(tx.quantity) * Number(tx.unitCost);
  }

  if (totalCOGS <= 0) return null;

  totalCOGS = Math.round(totalCOGS * 100) / 100;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true, createdAt: true },
  });

  if (!order) return null;

  // Ensure the accounting period for the order date is open
  await assertPeriodOpen(order.createdAt);

  // N+1 FIX: Batch-fetch both chart accounts in a single query
  // instead of two separate findUnique calls
  const accounts = await prisma.chartOfAccount.findMany({
    where: { code: { in: [ACCOUNT_CODES.PURCHASES, ACCOUNT_CODES.INVENTORY] } },
    select: { id: true, code: true },
  });
  const cogsAccount = accounts.find(a => a.code === ACCOUNT_CODES.PURCHASES);
  const stockAccount = accounts.find(a => a.code === ACCOUNT_CODES.INVENTORY);

  if (!cogsAccount || !stockAccount) {
    logger.error('COGS or Stock account not found in Chart of Accounts');
    return null;
  }

  // Generate entry number
  const year = new Date().getFullYear();
  const count = await prisma.journalEntry.count({
    where: { entryNumber: { startsWith: `JV-${year}-` } },
  });
  const entryNumber = `JV-${year}-${String(count + 1).padStart(4, '0')}`;

  const cogsLines = [
    {
      accountId: cogsAccount.id,
      description: `Coût des marchandises vendues ${order.orderNumber}`,
      debit: totalCOGS,
      credit: 0,
    },
    {
      accountId: stockAccount.id,
      description: `Sortie de stock ${order.orderNumber}`,
      debit: 0,
      credit: totalCOGS,
    },
  ];
  assertJournalBalance(cogsLines, `COGS ${order.orderNumber}`);

  const entry = await prisma.journalEntry.create({
    data: {
      entryNumber,
      date: order.createdAt,
      description: `CMV - Commande ${order.orderNumber}`,
      type: 'AUTO_SALE',
      status: 'POSTED',
      reference: `COGS-${order.orderNumber}`,
      orderId,
      createdBy: 'system',
      postedBy: 'system',
      postedAt: new Date(),
      lines: { create: cogsLines },
    },
  });

  return entry.id;
}

/**
 * Get inventory summary for admin
 */
export async function getInventorySummary() {
  const formats = await prisma.productFormat.findMany({
    where: { trackInventory: true, isActive: true },
    include: {
      product: {
        select: { name: true, sku: true },
      },
    },
    orderBy: { stockQuantity: 'asc' },
  });

  return formats.map((f) => {
    // Get the latest WAC (would be cached in production)
    return {
      id: f.id,
      productId: f.productId,
      productName: f.product.name,
      formatName: f.name,
      sku: f.sku,
      stockQuantity: f.stockQuantity,
      lowStockThreshold: f.lowStockThreshold,
      isLowStock: f.stockQuantity <= f.lowStockThreshold,
      availability: f.availability,
    };
  });
}
