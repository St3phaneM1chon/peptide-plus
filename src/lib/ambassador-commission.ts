/**
 * Ambassador Commission Utilities
 *
 * Handles commission clawback when orders are refunded (full or partial).
 * Integrated into all refund paths: Stripe webhook, PayPal webhook, admin refund.
 *
 * Clawback logic:
 * - Full refund: set commissionAmount to 0
 * - Partial refund: reduce commissionAmount proportionally based on refund ratio
 * - Update ambassador.totalEarnings to reflect the adjustment
 * - If commission was already paid out, create an AccountingAlert for admin review
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface ClawbackResult {
  success: boolean;
  commissionId?: string;
  ambassadorId?: string;
  originalAmount?: number;
  clawbackAmount?: number;
  newAmount?: number;
  wasPaidOut?: boolean;
  message: string;
}

/**
 * Clawback (reverse) ambassador commission when an order is refunded.
 *
 * @param orderId - The order being refunded
 * @param refundAmount - The amount refunded to the customer
 * @param orderTotal - The original order total (to calculate refund ratio)
 * @param isFullRefund - Whether this is a full refund
 * @returns ClawbackResult with details of what was done
 */
export async function clawbackAmbassadorCommission(
  orderId: string,
  refundAmount: number,
  orderTotal: number,
  isFullRefund: boolean
): Promise<ClawbackResult> {
  try {
    // Find the commission for this order
    const commission = await prisma.ambassadorCommission.findFirst({
      where: { orderId },
      include: {
        ambassador: {
          select: { id: true, name: true, totalEarnings: true },
        },
      },
    });

    if (!commission) {
      return {
        success: true,
        message: 'No ambassador commission found for this order - nothing to clawback',
      };
    }

    // FIX: FLAW-081 - Number() conversion from Prisma Decimal can lose precision for large values.
    // TODO: Consider using decimal.js for arbitrary precision arithmetic.
    const originalCommission = Number(commission.commissionAmount);
    if (originalCommission <= 0) {
      return {
        success: true,
        commissionId: commission.id,
        ambassadorId: commission.ambassadorId,
        message: 'Commission already at 0 - nothing to clawback',
      };
    }

    // Calculate the clawback amount
    let clawbackAmount: number;
    let newCommissionAmount: number;

    if (isFullRefund) {
      clawbackAmount = originalCommission;
      newCommissionAmount = 0;
    } else {
      // Partial refund: proportional clawback
      const refundRatio = orderTotal > 0 ? refundAmount / orderTotal : 0;
      clawbackAmount = Math.round(originalCommission * refundRatio * 100) / 100;
      newCommissionAmount = Math.round((originalCommission - clawbackAmount) * 100) / 100;
    }

    if (clawbackAmount <= 0) {
      return {
        success: true,
        commissionId: commission.id,
        ambassadorId: commission.ambassadorId,
        message: 'Clawback amount is 0 - no adjustment needed',
      };
    }

    const wasPaidOut = commission.paidOut;

    // Perform the clawback in a transaction
    await prisma.$transaction(async (tx) => {
      // Update the commission amount
      await tx.ambassadorCommission.update({
        where: { id: commission.id },
        data: {
          commissionAmount: newCommissionAmount,
        },
      });

      // Recalculate and update the ambassador's totalEarnings
      // Sum all their commissions (the updated value will be reflected)
      const earningsAgg = await tx.ambassadorCommission.aggregate({
        where: { ambassadorId: commission.ambassadorId },
        _sum: { commissionAmount: true },
      });
      const newTotalEarnings = Number(earningsAgg._sum?.commissionAmount || 0);

      await tx.ambassador.update({
        where: { id: commission.ambassadorId },
        data: { totalEarnings: newTotalEarnings },
      });

      // If commission was already paid out, create an alert for admin to recover funds
      if (wasPaidOut) {
        await tx.accountingAlert.create({
          data: {
            type: 'COMMISSION_CLAWBACK',
            severity: 'HIGH',
            title: `Commission clawback required: $${clawbackAmount.toFixed(2)} from ${commission.ambassador.name}`,
            message:
              `Order ${commission.orderNumber} was refunded ($${refundAmount.toFixed(2)} of $${orderTotal.toFixed(2)}). ` +
              `Ambassador commission of $${originalCommission.toFixed(2)} was already paid out. ` +
              `$${clawbackAmount.toFixed(2)} needs to be recovered from ambassador ${commission.ambassador.name}.`,
            entityType: 'AmbassadorCommission',
            entityId: commission.id,
          },
        });
      }
    });

    logger.info('Ambassador commission clawback processed', {
      orderId,
      commissionId: commission.id,
      ambassadorId: commission.ambassadorId,
      ambassadorName: commission.ambassador.name,
      originalAmount: originalCommission,
      clawbackAmount,
      newAmount: newCommissionAmount,
      isFullRefund,
      wasPaidOut,
    });

    return {
      success: true,
      commissionId: commission.id,
      ambassadorId: commission.ambassadorId,
      originalAmount: originalCommission,
      clawbackAmount,
      newAmount: newCommissionAmount,
      wasPaidOut,
      message: wasPaidOut
        ? `Commission clawed back ($${clawbackAmount.toFixed(2)}). WARNING: commission was already paid out - admin alert created.`
        : `Commission clawed back ($${clawbackAmount.toFixed(2)}).`,
    };
  } catch (error) {
    logger.error('Failed to clawback ambassador commission', {
      orderId,
      refundAmount,
      orderTotal,
      isFullRefund,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      message: `Clawback failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
