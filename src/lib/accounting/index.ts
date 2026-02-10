/**
 * Accounting Module - Main Export
 * 
 * Comprehensive accounting functionality for BioCycle Peptides:
 * 
 * PHASE 1-2: Core Functionality
 * - Automatic journal entries from sales, refunds, and fees
 * - Stripe payment integration and synchronization
 * - Bank reconciliation with intelligent matching
 * - PDF generation for tax reports and financial statements
 * - Intelligent alerts for overdue invoices, low cash, and tax deadlines
 * - Aging reports for accounts receivable and payable
 * 
 * PHASE 3: Automation
 * - Recurring entries (depreciation, subscriptions)
 * - Bank import via Plaid/CSV
 * - ML-based reconciliation
 * 
 * PHASE 4: Reporting
 * - Cash flow forecasting
 * - Scenario analysis
 * 
 * PHASE 5: Compliance
 * - Complete audit trail
 * - TPS/TVQ form generation
 * - Multi-currency with auto FX rates
 * 
 * PHASE 6: Integrations
 * - QuickBooks/Sage export
 * - Inventory sync & COGS
 * - PayPal webhook
 * 
 * PHASE 7: UX
 * - Quick entry templates
 * - OCR invoice scanning
 * - Advanced search
 */

// Types
export * from './types';

// Auto Entries Service
export {
  generateSaleEntry,
  generateFeeEntry,
  generateRefundEntry,
  generateStripePayoutEntry,
  generateRecurringEntry,
  calculateTaxes,
  validateEntry,
  getAccountName,
} from './auto-entries.service';

// Stripe Sync Service
export {
  syncStripeCharges,
  syncStripeRefunds,
  syncStripePayouts,
  getStripeBalance,
  fullStripeSync,
} from './stripe-sync.service';

// Reconciliation Service
export {
  autoReconcile,
  manualMatch,
  markAsUnmatched,
  createEntryFromBankTransaction,
  getReconciliationSummary,
  parseBankStatementCSV,
} from './reconciliation.service';

// PDF Reports Service
export {
  generateTaxReportHTML,
  generateIncomeStatementHTML,
  generateBalanceSheetHTML,
  generateJournalEntryHTML,
} from './pdf-reports.service';

// Alerts Service
export {
  generateAlerts,
  generateClosingAlerts,
  generatePaymentReminders,
  detectExpenseAnomalies,
  getNextTaxDeadline,
  getAlertStyle,
} from './alerts.service';

// Aging Service
export {
  generateAgingReport,
  getCollectionPriority,
  getAgingSummaryStats,
  formatAgingReportHTML,
  exportAgingToCSV,
} from './aging.service';

// PHASE 3: Recurring Entries Service
export {
  getRecurringTemplates,
  createRecurringTemplate,
  calculateNextRunDate,
  processDueRecurringEntries,
  previewRecurringSchedule,
  getFrequencyLabel,
  PREDEFINED_TEMPLATES,
} from './recurring-entries.service';

// PHASE 3: Bank Import Service
export {
  categorizeTransaction,
  convertPlaidTransactions,
  fetchPlaidTransactions,
  syncBankAccount,
  parseDesjardinsCSV,
  parseTDCSV,
  detectCSVFormat,
  getBankConnections,
} from './bank-import.service';

// PHASE 3: ML Reconciliation Service
export {
  intelligentReconcile,
  learnFromMatch,
  getLearnedRules,
  deleteLearnedRule,
  detectAnomalies,
} from './ml-reconciliation.service';

// PHASE 4: Forecasting Service
export {
  forecastRevenue,
  generateCashFlowProjection,
  runScenarioAnalysis,
  generateCashFlowAlerts,
  formatProjectionSummary,
  STANDARD_SCENARIOS,
} from './forecasting.service';

// PHASE 5: Audit Trail Service
export {
  logAuditEntry,
  generateChanges,
  getAuditHistory,
  generateAuditReport,
  exportAuditToCSV,
  getActionLabel,
  getEntityLabel,
} from './audit-trail.service';

// PHASE 5: Tax Compliance Service
export {
  calculateSalesTax,
  generateTaxSummary,
  generateFPZ500Data,
  calculateFilingDueDate,
  createTaxReport,
  getTaxFilingReminders,
  validateTaxNumbers,
  PROVINCIAL_TAX_RATES,
} from './tax-compliance.service';

// PHASE 5: Currency Service
export {
  getExchangeRate,
  convertCurrency,
  calculateFxGainLoss,
  createFxJournalEntry,
  formatCurrency,
  getHistoricalRates,
  revalueForeignAccounts,
  getExchangeRateSummary,
  CURRENCIES,
} from './currency.service';

// PHASE 6: Integrations Service
export {
  convertToQBOFormat,
  exportToQuickBooks,
  exportToSageCSV,
  calculateCOGS,
  syncInventoryValuation,
  processPayPalWebhook,
  syncPayPalTransactions,
  exportToIIF,
  exportToExcel,
} from './integrations.service';

// PHASE 7: Quick Entry Service
export {
  evaluateFormula,
  generateEntryFromTemplate,
  getTemplatesByFrequency,
  recordTemplateUsage,
  parseKeyboardEvent,
  duplicateEntry,
  reverseEntry,
  parseCSVForEntries,
  DEFAULT_TEMPLATES,
  KEYBOARD_SHORTCUTS,
} from './quick-entry.service';

// PHASE 7: OCR Service
export {
  processInvoiceWithVision,
  processInvoiceFromText,
  createInvoiceFromOCR,
  validateOCRFile,
  SUPPORTED_FILE_TYPES,
} from './ocr.service';

// PHASE 7: Search Service
export {
  advancedSearch,
  saveSearch,
  getSavedSearches,
  deleteSavedSearch,
  recordSearchUsage,
  getSearchSuggestions,
  getPopularSearchTerms,
  getFilterOptions,
} from './search.service';
