/**
 * Accounting Module - Main Export
 *
 * #86 TODO: Extract common query builder patterns.
 * Multiple API routes (customer-invoices, supplier-invoices, bank-transactions,
 * entries, general-ledger) share nearly identical logic for:
 *   - Date range filter construction + validation (from/to → { gte, lte })
 *   - Pagination param parsing (page/limit with clamping)
 *   - Safe ORDER BY field allowlist (sortBy/sortOrder)
 *   - Soft-delete filter (deletedAt: null)
 * Consolidating these into a shared `buildQueryFilters()` utility would reduce
 * ~15 lines of boilerplate per route and centralise validation rules.
 * Candidate location: src/lib/accounting/query-utils.ts
 *
 * #87 Note: Error message language convention.
 * - API route handlers (src/app/api/accounting/): ALL error messages in French
 *   (these are user-facing and returned in JSON responses).
 * - Service files (src/lib/accounting/): English is acceptable for throw new Error()
 *   (these are internal/technical errors caught and wrapped by API routes).
 * - Do NOT mix languages within the same layer.
 *
 * #88 TODO: Potential circular dependency risk.
 * expense.service.ts and recurring-entries.service.ts both import from '@/lib/db'
 * and operate on the same JournalEntry model. If either service starts importing
 * from the other (e.g. recurring expenses calling createExpenseEntry), a circular
 * dependency will arise. Mitigation: keep these services independent and use the
 * lower-level Prisma calls directly, or extract shared logic into a common
 * journal-entry-factory.ts that both services can import.
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
 *
 * PHASE 8: Automation
 * - Alert rules engine (budget, overdue, reconciliation, tax, unusual amounts)
 * - Auto-reconciliation (by reference, by amount, batch processing)
 * - Recurring entries processing with audit trail
 * - Scheduler service for cron-triggered batch tasks
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
  processRecurringEntries,
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
  logAuditTrail,
  logAuditTrailBatch,
} from './audit-trail.service';
export type { AuditAction, EntityType } from './audit-trail.service';

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

// Error Handler
export {
  handlePrismaError,
  safeJsonParse,
} from './error-handler';

// Validation Schemas
export {
  createJournalEntrySchema,
  updateJournalEntrySchema,
  createCustomerInvoiceSchema,
  createExpenseSchema,
  createBudgetSchema,
  formatZodErrors,
} from './validation';

// PHASE 8: Alert Rules Service
export {
  evaluateAlertRules,
  getActiveAlerts,
} from './alert-rules.service';
export type { AlertRuleType, AlertRuleResult } from './alert-rules.service';

// PHASE 8: Auto-Reconciliation Service
export {
  autoReconcileByReference,
  autoReconcileByAmount,
  runAutoReconciliation,
} from './auto-reconciliation.service';
export type { ReconciliationMatch, AutoReconciliationResult } from './auto-reconciliation.service';

// PHASE 8: Scheduler Service
export {
  runScheduledTasks,
} from './scheduler.service';
export type { ScheduledTaskResult, SchedulerRunResult } from './scheduler.service';

// PHASE 10: KPI Service
export {
  calculateKPIs,
  getKPITrend,
} from './kpi.service';
export type { FinancialKPIs, KPITrendPoint } from './kpi.service';

// PHASE 10: Payment Matching Service
export {
  findPaymentMatches,
  applyPaymentMatch,
  suggestUnmatchedPayments,
} from './payment-matching.service';
export type { PaymentMatch, MatchResult, UnmatchedSuggestion } from './payment-matching.service';

// PHASE 10: Report Templates Service
export {
  generateBalanceSheet as generateBalanceSheetData,
  generateIncomeStatement as generateIncomeStatementData,
  generateCashFlowStatement,
} from './report-templates.service';
export type {
  BalanceSheetData,
  IncomeStatementData,
  CashFlowStatementData,
  ReportLineItem,
  ReportCategory,
} from './report-templates.service';
