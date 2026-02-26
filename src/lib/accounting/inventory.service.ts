/**
 * INVENTORY SERVICE - Advanced Inventory Management
 *
 * Full inventory service supporting:
 * - Multi-warehouse stock management
 * - Cost methods: FIFO, LIFO, WAC (Weighted Average Cost)
 * - Stock movements (IN, OUT, ADJUSTMENT, TRANSFER, RETURN, PRODUCTION, CONSUMPTION)
 * - Inter-warehouse transfers with status tracking
 * - Reorder alerts with configurable thresholds
 * - Stock reservations for pending orders
 * - Comprehensive valuation reporting
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MovementType =
  | 'IN'
  | 'OUT'
  | 'ADJUSTMENT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RETURN'
  | 'PRODUCTION'
  | 'CONSUMPTION';

export type ReferenceType =
  | 'ORDER'
  | 'PURCHASE_ORDER'
  | 'TRANSFER'
  | 'MANUAL'
  | 'PRODUCTION';

export type CostMethod = 'FIFO' | 'LIFO' | 'WAC';

export type TransferStatus = 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface StockLevelFilters {
  warehouseId?: string;
  productId?: string;
  belowReorder?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface MovementHistoryFilters {
  productId?: string;
  warehouseId?: string;
  type?: MovementType;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface TransferItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
}

export interface ReorderAlert {
  productId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  currentQty: number;
  reservedQty: number;
  availableQty: number;
  reorderPoint: number;
  reorderQty: number | null;
  deficit: number;
  unitCost: number;
}

export interface ValuationLine {
  productId: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  costMethod: string;
}

export interface ValuationReport {
  lines: ValuationLine[];
  totalValue: number;
  totalItems: number;
  byWarehouse: { warehouseId: string; warehouseName: string; value: number; items: number }[];
  generatedAt: Date;
  costMethod: CostMethod;
}

// ---------------------------------------------------------------------------
// getStockLevels
// ---------------------------------------------------------------------------

export async function getStockLevels(filters: StockLevelFilters = {}) {
  const {
    warehouseId,
    productId,
    belowReorder,
    search,
    page = 1,
    limit = 50,
  } = filters;

  const where: Prisma.StockLevelWhereInput = {};

  if (warehouseId) where.warehouseId = warehouseId;
  if (productId) where.productId = productId;

  if (belowReorder) {
    // Only return items where quantity < reorderPoint
    // We use a raw filter because Prisma doesn't natively support cross-column comparison
    where.AND = [
      { reorderPoint: { not: null } },
      // We'll filter in application layer since Prisma doesn't support col-to-col comparison easily
    ];
  }

  if (search) {
    where.productId = { contains: search, mode: 'insensitive' };
  }

  const [levels, total] = await Promise.all([
    prisma.stockLevel.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true, isActive: true } },
      },
      orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockLevel.count({ where }),
  ]);

  // Application-layer filter for belowReorder
  let filteredLevels = levels;
  if (belowReorder) {
    filteredLevels = levels.filter((sl) => {
      if (!sl.reorderPoint) return false;
      return Number(sl.quantity) < Number(sl.reorderPoint);
    });
  }

  return {
    levels: filteredLevels.map((sl) => ({
      ...sl,
      quantity: Number(sl.quantity),
      reservedQty: Number(sl.reservedQty),
      reorderPoint: sl.reorderPoint ? Number(sl.reorderPoint) : null,
      reorderQty: sl.reorderQty ? Number(sl.reorderQty) : null,
      maxStock: sl.maxStock ? Number(sl.maxStock) : null,
      unitCost: Number(sl.unitCost),
      totalValue: Number(sl.totalValue),
    })),
    pagination: {
      page,
      limit,
      total: belowReorder ? filteredLevels.length : total,
      pages: Math.ceil((belowReorder ? filteredLevels.length : total) / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// getStockValue
// ---------------------------------------------------------------------------

export async function getStockValue(warehouseId?: string, costMethod?: CostMethod) {
  const where: Prisma.StockLevelWhereInput = {};
  if (warehouseId) where.warehouseId = warehouseId;
  if (costMethod) where.costMethod = costMethod;

  const aggregate = await prisma.stockLevel.aggregate({
    where,
    _sum: { totalValue: true, quantity: true },
    _count: { id: true },
  });

  return {
    totalValue: Number(aggregate._sum.totalValue ?? 0),
    totalQuantity: Number(aggregate._sum.quantity ?? 0),
    itemCount: aggregate._count.id,
  };
}

// ---------------------------------------------------------------------------
// recordMovement
// ---------------------------------------------------------------------------

export async function recordMovement(params: {
  productId: string;
  warehouseId: string;
  type: MovementType;
  quantity: number;
  unitCost: number;
  reference?: string;
  referenceType?: ReferenceType;
  notes?: string;
  createdBy?: string;
}) {
  const {
    productId,
    warehouseId,
    type,
    quantity,
    unitCost,
    reference,
    referenceType,
    notes,
    createdBy,
  } = params;

  if (quantity <= 0) {
    throw new Error('Quantity must be greater than 0');
  }

  const totalCost = quantity * unitCost;

  return await prisma.$transaction(async (tx) => {
    // Create the movement record
    const movement = await tx.stockMovement.create({
      data: {
        productId,
        warehouseId,
        type,
        quantity: new Prisma.Decimal(quantity),
        unitCost: new Prisma.Decimal(unitCost),
        totalCost: new Prisma.Decimal(totalCost),
        reference: reference || null,
        referenceType: referenceType || null,
        notes: notes || null,
        createdBy: createdBy || null,
      },
    });

    // Update stock level
    const existingLevel = await tx.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    const isInbound = ['IN', 'TRANSFER_IN', 'RETURN', 'PRODUCTION'].includes(type);
    const isOutbound = ['OUT', 'TRANSFER_OUT', 'CONSUMPTION'].includes(type);

    let newQuantity: number;
    let newUnitCost: number;

    if (existingLevel) {
      const currentQty = Number(existingLevel.quantity);
      const currentUnitCost = Number(existingLevel.unitCost);

      if (isInbound) {
        newQuantity = currentQty + quantity;
        // Weighted average cost for inbound
        if (newQuantity > 0) {
          newUnitCost = ((currentQty * currentUnitCost) + (quantity * unitCost)) / newQuantity;
        } else {
          newUnitCost = unitCost;
        }
      } else if (isOutbound) {
        newQuantity = currentQty - quantity;
        if (newQuantity < 0) {
          throw new Error(`Insufficient stock. Available: ${currentQty}, Requested: ${quantity}`);
        }
        newUnitCost = currentUnitCost; // Keep existing unit cost on outbound
      } else {
        // ADJUSTMENT - handled separately via adjustStock
        newQuantity = currentQty;
        newUnitCost = currentUnitCost;
      }

      await tx.stockLevel.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: {
          quantity: new Prisma.Decimal(newQuantity),
          unitCost: new Prisma.Decimal(newUnitCost),
          totalValue: new Prisma.Decimal(newQuantity * newUnitCost),
        },
      });
    } else {
      // Create new stock level
      if (isOutbound) {
        throw new Error('Cannot record outbound movement for product with no stock level');
      }

      newQuantity = isInbound ? quantity : 0;
      newUnitCost = unitCost;

      await tx.stockLevel.create({
        data: {
          productId,
          warehouseId,
          quantity: new Prisma.Decimal(newQuantity),
          unitCost: new Prisma.Decimal(newUnitCost),
          totalValue: new Prisma.Decimal(newQuantity * newUnitCost),
          costMethod: 'WAC',
        },
      });
    }

    return {
      movement: {
        ...movement,
        quantity: Number(movement.quantity),
        unitCost: Number(movement.unitCost),
        totalCost: Number(movement.totalCost),
      },
      newStockLevel: {
        quantity: newQuantity,
        unitCost: newUnitCost,
        totalValue: newQuantity * newUnitCost,
      },
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

// ---------------------------------------------------------------------------
// adjustStock (physical count adjustment)
// ---------------------------------------------------------------------------

export async function adjustStock(params: {
  productId: string;
  warehouseId: string;
  newQuantity: number;
  reason: string;
  createdBy?: string;
}) {
  const { productId, warehouseId, newQuantity, reason, createdBy } = params;

  if (newQuantity < 0) {
    throw new Error('New quantity cannot be negative');
  }

  if (!reason.trim()) {
    throw new Error('Adjustment reason is required');
  }

  return await prisma.$transaction(async (tx) => {
    const existingLevel = await tx.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    const currentQty = existingLevel ? Number(existingLevel.quantity) : 0;
    const currentUnitCost = existingLevel ? Number(existingLevel.unitCost) : 0;
    const adjustmentQty = newQuantity - currentQty;

    if (adjustmentQty === 0) {
      return { adjusted: false, message: 'No adjustment needed - quantity unchanged' };
    }

    // Create adjustment movement
    const movement = await tx.stockMovement.create({
      data: {
        productId,
        warehouseId,
        type: 'ADJUSTMENT',
        quantity: new Prisma.Decimal(Math.abs(adjustmentQty)),
        unitCost: new Prisma.Decimal(currentUnitCost),
        totalCost: new Prisma.Decimal(Math.abs(adjustmentQty) * currentUnitCost),
        referenceType: 'MANUAL',
        notes: `Physical count adjustment: ${currentQty} -> ${newQuantity}. Reason: ${reason}`,
        createdBy: createdBy || null,
      },
    });

    // Update or create stock level
    if (existingLevel) {
      await tx.stockLevel.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: {
          quantity: new Prisma.Decimal(newQuantity),
          totalValue: new Prisma.Decimal(newQuantity * currentUnitCost),
          lastCountDate: new Date(),
        },
      });
    } else {
      await tx.stockLevel.create({
        data: {
          productId,
          warehouseId,
          quantity: new Prisma.Decimal(newQuantity),
          unitCost: new Prisma.Decimal(0),
          totalValue: new Prisma.Decimal(0),
          costMethod: 'WAC',
          lastCountDate: new Date(),
        },
      });
    }

    return {
      adjusted: true,
      movement: {
        ...movement,
        quantity: Number(movement.quantity),
        unitCost: Number(movement.unitCost),
        totalCost: Number(movement.totalCost),
      },
      previousQty: currentQty,
      newQty: newQuantity,
      adjustmentQty,
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

// ---------------------------------------------------------------------------
// createTransfer
// ---------------------------------------------------------------------------

async function generateTransferNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `TRF-${year}-`;

  const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
    SELECT MAX("transferNumber") as max_num
    FROM "StockTransfer"
    WHERE "transferNumber" LIKE ${prefix + '%'}
    FOR UPDATE
  `;

  let nextSeq = 1;
  if (maxRow?.max_num) {
    const parts = maxRow.max_num.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

export async function createTransfer(params: {
  fromWarehouseId: string;
  toWarehouseId: string;
  items: TransferItem[];
  notes?: string;
  createdBy?: string;
}) {
  const { fromWarehouseId, toWarehouseId, items, notes, createdBy } = params;

  if (fromWarehouseId === toWarehouseId) {
    throw new Error('Source and destination warehouses must be different');
  }

  if (!items.length) {
    throw new Error('At least one item is required for a transfer');
  }

  // Validate warehouses exist and are active
  const [fromWh, toWh] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: fromWarehouseId } }),
    prisma.warehouse.findUnique({ where: { id: toWarehouseId } }),
  ]);

  if (!fromWh || fromWh.deletedAt) throw new Error('Source warehouse not found');
  if (!toWh || toWh.deletedAt) throw new Error('Destination warehouse not found');
  if (!fromWh.isActive) throw new Error('Source warehouse is inactive');
  if (!toWh.isActive) throw new Error('Destination warehouse is inactive');

  return await prisma.$transaction(async (tx) => {
    const transferNumber = await generateTransferNumber(tx);

    // Validate stock levels for all items
    for (const item of items) {
      const stockLevel = await tx.stockLevel.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: fromWarehouseId } },
      });

      const available = stockLevel
        ? Number(stockLevel.quantity) - Number(stockLevel.reservedQty)
        : 0;

      if (available < item.quantity) {
        throw new Error(
          `Insufficient stock for product ${item.productName}. Available: ${available}, Requested: ${item.quantity}`
        );
      }
    }

    // Create transfer
    const transfer = await tx.stockTransfer.create({
      data: {
        transferNumber,
        fromWarehouseId,
        toWarehouseId,
        status: 'PENDING',
        notes: notes || null,
        createdBy: createdBy || null,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: new Prisma.Decimal(item.quantity),
            unitCost: new Prisma.Decimal(item.unitCost),
          })),
        },
      },
      include: {
        items: true,
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
      },
    });

    // Create TRANSFER_OUT movements and deduct stock from source
    for (const item of items) {
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          warehouseId: fromWarehouseId,
          type: 'TRANSFER_OUT',
          quantity: new Prisma.Decimal(item.quantity),
          unitCost: new Prisma.Decimal(item.unitCost),
          totalCost: new Prisma.Decimal(item.quantity * item.unitCost),
          reference: transfer.id,
          referenceType: 'TRANSFER',
          notes: `Transfer to ${toWh.name} (${transferNumber})`,
          createdBy: createdBy || null,
        },
      });

      // Deduct from source warehouse
      const sourceLevel = await tx.stockLevel.findUnique({
        where: { productId_warehouseId: { productId: item.productId, warehouseId: fromWarehouseId } },
      });

      if (sourceLevel) {
        const newQty = Number(sourceLevel.quantity) - item.quantity;
        const unitCostVal = Number(sourceLevel.unitCost);
        await tx.stockLevel.update({
          where: { productId_warehouseId: { productId: item.productId, warehouseId: fromWarehouseId } },
          data: {
            quantity: new Prisma.Decimal(newQty),
            totalValue: new Prisma.Decimal(newQty * unitCostVal),
          },
        });
      }
    }

    // Update status to IN_TRANSIT and record shipped time
    const updated = await tx.stockTransfer.update({
      where: { id: transfer.id },
      data: { status: 'IN_TRANSIT', shippedAt: new Date() },
      include: {
        items: true,
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      ...updated,
      items: updated.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      })),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

// ---------------------------------------------------------------------------
// completeTransfer
// ---------------------------------------------------------------------------

export async function completeTransfer(transferId: string, receivedBy?: string) {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: {
      items: true,
      fromWarehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
    },
  });

  if (!transfer) throw new Error('Transfer not found');
  if (transfer.status === 'COMPLETED') throw new Error('Transfer already completed');
  if (transfer.status === 'CANCELLED') throw new Error('Transfer was cancelled');
  if (transfer.status !== 'IN_TRANSIT') throw new Error('Transfer must be in transit to complete');

  return await prisma.$transaction(async (tx) => {
    // Create TRANSFER_IN movements and add stock to destination
    for (const item of transfer.items) {
      const qty = Number(item.quantity);
      const cost = Number(item.unitCost);

      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          warehouseId: transfer.toWarehouseId,
          type: 'TRANSFER_IN',
          quantity: new Prisma.Decimal(qty),
          unitCost: new Prisma.Decimal(cost),
          totalCost: new Prisma.Decimal(qty * cost),
          reference: transfer.id,
          referenceType: 'TRANSFER',
          notes: `Transfer from ${transfer.fromWarehouse.name} (${transfer.transferNumber})`,
          createdBy: receivedBy || null,
        },
      });

      // Upsert destination stock level with WAC
      const destLevel = await tx.stockLevel.findUnique({
        where: {
          productId_warehouseId: {
            productId: item.productId,
            warehouseId: transfer.toWarehouseId,
          },
        },
      });

      if (destLevel) {
        const existingQty = Number(destLevel.quantity);
        const existingCost = Number(destLevel.unitCost);
        const newQty = existingQty + qty;
        const newCost = newQty > 0
          ? ((existingQty * existingCost) + (qty * cost)) / newQty
          : cost;

        await tx.stockLevel.update({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: transfer.toWarehouseId,
            },
          },
          data: {
            quantity: new Prisma.Decimal(newQty),
            unitCost: new Prisma.Decimal(newCost),
            totalValue: new Prisma.Decimal(newQty * newCost),
          },
        });
      } else {
        await tx.stockLevel.create({
          data: {
            productId: item.productId,
            warehouseId: transfer.toWarehouseId,
            quantity: new Prisma.Decimal(qty),
            unitCost: new Prisma.Decimal(cost),
            totalValue: new Prisma.Decimal(qty * cost),
            costMethod: 'WAC',
          },
        });
      }
    }

    // Mark transfer as completed
    const completed = await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'COMPLETED', receivedAt: new Date() },
      include: {
        items: true,
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      ...completed,
      items: completed.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      })),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

// ---------------------------------------------------------------------------
// cancelTransfer
// ---------------------------------------------------------------------------

export async function cancelTransfer(transferId: string, cancelledBy?: string) {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: transferId },
    include: { items: true, fromWarehouse: { select: { name: true } } },
  });

  if (!transfer) throw new Error('Transfer not found');
  if (transfer.status === 'COMPLETED') throw new Error('Cannot cancel a completed transfer');
  if (transfer.status === 'CANCELLED') throw new Error('Transfer already cancelled');

  return await prisma.$transaction(async (tx) => {
    // If IN_TRANSIT, return stock to source warehouse
    if (transfer.status === 'IN_TRANSIT') {
      for (const item of transfer.items) {
        const qty = Number(item.quantity);
        const cost = Number(item.unitCost);

        // Create reversal movement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: transfer.fromWarehouseId,
            type: 'TRANSFER_IN',
            quantity: new Prisma.Decimal(qty),
            unitCost: new Prisma.Decimal(cost),
            totalCost: new Prisma.Decimal(qty * cost),
            reference: transfer.id,
            referenceType: 'TRANSFER',
            notes: `Transfer cancelled - stock returned (${transfer.transferNumber})`,
            createdBy: cancelledBy || null,
          },
        });

        // Return stock to source
        const sourceLevel = await tx.stockLevel.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: transfer.fromWarehouseId,
            },
          },
        });

        if (sourceLevel) {
          const existingQty = Number(sourceLevel.quantity);
          const existingCost = Number(sourceLevel.unitCost);
          const newQty = existingQty + qty;
          const newCost = newQty > 0
            ? ((existingQty * existingCost) + (qty * cost)) / newQty
            : cost;

          await tx.stockLevel.update({
            where: {
              productId_warehouseId: {
                productId: item.productId,
                warehouseId: transfer.fromWarehouseId,
              },
            },
            data: {
              quantity: new Prisma.Decimal(newQty),
              unitCost: new Prisma.Decimal(newCost),
              totalValue: new Prisma.Decimal(newQty * newCost),
            },
          });
        }
      }
    }

    const cancelled = await tx.stockTransfer.update({
      where: { id: transferId },
      data: { status: 'CANCELLED' },
      include: {
        items: true,
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      ...cancelled,
      items: cancelled.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      })),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

// ---------------------------------------------------------------------------
// getReorderAlerts
// ---------------------------------------------------------------------------

export async function getReorderAlerts(): Promise<ReorderAlert[]> {
  const levels = await prisma.stockLevel.findMany({
    where: {
      reorderPoint: { not: null },
      warehouse: { isActive: true, deletedAt: null },
    },
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
    },
  });

  const alerts: ReorderAlert[] = [];

  for (const level of levels) {
    const qty = Number(level.quantity);
    const reserved = Number(level.reservedQty);
    const reorderPoint = Number(level.reorderPoint!);
    const available = qty - reserved;

    if (available <= reorderPoint) {
      alerts.push({
        productId: level.productId,
        warehouseId: level.warehouseId,
        warehouseName: level.warehouse.name,
        warehouseCode: level.warehouse.code,
        currentQty: qty,
        reservedQty: reserved,
        availableQty: available,
        reorderPoint,
        reorderQty: level.reorderQty ? Number(level.reorderQty) : null,
        deficit: reorderPoint - available,
        unitCost: Number(level.unitCost),
      });
    }
  }

  // Sort by deficit descending (most urgent first)
  alerts.sort((a, b) => b.deficit - a.deficit);

  return alerts;
}

// ---------------------------------------------------------------------------
// Cost Calculation Methods
// ---------------------------------------------------------------------------

/**
 * Calculate Weighted Average Cost (WAC) for a product in a warehouse.
 * WAC = (Total Cost of all IN movements) / (Total Quantity of all IN movements)
 */
export async function calculateWAC(productId: string, warehouseId: string): Promise<number> {
  const movements = await prisma.stockMovement.findMany({
    where: {
      productId,
      warehouseId,
      type: { in: ['IN', 'TRANSFER_IN', 'RETURN', 'PRODUCTION'] },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (movements.length === 0) return 0;

  let totalCost = 0;
  let totalQty = 0;

  for (const m of movements) {
    const qty = Number(m.quantity);
    const cost = Number(m.unitCost);
    totalCost += qty * cost;
    totalQty += qty;
  }

  return totalQty > 0 ? totalCost / totalQty : 0;
}

/**
 * Calculate FIFO (First In, First Out) cost for remaining inventory.
 * Works through IN movements chronologically, consuming quantities as OUT movements occur.
 * Returns the unit cost of the remaining inventory.
 */
export async function calculateFIFO(productId: string, warehouseId: string): Promise<number> {
  const [inMovements, outMovements] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        productId,
        warehouseId,
        type: { in: ['IN', 'TRANSFER_IN', 'RETURN', 'PRODUCTION'] },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.stockMovement.findMany({
      where: {
        productId,
        warehouseId,
        type: { in: ['OUT', 'TRANSFER_OUT', 'CONSUMPTION'] },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Build FIFO layers (oldest first)
  const layers: { qty: number; cost: number }[] = inMovements.map((m) => ({
    qty: Number(m.quantity),
    cost: Number(m.unitCost),
  }));

  // Also account for adjustment movements
  const adjustments = await prisma.stockMovement.findMany({
    where: { productId, warehouseId, type: 'ADJUSTMENT' },
    orderBy: { createdAt: 'asc' },
  });

  for (const adj of adjustments) {
    layers.push({ qty: Number(adj.quantity), cost: Number(adj.unitCost) });
  }

  // Consume from oldest layers first (FIFO)
  let totalConsumed = outMovements.reduce((sum, m) => sum + Number(m.quantity), 0);

  for (const layer of layers) {
    if (totalConsumed <= 0) break;
    const consumed = Math.min(layer.qty, totalConsumed);
    layer.qty -= consumed;
    totalConsumed -= consumed;
  }

  // Calculate cost of remaining inventory
  const remainingLayers = layers.filter((l) => l.qty > 0);
  if (remainingLayers.length === 0) return 0;

  const totalRemainingCost = remainingLayers.reduce((sum, l) => sum + l.qty * l.cost, 0);
  const totalRemainingQty = remainingLayers.reduce((sum, l) => sum + l.qty, 0);

  return totalRemainingQty > 0 ? totalRemainingCost / totalRemainingQty : 0;
}

/**
 * Calculate LIFO (Last In, First Out) cost for remaining inventory.
 * Works through IN movements in reverse chronological order, consuming quantities as OUT movements occur.
 * Returns the unit cost of the remaining inventory.
 */
export async function calculateLIFO(productId: string, warehouseId: string): Promise<number> {
  const [inMovements, outMovements] = await Promise.all([
    prisma.stockMovement.findMany({
      where: {
        productId,
        warehouseId,
        type: { in: ['IN', 'TRANSFER_IN', 'RETURN', 'PRODUCTION'] },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.stockMovement.findMany({
      where: {
        productId,
        warehouseId,
        type: { in: ['OUT', 'TRANSFER_OUT', 'CONSUMPTION'] },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Build LIFO layers (newest first for consumption)
  const layers: { qty: number; cost: number }[] = inMovements.map((m) => ({
    qty: Number(m.quantity),
    cost: Number(m.unitCost),
  }));

  // Also account for adjustment movements
  const adjustments = await prisma.stockMovement.findMany({
    where: { productId, warehouseId, type: 'ADJUSTMENT' },
    orderBy: { createdAt: 'asc' },
  });

  for (const adj of adjustments) {
    layers.push({ qty: Number(adj.quantity), cost: Number(adj.unitCost) });
  }

  // Consume from newest layers first (LIFO) - reverse the array
  let totalConsumed = outMovements.reduce((sum, m) => sum + Number(m.quantity), 0);

  for (let i = layers.length - 1; i >= 0; i--) {
    if (totalConsumed <= 0) break;
    const consumed = Math.min(layers[i].qty, totalConsumed);
    layers[i].qty -= consumed;
    totalConsumed -= consumed;
  }

  // Calculate cost of remaining inventory
  const remainingLayers = layers.filter((l) => l.qty > 0);
  if (remainingLayers.length === 0) return 0;

  const totalRemainingCost = remainingLayers.reduce((sum, l) => sum + l.qty * l.cost, 0);
  const totalRemainingQty = remainingLayers.reduce((sum, l) => sum + l.qty, 0);

  return totalRemainingQty > 0 ? totalRemainingCost / totalRemainingQty : 0;
}

// ---------------------------------------------------------------------------
// getMovementHistory
// ---------------------------------------------------------------------------

export async function getMovementHistory(filters: MovementHistoryFilters = {}) {
  const {
    productId,
    warehouseId,
    type,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = filters;

  const where: Prisma.StockMovementWhereInput = {};

  if (productId) where.productId = productId;
  if (warehouseId) where.warehouseId = warehouseId;
  if (type) where.type = type;

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    movements: movements.map((m) => ({
      ...m,
      quantity: Number(m.quantity),
      unitCost: Number(m.unitCost),
      totalCost: Number(m.totalCost),
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// ---------------------------------------------------------------------------
// getInventoryValuationReport
// ---------------------------------------------------------------------------

export async function getInventoryValuationReport(
  warehouseId?: string,
  costMethod: CostMethod = 'WAC'
): Promise<ValuationReport> {
  const where: Prisma.StockLevelWhereInput = {
    warehouse: { isActive: true, deletedAt: null },
  };
  if (warehouseId) where.warehouseId = warehouseId;

  const levels = await prisma.stockLevel.findMany({
    where,
    include: {
      warehouse: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
  });

  const lines: ValuationLine[] = [];

  for (const level of levels) {
    const qty = Number(level.quantity);
    if (qty <= 0) continue;

    let unitCost: number;

    switch (costMethod) {
      case 'FIFO':
        unitCost = await calculateFIFO(level.productId, level.warehouseId);
        break;
      case 'LIFO':
        unitCost = await calculateLIFO(level.productId, level.warehouseId);
        break;
      case 'WAC':
      default:
        unitCost = await calculateWAC(level.productId, level.warehouseId);
        // If WAC returns 0 but we have a stored unit cost, use that
        if (unitCost === 0 && Number(level.unitCost) > 0) {
          unitCost = Number(level.unitCost);
        }
        break;
    }

    const totalValue = qty * unitCost;

    lines.push({
      productId: level.productId,
      warehouseId: level.warehouseId,
      warehouseName: level.warehouse.name,
      warehouseCode: level.warehouse.code,
      quantity: qty,
      unitCost: Math.round(unitCost * 10000) / 10000,
      totalValue: Math.round(totalValue * 100) / 100,
      costMethod,
    });
  }

  // Aggregate by warehouse
  const warehouseMap = new Map<string, { warehouseId: string; warehouseName: string; value: number; items: number }>();
  for (const line of lines) {
    const existing = warehouseMap.get(line.warehouseId);
    if (existing) {
      existing.value += line.totalValue;
      existing.items += 1;
    } else {
      warehouseMap.set(line.warehouseId, {
        warehouseId: line.warehouseId,
        warehouseName: line.warehouseName,
        value: line.totalValue,
        items: 1,
      });
    }
  }

  return {
    lines,
    totalValue: Math.round(lines.reduce((sum, l) => sum + l.totalValue, 0) * 100) / 100,
    totalItems: lines.length,
    byWarehouse: Array.from(warehouseMap.values()),
    generatedAt: new Date(),
    costMethod,
  };
}

// ---------------------------------------------------------------------------
// reserveStock
// ---------------------------------------------------------------------------

export async function reserveStock(params: {
  productId: string;
  warehouseId: string;
  quantity: number;
}) {
  const { productId, warehouseId, quantity } = params;

  if (quantity <= 0) throw new Error('Reserve quantity must be positive');

  return await prisma.$transaction(async (tx) => {
    const level = await tx.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    if (!level) throw new Error('Stock level not found for this product/warehouse');

    const currentQty = Number(level.quantity);
    const currentReserved = Number(level.reservedQty);
    const available = currentQty - currentReserved;

    if (available < quantity) {
      throw new Error(`Insufficient available stock. Available: ${available}, Requested: ${quantity}`);
    }

    const updated = await tx.stockLevel.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: {
        reservedQty: new Prisma.Decimal(currentReserved + quantity),
      },
    });

    return {
      productId,
      warehouseId,
      reservedQty: Number(updated.reservedQty),
      availableQty: Number(updated.quantity) - Number(updated.reservedQty),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

// ---------------------------------------------------------------------------
// releaseReservation
// ---------------------------------------------------------------------------

export async function releaseReservation(params: {
  productId: string;
  warehouseId: string;
  quantity: number;
}) {
  const { productId, warehouseId, quantity } = params;

  if (quantity <= 0) throw new Error('Release quantity must be positive');

  return await prisma.$transaction(async (tx) => {
    const level = await tx.stockLevel.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    if (!level) throw new Error('Stock level not found for this product/warehouse');

    const currentReserved = Number(level.reservedQty);

    if (currentReserved < quantity) {
      throw new Error(`Cannot release more than reserved. Reserved: ${currentReserved}, Release requested: ${quantity}`);
    }

    const updated = await tx.stockLevel.update({
      where: { productId_warehouseId: { productId, warehouseId } },
      data: {
        reservedQty: new Prisma.Decimal(currentReserved - quantity),
      },
    });

    return {
      productId,
      warehouseId,
      reservedQty: Number(updated.reservedQty),
      availableQty: Number(updated.quantity) - Number(updated.reservedQty),
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

// ---------------------------------------------------------------------------
// Warehouse CRUD helpers
// ---------------------------------------------------------------------------

export async function getWarehouses(includeInactive = false) {
  const where: Prisma.WarehouseWhereInput = { deletedAt: null };
  if (!includeInactive) where.isActive = true;

  return prisma.warehouse.findMany({
    where,
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { stockLevels: true, movements: true } },
    },
  });
}

export async function getWarehouseById(id: string) {
  return prisma.warehouse.findUnique({
    where: { id },
    include: {
      _count: { select: { stockLevels: true, movements: true, transfersFrom: true, transfersTo: true } },
    },
  });
}

export async function createWarehouse(data: {
  name: string;
  code: string;
  address?: string;
  isDefault?: boolean;
}) {
  // If setting as default, unset any existing default
  if (data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.warehouse.create({
    data: {
      name: data.name,
      code: data.code.toUpperCase(),
      address: data.address || null,
      isDefault: data.isDefault ?? false,
    },
  });
}

export async function updateWarehouse(id: string, data: {
  name?: string;
  code?: string;
  address?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}) {
  if (data.isDefault) {
    await prisma.warehouse.updateMany({
      where: { isDefault: true, id: { not: id } },
      data: { isDefault: false },
    });
  }

  return prisma.warehouse.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code.toUpperCase() }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function deleteWarehouse(id: string) {
  const warehouse = await prisma.warehouse.findUnique({ where: { id } });
  if (!warehouse) throw new Error('Warehouse not found');
  if (warehouse.isDefault) throw new Error('Cannot delete the default warehouse');

  // Check for non-zero stock
  const nonZeroStock = await prisma.stockLevel.count({
    where: { warehouseId: id, quantity: { gt: 0 } },
  });

  if (nonZeroStock > 0) {
    throw new Error('Cannot delete warehouse with non-zero stock. Transfer stock first.');
  }

  // Check for active transfers
  const activeTransfers = await prisma.stockTransfer.count({
    where: {
      OR: [{ fromWarehouseId: id }, { toWarehouseId: id }],
      status: { in: ['PENDING', 'IN_TRANSIT'] },
    },
  });

  if (activeTransfers > 0) {
    throw new Error('Cannot delete warehouse with active transfers');
  }

  // Soft delete
  return prisma.warehouse.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
}

// ---------------------------------------------------------------------------
// getTransfers
// ---------------------------------------------------------------------------

export async function getTransfers(filters: {
  status?: TransferStatus;
  warehouseId?: string;
  page?: number;
  limit?: number;
} = {}) {
  const { status, warehouseId, page = 1, limit = 20 } = filters;

  const where: Prisma.StockTransferWhereInput = {};
  if (status) where.status = status;
  if (warehouseId) {
    where.OR = [
      { fromWarehouseId: warehouseId },
      { toWarehouseId: warehouseId },
    ];
  }

  const [transfers, total] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      include: {
        items: true,
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.stockTransfer.count({ where }),
  ]);

  return {
    transfers: transfers.map((t) => ({
      ...t,
      items: t.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      })),
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

export async function getTransferById(id: string) {
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      items: true,
      fromWarehouse: { select: { id: true, name: true, code: true } },
      toWarehouse: { select: { id: true, name: true, code: true } },
    },
  });

  if (!transfer) return null;

  return {
    ...transfer,
    items: transfer.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
    })),
  };
}
