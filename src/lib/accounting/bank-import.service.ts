/**
 * Bank Import Service
 * Handles automatic bank transaction imports via Plaid/Flinks or manual CSV
 */

import { BankTransaction, ReconciliationStatus } from './types';

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
 * Simulate Plaid API call for bank transactions
 * In production, replace with actual Plaid SDK calls
 */
export async function fetchPlaidTransactions(
  _accessToken: string,
  _startDate: Date,
  _endDate: Date
): Promise<{ transactions: PlaidTransaction[]; accounts: PlaidAccount[] }> {
  // Simulated response for demo
  // In production: const plaidClient = new PlaidApi(configuration);
  // return plaidClient.transactionsGet({ access_token, start_date, end_date });
  
  return {
    accounts: [
      {
        account_id: 'desjardins-main',
        name: 'Compte courant',
        official_name: 'Compte Entreprise Desjardins',
        type: 'depository',
        subtype: 'checking',
        mask: '4589',
        balances: {
          available: 42500.00,
          current: 45230.50,
          iso_currency_code: 'CAD',
        },
      },
    ],
    transactions: [
      {
        transaction_id: 'plaid-tx-001',
        account_id: 'desjardins-main',
        date: new Date().toISOString().split('T')[0],
        name: 'STRIPE TRANSFER',
        merchant_name: 'Stripe',
        amount: -2500.00,
        iso_currency_code: 'CAD',
        category: ['Transfer', 'Credit'],
        pending: false,
        payment_channel: 'online',
      },
      {
        transaction_id: 'plaid-tx-002',
        account_id: 'desjardins-main',
        date: new Date().toISOString().split('T')[0],
        name: 'MICROSOFT AZURE',
        merchant_name: 'Microsoft Azure',
        amount: 185.50,
        iso_currency_code: 'CAD',
        category: ['Service', 'Web Hosting'],
        pending: false,
        payment_channel: 'online',
      },
      {
        transaction_id: 'plaid-tx-003',
        account_id: 'desjardins-main',
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        name: 'GOOGLE ADS',
        merchant_name: 'Google Ads',
        amount: 125.00,
        iso_currency_code: 'CAD',
        category: ['Service', 'Marketing'],
        pending: false,
        payment_channel: 'online',
      },
      {
        transaction_id: 'plaid-tx-004',
        account_id: 'desjardins-main',
        date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        name: 'POSTES CANADA',
        merchant_name: 'Postes Canada',
        amount: 342.80,
        iso_currency_code: 'CAD',
        category: ['Shops', 'Shipping'],
        pending: false,
        payment_channel: 'online',
      },
    ],
  };
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

    const { transactions, accounts } = await fetchPlaidTransactions(
      connection.accessToken || '',
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

    transactions.push({
      id: `csv-${Date.now()}-${i}`,
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

    transactions.push({
      id: `csv-td-${Date.now()}-${i}`,
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
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

function parseDate(dateStr: string): Date {
  // Try common formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  ];

  for (const format of formats) {
    if (format.test(dateStr)) {
      return new Date(dateStr);
    }
  }

  return new Date(dateStr);
}

/**
 * Get bank connection status
 */
export async function getBankConnections(): Promise<BankConnection[]> {
  // Mock data for demo
  return [
    {
      id: 'conn-1',
      provider: 'PLAID',
      institutionId: 'ins_desjardins',
      institutionName: 'Desjardins',
      accounts: [
        {
          account_id: 'desjardins-main',
          name: 'Compte courant entreprise',
          type: 'depository',
          subtype: 'checking',
          mask: '4589',
          balances: {
            available: 42500,
            current: 45230.50,
            iso_currency_code: 'CAD',
          },
        },
      ],
      lastSync: new Date(Date.now() - 3600000), // 1 hour ago
      status: 'ACTIVE',
    },
  ];
}
