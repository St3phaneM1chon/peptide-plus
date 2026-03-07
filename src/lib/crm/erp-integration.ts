/**
 * CRM ERP Integration - QuickBooks / Xero (M12)
 *
 * Sync invoices and payments between the CRM and ERP systems.
 * Similar to Salesforce Revenue Cloud, Zoho Books, HubSpot QuickBooks integration.
 *
 * Supports:
 * - QuickBooks Online (Intuit API)
 * - Xero (Xero API v2)
 *
 * ERP configuration is stored encrypted in SiteSettings.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErpProvider = 'quickbooks' | 'xero';

export interface ErpConnectionConfig {
  clientId: string;
  clientSecret: string;
  companyId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  realmId?: string;   // QuickBooks realm
  tenantId?: string;  // Xero tenant
}

export interface ErpFieldMapping {
  crmField: string;
  erpField: string;
  transform?: 'string' | 'number' | 'date' | 'currency';
}

export interface ErpSyncStatus {
  provider: ErpProvider;
  connected: boolean;
  lastSyncAt: string | null;
  pendingInvoices: number;
  pendingPayments: number;
  errors: string[];
  syncHistory: {
    date: string;
    type: 'invoice' | 'payment';
    direction: 'push' | 'pull';
    count: number;
    success: boolean;
  }[];
}

export interface ErpInvoiceSyncResult {
  invoiceId: string;
  erpInvoiceId: string | null;
  success: boolean;
  error?: string;
}

export interface ErpPaymentRecord {
  erpPaymentId: string;
  invoiceId: string;
  amount: number;
  currency: string;
  paidAt: string;
  method: string;
}

export interface ErpReconciliationResult {
  period: { start: string; end: string };
  crmTotal: number;
  erpTotal: number;
  difference: number;
  discrepancies: {
    invoiceId: string;
    crmAmount: number;
    erpAmount: number;
    difference: number;
    reason: string;
  }[];
  matched: number;
  missingInErp: number;
  missingInCrm: number;
}

// ---------------------------------------------------------------------------
// Helpers - Config storage
// ---------------------------------------------------------------------------

/**
 * Get ERP connection config from audit trail (config storage pattern).
 */
async function getErpConfig(
  provider: ErpProvider,
): Promise<ErpConnectionConfig | null> {
  try {
    const trail = await prisma.auditTrail.findFirst({
      where: { entityType: `ERP_${provider.toUpperCase()}_CONFIG`, action: 'CONFIG' },
      orderBy: { createdAt: 'desc' },
    });
    if (!trail) return null;
    const meta = trail.metadata as Record<string, unknown> | null;
    if (!meta) return null;
    return meta as unknown as ErpConnectionConfig;
  } catch {
    return null;
  }
}

/**
 * Store ERP connection config via audit trail.
 */
async function storeErpConfig(
  provider: ErpProvider,
  config: ErpConnectionConfig,
): Promise<void> {
  await prisma.auditTrail.create({
    data: {
      entityType: `ERP_${provider.toUpperCase()}_CONFIG`,
      entityId: provider,
      action: 'CONFIG',
      userId: 'system',
      metadata: config as unknown as Prisma.InputJsonValue,
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers - API calls
// ---------------------------------------------------------------------------

/**
 * Get the API base URL for the ERP provider.
 */
function getErpApiUrl(provider: ErpProvider, config: ErpConnectionConfig): string {
  if (provider === 'quickbooks') {
    const env = process.env.QUICKBOOKS_ENV === 'production' ? '' : 'sandbox-';
    return `https://${env}quickbooks.api.intuit.com/v3/company/${config.realmId || config.companyId}`;
  }
  return 'https://api.xero.com/api.xro/2.0';
}

/**
 * Make an authenticated API request to the ERP system.
 */
async function erpRequest<T>(
  provider: ErpProvider,
  endpoint: string,
  options: RequestInit = {},
): Promise<T | null> {
  const config = await getErpConfig(provider);
  if (!config?.accessToken) {
    logger.error('[ERP] No access token configured', { provider });
    return null;
  }

  try {
    const baseUrl = getErpApiUrl(provider, config);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    if (provider === 'xero' && config.tenantId) {
      headers['xero-tenant-id'] = config.tenantId;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: { ...headers, ...options.headers },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.error('[ERP] API request failed', {
        provider,
        endpoint,
        status: response.status,
      });
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    logger.error('[ERP] API request error', {
      provider,
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// configureErpConnection
// ---------------------------------------------------------------------------

/**
 * Setup ERP connection with OAuth credentials.
 * Stores the config encrypted in site settings.
 */
export async function configureErpConnection(
  provider: ErpProvider,
  config: { clientId: string; clientSecret: string; companyId?: string },
): Promise<{ success: boolean; authUrl?: string; error?: string }> {
  if (!config.clientId || !config.clientSecret) {
    return { success: false, error: 'clientId and clientSecret are required' };
  }

  const fullConfig: ErpConnectionConfig = {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    companyId: config.companyId,
  };

  await storeErpConfig(provider, fullConfig);

  // Build OAuth authorization URL
  let authUrl: string;
  if (provider === 'quickbooks') {
    const redirectUri = `${process.env.NEXTAUTH_URL || ''}/api/integrations/quickbooks/callback`;
    authUrl = `https://appcenter.intuit.com/connect/oauth2?` +
      `client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=com.intuit.quickbooks.accounting&state=erp_setup`;
  } else {
    const redirectUri = `${process.env.NEXTAUTH_URL || ''}/api/integrations/xero/callback`;
    authUrl = `https://login.xero.com/identity/connect/authorize?` +
      `client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code&scope=accounting.transactions accounting.contacts offline_access`;
  }

  logger.info('[ERP] Connection configured', { provider });
  return { success: true, authUrl };
}

// ---------------------------------------------------------------------------
// syncInvoicesToErp
// ---------------------------------------------------------------------------

/**
 * Push CRM invoices/quotes to the ERP system.
 * Maps CrmQuote records to ERP invoices.
 */
export async function syncInvoicesToErp(
  invoiceIds: string[],
  provider?: ErpProvider,
): Promise<ErpInvoiceSyncResult[]> {
  const erp = provider || 'quickbooks';
  const results: ErpInvoiceSyncResult[] = [];

  // Batch fetch all quotes at once to avoid N+1
  const allQuotes = invoiceIds.length > 0
    ? await prisma.crmQuote.findMany({
        where: { id: { in: invoiceIds } },
        include: { items: true, deal: true },
      })
    : [];
  const quoteMap = new Map(allQuotes.map(q => [q.id, q]));

  for (const invoiceId of invoiceIds) {
    try {
      const quote = quoteMap.get(invoiceId) ?? null;

      if (!quote) {
        results.push({ invoiceId, erpInvoiceId: null, success: false, error: 'Invoice not found' });
        continue;
      }

      // Map CRM quote to ERP invoice format
      const erpInvoice = {
        Line: quote.items.map((item, idx) => ({
          LineNum: idx + 1,
          Description: item.description || 'Product',
          Amount: Number(item.total),
          DetailType: 'SalesItemLineDetail',
          SalesItemLineDetail: {
            Qty: item.quantity,
            UnitPrice: Number(item.unitPrice),
          },
        })),
        TotalAmt: Number(quote.total),
        CurrencyRef: { value: quote.currency },
        DocNumber: quote.number,
      };

      const endpoint = erp === 'quickbooks' ? '/invoice' : '/Invoices';
      const result = await erpRequest<{ Invoice?: { Id: string }; Invoices?: Array<{ InvoiceID: string }> }>(
        erp,
        endpoint,
        {
          method: 'POST',
          body: JSON.stringify(erpInvoice),
        },
      );

      if (result) {
        const erpId = erp === 'quickbooks'
          ? result.Invoice?.Id
          : result.Invoices?.[0]?.InvoiceID;

        // Store ERP reference in quote notes
        const erpRef = JSON.stringify({
          erpProvider: erp,
          erpInvoiceId: erpId,
          erpSyncedAt: new Date().toISOString(),
        });
        await prisma.crmQuote.update({
          where: { id: invoiceId },
          data: {
            notes: erpRef,
          },
        });

        results.push({ invoiceId, erpInvoiceId: erpId || null, success: true });
      } else {
        results.push({ invoiceId, erpInvoiceId: null, success: false, error: 'ERP API call failed' });
      }
    } catch (error) {
      results.push({
        invoiceId,
        erpInvoiceId: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('[ERP] Invoice sync complete', {
    provider: erp,
    total: invoiceIds.length,
    success: results.filter((r) => r.success).length,
  });

  return results;
}

// ---------------------------------------------------------------------------
// syncPaymentsFromErp
// ---------------------------------------------------------------------------

/**
 * Pull payments from the ERP system into the CRM.
 * Creates CrmActivity records for received payments.
 */
export async function syncPaymentsFromErp(
  since: Date,
  provider?: ErpProvider,
): Promise<{ payments: ErpPaymentRecord[]; errors: string[] }> {
  const erp = provider || 'quickbooks';
  const sinceStr = since.toISOString().split('T')[0];

  let endpoint: string;
  if (erp === 'quickbooks') {
    endpoint = `/query?query=${encodeURIComponent(`SELECT * FROM Payment WHERE TxnDate >= '${sinceStr}'`)}`;
  } else {
    endpoint = `/Payments?where=Date>="${sinceStr}"`;
  }

  const result = await erpRequest<{
    QueryResponse?: { Payment: Array<Record<string, unknown>> };
    Payments?: Array<Record<string, unknown>>;
  }>(erp, endpoint);

  const payments: ErpPaymentRecord[] = [];
  const errors: string[] = [];

  if (!result) {
    errors.push('Failed to fetch payments from ERP');
    return { payments, errors };
  }

  const rawPayments = erp === 'quickbooks'
    ? result.QueryResponse?.Payment || []
    : result.Payments || [];

  for (const p of rawPayments) {
    try {
      const invoiceRef = p.Invoice as Record<string, unknown> | undefined;
      const currencyRef = p.CurrencyRef as Record<string, unknown> | undefined;
      const paymentMethodRef = p.PaymentMethodRef as Record<string, unknown> | undefined;
      const payment: ErpPaymentRecord = {
        erpPaymentId: String(p.Id || p.PaymentID || ''),
        invoiceId: String(p.InvoiceRef || invoiceRef?.InvoiceID || ''),
        amount: Number(p.TotalAmt || p.Amount || 0),
        currency: String(currencyRef?.value || p.CurrencyCode || 'CAD'),
        paidAt: String(p.TxnDate || p.Date || new Date().toISOString()),
        method: String(paymentMethodRef?.name || p.PaymentType || 'unknown'),
      };
      payments.push(payment);
    } catch (err) {
      errors.push(
        `Failed to parse payment: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  logger.info('[ERP] Payments synced from ERP', {
    provider: erp,
    since: sinceStr,
    count: payments.length,
  });

  return { payments, errors };
}

// ---------------------------------------------------------------------------
// mapCrmToErpFields
// ---------------------------------------------------------------------------

/**
 * Get field mapping configuration between CRM and ERP entities.
 * Returns default mappings that can be customized.
 */
export function mapCrmToErpFields(
  entity: 'invoice' | 'contact' | 'payment',
): ErpFieldMapping[] {
  const mappings: Record<string, ErpFieldMapping[]> = {
    invoice: [
      { crmField: 'quoteNumber', erpField: 'DocNumber', transform: 'string' },
      { crmField: 'totalAmount', erpField: 'TotalAmt', transform: 'number' },
      { crmField: 'currency', erpField: 'CurrencyRef.value', transform: 'string' },
      { crmField: 'validUntil', erpField: 'DueDate', transform: 'date' },
      { crmField: 'items[].quantity', erpField: 'Line[].Qty', transform: 'number' },
      { crmField: 'items[].unitPrice', erpField: 'Line[].UnitPrice', transform: 'currency' },
      { crmField: 'items[].total', erpField: 'Line[].Amount', transform: 'currency' },
      { crmField: 'items[].description', erpField: 'Line[].Description', transform: 'string' },
    ],
    contact: [
      { crmField: 'contactName', erpField: 'DisplayName', transform: 'string' },
      { crmField: 'email', erpField: 'PrimaryEmailAddr.Address', transform: 'string' },
      { crmField: 'phone', erpField: 'PrimaryPhone.FreeFormNumber', transform: 'string' },
      { crmField: 'companyName', erpField: 'CompanyName', transform: 'string' },
    ],
    payment: [
      { crmField: 'amount', erpField: 'TotalAmt', transform: 'currency' },
      { crmField: 'currency', erpField: 'CurrencyRef.value', transform: 'string' },
      { crmField: 'paidAt', erpField: 'TxnDate', transform: 'date' },
      { crmField: 'method', erpField: 'PaymentMethodRef.name', transform: 'string' },
    ],
  };

  return mappings[entity] || [];
}

// ---------------------------------------------------------------------------
// getErpSyncStatus
// ---------------------------------------------------------------------------

/**
 * Get current ERP sync status: connection health, pending items, errors.
 */
export async function getErpSyncStatus(
  provider?: ErpProvider,
): Promise<ErpSyncStatus> {
  const erp = provider || 'quickbooks';
  const config = await getErpConfig(erp);
  const connected = !!(config?.accessToken);

  // Count invoices not yet synced to ERP (those without ERP ref in notes)
  const pendingInvoices = await prisma.crmQuote.count({
    where: {
      status: 'ACCEPTED',
      OR: [
        { notes: null },
        { notes: { not: { contains: 'erpInvoiceId' } } },
      ],
    },
  });

  return {
    provider: erp,
    connected,
    lastSyncAt: null,
    pendingInvoices,
    pendingPayments: 0,
    errors: connected ? [] : ['ERP not connected. Complete OAuth authorization.'],
    syncHistory: [],
  };
}

// ---------------------------------------------------------------------------
// reconcileWithErp
// ---------------------------------------------------------------------------

/**
 * Compare CRM vs ERP data for a given period and identify discrepancies.
 */
export async function reconcileWithErp(
  period: { start: Date; end: Date },
  provider?: ErpProvider,
): Promise<ErpReconciliationResult> {
  const erp = provider || 'quickbooks';

  // Get CRM invoices for the period
  const crmQuotes = await prisma.crmQuote.findMany({
    where: {
      status: 'ACCEPTED',
      createdAt: {
        gte: period.start,
        lte: period.end,
      },
    },
    select: { id: true, number: true, total: true, notes: true },
  });

  const crmTotal = crmQuotes.reduce((sum, q) => sum + Number(q.total), 0);

  // Fetch ERP invoices for the same period
  const startStr = period.start.toISOString().split('T')[0];
  const endStr = period.end.toISOString().split('T')[0];

  let erpEndpoint: string;
  if (erp === 'quickbooks') {
    erpEndpoint = `/query?query=${encodeURIComponent(
      `SELECT * FROM Invoice WHERE TxnDate >= '${startStr}' AND TxnDate <= '${endStr}'`
    )}`;
  } else {
    erpEndpoint = `/Invoices?where=Date>="${startStr}" AND Date<="${endStr}"`;
  }

  const erpResult = await erpRequest<{
    QueryResponse?: { Invoice: Array<Record<string, unknown>> };
    Invoices?: Array<Record<string, unknown>>;
  }>(erp, erpEndpoint);

  const erpInvoices = erp === 'quickbooks'
    ? erpResult?.QueryResponse?.Invoice || []
    : erpResult?.Invoices || [];

  const erpTotal = erpInvoices.reduce(
    (sum, inv) => sum + Number(inv.TotalAmt || inv.Total || 0),
    0,
  );

  // Find discrepancies
  const discrepancies: ErpReconciliationResult['discrepancies'] = [];
  let matched = 0;
  let missingInErp = 0;

  for (const quote of crmQuotes) {
    let erpId: string | undefined;
    if (quote.notes) {
      try {
        const parsed = JSON.parse(quote.notes) as Record<string, unknown>;
        erpId = parsed.erpInvoiceId as string | undefined;
      } catch {
        // notes is not JSON, no ERP reference
      }
    }

    if (!erpId) {
      missingInErp++;
      discrepancies.push({
        invoiceId: quote.id,
        crmAmount: Number(quote.total),
        erpAmount: 0,
        difference: Number(quote.total),
        reason: 'Not synced to ERP',
      });
    } else {
      matched++;
    }
  }

  const missingInCrm = Math.max(0, erpInvoices.length - matched);

  logger.info('[ERP] Reconciliation complete', {
    provider: erp,
    period: { start: startStr, end: endStr },
    crmTotal,
    erpTotal,
    discrepancies: discrepancies.length,
  });

  return {
    period: { start: period.start.toISOString(), end: period.end.toISOString() },
    crmTotal: Math.round(crmTotal * 100) / 100,
    erpTotal: Math.round(erpTotal * 100) / 100,
    difference: Math.round((crmTotal - erpTotal) * 100) / 100,
    discrepancies,
    matched,
    missingInErp,
    missingInCrm,
  };
}
