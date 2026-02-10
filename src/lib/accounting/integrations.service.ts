/**
 * External Integrations Service
 * QuickBooks, Sage, inventory sync, and external accounting exports
 */

import { JournalEntry } from './types';

// ============================================
// QUICKBOOKS ONLINE INTEGRATION
// ============================================

interface QBOConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  realmId?: string;
  environment: 'sandbox' | 'production';
}

interface QBOJournalEntry {
  Id?: string;
  DocNumber?: string;
  TxnDate: string;
  PrivateNote?: string;
  Line: QBOJournalEntryLine[];
}

interface QBOJournalEntryLine {
  Id?: string;
  Description?: string;
  Amount: number;
  DetailType: 'JournalEntryLineDetail';
  JournalEntryLineDetail: {
    PostingType: 'Debit' | 'Credit';
    AccountRef: {
      value: string;
      name?: string;
    };
  };
}

/**
 * Map local account codes to QuickBooks account IDs
 */
const QBO_ACCOUNT_MAPPING: Record<string, string> = {
  '1010': '1', // Cash
  '1040': '2', // Stripe
  '1110': '3', // Accounts Receivable
  '2000': '4', // Accounts Payable
  '2110': '5', // GST Payable
  '2120': '6', // QST Payable
  '4010': '7', // Sales Revenue
  '5010': '8', // Cost of Goods Sold
  '6000': '9', // Shipping Expense
  '6110': '10', // Payment Processing Fees
};

/**
 * Convert local journal entry to QBO format
 */
export function convertToQBOFormat(entry: JournalEntry): QBOJournalEntry {
  const lines: QBOJournalEntryLine[] = entry.lines.map((line, index) => ({
    Id: String(index + 1),
    Description: line.description || entry.description,
    Amount: Number(line.debit) > 0 ? Number(line.debit) : Number(line.credit),
    DetailType: 'JournalEntryLineDetail',
    JournalEntryLineDetail: {
      PostingType: Number(line.debit) > 0 ? 'Debit' : 'Credit',
      AccountRef: {
        value: QBO_ACCOUNT_MAPPING[line.accountCode] || '99',
        name: line.accountName,
      },
    },
  }));

  return {
    DocNumber: entry.entryNumber,
    TxnDate: new Date(entry.date).toISOString().split('T')[0],
    PrivateNote: `${entry.description} | Ref: ${entry.reference || 'N/A'}`,
    Line: lines,
  };
}

/**
 * Export entries to QuickBooks Online
 */
export async function exportToQuickBooks(
  entries: JournalEntry[],
  _config: QBOConfig
): Promise<{
  success: boolean;
  exported: number;
  failed: number;
  errors: { entryNumber: string; error: string }[];
}> {
  const result = {
    success: true,
    exported: 0,
    failed: 0,
    errors: [] as { entryNumber: string; error: string }[],
  };

  // In production, use QuickBooks SDK
  // const qbo = new QuickBooks(config);
  
  for (const entry of entries) {
    try {
      const qboEntry = convertToQBOFormat(entry);
      
      // Simulate API call
      // await qbo.createJournalEntry(qboEntry);
      
      console.log('Would export to QBO:', qboEntry);
      result.exported++;
    } catch (error: any) {
      result.failed++;
      result.errors.push({
        entryNumber: entry.entryNumber,
        error: error.message || 'Unknown error',
      });
    }
  }

  result.success = result.failed === 0;
  return result;
}

// ============================================
// SAGE 50 EXPORT (CSV FORMAT)
// ============================================

/**
 * Convert entries to Sage 50 CSV format
 */
export function exportToSageCSV(entries: JournalEntry[]): string {
  const headers = [
    'Journal Entry Number',
    'Date',
    'Source',
    'Comment',
    'Account Number',
    'Account Name',
    'Debit',
    'Credit',
    'Project',
    'Allocation',
  ];

  const rows: string[][] = [];

  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push([
        entry.entryNumber,
        new Date(entry.date).toLocaleDateString('en-CA'),
        'GJ', // General Journal
        entry.description.replace(/"/g, '""'),
        line.accountCode,
        (line.accountName || '').replace(/"/g, '""'),
        Number(line.debit).toFixed(2),
        Number(line.credit).toFixed(2),
        '', // Project
        '', // Allocation
      ]);
    }
  }

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');
}

// ============================================
// INVENTORY SYNC & COGS
// ============================================

interface InventoryItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
}

interface COGSCalculation {
  productId: string;
  productName: string;
  quantitySold: number;
  unitCost: number;
  totalCOGS: number;
  method: 'FIFO' | 'LIFO' | 'AVERAGE';
}

/**
 * Calculate COGS using average cost method
 */
export async function calculateCOGS(
  orders: {
    orderId: string;
    items: { productId: string; productName: string; quantity: number }[];
  }[],
  inventoryCosts: Map<string, { unitCost: number; quantity: number }[]>
): Promise<{
  cogsByProduct: COGSCalculation[];
  totalCOGS: number;
  journalEntry: {
    description: string;
    lines: { accountCode: string; accountName: string; debit: number; credit: number }[];
  };
}> {
  const cogsByProduct: COGSCalculation[] = [];
  let totalCOGS = 0;

  for (const order of orders) {
    for (const item of order.items) {
      const costs = inventoryCosts.get(item.productId) || [];
      
      // Calculate average cost
      const totalUnits = costs.reduce((sum, c) => sum + c.quantity, 0);
      const totalValue = costs.reduce((sum, c) => sum + (c.quantity * c.unitCost), 0);
      const avgCost = totalUnits > 0 ? totalValue / totalUnits : 0;
      
      const itemCOGS = item.quantity * avgCost;
      
      cogsByProduct.push({
        productId: item.productId,
        productName: item.productName,
        quantitySold: item.quantity,
        unitCost: Math.round(avgCost * 100) / 100,
        totalCOGS: Math.round(itemCOGS * 100) / 100,
        method: 'AVERAGE',
      });
      
      totalCOGS += itemCOGS;
    }
  }

  // Aggregate by product
  const aggregated = new Map<string, COGSCalculation>();
  for (const calc of cogsByProduct) {
    const existing = aggregated.get(calc.productId);
    if (existing) {
      existing.quantitySold += calc.quantitySold;
      existing.totalCOGS += calc.totalCOGS;
    } else {
      aggregated.set(calc.productId, { ...calc });
    }
  }

  return {
    cogsByProduct: Array.from(aggregated.values()),
    totalCOGS: Math.round(totalCOGS * 100) / 100,
    journalEntry: {
      description: 'Coût des marchandises vendues',
      lines: [
        {
          accountCode: '5010',
          accountName: 'Coût des marchandises vendues',
          debit: Math.round(totalCOGS * 100) / 100,
          credit: 0,
        },
        {
          accountCode: '1210',
          accountName: 'Stock de marchandises',
          debit: 0,
          credit: Math.round(totalCOGS * 100) / 100,
        },
      ],
    },
  };
}

/**
 * Sync inventory valuation with accounting
 */
export async function syncInventoryValuation(
  inventoryItems: InventoryItem[]
): Promise<{
  totalValue: number;
  accountBalance: number;
  difference: number;
  adjustment?: {
    type: 'INCREASE' | 'DECREASE';
    amount: number;
    journalEntry: any;
  };
}> {
  const totalValue = inventoryItems.reduce((sum, item) => sum + item.totalValue, 0);
  
  // In production, fetch from chart of accounts
  const accountBalance = 35600; // Mock current book value
  
  const difference = totalValue - accountBalance;

  if (Math.abs(difference) > 0.01) {
    return {
      totalValue,
      accountBalance,
      difference,
      adjustment: {
        type: difference > 0 ? 'INCREASE' : 'DECREASE',
        amount: Math.abs(difference),
        journalEntry: {
          description: 'Ajustement de la valeur du stock',
          lines: [
            {
              accountCode: '1210',
              accountName: 'Stock de marchandises',
              debit: difference > 0 ? Math.abs(difference) : 0,
              credit: difference < 0 ? Math.abs(difference) : 0,
            },
            {
              accountCode: '5900',
              accountName: 'Ajustement de stock',
              debit: difference < 0 ? Math.abs(difference) : 0,
              credit: difference > 0 ? Math.abs(difference) : 0,
            },
          ],
        },
      },
    };
  }

  return {
    totalValue,
    accountBalance,
    difference: 0,
  };
}

// ============================================
// PAYPAL WEBHOOK INTEGRATION
// ============================================

interface PayPalTransaction {
  id: string;
  create_time: string;
  update_time: string;
  amount: {
    currency_code: string;
    value: string;
  };
  payee: {
    email_address: string;
  };
  payer: {
    email_address: string;
    name: { given_name: string; surname: string };
  };
  status: 'COMPLETED' | 'PENDING' | 'REFUNDED' | 'FAILED';
  transaction_info?: {
    transaction_id: string;
    transaction_event_code: string;
    transaction_amount: { currency_code: string; value: string };
    fee_amount?: { currency_code: string; value: string };
  };
}

/**
 * Process PayPal webhook event
 */
export function processPayPalWebhook(
  eventType: string,
  resource: PayPalTransaction
): {
  shouldCreateEntry: boolean;
  entryType?: 'SALE' | 'REFUND' | 'FEE';
  journalEntry?: {
    description: string;
    type: string;
    reference: string;
    lines: { accountCode: string; accountName: string; debit: number; credit: number }[];
  };
} {
  const amount = parseFloat(resource.amount.value);
  const fee = resource.transaction_info?.fee_amount 
    ? parseFloat(resource.transaction_info.fee_amount.value) 
    : amount * 0.029 + 0.30; // Default PayPal fee structure

  switch (eventType) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      return {
        shouldCreateEntry: true,
        entryType: 'SALE',
        journalEntry: {
          description: `Paiement PayPal - ${resource.payer.email_address}`,
          type: 'AUTO_SALE',
          reference: resource.id,
          lines: [
            {
              accountCode: '1030',
              accountName: 'Compte PayPal',
              debit: amount - fee,
              credit: 0,
            },
            {
              accountCode: '6120',
              accountName: 'Frais PayPal',
              debit: fee,
              credit: 0,
            },
            {
              accountCode: '4010',
              accountName: 'Ventes',
              debit: 0,
              credit: amount,
            },
          ],
        },
      };

    case 'PAYMENT.CAPTURE.REFUNDED':
      return {
        shouldCreateEntry: true,
        entryType: 'REFUND',
        journalEntry: {
          description: `Remboursement PayPal - ${resource.id}`,
          type: 'AUTO_REFUND',
          reference: `REFUND-${resource.id}`,
          lines: [
            {
              accountCode: '4900',
              accountName: 'Remises et retours',
              debit: amount,
              credit: 0,
            },
            {
              accountCode: '1030',
              accountName: 'Compte PayPal',
              debit: 0,
              credit: amount,
            },
          ],
        },
      };

    default:
      return { shouldCreateEntry: false };
  }
}

/**
 * Sync PayPal transactions
 */
export async function syncPayPalTransactions(
  _startDate: Date,
  _endDate: Date,
  _accessToken: string
): Promise<{
  transactions: PayPalTransaction[];
  totalReceived: number;
  totalFees: number;
  netAmount: number;
}> {
  // In production, use PayPal SDK
  // const paypal = require('@paypal/checkout-server-sdk');
  
  // Simulated response
  const transactions: PayPalTransaction[] = [
    {
      id: 'PAY-1234567890',
      create_time: new Date().toISOString(),
      update_time: new Date().toISOString(),
      amount: { currency_code: 'CAD', value: '150.00' },
      payee: { email_address: 'business@biocycle.ca' },
      payer: {
        email_address: 'customer@example.com',
        name: { given_name: 'Jean', surname: 'Tremblay' },
      },
      status: 'COMPLETED',
      transaction_info: {
        transaction_id: 'TXN-1234567890',
        transaction_event_code: 'T0006',
        transaction_amount: { currency_code: 'CAD', value: '150.00' },
        fee_amount: { currency_code: 'CAD', value: '4.65' },
      },
    },
  ];

  const totalReceived = transactions
    .filter(t => t.status === 'COMPLETED')
    .reduce((sum, t) => sum + parseFloat(t.amount.value), 0);
  
  const totalFees = transactions
    .filter(t => t.transaction_info?.fee_amount)
    .reduce((sum, t) => sum + parseFloat(t.transaction_info!.fee_amount!.value), 0);

  return {
    transactions,
    totalReceived,
    totalFees,
    netAmount: totalReceived - totalFees,
  };
}

// ============================================
// GENERIC EXPORT FORMATS
// ============================================

/**
 * Export to IIF format (for older QuickBooks Desktop)
 */
export function exportToIIF(entries: JournalEntry[]): string {
  let iif = '!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
  iif += '!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n';
  iif += '!ENDTRNS\n';

  for (const entry of entries) {
    const date = new Date(entry.date).toLocaleDateString('en-US');
    
    // First line (TRNS)
    const firstLine = entry.lines[0];
    iif += `TRNS\tGENERAL JOURNAL\t${date}\t${firstLine.accountName}\t\t${Number(firstLine.debit) > 0 ? Number(firstLine.debit) : -Number(firstLine.credit)}\t${entry.description}\n`;
    
    // Split lines (SPL)
    for (let i = 1; i < entry.lines.length; i++) {
      const line = entry.lines[i];
      iif += `SPL\tGENERAL JOURNAL\t${date}\t${line.accountName}\t\t${Number(line.debit) > 0 ? Number(line.debit) : -Number(line.credit)}\t${line.description || ''}\n`;
    }
    
    iif += 'ENDTRNS\n';
  }

  return iif;
}

/**
 * Export to Excel-compatible format
 */
export function exportToExcel(entries: JournalEntry[]): {
  headers: string[];
  rows: any[][];
} {
  const headers = [
    'N° Écriture',
    'Date',
    'Description',
    'Type',
    'Statut',
    'Référence',
    'Code Compte',
    'Nom Compte',
    'Débit',
    'Crédit',
  ];

  const rows: any[][] = [];

  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push([
        entry.entryNumber,
        new Date(entry.date).toLocaleDateString('fr-CA'),
        entry.description,
        entry.type,
        entry.status,
        entry.reference || '',
        line.accountCode,
        line.accountName,
        Number(line.debit),
        Number(line.credit),
      ]);
    }
  }

  return { headers, rows };
}
