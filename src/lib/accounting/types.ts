// Types for the accounting module
//
// TODO #80: Define and enforce a data retention policy for accounting records.
// Canadian tax law (CRA) requires businesses to keep records for at least 6 years
// from the end of the last tax year they relate to. Quebec (Revenu Quebec) also
// requires 6-year retention. Considerations:
//   - Soft-deleted records (deletedAt != null) should be purged only after 6+ years
//   - FILED TaxReports must NEVER be purged (regulatory requirement)
//   - JournalEntries tied to active fiscal years must be retained
//   - BankTransactions: retain matched records for 6 years, unmatched for review
//   - Implement a scheduled job (e.g., cron) to archive/purge expired records
//   - Add a `retainUntil` field to key models for automated retention enforcement

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export type JournalEntryType = 
  | 'MANUAL' 
  | 'AUTO_SALE' 
  | 'AUTO_REFUND' 
  | 'AUTO_STRIPE_FEE' 
  | 'AUTO_PAYPAL_FEE'
  | 'AUTO_SHIPPING'
  | 'AUTO_PURCHASE'
  | 'RECURRING'
  | 'ADJUSTMENT'
  | 'CLOSING';

export type JournalEntryStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

export type TransactionType = 'CREDIT' | 'DEBIT';

export type ReconciliationStatus = 'PENDING' | 'MATCHED' | 'UNMATCHED' | 'MANUAL';

export type TaxType = 'TPS' | 'TVQ' | 'TVH' | 'PST' | 'GST' | 'SALES_TAX' | 'VAT';

// Account codes for BioCycle (Quebec NCECF structure)
export const ACCOUNT_CODES = {
  // Assets (1000-1999)
  CASH_BANK_MAIN: '1010',
  CASH_BANK_USD: '1020',
  CASH_PAYPAL: '1030',
  CASH_STRIPE: '1040',
  ACCOUNTS_RECEIVABLE_CA: '1110',
  ACCOUNTS_RECEIVABLE_US: '1120',
  ACCOUNTS_RECEIVABLE_INTL: '1130',
  INVENTORY: '1210',
  INVENTORY_IN_TRANSIT: '1220',
  INVENTORY_OBSOLESCENCE: '1230',
  PREPAID_EXPENSES: '1300',
  EQUIPMENT: '1510',
  ACCUMULATED_DEPRECIATION: '1590',

  // Liabilities (2000-2999)
  ACCOUNTS_PAYABLE: '2000',
  TPS_PAYABLE: '2110',
  TVQ_PAYABLE: '2120',
  TVH_PAYABLE: '2130',
  PST_PAYABLE: '2150',
  INTL_TAX_PAYABLE: '2140',
  DEFERRED_REVENUE: '2300',

  // Equity (3000-3999)
  SHARE_CAPITAL: '3000',
  RETAINED_EARNINGS: '3100',

  // Revenue (4000-4999)
  SALES_CANADA: '4010',
  SALES_USA: '4020',
  SALES_EUROPE: '4030',
  SALES_OTHER: '4040',
  SHIPPING_CHARGED: '4100',
  DISCOUNTS_RETURNS: '4900',

  // COGS (5000-5999)
  PURCHASES: '5010',
  CUSTOMS_DUTIES: '5100',
  INBOUND_SHIPPING: '5200',

  // Operating Expenses (6000-6999)
  SHIPPING_EXPENSE: '6000',
  SHIPPING_CANADA_POST: '6010',
  SHIPPING_UPS_FEDEX: '6020',
  SHIPPING_INTERNATIONAL: '6030',
  STRIPE_FEES: '6110',
  PAYPAL_FEES: '6120',
  BANK_FEES: '6130',
  MARKETING_GOOGLE: '6210',
  MARKETING_FACEBOOK: '6220',
  MARKETING_INFLUENCER: '6230',
  PROMO_DISCOUNTS: '6240',
  HOSTING_AZURE: '6310',
  DOMAINS_SSL: '6320',
  SAAS_SERVICES: '6330',
  PROFESSIONAL_ACCOUNTING: '6710',
  PROFESSIONAL_LEGAL: '6720',
  DEPRECIATION: '6800',
  INVENTORY_LOSS: '6900',

  // Other (7000-7999)
  FX_GAINS_LOSSES: '7000',
  INTEREST_INCOME: '7100',
  INTEREST_EXPENSE: '7200',
} as const;

// Tax rates by province/region
export const TAX_RATES = {
  QC: { TPS: 0.05, TVQ: 0.09975, combined: 0.14975 },
  ON: { TVH: 0.13, combined: 0.13 },
  BC: { TPS: 0.05, PST: 0.07, combined: 0.12 },
  AB: { TPS: 0.05, combined: 0.05 },
  SK: { TPS: 0.05, PST: 0.06, combined: 0.11 },
  MB: { TPS: 0.05, PST: 0.07, combined: 0.12 },
  NS: { TVH: 0.15, combined: 0.15 },
  NB: { TVH: 0.15, combined: 0.15 },
  NL: { TVH: 0.15, combined: 0.15 },
  PE: { TVH: 0.15, combined: 0.15 },
  NT: { TPS: 0.05, combined: 0.05 },
  YT: { TPS: 0.05, combined: 0.05 },
  NU: { TPS: 0.05, combined: 0.05 },
  US: { combined: 0 }, // No Canadian tax for US
  INTL: { combined: 0 }, // No Canadian tax for international
} as const;

export interface JournalEntry {
  id: string;
  entryNumber: string;
  date: Date;
  description: string;
  type: JournalEntryType;
  status: JournalEntryStatus;
  reference?: string;
  orderId?: string;
  lines: JournalLine[];
  createdBy: string;
  createdAt: Date;
  postedAt?: Date;
  voidedAt?: Date;
  attachments?: string[];
}

export interface JournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  description?: string;
  debit: number;
  credit: number;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  date: Date;
  description: string;
  amount: number;
  type: TransactionType;
  reference?: string;
  category?: string;
  reconciliationStatus: ReconciliationStatus;
  matchedJournalEntryId?: string;
  importedAt: Date;
  rawData?: Record<string, unknown>;
}

export interface TaxReport {
  id: string;
  period: string;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  year: number;
  month?: number;
  quarter?: number;
  region: string;
  regionCode: string;
  
  // Collected taxes
  tpsCollected: number;
  tvqCollected: number;
  tvhCollected: number;
  otherTaxCollected: number;
  
  // Input tax credits
  tpsPaid: number;
  tvqPaid: number;
  tvhPaid: number;
  otherTaxPaid: number;
  
  // Net amounts
  netTps: number;
  netTvq: number;
  netTvh: number;
  netTotal: number;
  
  // Metadata
  salesCount: number;
  totalSales: number;
  status: 'DRAFT' | 'GENERATED' | 'FILED' | 'PAID';
  generatedAt: Date;
  filedAt?: Date;
  paidAt?: Date;
  dueDate: Date;
}

export interface AccountBalance {
  accountCode: string;
  accountName: string;
  type: AccountType;
  openingBalance: number;
  debits: number;
  credits: number;
  closingBalance: number;
  period: string;
}

export interface FinancialStatement {
  type: 'BALANCE_SHEET' | 'INCOME_STATEMENT' | 'CASH_FLOW';
  period: string;
  generatedAt: Date;
  data: Record<string, number>;
}

export interface ReconciliationResult {
  matched: number;
  unmatched: number;
  suggestions: ReconciliationSuggestion[];
}

export interface ReconciliationSuggestion {
  bankTransactionId: string;
  journalEntryId: string;
  confidence: number;
  reason: string;
}

export interface Alert {
  id: string;
  type: 'OVERDUE_INVOICE' | 'LOW_CASH' | 'TAX_DUE' | 'RECONCILIATION_PENDING' | 'EXPENSE_ANOMALY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  link?: string;
  createdAt: Date;
  readAt?: Date;
  resolvedAt?: Date;
}
