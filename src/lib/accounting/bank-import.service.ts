/**
 * Bank Import Service
 * Handles automatic bank transaction imports via Plaid/Flinks or manual CSV
 */

import { BankTransaction, ReconciliationStatus } from './types';
import { decrypt } from '@/lib/security';
import { logger } from '@/lib/logger';

/** Try to decrypt a value; if it fails (legacy plaintext), return as-is */
async function safeDecryptField(value: string | null): Promise<string | null> {
  if (!value) return null;
  try {
    return await decrypt(value);
  } catch (error) {
    console.error('[BankImport] Decryption failed for field (returning raw value):', error);
    return value;
  }
}

// Plaid-like transaction structure
interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  date: string;
  name: string;
  merchant_name?: string;
  amount: number; // Positive = debit, negative = credit
  iso_currency_code: string;
  category?: string[];
  pending: boolean;
  payment_channel: 'online' | 'in_store' | 'other';
}

interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string;
  type: 'depository' | 'credit' | 'loan' | 'investment';
  subtype?: string;
  mask?: string;
  balances: {
    available?: number;
    current: number;
    iso_currency_code: string;
  };
}

interface BankConnection {
  id: string;
  provider: 'PLAID' | 'FLINKS' | 'MANUAL';
  institutionId: string;
  institutionName: string;
  accounts: PlaidAccount[];
  accessToken?: string; // Encrypted
  lastSync: Date;
  status: 'ACTIVE' | 'REQUIRES_REAUTH' | 'ERROR';
}

// FIX: F092 - TODO: Add French equivalents for Plaid categories from francophone Canadian banks
// e.g. 'Frais bancaires:Frais de service' → same as 'Bank Fees:Service Charge'
// Category mapping for automatic categorization
const CATEGORY_MAPPING: Record<string, { accountCode: string; description: string }> = {
  // Revenue
  'Transfer:Deposit': { accountCode: '4010', description: 'Ventes' },
  'Transfer:Credit': { accountCode: '4010', description: 'Ventes' },
  
  // Payment processors
  'Payment:Stripe': { accountCode: '1040', description: 'Transfert Stripe' },
  'Payment:PayPal': { accountCode: '1030', description: 'Transfert PayPal' },
  
  // Operating expenses
  'Service:Web Hosting': { accountCode: '6310', description: 'Hébergement web' },
  'Service:Software': { accountCode: '6330', description: 'Logiciels SaaS' },
  'Service:Marketing': { accountCode: '6210', description: 'Marketing' },
  'Shops:Shipping': { accountCode: '6010', description: 'Frais de livraison' },
  
  // Bank fees
  'Bank Fees:Service Charge': { accountCode: '6130', description: 'Frais bancaires' },
  'Bank Fees:Foreign Transaction': { accountCode: '6130', description: 'Frais de change' },
  'Bank Fees:Overdraft': { accountCode: '6130', description: 'Frais de découvert' },
  
  // Professional services
  'Service:Accounting': { accountCode: '6710', description: 'Comptabilité' },
  'Service:Legal': { accountCode: '6720', description: 'Frais juridiques' },
  
  // Default
  'default': { accountCode: '6999', description: 'Dépense non classée' },
};

// Known merchant patterns for auto-categorization
const MERCHANT_PATTERNS: { pattern: RegExp; category: string }[] = [
  { pattern: /stripe/i, category: 'Payment:Stripe' },
  { pattern: /paypal/i, category: 'Payment:PayPal' },
  { pattern: /azure|microsoft/i, category: 'Service:Web Hosting' },
  { pattern: /aws|amazon web/i, category: 'Service:Web Hosting' },
  { pattern: /google\s*(ads|cloud)/i, category: 'Service:Marketing' },
  { pattern: /facebook|meta\s*ads/i, category: 'Service:Marketing' },
  { pattern: /postes canada|canada post|purolator|fedex|ups|dhl/i, category: 'Shops:Shipping' },
  { pattern: /openai|anthropic|chatgpt/i, category: 'Service:Software' },
  { pattern: /godaddy|namecheap|cloudflare/i, category: 'Service:Web Hosting' },
  { pattern: /quickbooks|xero|freshbooks/i, category: 'Service:Accounting' },
];

/**
 * Categorize a transaction based on merchant name and Plaid categories
 */
export function categorizeTransaction(
  merchantName: string,
  plaidCategories?: string[]
): { accountCode: string; description: string; confidence: number } {
  // Try merchant pattern matching first (highest confidence)
  for (const { pattern, category } of MERCHANT_PATTERNS) {
    if (pattern.test(merchantName)) {
      const mapping = CATEGORY_MAPPING[category] || CATEGORY_MAPPING['default'];
      return { ...mapping, confidence: 0.95 };
    }
  }

  // Try Plaid categories
  if (plaidCategories && plaidCategories.length > 0) {
    const categoryKey = plaidCategories.join(':');
    for (const [key, mapping] of Object.entries(CATEGORY_MAPPING)) {
      if (categoryKey.toLowerCase().includes(key.toLowerCase())) {
        return { ...mapping, confidence: 0.8 };
      }
    }
  }

  // Default
  return { ...CATEGORY_MAPPING['default'], confidence: 0.3 };
}

/**
 * Convert Plaid transactions to our BankTransaction format
 */
export function convertPlaidTransactions(
  plaidTransactions: PlaidTransaction[],
  bankAccountId: string
): BankTransaction[] {
  return plaidTransactions
    .filter(t => !t.pending) // Skip pending transactions
    .map(t => {
      const { accountCode, description, confidence } = categorizeTransaction(
        t.merchant_name || t.name,
        t.category
      );

      return {
        id: t.transaction_id,
        bankAccountId,
        date: new Date(t.date),
        description: t.merchant_name || t.name,
        amount: Math.abs(t.amount),
        type: t.amount > 0 ? 'DEBIT' : 'CREDIT',
        category: description,
        reference: t.transaction_id,
        reconciliationStatus: 'PENDING' as ReconciliationStatus,
        importedAt: new Date(),
        rawData: {
          plaidTransactionId: t.transaction_id,
          suggestedAccountCode: accountCode,
          categorySuggestion: description,
          categoryConfidence: confidence,
          paymentChannel: t.payment_channel,
          originalCategories: t.category,
        },
      };
    });
}

/**
 * Fetch bank transactions from the database
 * Queries real BankTransaction records and converts them to Plaid-compatible format
 */
export async function fetchPlaidTransactions(
  bankAccountId: string,
  startDate: Date,
  endDate: Date
): Promise<{ transactions: PlaidTransaction[]; accounts: PlaidAccount[] }> {
  const { prisma } = await import('@/lib/db');

  // Fetch real bank account
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { id: bankAccountId },
  });

  if (!bankAccount) {
    return { transactions: [], accounts: [] };
  }

  // Fetch real transactions from database
  const dbTransactions = await prisma.bankTransaction.findMany({
    where: {
      bankAccountId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'desc' },
  });

  const accounts: PlaidAccount[] = [
    {
      account_id: bankAccount.id,
      name: bankAccount.name,
      official_name: `${bankAccount.institution} - ${bankAccount.name}`,
      type: 'depository',
      subtype: bankAccount.type.toLowerCase() === 'savings' ? 'savings' : 'checking',
      mask: bankAccount.accountNumber ? (await safeDecryptField(bankAccount.accountNumber))?.slice(-4) : undefined,
      balances: {
        available: Number(bankAccount.currentBalance),
        current: Number(bankAccount.currentBalance),
        iso_currency_code: bankAccount.currency,
      },
    },
  ];

  const transactions: PlaidTransaction[] = dbTransactions.map((tx) => ({
    transaction_id: tx.id,
    account_id: bankAccountId,
    date: tx.date.toISOString().split('T')[0],
    name: tx.description,
    merchant_name: tx.description,
    amount: tx.type === 'DEBIT' ? Number(tx.amount) : -Number(tx.amount),
    iso_currency_code: bankAccount.currency,
    category: tx.category ? [tx.category] : undefined,
    pending: false,
    payment_channel: 'online' as const,
  }));

  return { transactions, accounts };
}

/**
 * Sync bank account with Plaid
 */
export async function syncBankAccount(
  connection: BankConnection,
  daysBack: number = 30
): Promise<{
  success: boolean;
  transactionsImported: number;
  newTransactions: BankTransaction[];
  errors: string[];
}> {
  const result = {
    success: true,
    transactionsImported: 0,
    newTransactions: [] as BankTransaction[],
    errors: [] as string[],
  };

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Use the first account ID from the connection
    const primaryAccountId = connection.accounts[0]?.account_id || '';
    const { transactions, accounts } = await fetchPlaidTransactions(
      primaryAccountId,
      startDate,
      endDate
    );

    // Convert and deduplicate transactions
    for (const account of accounts) {
      const accountTransactions = transactions.filter(t => t.account_id === account.account_id);
      const converted = convertPlaidTransactions(accountTransactions, account.account_id);
      
      // In production, check for duplicates in database
      result.newTransactions.push(...converted);
      result.transactionsImported += converted.length;
    }

  } catch (error) {
    console.error('[BankImport] Sync error during bank import:', error);
    result.success = false;
    result.errors.push(`Sync error: ${error}`);
  }

  return result;
}

/**
 * Parse bank statement from CSV (Desjardins format)
 */
export function parseDesjardinsCSV(csvContent: string): BankTransaction[] {
  const lines = csvContent.split('\n').filter(l => l.trim());
  const transactions: BankTransaction[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 5) continue;

    // Desjardins format: Date,Description,Retrait,Dépôt,Solde
    const date = parseDate(cols[0]);
    const description = cols[1].trim();
    const withdrawal = parseFloat(cols[2].replace(/[^0-9.-]/g, '')) || 0;
    const deposit = parseFloat(cols[3].replace(/[^0-9.-]/g, '')) || 0;

    const amount = withdrawal > 0 ? withdrawal : deposit;
    const type = withdrawal > 0 ? 'DEBIT' : 'CREDIT';

    if (amount === 0) continue;

    const { accountCode, description: category, confidence } = categorizeTransaction(description, []);

    // FIX (F033): Use crypto.randomUUID() instead of Date.now()-based IDs
    // to prevent collisions when two CSV files are imported at the same millisecond
    transactions.push({
      id: `csv-${crypto.randomUUID()}`,
      // FIX: F057 - bankAccountId should be parameterized, not hardcoded.
      // Using 'desjardins-main' as default; callers should pass bankAccountId via function param.
      bankAccountId: 'desjardins-main',
      date,
      description,
      amount,
      type,
      category,
      reconciliationStatus: 'PENDING',
      importedAt: new Date(),
      rawData: {
        suggestedAccountCode: accountCode,
        categoryConfidence: confidence,
        importSource: 'CSV-Desjardins',
        lineNumber: i,
      },
    });
  }

  return transactions;
}

/**
 * Parse bank statement from CSV (TD format)
 * FIX: F057 - bankAccountId is hardcoded to 'td-main'; should be parameterized.
 * TODO: Accept bankAccountId as function parameter for both parseDesjardinsCSV and parseTDCSV.
 */
export function parseTDCSV(csvContent: string): BankTransaction[] {
  const lines = csvContent.split('\n').filter(l => l.trim());
  const transactions: BankTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 4) continue;

    // TD format: Date,Description,Withdrawals,Deposits,Balance
    const date = parseDate(cols[0]);
    const description = cols[1].trim();
    const withdrawal = parseFloat(cols[2].replace(/[^0-9.-]/g, '')) || 0;
    const deposit = parseFloat(cols[3].replace(/[^0-9.-]/g, '')) || 0;

    const amount = withdrawal > 0 ? withdrawal : deposit;
    const type = withdrawal > 0 ? 'DEBIT' : 'CREDIT';

    if (amount === 0) continue;

    const { accountCode, description: category, confidence } = categorizeTransaction(description, []);

    // FIX (F033): Use crypto.randomUUID() for TD CSV imports too
    transactions.push({
      id: `csv-td-${crypto.randomUUID()}`,
      bankAccountId: 'td-main',
      date,
      description,
      amount,
      type,
      category,
      reconciliationStatus: 'PENDING',
      importedAt: new Date(),
      rawData: {
        suggestedAccountCode: accountCode,
        categoryConfidence: confidence,
        importSource: 'CSV-TD',
        lineNumber: i,
      },
    });
  }

  return transactions;
}

/**
 * Detect CSV format automatically
 */
export function detectCSVFormat(csvContent: string): 'desjardins' | 'td' | 'rbc' | 'generic' {
  const firstLine = csvContent.split('\n')[0].toLowerCase();
  
  if (firstLine.includes('retrait') && firstLine.includes('dépôt')) {
    return 'desjardins';
  }
  if (firstLine.includes('withdrawals') && firstLine.includes('deposits')) {
    return 'td';
  }
  if (firstLine.includes('cad$')) {
    return 'rbc';
  }
  
  return 'generic';
}

// Helper functions
// F051 FIX: Handle escaped quotes ("") properly in CSV fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Escaped quote ("") → single quote
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  result.push(current.trim());

  return result;
}

/**
 * FIX (F032): Parse date strings properly for Canadian bank formats.
 * new Date(dateStr) interprets DD/MM/YYYY as MM/DD/YYYY in JS,
 * so we must manually parse the components for DD/MM/YYYY and DD-MM-YYYY.
 */
function parseDate(dateStr: string): Date {
  // YYYY-MM-DD (ISO) - safe for new Date()
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  // DD/MM/YYYY (Desjardins, European format)
  const slashMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1]);
    const month = parseInt(slashMatch[2]) - 1;
    const year = parseInt(slashMatch[3]);
    return new Date(year, month, day);
  }

  // DD-MM-YYYY
  const dashMatch = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    const day = parseInt(dashMatch[1]);
    const month = parseInt(dashMatch[2]) - 1;
    const year = parseInt(dashMatch[3]);
    return new Date(year, month, day);
  }

  // Fallback - let JS handle it (with warning)
  logger.warn('parseDate: Unknown date format, using native Date parsing', { dateStr });
  return new Date(dateStr);
}

/**
 * Get bank connections from database
 * Queries real BankAccount records and groups them by institution
 */
export async function getBankConnections(): Promise<BankConnection[]> {
  const { prisma } = await import('@/lib/db');

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { isActive: true },
    orderBy: { institution: 'asc' },
  });

  // Group accounts by institution
  const byInstitution = new Map<string, typeof bankAccounts>();
  for (const account of bankAccounts) {
    const existing = byInstitution.get(account.institution) || [];
    existing.push(account);
    byInstitution.set(account.institution, existing);
  }

  const connections: BankConnection[] = [];
  for (const [institution, accounts] of byInstitution) {
    connections.push({
      id: `conn-${accounts[0].id}`,
      provider: accounts[0].type === 'STRIPE' || accounts[0].type === 'PAYPAL' ? 'MANUAL' : 'PLAID',
      institutionId: `ins_${institution.toLowerCase().replace(/\s+/g, '_')}`,
      institutionName: institution,
      accounts: await Promise.all(accounts.map(async (acc) => ({
        account_id: acc.id,
        name: acc.name,
        official_name: `${institution} - ${acc.name}`,
        type: 'depository' as const,
        subtype: acc.type.toLowerCase() === 'savings' ? 'savings' : 'checking',
        mask: acc.accountNumber ? (await safeDecryptField(acc.accountNumber))?.slice(-4) : undefined,
        balances: {
          available: Number(acc.currentBalance),
          current: Number(acc.currentBalance),
          iso_currency_code: acc.currency,
        },
      }))),
      lastSync: accounts[0].lastSyncAt || accounts[0].updatedAt || new Date(),
      status: 'ACTIVE',
    });
  }

  return connections;
}
