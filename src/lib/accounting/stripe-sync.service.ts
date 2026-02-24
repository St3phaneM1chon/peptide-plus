/**
 * Stripe Sync Service
 * Synchronizes Stripe transactions with the accounting system
 */

import Stripe from 'stripe';
import { STRIPE_API_VERSION } from '@/lib/stripe';
import { logger } from '@/lib/logger';
import { generateSaleEntry, generateFeeEntry, generateRefundEntry, generateStripePayoutEntry } from './auto-entries.service';
import { JournalEntry, BankTransaction } from './types';

// Lazy-initialized Stripe client to avoid crashing during Next.js build/SSG
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
  }
  return _stripe;
}

/**
 * FIX (F001): Get the correct tax-exclusive subtotal from a tax-inclusive amount.
 * Uses the actual tax rate from Stripe metadata (province) instead of a hardcoded 0.87 multiplier.
 * Default tax rate comes from env TAX_DEFAULT_RATE or falls back to Quebec combined rate (14.975%).
 *
 * Formula: subtotal = totalAmount / (1 + taxRate)
 */
function getSubtotalFromTotal(totalAmount: number, province?: string): number {
  // Province-specific combined tax rates (federal + provincial)
  const PROVINCE_TAX_RATES: Record<string, number> = {
    QC: 0.14975,  // TPS 5% + TVQ 9.975%
    ON: 0.13,     // HST 13%
    BC: 0.12,     // GST 5% + PST 7%
    AB: 0.05,     // GST 5% only
    SK: 0.11,     // GST 5% + PST 6%
    MB: 0.12,     // GST 5% + RST 7%
    NS: 0.14,     // HST 14% (effective 2025-04-01 - was 15%)
    NB: 0.15,     // HST 15%
    NL: 0.15,     // HST 15%
    PE: 0.15,     // HST 15%
    NT: 0.05,     // GST 5%
    NU: 0.05,     // GST 5%
    YT: 0.05,     // GST 5%
  };

  const defaultRate = process.env.TAX_DEFAULT_RATE
    ? parseFloat(process.env.TAX_DEFAULT_RATE)
    : 0.14975; // Default to Quebec rate

  const taxRate = province ? (PROVINCE_TAX_RATES[province.toUpperCase()] ?? defaultRate) : defaultRate;
  return totalAmount / (1 + taxRate);
}

interface StripeSyncResult {
  success: boolean;
  entriesCreated: number;
  transactionsImported: number;
  errors: string[];
  entries: JournalEntry[];
  transactions: BankTransaction[];
}

/* For Stripe charge type extension
interface StripeChargeWithOrder {
  id: string;
  amount: number;
  amount_refunded: number;
  currency: string;
  created: number;
  status: string;
  metadata: {
    orderId?: string;
    orderNumber?: string;
    customerName?: string;
    customerEmail?: string;
    province?: string;
    country?: string;
  };
  balance_transaction?: string;
  fee?: number;
}
*/

/**
 * Fetch recent Stripe charges and create accounting entries
 */
export async function syncStripeCharges(
  startDate: Date,
  endDate: Date
): Promise<StripeSyncResult> {
  const result: StripeSyncResult = {
    success: true,
    entriesCreated: 0,
    transactionsImported: 0,
    errors: [],
    entries: [],
    transactions: [],
  };

  try {
    // FIX: F010 - Auto-paginate Stripe charges using has_more / starting_after
    const allCharges: Stripe.Charge[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const params: Stripe.ChargeListParams = {
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000),
        },
        limit: 100,
        expand: ['data.balance_transaction'],
      };
      if (startingAfter) params.starting_after = startingAfter;

      const charges = await getStripe().charges.list(params);
      allCharges.push(...charges.data);
      hasMore = charges.has_more;
      if (charges.data.length > 0) {
        startingAfter = charges.data[charges.data.length - 1].id;
      }
    }

    for (const charge of allCharges) {
      if (charge.status !== 'succeeded') continue;

      try {
        // Get balance transaction for fee info
        const balanceTransaction = charge.balance_transaction as Stripe.BalanceTransaction | null;
        const fee = balanceTransaction?.fee ? balanceTransaction.fee / 100 : 0;

        // Create bank transaction record
        const bankTx: BankTransaction = {
          id: charge.id,
          bankAccountId: 'stripe',
          date: new Date(charge.created * 1000),
          description: `Stripe charge ${charge.id}`,
          amount: charge.amount / 100,
          type: 'CREDIT',
          reference: charge.metadata?.orderNumber,
          category: 'Ventes',
          reconciliationStatus: 'PENDING',
          importedAt: new Date(),
          rawData: {
            stripeId: charge.id,
            currency: charge.currency,
            fee,
          },
        };
        result.transactions.push(bankTx);
        result.transactionsImported++;

        // Create sale entry if we have order info
        if (charge.metadata?.orderId) {
          // FIX (F001): Use province-specific tax rate instead of hardcoded 0.87 multiplier
          const chargeTotal = charge.amount / 100;
          const province = charge.metadata.province;
          const subtotal = getSubtotalFromTotal(chargeTotal, province);
          const saleEntry = generateSaleEntry({
            id: charge.metadata.orderId,
            orderNumber: charge.metadata.orderNumber || charge.id,
            date: new Date(charge.created * 1000),
            customer: {
              name: charge.metadata.customerName || 'Client Stripe',
              email: charge.metadata.customerEmail || '',
              province,
              country: charge.metadata.country || 'CA',
            },
            items: [], // Items would be fetched from order
            subtotal,
            shipping: 0,
            discount: 0,
            tps: subtotal * 0.05,
            tvq: province?.toUpperCase() === 'QC' ? subtotal * 0.09975 : 0,
            tvh: ['ON', 'NS', 'NB', 'NL', 'PE'].includes(province?.toUpperCase() || '') ? subtotal * 0.13 : 0,
            otherTax: 0,
            total: chargeTotal,
            paymentMethod: 'STRIPE',
            paymentFee: fee,
            currency: charge.currency.toUpperCase(),
          });
          result.entries.push(saleEntry);
          result.entriesCreated++;

          // Create fee entry
          if (fee > 0) {
            const feeEntry = generateFeeEntry(
              charge.metadata.orderId,
              charge.metadata.orderNumber || charge.id,
              new Date(charge.created * 1000),
              fee,
              'STRIPE'
            );
            result.entries.push(feeEntry);
            result.entriesCreated++;
          }
        }
      } catch (chargeError) {
        result.errors.push(`Error processing charge ${charge.id}: ${chargeError}`);
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Stripe API error: ${error}`);
  }

  return result;
}

/**
 * Fetch Stripe refunds and create reversal entries
 */
export async function syncStripeRefunds(
  startDate: Date,
  endDate: Date
): Promise<StripeSyncResult> {
  const result: StripeSyncResult = {
    success: true,
    entriesCreated: 0,
    transactionsImported: 0,
    errors: [],
    entries: [],
    transactions: [],
  };

  try {
    // FIX: F010 - Auto-paginate Stripe refunds using has_more / starting_after
    const allRefunds: Stripe.Refund[] = [];
    let refundHasMore = true;
    let refundStartingAfter: string | undefined;

    while (refundHasMore) {
      const refundParams: Stripe.RefundListParams = {
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000),
        },
        limit: 100,
        expand: ['data.charge'],
      };
      if (refundStartingAfter) refundParams.starting_after = refundStartingAfter;

      const refunds = await getStripe().refunds.list(refundParams);
      allRefunds.push(...refunds.data);
      refundHasMore = refunds.has_more;
      if (refunds.data.length > 0) {
        refundStartingAfter = refunds.data[refunds.data.length - 1].id;
      }
    }

    for (const refund of allRefunds) {
      try {
        const charge = refund.charge as Stripe.Charge | null;
        
        // Create bank transaction for refund
        const bankTx: BankTransaction = {
          id: refund.id,
          bankAccountId: 'stripe',
          date: new Date(refund.created * 1000),
          description: `Stripe refund ${refund.id}`,
          amount: refund.amount / 100,
          type: 'DEBIT',
          reference: charge?.metadata?.orderNumber,
          category: 'Remboursements',
          reconciliationStatus: 'PENDING',
          importedAt: new Date(),
          rawData: {
            stripeId: refund.id,
            chargeId: charge?.id,
          },
        };
        result.transactions.push(bankTx);
        result.transactionsImported++;

        // Create refund journal entry
        if (charge?.metadata?.orderId) {
          const refundAmount = refund.amount / 100;
          // FIX (F007): Use province-specific tax rate instead of hardcoded 0.87 multiplier
          const refundProvince = charge.metadata.province;
          const refundSubtotal = getSubtotalFromTotal(refundAmount, refundProvince);
          const refundEntry = generateRefundEntry({
            id: refund.id,
            orderId: charge.metadata.orderId,
            orderNumber: charge.metadata.orderNumber || refund.id,
            date: new Date(refund.created * 1000),
            amount: refundAmount,
            tps: refundSubtotal * 0.05,
            tvq: refundProvince?.toUpperCase() === 'QC' ? refundSubtotal * 0.09975 : 0,
            tvh: ['ON', 'NS', 'NB', 'NL', 'PE'].includes(refundProvince?.toUpperCase() || '') ? refundSubtotal * 0.13 : 0,
            reason: refund.reason || 'Remboursement client',
            paymentMethod: 'STRIPE',
          });
          result.entries.push(refundEntry);
          result.entriesCreated++;
        }
      } catch (refundError) {
        result.errors.push(`Error processing refund ${refund.id}: ${refundError}`);
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Stripe API error: ${error}`);
  }

  return result;
}

/**
 * Fetch Stripe payouts (transfers to bank) and create entries
 */
export async function syncStripePayouts(
  startDate: Date,
  endDate: Date
): Promise<StripeSyncResult> {
  const result: StripeSyncResult = {
    success: true,
    entriesCreated: 0,
    transactionsImported: 0,
    errors: [],
    entries: [],
    transactions: [],
  };

  try {
    // FIX: F010 - Auto-paginate Stripe payouts using has_more / starting_after
    const allPayouts: Stripe.Payout[] = [];
    let payoutHasMore = true;
    let payoutStartingAfter: string | undefined;

    while (payoutHasMore) {
      const payoutParams: Stripe.PayoutListParams = {
        created: {
          gte: Math.floor(startDate.getTime() / 1000),
          lte: Math.floor(endDate.getTime() / 1000),
        },
        limit: 100,
      };
      if (payoutStartingAfter) payoutParams.starting_after = payoutStartingAfter;

      const payouts = await getStripe().payouts.list(payoutParams);
      allPayouts.push(...payouts.data);
      payoutHasMore = payouts.has_more;
      if (payouts.data.length > 0) {
        payoutStartingAfter = payouts.data[payouts.data.length - 1].id;
      }
    }

    for (const payout of allPayouts) {
      if (payout.status !== 'paid') continue;

      try {
        // Create bank transaction
        const bankTx: BankTransaction = {
          id: payout.id,
          bankAccountId: 'bank_main',
          date: new Date((payout.arrival_date || payout.created) * 1000),
          description: `Stripe payout ${payout.id}`,
          amount: payout.amount / 100,
          type: 'CREDIT',
          reference: payout.id,
          category: 'Transfert Stripe',
          reconciliationStatus: 'PENDING',
          importedAt: new Date(),
          rawData: {
            stripeId: payout.id,
            currency: payout.currency,
          },
        };
        result.transactions.push(bankTx);
        result.transactionsImported++;

        // Create payout entry
        const payoutEntry = generateStripePayoutEntry({
          id: payout.id,
          date: new Date((payout.arrival_date || payout.created) * 1000),
          gross: payout.amount / 100,
          fees: 0, // Payout fees are usually included in charge fees
          net: payout.amount / 100,
          currency: payout.currency.toUpperCase(),
        });
        result.entries.push(payoutEntry);
        result.entriesCreated++;
      } catch (payoutError) {
        result.errors.push(`Error processing payout ${payout.id}: ${payoutError}`);
      }
    }
  } catch (error) {
    result.success = false;
    result.errors.push(`Stripe API error: ${error}`);
  }

  return result;
}

/**
 * Get Stripe balance
 */
export async function getStripeBalance(): Promise<{
  available: number;
  pending: number;
  currency: string;
  error?: boolean;
  errorMessage?: string;
}> {
  try {
    const balance = await getStripe().balance.retrieve();

    const cadBalance = balance.available.find(b => b.currency === 'cad') ||
                       balance.available[0];
    const cadPending = balance.pending.find(b => b.currency === 'cad') ||
                       balance.pending[0];

    return {
      available: (cadBalance?.amount || 0) / 100,
      pending: (cadPending?.amount || 0) / 100,
      currency: cadBalance?.currency?.toUpperCase() || 'CAD',
    };
  } catch (error) {
    logger.error('Error fetching Stripe balance', { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : 'Unknown Stripe error';
    return {
      available: 0,
      pending: 0,
      currency: 'CAD',
      error: true,
      errorMessage: message,
    };
  }
}

/**
 * Full sync: charges, refunds, and payouts
 */
export async function fullStripeSync(
  startDate: Date,
  endDate: Date
): Promise<StripeSyncResult> {
  const chargesResult = await syncStripeCharges(startDate, endDate);
  const refundsResult = await syncStripeRefunds(startDate, endDate);
  const payoutsResult = await syncStripePayouts(startDate, endDate);

  return {
    success: chargesResult.success && refundsResult.success && payoutsResult.success,
    entriesCreated: chargesResult.entriesCreated + refundsResult.entriesCreated + payoutsResult.entriesCreated,
    transactionsImported: chargesResult.transactionsImported + refundsResult.transactionsImported + payoutsResult.transactionsImported,
    errors: [...chargesResult.errors, ...refundsResult.errors, ...payoutsResult.errors],
    entries: [...chargesResult.entries, ...refundsResult.entries, ...payoutsResult.entries],
    transactions: [...chargesResult.transactions, ...refundsResult.transactions, ...payoutsResult.transactions],
  };
}
