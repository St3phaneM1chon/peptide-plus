export const dynamic = 'force-dynamic';

/**
 * Admin Purchase Order Receive API
 * POST - Mark items as received with optional partial receiving
 *
 * When items are received:
 * 1. Update PO item receivedQty
 * 2. Update PO status (PARTIAL_RECEIVED or RECEIVED)
 * 3. Increment inventory quantities (ProductFormat.stockQuantity)
 * 4. Create InventoryTransaction records with WAC recalculation
 * 5. Create JournalEntry: Debit Inventory (1210), Credit Accounts Payable (2000)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { ACCOUNT_CODES, TAX_RATES } from '@/lib/accounting/types';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { assertJournalBalance, assertPeriodOpen } from '@/lib/accounting/validation';

const receiveItemSchema = z.object({
  itemId: z.string().min(1, 'itemId is required'),
  receivedQty: z.number().positive('receivedQty must be positive'),
});

const receivePurchaseOrderSchema = z.object({
  items: z.array(receiveItemSchema).optional().default([]),
  notes: z.string().optional().nullable(),
});

// ─── POST /api/admin/purchase-orders/[id]/receive ───────────────────────────────
export const POST = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const parsed = receivePurchaseOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    // ─── Load PO with items ─────────────────────────────────────────────
    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!po) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      );
    }

    // Only ORDERED or PARTIAL_RECEIVED POs can receive goods
    if (po.status !== 'ORDERED' && po.status !== 'PARTIAL_RECEIVED') {
      return NextResponse.json(
        {
          error: `Cannot receive goods for a PO with status ${po.status}. Must be ORDERED or PARTIAL_RECEIVED.`,
        },
        { status: 400 }
      );
    }

    // ─── Parse received items ───────────────────────────────────────────
    // Body format:
    // {
    //   items: [
    //     { itemId: "xxx", receivedQty: 10 },
    //     { itemId: "yyy", receivedQty: 5 },
    //   ],
    //   notes?: "Received in good condition"
    // }
    //
    // If no items provided, receive ALL items at their full quantity
    const receivedItems: Array<{ itemId: string; receivedQty: number }> =
      parsed.data.items || [];

    // If no specific items, receive all remaining quantities
    const receiveAll = receivedItems.length === 0;

    // Build a map of what to receive
    const receiveMap = new Map<string, number>();

    if (receiveAll) {
      for (const item of po.items) {
        const remaining = item.quantity - item.receivedQty;
        if (remaining > 0) {
          receiveMap.set(item.id, remaining);
        }
      }
    } else {
      for (const ri of receivedItems) {
        if (!ri.itemId || !ri.receivedQty || ri.receivedQty <= 0) {
          return NextResponse.json(
            { error: 'Each received item must have itemId and a positive receivedQty' },
            { status: 400 }
          );
        }

        const poItem = po.items.find((item) => item.id === ri.itemId);
        if (!poItem) {
          return NextResponse.json(
            { error: `Item ${ri.itemId} not found in this purchase order` },
            { status: 400 }
          );
        }

        const remaining = poItem.quantity - poItem.receivedQty;
        if (ri.receivedQty > remaining) {
          return NextResponse.json(
            {
              error: `Cannot receive ${ri.receivedQty} for "${poItem.description}". Only ${remaining} remaining (ordered: ${poItem.quantity}, already received: ${poItem.receivedQty}).`,
            },
            { status: 400 }
          );
        }

        receiveMap.set(ri.itemId, ri.receivedQty);
      }
    }

    if (receiveMap.size === 0) {
      return NextResponse.json(
        { error: 'No items to receive. All items may have already been fully received.' },
        { status: 400 }
      );
    }

    // Ensure the current accounting period is open before writing entries
    await assertPeriodOpen(new Date());

    // ─── Process receiving in a transaction ──────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      const inventoryUpdates: Array<{
        productId: string;
        formatId: string | null;
        quantity: number;
        unitCost: number;
        newWAC: number;
        description: string;
      }> = [];

      // 1. Update each PO item's receivedQty and process inventory
      for (const [itemId, qtyToReceive] of receiveMap.entries()) {
        const poItem = po.items.find((item) => item.id === itemId)!;
        const newReceivedQty = poItem.receivedQty + qtyToReceive;

        // Update PO item receivedQty
        await tx.purchaseOrderItem.update({
          where: { id: itemId },
          data: { receivedQty: newReceivedQty },
        });

        // Only process inventory for items linked to a product
        if (poItem.productId) {
          const unitCost = Number(poItem.unitCost);

          // Get current stock quantity
          let currentQty = 0;
          if (poItem.formatId) {
            const format = await tx.productFormat.findUnique({
              where: { id: poItem.formatId },
              select: { stockQuantity: true, trackInventory: true },
            });
            if (format?.trackInventory) {
              currentQty = format.stockQuantity;
            }
          }

          // Get current WAC
          const lastTransaction = await tx.inventoryTransaction.findFirst({
            where: {
              productId: poItem.productId,
              formatId: poItem.formatId || null,
            },
            orderBy: { createdAt: 'desc' },
            select: { runningWAC: true },
          });
          const currentWAC = lastTransaction ? Number(lastTransaction.runningWAC) : 0;

          // Calculate new WAC
          // WAC = (existing_qty * existing_wac + new_qty * new_cost) / (existing_qty + new_qty)
          const totalCurrentValue = currentQty * currentWAC;
          const newValue = qtyToReceive * unitCost;
          const newTotalQty = currentQty + qtyToReceive;
          const newWAC = newTotalQty > 0
            ? Math.round(((totalCurrentValue + newValue) / newTotalQty) * 10000) / 10000
            : unitCost;

          // Increment stock
          if (poItem.formatId) {
            await tx.productFormat.update({
              where: { id: poItem.formatId },
              data: { stockQuantity: { increment: qtyToReceive } },
            });
          }

          // Create inventory transaction
          await tx.inventoryTransaction.create({
            data: {
              productId: poItem.productId,
              formatId: poItem.formatId || null,
              type: 'PURCHASE',
              quantity: qtyToReceive,
              unitCost,
              runningWAC: newWAC,
              supplierInvoiceId: po.supplierInvoiceId || null,
              reason: `PO ${po.poNumber} - ${poItem.description}`,
              createdBy: session!.user.id,
            },
          });

          inventoryUpdates.push({
            productId: poItem.productId,
            formatId: poItem.formatId,
            quantity: qtyToReceive,
            unitCost,
            newWAC,
            description: poItem.description,
          });
        }
      }

      // 2. Determine new PO status
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      const allFullyReceived = updatedItems.every(
        (item) => item.receivedQty >= item.quantity
      );
      const someReceived = updatedItems.some(
        (item) => item.receivedQty > 0
      );

      let newStatus: string;
      if (allFullyReceived) {
        newStatus = 'RECEIVED';
      } else if (someReceived) {
        newStatus = 'PARTIAL_RECEIVED';
      } else {
        newStatus = po.status; // Shouldn't happen, but safety
      }

      // 3. Update PO status
      const poUpdateData: Record<string, unknown> = {
        status: newStatus,
      };

      if (newStatus === 'RECEIVED') {
        poUpdateData.receivedAt = new Date();
      }

      if (parsed.data.notes) {
        const timestamp = new Date().toISOString();
        poUpdateData.notes = po.notes
          ? `${po.notes}\n[RECEIVED ${timestamp}] ${parsed.data.notes}`
          : `[RECEIVED ${timestamp}] ${parsed.data.notes}`;
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: poUpdateData,
      });

      // 4. Create accounting journal entry (Debit Inventory, Credit Accounts Payable)
      let journalEntryId: string | null = null;

      if (inventoryUpdates.length > 0) {
        // Calculate total value of received goods
        let totalInventoryValue = 0;
        for (const update of inventoryUpdates) {
          totalInventoryValue += update.quantity * update.unitCost;
        }
        totalInventoryValue = Math.round(totalInventoryValue * 100) / 100;

        if (totalInventoryValue > 0) {
          // Get account IDs
          const inventoryAccount = await tx.chartOfAccount.findUnique({
            where: { code: ACCOUNT_CODES.INVENTORY },
            select: { id: true },
          });
          const apAccount = await tx.chartOfAccount.findUnique({
            where: { code: ACCOUNT_CODES.ACCOUNTS_PAYABLE },
            select: { id: true },
          });

          if (inventoryAccount && apAccount) {
            // Generate journal entry number
            const year = new Date().getFullYear();
            const entryCount = await tx.journalEntry.count({
              where: { entryNumber: { startsWith: `JV-${year}-` } },
            });
            const entryNumber = `JV-${year}-${String(entryCount + 1).padStart(4, '0')}`;

            // Build description with item details
            const itemDescriptions = inventoryUpdates
              .map((u) => `${u.description} x${u.quantity} @ $${u.unitCost.toFixed(2)}`)
              .join(', ');

            // Build ALL journal lines (inventory + taxes) before creation
            const allLines: Array<{ accountId: string; description: string; debit: number; credit: number }> = [
              {
                accountId: inventoryAccount.id,
                description: `Stock entrant: ${itemDescriptions}`,
                debit: totalInventoryValue,
                credit: 0,
              },
              {
                accountId: apAccount.id,
                description: `Fournisseur: ${po.supplierName} - ${po.poNumber}`,
                debit: 0,
                credit: totalInventoryValue,
              },
            ];

            // Add tax input credit lines if applicable
            const taxableAmount = totalInventoryValue;
            const tpsCredit = Math.round(taxableAmount * TAX_RATES.QC.TPS * 100) / 100;
            const tvqCredit = Math.round(taxableAmount * TAX_RATES.QC.TVQ * 100) / 100;

            if (tpsCredit > 0) {
              const tpsAccount = await tx.chartOfAccount.findUnique({
                where: { code: ACCOUNT_CODES.TPS_PAYABLE },
                select: { id: true },
              });
              if (tpsAccount) {
                allLines.push({
                  accountId: tpsAccount.id,
                  description: `Crédit de taxe sur intrants TPS - ${po.poNumber}`,
                  debit: tpsCredit,
                  credit: 0,
                });
                allLines.push({
                  accountId: apAccount.id,
                  description: `TPS fournisseur - ${po.supplierName}`,
                  debit: 0,
                  credit: tpsCredit,
                });
              }
            }

            if (tvqCredit > 0) {
              const tvqAccount = await tx.chartOfAccount.findUnique({
                where: { code: ACCOUNT_CODES.TVQ_PAYABLE },
                select: { id: true },
              });
              if (tvqAccount) {
                allLines.push({
                  accountId: tvqAccount.id,
                  description: `Crédit de taxe sur intrants TVQ - ${po.poNumber}`,
                  debit: tvqCredit,
                  credit: 0,
                });
                allLines.push({
                  accountId: apAccount.id,
                  description: `TVQ fournisseur - ${po.supplierName}`,
                  debit: 0,
                  credit: tvqCredit,
                });
              }
            }

            // Validate balance before insertion
            assertJournalBalance(allLines, `PO receive ${po.poNumber}`);

            const journalEntry = await tx.journalEntry.create({
              data: {
                entryNumber,
                date: new Date(),
                description: `Réception ${po.poNumber}${allFullyReceived ? '' : ' (partielle)'} - ${po.supplierName}`,
                type: 'AUTO_PURCHASE',
                status: 'POSTED',
                reference: `PO-RCV-${po.poNumber}`,
                createdBy: session!.user.id,
                postedBy: session!.user.id,
                postedAt: new Date(),
                lines: { create: allLines },
              },
            });

            journalEntryId = journalEntry.id;
          } else {
            logger.warn(`Accounting accounts not found: Inventory(${ACCOUNT_CODES.INVENTORY})=${!!inventoryAccount}, AP(${ACCOUNT_CODES.ACCOUNTS_PAYABLE})=${!!apAccount}`);
          }
        }
      }

      return {
        newStatus,
        allFullyReceived,
        inventoryUpdates,
        journalEntryId,
      };
    });

    logAdminAction({
      adminUserId: session!.user.id,
      action: 'RECEIVE_PURCHASE_ORDER',
      targetType: 'PurchaseOrder',
      targetId: id,
      previousValue: { status: po.status, poNumber: po.poNumber },
      newValue: {
        newStatus: result.newStatus,
        allFullyReceived: result.allFullyReceived,
        itemsReceived: result.inventoryUpdates.length,
        journalEntryId: result.journalEntryId,
      },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    // ─── Fetch final state ──────────────────────────────────────────────
    const updatedPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json({
      success: true,
      purchaseOrder: updatedPO
        ? {
            ...updatedPO,
            subtotal: Number(updatedPO.subtotal),
            taxTps: Number(updatedPO.taxTps),
            taxTvq: Number(updatedPO.taxTvq),
            total: Number(updatedPO.total),
            items: updatedPO.items.map((item) => ({
              ...item,
              unitCost: Number(item.unitCost),
              total: Number(item.total),
            })),
          }
        : null,
      receiving: {
        status: result.newStatus,
        allFullyReceived: result.allFullyReceived,
        itemsReceived: result.inventoryUpdates.length,
        inventoryUpdates: result.inventoryUpdates.map((u) => ({
          productId: u.productId,
          formatId: u.formatId,
          description: u.description,
          quantityReceived: u.quantity,
          unitCost: u.unitCost,
          newWAC: u.newWAC,
        })),
        journalEntryId: result.journalEntryId,
      },
    });
  } catch (error) {
    logger.error('Admin purchase order receive error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
