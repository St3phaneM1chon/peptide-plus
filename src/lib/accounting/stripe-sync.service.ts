/**
 * Stripe Sync Service
 * Synchronizes Stripe transactions with the accounting system
 */

import Stripe from 'stripe';
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
      apiVersion: '2023-10-16',
    });
  }
  return _stripe;
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
    // Fetch charges from Stripe
    const charges = await getStripe().charges.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000),
      },
      limit: 100,
      expand: ['data.balance_transaction'],
    });

    for (const charge of charges.data) {
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
          const saleEntry = generateSaleEntry({
            id: charge.metadata.orderId,
            orderNumber: charge.metadata.orderNumber || charge.id,
            date: new Date(charge.created * 1000),
            customer: {
              name: charge.metadata.customerName || 'Client Stripe',
              email: charge.metadata.customerEmail || '',
              province: charge.metadata.province,
              country: charge.metadata.country || 'CA',
            },
            items: [], // Items would be fetched from order
            subtotal: (charge.amount / 100) * 0.87, // Approximate before tax
            shipping: 0,
            discount: 0,
            tps: (charge.amount / 100) * 0.05 * 0.87,
            tvq: (charge.amount / 100) * 0.09975 * 0.87,
            tvh: 0,
            otherTax: 0,
            total: charge.amount / 100,
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
    const refunds = await getStripe().refunds.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000),
      },
      limit: 100,
      expand: ['data.charge'],
    });

    for (const refund of refunds.data) {
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
          const refundEntry = generateRefundEntry({
            id: refund.id,
            orderId: charge.metadata.orderId,
            orderNumber: charge.metadata.orderNumber || refund.id,
            date: new Date(refund.created * 1000),
            amount: refundAmount,
            tps: refundAmount * 0.05 * 0.87,
            tvq: refundAmount * 0.09975 * 0.87,
            tvh: 0,
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
    const payouts = await getStripe().payouts.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000),
      },
      limit: 100,
    });

    for (const payout of payouts.data) {
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
    console.error('Error fetching Stripe balance:', error);
    return { available: 0, pending: 0, currency: 'CAD' };
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
