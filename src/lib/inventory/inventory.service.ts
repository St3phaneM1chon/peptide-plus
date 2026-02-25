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

  // Wrap entire reservation in a single transaction to prevent race conditions
  return prisma.$transaction(async (tx) => {
    const reservationIds: string[] = [];

    for (const item of items) {
      // Check available stock (total - reserved) atomically within transaction
      if (item.formatId) {
        const format = await tx.productFormat.findUnique({
          where: { id: item.formatId },
          select: { stockQuantity: true, trackInventory: true },
        });

        if (format?.trackInventory) {
          const reservedQty = await tx.inventoryReservation.aggregate({
            where: {
              formatId: item.formatId,
              status: 'RESERVED',
              expiresAt: { gt: new Date() },
            },
            _sum: { quantity: true },
          });

          const available = format.stockQuantity - (reservedQty._sum.quantity || 0);
          if (available < item.quantity) {
            throw new Error(
              `Stock insuffisant pour format ${item.formatId}: demandé ${item.quantity}, disponible ${available}`
            );
          }
        }
      } else {
        // E-07 FIX: Check stock for base products (no formatId)
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true, trackInventory: true },
        });

        if (product?.trackInventory) {
          const reservedQty = await tx.inventoryReservation.aggregate({
            where: {
              productId: item.productId,
              formatId: null,
              status: 'RESERVED',
              expiresAt: { gt: new Date() },
            },
            _sum: { quantity: true },
          });

          const available = product.stockQuantity - (reservedQty._sum.quantity || 0);
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

      // Get current WAC for this product/format
      const lastTransaction = await tx.inventoryTransaction.findFirst({
        where: {
          productId: reservation.productId,
          formatId: reservation.formatId,
        },
        orderBy: { createdAt: 'desc' },
        select: { runningWAC: true },
      });
      const wac = lastTransaction ? Number(lastTransaction.runningWAC) : 0;

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
  for (const item of items) {
    await prisma.$transaction(async (tx) => {
      // Get current stock quantity and WAC
      let currentQty = 0;
      let currentWAC = 0;

      if (item.formatId) {
        const format = await tx.productFormat.findUnique({
          where: { id: item.formatId },
          select: { stockQuantity: true },
        });
        currentQty = format?.stockQuantity || 0;
      } else {
        // E-07 FIX: Get current stock for base products
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true },
        });
        currentQty = product?.stockQuantity || 0;
      }

      const lastTransaction = await tx.inventoryTransaction.findFirst({
        where: {
          productId: item.productId,
          formatId: item.formatId || null,
        },
        orderBy: { createdAt: 'desc' },
        select: { runningWAC: true },
      });
      currentWAC = lastTransaction ? Number(lastTransaction.runningWAC) : 0;

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
        // E-07 FIX: Increment stock for base products
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
    });
  }
}

/**
 * Manual stock adjustment
 */
export async function adjustStock(
  productId: string,
  formatId: string | null,
  quantity: number,
  reason: string,
  createdBy?: string
): Promise<void> {
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

  // Get account IDs
  const cogsAccount = await prisma.chartOfAccount.findUnique({
    where: { code: ACCOUNT_CODES.PURCHASES },
    select: { id: true },
  });
  const stockAccount = await prisma.chartOfAccount.findUnique({
    where: { code: ACCOUNT_CODES.INVENTORY },
    select: { id: true },
  });

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
