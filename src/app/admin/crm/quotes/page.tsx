'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Send,
  Trash2,
  X,
  DollarSign,
  Calendar,
  ChevronDown,
  Search,
  Eye,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number | string;
  discount: number | string;
  total: number | string;
  product?: { id: string; name: string; sku: string | null } | null;
}

interface Quote {
  id: string;
  number: string;
  status: string;
  currency: string;
  subtotal: number | string;
  taxRate: number | string;
  taxAmount: number | string;
  total: number | string;
  validUntil: string | null;
  sentAt: string | null;
  notes: string | null;
  terms: string | null;
  deal: {
    id: string;
    title: string;
    value: number | string;
    lead?: {
      id: string;
      contactName: string;
      companyName: string | null;
      email: string | null;
    } | null;
  };
  items: QuoteItem[];
  createdBy: { id: string; name: string | null; email: string };
  createdAt: string;
  updatedAt: string;
}

interface DealOption {
  id: string;
  title: string;
  value: number | string;
  lead?: { contactName: string; companyName: string | null } | null;
}

interface NewLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  DRAFT: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700' },
  SENT: { label: 'Sent', bg: 'bg-teal-100', text: 'text-teal-700' },
  VIEWED: { label: 'Viewed', bg: 'bg-purple-100', text: 'text-purple-700' },
  ACCEPTED: { label: 'Accepted', bg: 'bg-green-100', text: 'text-green-700' },
  REJECTED: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-700' },
  EXPIRED: { label: 'Expired', bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

const STATUS_OPTIONS = ['', 'DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function QuotesPage() {
  const { t, locale } = useI18n();

  // List state
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [loadingDeals, setLoadingDeals] = useState(false);

  // Create form state
  const [formDealId, setFormDealId] = useState('');
  const [formTaxRate, setFormTaxRate] = useState('14.975');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formTerms, setFormTerms] = useState('');
  const [formItems, setFormItems] = useState<NewLineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, discount: 0 },
  ]);
  const [saving, setSaving] = useState(false);

  // Detail/view state
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);

  const fmt = useCallback(
    (amount: number | string) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(Number(amount)),
    [locale]
  );

  const fmtDate = useCallback(
    (dateStr: string) => new Date(dateStr).toLocaleDateString(locale),
    [locale]
  );

  // ---------------------------
  // Fetch quotes
  // ---------------------------
  const fetchQuotes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/crm/quotes?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setQuotes(json.data || []);
        setTotal(json.pagination?.total || 0);
      } else {
        toast.error(json.error?.message || t('admin.crm.quotes.loadError') || 'Failed to load quotes');
      }
    } catch {
      toast.error(t('admin.crm.quotes.loadError') || 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery, t]);

  // ---------------------------
  // Fetch deals for create modal
  // ---------------------------
  const fetchDeals = useCallback(async () => {
    setLoadingDeals(true);
    try {
      const res = await fetch('/api/admin/crm/deals?limit=100');
      const json = await res.json();
      if (json.success && json.data) {
        setDeals(
          json.data.map((d: DealOption) => ({
            id: d.id,
            title: d.title,
            value: d.value,
            lead: d.lead,
          }))
        );
      }
    } catch {
      // silently fail, deals dropdown will be empty
    } finally {
      setLoadingDeals(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // ---------------------------
  // Line item helpers
  // ---------------------------
  const addLineItem = () => {
    setFormItems((prev) => [...prev, { description: '', quantity: 1, unitPrice: 0, discount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof NewLineItem, value: string | number) => {
    setFormItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const calcItemTotal = (item: NewLineItem) => {
    const discountMultiplier = 1 - (item.discount || 0) / 100;
    return Math.round(item.quantity * item.unitPrice * discountMultiplier * 100) / 100;
  };

  const calcFormSubtotal = () => formItems.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const calcFormTax = () => Math.round(calcFormSubtotal() * (parseFloat(formTaxRate) / 100) * 100) / 100;
  const calcFormTotal = () => Math.round((calcFormSubtotal() + calcFormTax()) * 100) / 100;

  // ---------------------------
  // Create quote
  // ---------------------------
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formDealId) {
      toast.error(t('admin.crm.quotes.selectDeal') || 'Please select a deal');
      return;
    }

    const validItems = formItems.filter((item) => item.description.trim());
    if (validItems.length === 0) {
      toast.error(t('admin.crm.quotes.addItems') || 'Add at least one line item');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId: formDealId,
          taxRate: parseFloat(formTaxRate) / 100, // convert percentage to decimal
          validUntil: formValidUntil ? new Date(formValidUntil).toISOString() : null,
          notes: formNotes || null,
          terms: formTerms || null,
          items: validItems.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
          })),
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to create quote');
      }

      toast.success(t('admin.crm.quotes.created') || 'Quote created successfully');
      resetForm();
      setShowCreateModal(false);
      fetchQuotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create quote');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormDealId('');
    setFormTaxRate('14.975');
    setFormValidUntil('');
    setFormNotes('');
    setFormTerms('');
    setFormItems([{ description: '', quantity: 1, unitPrice: 0, discount: 0 }]);
  };

  // ---------------------------
  // Send quote (change status to SENT)
  // ---------------------------
  const handleSend = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/admin/crm/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SENT' }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to send quote');
      }
      toast.success(t('admin.crm.quotes.sent') || 'Quote sent');
      fetchQuotes();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send quote');
    }
  };

  // ---------------------------
  // Delete quote
  // ---------------------------
  const handleDelete = async (quoteId: string) => {
    try {
      const res = await fetch(`/api/admin/crm/quotes/${quoteId}`, { method: 'DELETE' });
      if (res.status === 204 || res.ok) {
        toast.success(t('admin.crm.quotes.deleted') || 'Quote deleted');
        setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
        if (selectedQuote?.id === quoteId) setSelectedQuote(null);
      } else {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message || 'Failed to delete quote');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete quote');
    }
  };

  // ---------------------------
  // Open create modal
  // ---------------------------
  const openCreateModal = () => {
    setShowCreateModal(true);
    fetchDeals();
  };

  // Pagination
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-teal-600" />
            {t('admin.crm.quotes.title') || 'Quotes'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.quotes.subtitle') || 'Create and manage sales quotes for deals'}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          {t('admin.crm.quotes.new') || 'New Quote'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            placeholder={t('admin.crm.quotes.search') || 'Search quotes...'}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
          >
            <option value="">{t('admin.crm.quotes.allStatuses') || 'All Statuses'}</option>
            {STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Quotes Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {t('admin.crm.quotes.empty') || 'No quotes found'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {t('admin.crm.quotes.emptyDesc') || 'Create a quote to get started'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotes.numberCol') || 'Quote #'}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotes.dealCol') || 'Deal'}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotes.statusCol') || 'Status'}
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotes.totalCol') || 'Total'}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotes.validUntilCol') || 'Valid Until'}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotes.createdByCol') || 'Created By'}
                  </th>
                  <th className="px-4 py-3 font-medium text-gray-600">
                    {t('admin.crm.quotes.actionsCol') || 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotes.map((quote) => {
                  const cfg = STATUS_CONFIG[quote.status] || STATUS_CONFIG.DRAFT;
                  return (
                    <tr key={quote.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedQuote(quote)}
                          className="font-medium text-teal-600 hover:text-teal-800"
                        >
                          {quote.number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">
                        {quote.deal?.title || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {fmt(quote.total)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {quote.validUntil ? fmtDate(quote.validUntil) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 truncate max-w-[150px]">
                        {quote.createdBy?.name || quote.createdBy?.email || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedQuote(quote)}
                            className="p-1 text-gray-400 hover:text-teal-600"
                            title={t('admin.crm.quotes.view') || 'View'}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {quote.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handleSend(quote.id)}
                                className="p-1 text-gray-400 hover:text-teal-600"
                                title={t('admin.crm.quotes.send') || 'Send'}
                              >
                                <Send className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(quote.id)}
                                className="p-1 text-gray-400 hover:text-red-600"
                                title={t('common.delete') || 'Delete'}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <p className="text-sm text-gray-500">
                {t('admin.crm.quotes.showing') || 'Showing'} {(page - 1) * 20 + 1}-{Math.min(page * 20, total)} {t('admin.crm.quotes.of') || 'of'} {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.previous') || 'Previous'}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.next') || 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quote Detail Side Panel */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedQuote(null)} />
          <div className="relative w-full max-w-xl bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedQuote.number}</h2>
                <p className="text-sm text-gray-500">{selectedQuote.deal?.title}</p>
              </div>
              <button onClick={() => setSelectedQuote(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-6">
              {/* Status & Meta */}
              <div className="flex items-center gap-3">
                {(() => {
                  const cfg = STATUS_CONFIG[selectedQuote.status] || STATUS_CONFIG.DRAFT;
                  return (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${cfg.bg} ${cfg.text}`}>
                      {cfg.label}
                    </span>
                  );
                })()}
                <span className="text-sm text-gray-500">{fmtDate(selectedQuote.createdAt)}</span>
              </div>

              {/* Client Info */}
              {selectedQuote.deal?.lead && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {t('admin.crm.quotes.client') || 'Client'}
                  </h3>
                  <p className="font-medium text-gray-900">{selectedQuote.deal.lead.contactName}</p>
                  {selectedQuote.deal.lead.companyName && (
                    <p className="text-sm text-gray-600">{selectedQuote.deal.lead.companyName}</p>
                  )}
                  {selectedQuote.deal.lead.email && (
                    <p className="text-sm text-gray-500">{selectedQuote.deal.lead.email}</p>
                  )}
                </div>
              )}

              {/* Line Items */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  {t('admin.crm.quotes.lineItems') || 'Line Items'}
                </h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 font-medium text-gray-600">{t('admin.crm.quotes.description') || 'Description'}</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">{t('admin.crm.quotes.qty') || 'Qty'}</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">{t('admin.crm.quotes.price') || 'Price'}</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">{t('admin.crm.quotes.disc') || 'Disc%'}</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">{t('admin.crm.quotes.total') || 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedQuote.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-gray-900">{item.description}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{fmt(item.unitPrice)}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{Number(item.discount)}%</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{fmt(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('admin.crm.quotes.subtotal') || 'Subtotal'}</span>
                  <span className="font-medium text-gray-900">{fmt(selectedQuote.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('admin.crm.quotes.tax') || 'Tax'} ({(Number(selectedQuote.taxRate) * 100).toFixed(2)}%)</span>
                  <span className="font-medium text-gray-900">{fmt(selectedQuote.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">{t('admin.crm.quotes.total') || 'Total'}</span>
                  <span className="font-bold text-gray-900">{fmt(selectedQuote.total)}</span>
                </div>
              </div>

              {/* Valid Until */}
              {selectedQuote.validUntil && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="h-4 w-4" />
                  {t('admin.crm.quotes.validUntil') || 'Valid until'}: {fmtDate(selectedQuote.validUntil)}
                </div>
              )}

              {/* Notes */}
              {selectedQuote.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {t('admin.crm.quotes.notes') || 'Notes'}
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedQuote.notes}</p>
                </div>
              )}

              {/* Terms */}
              {selectedQuote.terms && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    {t('admin.crm.quotes.terms') || 'Terms & Conditions'}
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedQuote.terms}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {selectedQuote.status === 'DRAFT' && (
                  <>
                    <button
                      onClick={() => { handleSend(selectedQuote.id); setSelectedQuote(null); }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      <Send className="h-4 w-4" />
                      {t('admin.crm.quotes.send') || 'Send Quote'}
                    </button>
                    <button
                      onClick={() => { handleDelete(selectedQuote.id); setSelectedQuote(null); }}
                      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('common.delete') || 'Delete'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Quote Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowCreateModal(false)} />
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-teal-600" />
                {t('admin.crm.quotes.createTitle') || 'Create Quote'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-4 space-y-6">
              {/* Deal Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('admin.crm.quotes.deal') || 'Deal'} *
                </label>
                <select
                  value={formDealId}
                  onChange={(e) => setFormDealId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  required
                >
                  <option value="">{loadingDeals ? (t('common.loading') || 'Loading...') : (t('admin.crm.quotes.selectDeal') || 'Select a deal...')}</option>
                  {deals.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.title} {deal.lead ? `- ${deal.lead.contactName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tax Rate & Valid Until */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.crm.quotes.taxRate') || 'Tax Rate (%)'}
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="100"
                    value={formTaxRate}
                    onChange={(e) => setFormTaxRate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.crm.quotes.validUntilLabel') || 'Valid Until'}
                  </label>
                  <input
                    type="date"
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    {t('admin.crm.quotes.lineItems') || 'Line Items'} *
                  </label>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium"
                  >
                    <Plus className="h-3 w-3" />
                    {t('admin.crm.quotes.addItem') || 'Add Item'}
                  </button>
                </div>
                <div className="space-y-3">
                  {formItems.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-12 sm:col-span-5">
                          <label className="block text-xs text-gray-500 mb-1">
                            {t('admin.crm.quotes.description') || 'Description'}
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                            placeholder={t('admin.crm.quotes.itemDesc') || 'Item description...'}
                            required
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">
                            {t('admin.crm.quotes.qty') || 'Qty'}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">
                            {t('admin.crm.quotes.unitPrice') || 'Unit Price'}
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <label className="block text-xs text-gray-500 mb-1">
                            {t('admin.crm.quotes.discountPct') || 'Disc %'}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={item.discount}
                            onChange={(e) => updateLineItem(index, 'discount', parseFloat(e.target.value) || 0)}
                            className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex items-end justify-end">
                          {formItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLineItem(index)}
                              className="p-1.5 text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500 mt-2">
                        {t('admin.crm.quotes.itemTotal') || 'Item total'}: <span className="font-medium text-gray-700">{fmt(calcItemTotal(item))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Preview */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('admin.crm.quotes.subtotal') || 'Subtotal'}</span>
                  <span className="font-medium">{fmt(calcFormSubtotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('admin.crm.quotes.tax') || 'Tax'} ({formTaxRate}%)</span>
                  <span className="font-medium">{fmt(calcFormTax())}</span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-gray-200">
                  <span className="font-semibold">{t('admin.crm.quotes.total') || 'Total'}</span>
                  <span className="font-bold text-gray-900">{fmt(calcFormTotal())}</span>
                </div>
              </div>

              {/* Notes & Terms */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.crm.quotes.notes') || 'Notes'}
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    placeholder={t('admin.crm.quotes.notesPlaceholder') || 'Internal notes...'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.crm.quotes.terms') || 'Terms & Conditions'}
                  </label>
                  <textarea
                    value={formTerms}
                    onChange={(e) => setFormTerms(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                    placeholder={t('admin.crm.quotes.termsPlaceholder') || 'Payment terms, conditions...'}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? (t('common.saving') || 'Saving...') : (t('admin.crm.quotes.create') || 'Create Quote')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
