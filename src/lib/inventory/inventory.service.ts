/**
 * Inventory Service
 * Manages stock reservations, consumption, WAC calculation, and COGS entries
 */

import { prisma } from '@/lib/db';
import { ACCOUNT_CODES } from '@/lib/accounting/types';

/**
 * Reserve stock for a checkout session
 * Creates InventoryReservation records and temporarily holds stock
 */
export async function reserveStock(
  items: { productId: string; formatId?: string; quantity: number }[],
  cartId: string,
  ttlMinutes = 30
): Promise<string[]> {
  const reservationIds: string[] = [];
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  for (const item of items) {
    // Check available stock (total - reserved)
    if (item.formatId) {
      const format = await prisma.productFormat.findUnique({
        where: { id: item.formatId },
        select: { stockQuantity: true, trackInventory: true },
      });

      if (format?.trackInventory) {
        const reservedQty = await prisma.inventoryReservation.aggregate({
          where: {
            formatId: item.formatId,
            status: 'RESERVED',
            expiresAt: { gt: new Date() },
          },
          _sum: { quantity: true },
        });

        const available = format.stockQuantity - (reservedQty._sum.quantity || 0);
        if (available < item.quantity) {
          // Rollback previous reservations
          if (reservationIds.length > 0) {
            await prisma.inventoryReservation.updateMany({
              where: { id: { in: reservationIds } },
              data: { status: 'RELEASED', releasedAt: new Date() },
            });
          }
          throw new Error(
            `Stock insuffisant pour format ${item.formatId}: demandé ${item.quantity}, disponible ${available}`
          );
        }
      }
    }

    const reservation = await prisma.inventoryReservation.create({
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
 */
export async function consumeReservation(
  orderId: string,
  cartId?: string
): Promise<void> {
  const where: Record<string, unknown> = { status: 'RESERVED' as const };
  if (cartId) where.cartId = cartId;
  else where.orderId = orderId;

  const reservations = await prisma.inventoryReservation.findMany({ where });

  for (const reservation of reservations) {
    await prisma.$transaction(async (tx) => {
      // Mark reservation as consumed
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: 'CONSUMED', orderId, consumedAt: new Date() },
      });

      // Decrement stock
      if (reservation.formatId) {
        await tx.productFormat.update({
          where: { id: reservation.formatId },
          data: { stockQuantity: { decrement: reservation.quantity } },
        });
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
    });
  }
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
        await tx.productFormat.update({
          where: { id: formatId },
          data: { stockQuantity: { decrement: Math.abs(quantity) } },
        });
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
    console.error('COGS or Stock account not found in Chart of Accounts');
    return null;
  }

  // Generate entry number
  const year = new Date().getFullYear();
  const count = await prisma.journalEntry.count({
    where: { entryNumber: { startsWith: `JV-${year}-` } },
  });
  const entryNumber = `JV-${year}-${String(count + 1).padStart(4, '0')}`;

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
      lines: {
        create: [
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
        ],
      },
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
