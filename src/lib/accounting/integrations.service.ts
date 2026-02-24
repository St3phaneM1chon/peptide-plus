/**
 * External Integrations Service
 * QuickBooks, Sage, inventory sync, and external accounting exports
 *
 * #73 Audit: SECURITY - All API keys and secrets MUST come from environment
 * variables, never from plain text in code or database fields. Sensitive
 * credentials should be stored in Azure Key Vault or equivalent secret manager.
 */

import { JournalEntry } from './types';

// ============================================
// QUICKBOOKS ONLINE INTEGRATION
// ============================================

// #73 Audit: Config should be populated exclusively from environment variables
interface QBOConfig {
  clientId: string;      // From process.env.QBO_CLIENT_ID
  clientSecret: string;  // From process.env.QBO_CLIENT_SECRET
  accessToken?: string;  // From OAuth flow, stored encrypted
  refreshToken?: string; // From OAuth flow, stored encrypted
  realmId?: string;
  environment: 'sandbox' | 'production';
}

/**
 * #73 Audit: Build QBO config from environment variables only
 * Never accept credentials from request body or database plain text fields
 */
export function getQBOConfigFromEnv(): QBOConfig {
  return {
    clientId: process.env.QBO_CLIENT_ID || '',
    clientSecret: process.env.QBO_CLIENT_SECRET || '',
    accessToken: process.env.QBO_ACCESS_TOKEN,
    refreshToken: process.env.QBO_REFRESH_TOKEN,
    realmId: process.env.QBO_REALM_ID,
    environment: (process.env.QBO_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  };
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

  if (!_config.clientId || !_config.clientSecret) {
    return {
      success: false,
      exported: 0,
      failed: entries.length,
      errors: [{ entryNumber: 'N/A', error: 'QuickBooks credentials not configured. Set QBO_CLIENT_ID and QBO_CLIENT_SECRET environment variables.' }],
    };
  }

  if (!_config.accessToken || !_config.realmId) {
    return {
      success: false,
      exported: 0,
      failed: entries.length,
      errors: [{ entryNumber: 'N/A', error: 'QuickBooks OAuth not completed. Connect your QuickBooks account first.' }],
    };
  }

  const baseUrl = _config.environment === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';

  for (const entry of entries) {
    try {
      const qboEntry = convertToQBOFormat(entry);

      const response = await fetch(
        `${baseUrl}/v3/company/${_config.realmId}/journalentry`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${_config.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(qboEntry),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`QBO API ${response.status}: ${JSON.stringify(errorData)}`);
      }

      result.exported++;
    } catch (error: unknown) {
      result.failed++;
      result.errors.push({
        entryNumber: entry.entryNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
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
    journalEntry: {
      description: string;
      lines: { accountCode: string; accountName: string; debit: number; credit: number }[];
    };
  };
}> {
  const { prisma } = await import('@/lib/db');
  const totalValue = inventoryItems.reduce((sum, item) => sum + item.totalValue, 0);

  // Fetch real inventory account balance from chart of accounts (account 1210 = Stock de marchandises)
  const inventoryAccount = await prisma.chartOfAccount.findFirst({
    where: { code: '1210' },
  });

  let accountBalance = 0;
  if (inventoryAccount) {
    // Calculate balance from journal lines
    const journalLines = await prisma.journalLine.aggregate({
      where: { accountId: inventoryAccount.id },
      _sum: { debit: true, credit: true },
    });
    accountBalance = Number(journalLines._sum.debit || 0) - Number(journalLines._sum.credit || 0);
  }
  
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
  startDate: Date,
  endDate: Date,
  _accessToken: string
): Promise<{
  transactions: PayPalTransaction[];
  totalReceived: number;
  totalFees: number;
  netAmount: number;
}> {
  const { prisma } = await import('@/lib/db');

  // Fetch real PayPal orders from the database
  const paypalOrders = await prisma.order.findMany({
    where: {
      paymentMethod: 'PAYPAL',
      createdAt: { gte: startDate, lte: endDate },
      paymentStatus: { in: ['PAID', 'REFUNDED'] },
    },
    include: {
      user: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Also fetch PayPal settings for payee email
  const settings = await prisma.accountingSettings.findFirst();
  const payeeEmail = settings?.companyEmail || 'business@biocycle.ca';

  const transactions: PayPalTransaction[] = paypalOrders.map((order) => {
    const amount = Number(order.total);
    // PayPal standard fee: 2.9% + $0.30 CAD
    const estimatedFee = Math.round((amount * 0.029 + 0.30) * 100) / 100;

    return {
      id: order.paypalOrderId || order.id,
      create_time: order.createdAt.toISOString(),
      update_time: order.updatedAt.toISOString(),
      amount: {
        currency_code: 'CAD',
        value: amount.toFixed(2),
      },
      payee: { email_address: payeeEmail },
      payer: {
        email_address: order.user?.email || 'noreply@biocyclepeptides.com',
        name: {
          given_name: order.user?.name?.split(' ')[0] || '',
          surname: order.user?.name?.split(' ').slice(1).join(' ') || '',
        },
      },
      status: order.paymentStatus === 'PAID' ? 'COMPLETED' : 'REFUNDED',
      transaction_info: {
        transaction_id: order.paypalOrderId || order.id,
        transaction_event_code: 'T0006',
        transaction_amount: { currency_code: 'CAD', value: amount.toFixed(2) },
        fee_amount: { currency_code: 'CAD', value: estimatedFee.toFixed(2) },
      },
    };
  });

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
  rows: (string | number)[][];
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

  const rows: (string | number)[][] = [];

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
