'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText, DollarSign, Clock, CheckCircle, XCircle,
  AlertTriangle, Loader2, Download, CreditCard,
  Receipt, BarChart3, Calendar, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import { useTranslations } from '@/hooks/useTranslations';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortalAccess {
  clientName: string;
  companyName: string | null;
  email: string;
  expiresAt: string | null;
}

interface OutstandingBalance {
  total: number;
  invoiceCount: number;
  currency: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  subtotal: number;
  taxTps: number;
  taxTvq: number;
  taxTvh: number;
  shippingCost: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
  pdfUrl: string | null;
  notes: string | null;
  paidAt: string | null;
  items: InvoiceItem[];
}

interface EstimateItem {
  id: string;
  productName: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  sortOrder: number;
}

interface Estimate {
  id: string;
  estimateNumber: string;
  status: string;
  issueDate: string;
  validUntil: string;
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxGst: number;
  taxQst: number;
  taxTotal: number;
  total: number;
  currency: string;
  notes: string | null;
  termsConditions: string | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  items: EstimateItem[];
}

interface Payment {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  paidAt: string;
  amountPaid: number;
  total: number;
  currency: string;
  status: string;
}

interface StatementLineItem {
  id: string;
  date: string;
  type: 'INVOICE' | 'CREDIT_NOTE' | 'PAYMENT';
  reference: string;
  description: string;
  status: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface Statement {
  clientName: string;
  clientEmail: string;
  companyName: string | null;
  dateFrom: string;
  dateTo: string;
  generatedAt: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  currency: string;
  lineItems: StatementLineItem[];
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, currency: string = 'CAD'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function InvoiceStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <Clock className="w-3.5 h-3.5" /> },
    SENT: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <FileText className="w-3.5 h-3.5" /> },
    PARTIAL: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <DollarSign className="w-3.5 h-3.5" /> },
    PAID: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    VOID: { bg: 'bg-gray-100', text: 'text-gray-500', icon: <XCircle className="w-3.5 h-3.5" /> },
  };

  const c = config[status] || config.DRAFT;
  const label = t(`portal.status.${status.toLowerCase()}`) || status;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon}
      {label}
    </span>
  );
}

function EstimateStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', icon: <Clock className="w-3.5 h-3.5" /> },
    SENT: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <FileText className="w-3.5 h-3.5" /> },
    VIEWED: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Clock className="w-3.5 h-3.5" /> },
    ACCEPTED: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    DECLINED: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-3.5 h-3.5" /> },
    EXPIRED: { bg: 'bg-orange-100', text: 'text-orange-700', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    CONVERTED: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  };

  const c = config[status] || config.DRAFT;
  const label = t(`portal.estimateStatus.${status.toLowerCase()}`) || status;

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------

type TabKey = 'invoices' | 'estimates' | 'payments' | 'statement';

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function ClientPortalPage() {
  const params = useParams();
  const token = params?.token as string;
  const { t } = useTranslations();

  // Portal state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [access, setAccess] = useState<PortalAccess | null>(null);
  const [outstanding, setOutstanding] = useState<OutstandingBalance | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('invoices');

  // Tab data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [tabLoading, setTabLoading] = useState(false);

  // Statement date range
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Invoice detail expand
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [expandedEstimate, setExpandedEstimate] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch portal dashboard data
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!token) return;

    async function fetchPortal() {
      try {
        const res = await fetch(`/api/accounting/client-portal/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError(t('portal.invalidToken'));
          } else {
            setError(t('portal.loadError'));
          }
          return;
        }
        const data = await res.json();
        setAccess(data.data.access);
        setOutstanding(data.data.outstanding);
        setRecentInvoices(data.data.recentInvoices);
        setRecentPayments(data.data.recentPayments);
      } catch {
        setError(t('portal.connectionError'));
      } finally {
        setLoading(false);
      }
    }

    fetchPortal();
  }, [token, t]);

  // ---------------------------------------------------------------------------
  // Fetch tab data
  // ---------------------------------------------------------------------------

  const fetchInvoices = useCallback(async () => {
    setTabLoading(true);
    try {
      const res = await fetch(`/api/accounting/client-portal/${token}/invoices`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.data);
      }
    } catch {
      // Silently fail - data will show as empty
    } finally {
      setTabLoading(false);
    }
  }, [token]);

  const fetchEstimates = useCallback(async () => {
    setTabLoading(true);
    try {
      const res = await fetch(`/api/accounting/client-portal/${token}/estimates`);
      if (res.ok) {
        const data = await res.json();
        setEstimates(data.data);
      }
    } catch {
      // Silently fail
    } finally {
      setTabLoading(false);
    }
  }, [token]);

  const fetchPayments = useCallback(async () => {
    setTabLoading(true);
    try {
      const res = await fetch(`/api/accounting/client-portal/${token}/payments`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.data);
      }
    } catch {
      // Silently fail
    } finally {
      setTabLoading(false);
    }
  }, [token]);

  const fetchStatement = useCallback(async () => {
    setTabLoading(true);
    try {
      const res = await fetch(
        `/api/accounting/client-portal/${token}/statement?dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      if (res.ok) {
        const data = await res.json();
        setStatement(data.data);
      }
    } catch {
      // Silently fail
    } finally {
      setTabLoading(false);
    }
  }, [token, dateFrom, dateTo]);

  // Fetch tab data when switching tabs
  useEffect(() => {
    if (!access) return;

    switch (activeTab) {
      case 'invoices':
        if (invoices.length === 0) fetchInvoices();
        break;
      case 'estimates':
        if (estimates.length === 0) fetchEstimates();
        break;
      case 'payments':
        if (payments.length === 0) fetchPayments();
        break;
      case 'statement':
        fetchStatement();
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, access]);

  // ---------------------------------------------------------------------------
  // Loading State
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">{t('portal.loading')}</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error State
  // ---------------------------------------------------------------------------

  if (error || !access) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('portal.accessDenied')}</h1>
          <p className="text-gray-600">{error || t('portal.invalidLink')}</p>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'invoices', label: t('portal.tabs.invoices'), icon: <FileText className="w-4 h-4" /> },
    { key: 'estimates', label: t('portal.tabs.estimates'), icon: <Receipt className="w-4 h-4" /> },
    { key: 'payments', label: t('portal.tabs.payments'), icon: <DollarSign className="w-4 h-4" /> },
    { key: 'statement', label: t('portal.tabs.statement'), icon: <BarChart3 className="w-4 h-4" /> },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">BioCycle Peptides</h1>
              <p className="text-indigo-200 text-sm mt-1">
                {t('portal.clientPortal')}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-lg">{access.clientName}</p>
              {access.companyName && (
                <p className="text-indigo-200 text-sm">{access.companyName}</p>
              )}
              <p className="text-indigo-300 text-xs mt-1">{access.email}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Outstanding Balance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-500">
                {t('portal.outstandingBalance')}
              </p>
              <DollarSign className="w-5 h-5 text-indigo-500" />
            </div>
            <p className={`text-2xl font-bold ${(outstanding?.total || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(outstanding?.total || 0, outstanding?.currency)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {outstanding?.invoiceCount || 0} {t('portal.openInvoices')}
            </p>
          </div>

          {/* Recent Invoices Count */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-500">
                {t('portal.recentInvoices')}
              </p>
              <FileText className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{recentInvoices.length}</p>
            <p className="text-xs text-gray-400 mt-1">{t('portal.last5Invoices')}</p>
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-500">
                {t('portal.recentPaymentsLabel')}
              </p>
              <CreditCard className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(
                recentPayments.reduce((sum, p) => sum + p.amountPaid, 0),
                outstanding?.currency
              )}
            </p>
            <p className="text-xs text-gray-400 mt-1">{t('portal.recentPaymentsCount', { count: recentPayments.length })}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {tabLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : (
              <>
                {/* Invoices Tab */}
                {activeTab === 'invoices' && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('portal.allInvoices')}
                    </h2>
                    {invoices.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">{t('portal.noInvoices')}</p>
                    ) : (
                      <div className="space-y-3">
                        {invoices.map((inv) => (
                          <div key={inv.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                              onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                            >
                              <div className="flex items-center gap-3 mb-2 sm:mb-0">
                                <div>
                                  <p className="font-semibold text-gray-900">{inv.invoiceNumber}</p>
                                  <p className="text-xs text-gray-500">
                                    {formatDate(inv.invoiceDate)} &middot; {t('portal.dueDate')}: {formatDate(inv.dueDate)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <InvoiceStatusBadge status={inv.status} t={t} />
                                <div className="text-right">
                                  <p className="font-bold text-gray-900">{formatCurrency(inv.total, inv.currency)}</p>
                                  {inv.balance > 0 && inv.status !== 'PAID' && (
                                    <p className="text-xs text-red-600">{t('portal.balanceDue')}: {formatCurrency(inv.balance, inv.currency)}</p>
                                  )}
                                </div>
                                {expandedInvoice === inv.id ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                            </div>

                            {/* Expanded Detail */}
                            {expandedInvoice === inv.id && (
                              <div className="border-t border-gray-200 bg-gray-50 p-4">
                                <table className="w-full text-sm mb-4">
                                  <thead>
                                    <tr className="text-left text-gray-500 border-b">
                                      <th className="pb-2 font-medium">{t('portal.description')}</th>
                                      <th className="pb-2 font-medium text-right">{t('portal.qty')}</th>
                                      <th className="pb-2 font-medium text-right">{t('portal.unitPrice')}</th>
                                      <th className="pb-2 font-medium text-right">{t('portal.lineTotal')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inv.items.map((item) => (
                                      <tr key={item.id} className="border-b border-gray-100">
                                        <td className="py-2 text-gray-800">{item.description}</td>
                                        <td className="py-2 text-right text-gray-700">{item.quantity}</td>
                                        <td className="py-2 text-right text-gray-700">{formatCurrency(item.unitPrice, inv.currency)}</td>
                                        <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(item.total, inv.currency)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                <div className="flex justify-end">
                                  <div className="w-64 space-y-1 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                      <span>{t('portal.subtotal')}</span>
                                      <span>{formatCurrency(inv.subtotal, inv.currency)}</span>
                                    </div>
                                    {inv.taxTps > 0 && (
                                      <div className="flex justify-between text-gray-500">
                                        <span>GST/TPS (5%)</span>
                                        <span>{formatCurrency(inv.taxTps, inv.currency)}</span>
                                      </div>
                                    )}
                                    {inv.taxTvq > 0 && (
                                      <div className="flex justify-between text-gray-500">
                                        <span>QST/TVQ (9.975%)</span>
                                        <span>{formatCurrency(inv.taxTvq, inv.currency)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                                      <span>{t('portal.total')}</span>
                                      <span>{formatCurrency(inv.total, inv.currency)}</span>
                                    </div>
                                    {inv.amountPaid > 0 && (
                                      <div className="flex justify-between text-green-600">
                                        <span>{t('portal.paid')}</span>
                                        <span>-{formatCurrency(inv.amountPaid, inv.currency)}</span>
                                      </div>
                                    )}
                                    {inv.balance > 0 && (
                                      <div className="flex justify-between font-bold text-red-600 border-t pt-1">
                                        <span>{t('portal.balanceDue')}</span>
                                        <span>{formatCurrency(inv.balance, inv.currency)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                                  {inv.pdfUrl && (
                                    <a
                                      href={inv.pdfUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                                    >
                                      <Download className="w-4 h-4" />
                                      {t('portal.downloadPdf')}
                                    </a>
                                  )}
                                  {inv.balance > 0 && inv.status !== 'PAID' && (
                                    <a
                                      href={`/checkout/invoice/${inv.id}`}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                      <CreditCard className="w-4 h-4" />
                                      {t('portal.payNow')}
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Estimates Tab */}
                {activeTab === 'estimates' && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('portal.allEstimates')}
                    </h2>
                    {estimates.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">{t('portal.noEstimates')}</p>
                    ) : (
                      <div className="space-y-3">
                        {estimates.map((est) => (
                          <div key={est.id} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div
                              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
                              onClick={() => setExpandedEstimate(expandedEstimate === est.id ? null : est.id)}
                            >
                              <div>
                                <p className="font-semibold text-gray-900">{est.estimateNumber}</p>
                                <p className="text-xs text-gray-500">
                                  {formatDate(est.issueDate)} &middot; {t('portal.validUntil')}: {formatDate(est.validUntil)}
                                </p>
                              </div>
                              <div className="flex items-center gap-4 mt-2 sm:mt-0">
                                <EstimateStatusBadge status={est.status} t={t} />
                                <p className="font-bold text-gray-900">{formatCurrency(est.total, est.currency)}</p>
                                {expandedEstimate === est.id ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </div>
                            </div>

                            {expandedEstimate === est.id && (
                              <div className="border-t border-gray-200 bg-gray-50 p-4">
                                <table className="w-full text-sm mb-4">
                                  <thead>
                                    <tr className="text-left text-gray-500 border-b">
                                      <th className="pb-2 font-medium">{t('portal.product')}</th>
                                      <th className="pb-2 font-medium text-right">{t('portal.qty')}</th>
                                      <th className="pb-2 font-medium text-right">{t('portal.unitPrice')}</th>
                                      <th className="pb-2 font-medium text-right">{t('portal.lineTotal')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {est.items
                                      .sort((a, b) => a.sortOrder - b.sortOrder)
                                      .map((item) => (
                                        <tr key={item.id} className="border-b border-gray-100">
                                          <td className="py-2">
                                            <p className="text-gray-800">{item.productName}</p>
                                            {item.description && (
                                              <p className="text-xs text-gray-500">{item.description}</p>
                                            )}
                                          </td>
                                          <td className="py-2 text-right text-gray-700">{item.quantity}</td>
                                          <td className="py-2 text-right text-gray-700">{formatCurrency(item.unitPrice, est.currency)}</td>
                                          <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(item.lineTotal, est.currency)}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>

                                <div className="flex justify-end">
                                  <div className="w-64 space-y-1 text-sm">
                                    <div className="flex justify-between text-gray-600">
                                      <span>{t('portal.subtotal')}</span>
                                      <span>{formatCurrency(est.subtotal, est.currency)}</span>
                                    </div>
                                    {est.discountAmount > 0 && (
                                      <div className="flex justify-between text-orange-600">
                                        <span>{t('portal.discount')} ({est.discountPercent}%)</span>
                                        <span>-{formatCurrency(est.discountAmount, est.currency)}</span>
                                      </div>
                                    )}
                                    {est.taxGst > 0 && (
                                      <div className="flex justify-between text-gray-500">
                                        <span>GST/TPS</span>
                                        <span>{formatCurrency(est.taxGst, est.currency)}</span>
                                      </div>
                                    )}
                                    {est.taxQst > 0 && (
                                      <div className="flex justify-between text-gray-500">
                                        <span>QST/TVQ</span>
                                        <span>{formatCurrency(est.taxQst, est.currency)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                                      <span>{t('portal.total')}</span>
                                      <span>{formatCurrency(est.total, est.currency)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Notes */}
                                {est.notes && (
                                  <div className="mt-4 pt-4 border-t border-gray-200">
                                    <p className="text-xs text-gray-500 uppercase mb-1">{t('portal.notes')}</p>
                                    <p className="text-sm text-gray-700 whitespace-pre-line">{est.notes}</p>
                                  </div>
                                )}

                                {/* Accept/Decline actions */}
                                {['SENT', 'VIEWED'].includes(est.status) && est.items.length > 0 && (
                                  <div className="flex gap-3 mt-4 pt-4 border-t border-gray-200">
                                    <a
                                      href={`/estimate/${est.id}`}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                      {t('portal.acceptEstimate')}
                                    </a>
                                    <a
                                      href={`/estimate/${est.id}`}
                                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                      <XCircle className="w-4 h-4" />
                                      {t('portal.declineEstimate')}
                                    </a>
                                  </div>
                                )}

                                {est.status === 'ACCEPTED' && (
                                  <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                                    <div className="inline-flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg">
                                      <CheckCircle className="w-4 h-4" />
                                      <span className="text-sm font-medium">
                                        {t('portal.acceptedBy', { name: est.acceptedBy || '' })}
                                        {est.acceptedAt && ` - ${formatDate(est.acceptedAt)}`}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {est.status === 'DECLINED' && (
                                  <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                                    <div className="inline-flex items-center gap-2 text-red-700 bg-red-50 px-4 py-2 rounded-lg">
                                      <XCircle className="w-4 h-4" />
                                      <span className="text-sm font-medium">{t('portal.declined')}</span>
                                    </div>
                                    {est.declineReason && (
                                      <p className="text-sm text-red-600 mt-2">{est.declineReason}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Payments Tab */}
                {activeTab === 'payments' && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">
                      {t('portal.paymentHistory')}
                    </h2>
                    {payments.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">{t('portal.noPayments')}</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-gray-200">
                              <th className="py-3 text-left font-semibold text-gray-700">{t('portal.date')}</th>
                              <th className="py-3 text-left font-semibold text-gray-700">{t('portal.invoice')}</th>
                              <th className="py-3 text-right font-semibold text-gray-700">{t('portal.invoiceTotal')}</th>
                              <th className="py-3 text-right font-semibold text-gray-700">{t('portal.amountPaid')}</th>
                              <th className="py-3 text-center font-semibold text-gray-700">{t('portal.statusLabel')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((pay) => (
                              <tr key={pay.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-3 text-gray-700">{formatDate(pay.paidAt)}</td>
                                <td className="py-3 text-gray-900 font-medium">{pay.invoiceNumber}</td>
                                <td className="py-3 text-right text-gray-700">{formatCurrency(pay.total, pay.currency)}</td>
                                <td className="py-3 text-right font-semibold text-green-600">{formatCurrency(pay.amountPaid, pay.currency)}</td>
                                <td className="py-3 text-center">
                                  <InvoiceStatusBadge status={pay.status} t={t} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t-2 border-gray-200 font-bold">
                              <td colSpan={3} className="py-3 text-right text-gray-700">{t('portal.totalPaid')}</td>
                              <td className="py-3 text-right text-green-600">
                                {formatCurrency(
                                  payments.reduce((sum, p) => sum + p.amountPaid, 0),
                                  payments[0]?.currency
                                )}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Statement Tab */}
                {activeTab === 'statement' && (
                  <div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                      <h2 className="text-lg font-semibold text-gray-900">
                        {t('portal.accountStatement')}
                      </h2>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <span className="text-gray-400">{t('portal.to')}</span>
                          <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        </div>
                        <button
                          onClick={fetchStatement}
                          className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          {t('portal.generate')}
                        </button>
                      </div>
                    </div>

                    {statement ? (
                      <>
                        {/* Statement Summary */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-1">{t('portal.openingBalance')}</p>
                            <p className="text-lg font-bold text-gray-900">
                              {formatCurrency(statement.openingBalance, statement.currency)}
                            </p>
                          </div>
                          <div className="bg-red-50 rounded-lg p-4">
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                              <p className="text-xs text-red-600">{t('portal.totalCharges')}</p>
                            </div>
                            <p className="text-lg font-bold text-red-700">
                              {formatCurrency(statement.totalDebits, statement.currency)}
                            </p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4">
                            <div className="flex items-center gap-1 mb-1">
                              <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                              <p className="text-xs text-green-600">{t('portal.totalPayments')}</p>
                            </div>
                            <p className="text-lg font-bold text-green-700">
                              {formatCurrency(statement.totalCredits, statement.currency)}
                            </p>
                          </div>
                          <div className={`rounded-lg p-4 ${statement.closingBalance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                            <p className="text-xs text-gray-500 mb-1">{t('portal.closingBalance')}</p>
                            <p className={`text-lg font-bold ${statement.closingBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                              {formatCurrency(statement.closingBalance, statement.currency)}
                            </p>
                          </div>
                        </div>

                        {/* Statement Lines */}
                        {statement.lineItems.length === 0 ? (
                          <p className="text-gray-500 text-center py-8">{t('portal.noTransactions')}</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b-2 border-gray-200">
                                  <th className="py-3 text-left font-semibold text-gray-700">{t('portal.date')}</th>
                                  <th className="py-3 text-left font-semibold text-gray-700">{t('portal.type')}</th>
                                  <th className="py-3 text-left font-semibold text-gray-700">{t('portal.reference')}</th>
                                  <th className="py-3 text-left font-semibold text-gray-700">{t('portal.description')}</th>
                                  <th className="py-3 text-right font-semibold text-gray-700">{t('portal.debit')}</th>
                                  <th className="py-3 text-right font-semibold text-gray-700">{t('portal.credit')}</th>
                                  <th className="py-3 text-right font-semibold text-gray-700">{t('portal.balance')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {/* Opening balance row */}
                                <tr className="border-b border-gray-100 bg-gray-50">
                                  <td className="py-2 text-gray-500">{formatDate(statement.dateFrom)}</td>
                                  <td colSpan={3} className="py-2 text-gray-500 italic">{t('portal.openingBalanceRow')}</td>
                                  <td></td>
                                  <td></td>
                                  <td className="py-2 text-right font-medium text-gray-700">
                                    {formatCurrency(statement.openingBalance, statement.currency)}
                                  </td>
                                </tr>
                                {statement.lineItems.map((line) => {
                                  const typeColors: Record<string, string> = {
                                    INVOICE: 'text-blue-700 bg-blue-50',
                                    PAYMENT: 'text-green-700 bg-green-50',
                                    CREDIT_NOTE: 'text-orange-700 bg-orange-50',
                                  };
                                  const typeLabels: Record<string, string> = {
                                    INVOICE: t('portal.typeInvoice'),
                                    PAYMENT: t('portal.typePayment'),
                                    CREDIT_NOTE: t('portal.typeCreditNote'),
                                  };

                                  return (
                                    <tr key={line.id} className="border-b border-gray-100 hover:bg-gray-50">
                                      <td className="py-2 text-gray-700">{formatDate(line.date)}</td>
                                      <td className="py-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[line.type] || ''}`}>
                                          {typeLabels[line.type] || line.type}
                                        </span>
                                      </td>
                                      <td className="py-2 text-gray-900 font-medium">{line.reference}</td>
                                      <td className="py-2 text-gray-600 max-w-xs truncate">{line.description}</td>
                                      <td className="py-2 text-right text-red-600">
                                        {line.debit > 0 ? formatCurrency(line.debit, statement.currency) : ''}
                                      </td>
                                      <td className="py-2 text-right text-green-600">
                                        {line.credit > 0 ? formatCurrency(line.credit, statement.currency) : ''}
                                      </td>
                                      <td className="py-2 text-right font-medium text-gray-900">
                                        {formatCurrency(line.runningBalance, statement.currency)}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Closing balance row */}
                                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                                  <td className="py-3 text-gray-700">{formatDate(statement.dateTo)}</td>
                                  <td colSpan={3} className="py-3 text-gray-700">{t('portal.closingBalanceRow')}</td>
                                  <td className="py-3 text-right text-red-700">
                                    {formatCurrency(statement.totalDebits, statement.currency)}
                                  </td>
                                  <td className="py-3 text-right text-green-700">
                                    {formatCurrency(statement.totalCredits, statement.currency)}
                                  </td>
                                  <td className={`py-3 text-right ${statement.closingBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                    {formatCurrency(statement.closingBalance, statement.currency)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500 text-center py-8">{t('portal.selectDateRange')}</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-gray-400">
        <p>BioCycle Peptides Inc. &bull; Montreal, QC, Canada &bull; biocyclepeptides.com</p>
      </div>
    </div>
  );
}
