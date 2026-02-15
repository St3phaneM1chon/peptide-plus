'use client';

/**
 * INVOICES PAGE - BioCycle Peptides
 * Lists user's paid order invoices with view, print, and PDF download
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/hooks/useTranslations';

// =====================================================
// TYPES
// =====================================================

interface InvoiceItem {
  id: string;
  productName: string;
  formatName: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface InvoiceListItem {
  id: string;
  orderNumber: string;
  invoiceNumber: string;
  date: string;
  subtotal: number;
  shippingCost: number;
  discount: number;
  taxTps: number;
  taxTvq: number;
  taxTvh: number;
  taxPst: number;
  total: number;
  paymentStatus: string;
  paymentMethod: string | null;
  currency: { code: string; symbol: string };
  itemCount: number;
  items: InvoiceItem[];
}

interface InvoiceDetail {
  id: string;
  orderNumber: string;
  invoiceNumber: string;
  date: string;
  items: {
    id: string;
    productName: string;
    formatName: string | null;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  taxTps: number;
  taxTvq: number;
  taxTvh: number;
  taxPst: number;
  total: number;
  currency: { code: string; symbol: string; name: string };
  exchangeRate: number;
  promoCode: string | null;
  promoDiscount: number | null;
  paymentMethod: string | null;
  paymentStatus: string;
  status: string;
  shippingAddress: {
    name: string;
    address1: string;
    address2: string | null;
    city: string;
    state: string;
    postal: string;
    country: string;
    phone: string | null;
  };
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  customerNotes: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  STRIPE_CARD: 'Credit Card',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
  PAYPAL: 'PayPal',
  VISA_CLICK_TO_PAY: 'Visa Click to Pay',
  MASTERCARD_CLICK_TO_PAY: 'Mastercard Click to Pay',
  AURELIA_PAY: 'Aurelia Pay',
};

// =====================================================
// COMPONENT
// =====================================================

export default function InvoicesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslations();
  const printRef = useRef<HTMLDivElement>(null);

  // State
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewingInvoice, setViewingInvoice] = useState<InvoiceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);

  // Auth redirect
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/invoices');
    }
  }, [status, router]);

  // Fetch invoices
  const fetchInvoices = useCallback(async (page: number = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
      });
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/account/invoices?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
        setPagination(data.pagination || null);
      } else {
        console.error('Failed to fetch invoices:', res.status);
        setInvoices([]);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  // Load invoices on mount and when filters change
  useEffect(() => {
    if (session?.user) {
      fetchInvoices(currentPage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentPage]);

  // Apply date filter
  const handleDateFilter = () => {
    setCurrentPage(1);
    fetchInvoices(1);
  };

  // Clear date filter
  const handleClearDateFilter = async () => {
    setDateFrom('');
    setDateTo('');
    setCurrentPage(1);
    // Fetch directly without date params (since state updates are async)
    setLoading(true);
    try {
      const res = await fetch('/api/account/invoices?page=1&limit=10');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
        setPagination(data.pagination || null);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch invoice detail
  const handleViewInvoice = async (invoiceId: string) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}`);
      if (res.ok) {
        const data = await res.json();
        setViewingInvoice(data.invoice);
      } else {
        alert(t('account.invoices.errorLoadDetail') || 'Failed to load invoice details');
      }
    } catch (error) {
      console.error('Error fetching invoice detail:', error);
      alert(t('account.invoices.errorLoadDetail') || 'Failed to load invoice details');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingPdf(invoiceId);
    try {
      const res = await fetch(`/api/account/invoices/${invoiceId}/pdf`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Invoice_${invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(t('account.invoices.errorPdf') || 'Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert(t('account.invoices.errorPdf') || 'Failed to generate PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  // Print invoice
  const handlePrint = () => {
    window.print();
  };

  // Format helpers
  const formatMoney = (amount: number, symbol: string = '$') => {
    return `${symbol}${amount.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatShortDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Loading state
  if (status === 'loading' || (loading && invoices.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-gray-500 mt-4">{t('account.invoices.loading') || 'Loading invoices...'}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      {/* Print-only styles */}
      <style jsx global>{`
        @media print {
          /* Hide everything except the invoice detail */
          body > *:not(.print-invoice-container) {
            display: none !important;
          }
          header, footer, nav,
          .no-print,
          [data-radix-popper-content-wrapper] {
            display: none !important;
          }
          .print-invoice-container {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            z-index: 99999 !important;
          }
          .print-invoice-content {
            padding: 20mm !important;
            max-width: 100% !important;
          }
          @page {
            margin: 10mm;
            size: A4;
          }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 no-print">
        {/* Header */}
        <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="text-sm text-neutral-400 mb-4">
              <Link href="/" className="hover:text-orange-400">{t('nav.home') || 'Home'}</Link>
              <span className="mx-2">/</span>
              <Link href="/account/settings" className="hover:text-orange-400">{t('nav.myAccount') || 'My Account'}</Link>
              <span className="mx-2">/</span>
              <span className="text-white">{t('account.invoices.title') || 'Invoices'}</span>
            </nav>
            <h1 className="text-2xl md:text-3xl font-bold">{t('account.invoices.title') || 'My Invoices'}</h1>
            <p className="text-neutral-400 mt-1">{t('account.invoices.subtitle') || 'View and download your purchase invoices'}</p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Date Range Filter */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex flex-col sm:flex-row items-end gap-4">
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('account.invoices.dateFrom') || 'From'}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('account.invoices.dateTo') || 'To'}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={handleDateFilter}
                  className="flex-1 sm:flex-none px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {t('account.invoices.filter') || 'Filter'}
                </button>
                {(dateFrom || dateTo) && (
                  <button
                    onClick={handleClearDateFilter}
                    className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    {t('account.invoices.clearFilter') || 'Clear'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results info */}
          {pagination && pagination.total > 0 && (
            <p className="text-sm text-gray-500 mb-4">
              {t('account.invoices.showingResults') || 'Showing'} {((currentPage - 1) * 10) + 1}-{Math.min(currentPage * 10, pagination.total)} {t('account.invoices.of') || 'of'} {pagination.total} {t('account.invoices.invoicesLabel') || 'invoices'}
            </p>
          )}

          {/* Loading overlay */}
          {loading && invoices.length > 0 && (
            <div className="flex justify-center py-4 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
            </div>
          )}

          {/* Empty state */}
          {!loading && invoices.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
              <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {t('account.invoices.noInvoices') || 'No invoices yet'}
              </h2>
              <p className="text-gray-600 mb-6">
                {(dateFrom || dateTo)
                  ? (t('account.invoices.noInvoicesDateRange') || 'No invoices found for the selected date range.')
                  : (t('account.invoices.noInvoicesDescription') || 'Your invoices will appear here after your first purchase.')}
              </p>
              {(dateFrom || dateTo) ? (
                <button
                  onClick={handleClearDateFilter}
                  className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {t('account.invoices.clearFilter') || 'Clear Filters'}
                </button>
              ) : (
                <Link
                  href="/shop"
                  className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  {t('account.invoices.shopNow') || 'Browse Products'}
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Invoices Table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {t('account.invoices.colInvoice') || 'Invoice'}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {t('account.invoices.colDate') || 'Date'}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                          {t('account.invoices.colItems') || 'Items'}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {t('account.invoices.colTotal') || 'Total'}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                          {t('account.invoices.colStatus') || 'Status'}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {t('account.invoices.colActions') || 'Actions'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900 text-sm">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-gray-500">
                              {t('account.invoices.order') || 'Order'}: {invoice.orderNumber}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatShortDate(invoice.date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 hidden sm:table-cell">
                            {invoice.itemCount} {invoice.itemCount === 1
                              ? (t('account.invoices.item') || 'item')
                              : (t('account.invoices.items') || 'items')}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="font-semibold text-gray-900">
                              {formatMoney(invoice.total, invoice.currency.symbol)}
                            </p>
                            <p className="text-xs text-gray-500">{invoice.currency.code}</p>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {t('account.invoices.paid') || 'Paid'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* View Button */}
                              <button
                                onClick={() => handleViewInvoice(invoice.id)}
                                disabled={loadingDetail}
                                className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                title={t('account.invoices.view') || 'View'}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>

                              {/* Download PDF Button */}
                              <button
                                onClick={() => handleDownloadPdf(invoice.id, invoice.invoiceNumber)}
                                disabled={downloadingPdf === invoice.id}
                                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                                title={t('account.invoices.downloadPdf') || 'Download PDF'}
                              >
                                {downloadingPdf === invoice.id ? (
                                  <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-gray-500">
                    {t('account.invoices.page') || 'Page'} {pagination.page} {t('account.invoices.of') || 'of'} {pagination.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t('account.invoices.previous') || 'Previous'}
                    </button>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={currentPage >= pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t('account.invoices.next') || 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ===================================================== */}
      {/* INVOICE DETAIL MODAL */}
      {/* ===================================================== */}
      {viewingInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 no-print">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-gray-50">
              <h2 className="text-lg font-bold text-gray-900">
                {t('account.invoices.invoiceDetail') || 'Invoice'} {viewingInvoice.invoiceNumber}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  {t('account.invoices.print') || 'Print'}
                </button>
                <button
                  onClick={() => handleDownloadPdf(viewingInvoice.id, viewingInvoice.invoiceNumber)}
                  disabled={downloadingPdf === viewingInvoice.id}
                  className="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {downloadingPdf === viewingInvoice.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                  PDF
                </button>
                <button
                  onClick={() => setViewingInvoice(null)}
                  className="p-2 hover:bg-gray-200 rounded-lg text-gray-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal body - scrollable invoice content */}
            <div className="flex-1 overflow-y-auto" ref={printRef}>
              <div className="p-6 md:p-8">
                {/* Company header + Invoice info */}
                <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-orange-500">BioCycle Peptides Inc.</h1>
                    <p className="text-gray-500 text-sm mt-1">1234 Boulevard des Sciences</p>
                    <p className="text-gray-500 text-sm">Montreal, QC H3C 1K3, Canada</p>
                    <p className="text-gray-500 text-sm">(514) 555-0199 | support@biocyclepeptides.com</p>
                  </div>
                  <div className="text-right sm:text-right">
                    <h2 className="text-xl font-bold text-gray-900">INVOICE</h2>
                    <p className="text-gray-600 font-medium">{viewingInvoice.invoiceNumber}</p>
                    <p className="text-gray-500 text-sm mt-2">
                      {t('account.invoices.date') || 'Date'}: {formatDate(viewingInvoice.date)}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {t('account.invoices.orderRef') || 'Order'}: {viewingInvoice.orderNumber}
                    </p>
                    <span className="inline-flex mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {t('account.invoices.paid') || 'Paid'}
                    </span>
                  </div>
                </div>

                {/* Shipping address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                  <div>
                    <h3 className="text-sm font-semibold text-orange-500 uppercase tracking-wider mb-2">
                      {t('account.invoices.shipTo') || 'Ship To'}
                    </h3>
                    <p className="text-sm font-medium text-gray-900">{viewingInvoice.shippingAddress.name}</p>
                    <p className="text-sm text-gray-600">{viewingInvoice.shippingAddress.address1}</p>
                    {viewingInvoice.shippingAddress.address2 && (
                      <p className="text-sm text-gray-600">{viewingInvoice.shippingAddress.address2}</p>
                    )}
                    <p className="text-sm text-gray-600">
                      {viewingInvoice.shippingAddress.city}, {viewingInvoice.shippingAddress.state} {viewingInvoice.shippingAddress.postal}
                    </p>
                    <p className="text-sm text-gray-600">{viewingInvoice.shippingAddress.country}</p>
                    {viewingInvoice.shippingAddress.phone && (
                      <p className="text-sm text-gray-500 mt-1">Tel: {viewingInvoice.shippingAddress.phone}</p>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-orange-500 uppercase tracking-wider mb-2">
                      {t('account.invoices.paymentInfo') || 'Payment Information'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{t('account.invoices.method') || 'Method'}:</span>{' '}
                      {viewingInvoice.paymentMethod
                        ? (PAYMENT_METHOD_LABELS[viewingInvoice.paymentMethod] || viewingInvoice.paymentMethod)
                        : 'N/A'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">{t('account.invoices.currency') || 'Currency'}:</span>{' '}
                      {viewingInvoice.currency.name} ({viewingInvoice.currency.code})
                    </p>
                    {viewingInvoice.carrier && (
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">{t('account.invoices.carrier') || 'Carrier'}:</span>{' '}
                        {viewingInvoice.carrier}
                      </p>
                    )}
                    {viewingInvoice.trackingNumber && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{t('account.invoices.tracking') || 'Tracking'}:</span>{' '}
                        {viewingInvoice.trackingNumber}
                      </p>
                    )}
                  </div>
                </div>

                {/* Items table */}
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          {t('account.invoices.product') || 'Product'}
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                          {t('account.invoices.qty') || 'Qty'}
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          {t('account.invoices.unitPrice') || 'Unit Price'}
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          {t('account.invoices.lineTotal') || 'Total'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {viewingInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 text-sm">{item.productName}</p>
                            {item.formatName && (
                              <p className="text-xs text-gray-500">{item.formatName}</p>
                            )}
                            {item.sku && (
                              <p className="text-xs text-gray-400">SKU: {item.sku}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">
                            {formatMoney(item.unitPrice, viewingInvoice.currency.symbol)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                            {formatMoney(item.total, viewingInvoice.currency.symbol)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="flex justify-end">
                  <div className="w-full sm:w-72 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('account.invoices.subtotal') || 'Subtotal'}:</span>
                      <span className="text-gray-900">{formatMoney(viewingInvoice.subtotal, viewingInvoice.currency.symbol)}</span>
                    </div>

                    {viewingInvoice.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>
                          {t('account.invoices.discount') || 'Discount'}
                          {viewingInvoice.promoCode ? ` (${viewingInvoice.promoCode})` : ''}:
                        </span>
                        <span>-{formatMoney(viewingInvoice.discount, viewingInvoice.currency.symbol)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{t('account.invoices.shipping') || 'Shipping'}:</span>
                      <span className="text-gray-900">
                        {viewingInvoice.shippingCost > 0
                          ? formatMoney(viewingInvoice.shippingCost, viewingInvoice.currency.symbol)
                          : (t('account.invoices.free') || 'FREE')}
                      </span>
                    </div>

                    {viewingInvoice.taxTps > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">GST/TPS (5%):</span>
                        <span className="text-gray-900">{formatMoney(viewingInvoice.taxTps, viewingInvoice.currency.symbol)}</span>
                      </div>
                    )}

                    {viewingInvoice.taxTvq > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">QST/TVQ (9.975%):</span>
                        <span className="text-gray-900">{formatMoney(viewingInvoice.taxTvq, viewingInvoice.currency.symbol)}</span>
                      </div>
                    )}

                    {viewingInvoice.taxTvh > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">HST/TVH:</span>
                        <span className="text-gray-900">{formatMoney(viewingInvoice.taxTvh, viewingInvoice.currency.symbol)}</span>
                      </div>
                    )}

                    {viewingInvoice.taxPst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">PST:</span>
                        <span className="text-gray-900">{formatMoney(viewingInvoice.taxPst, viewingInvoice.currency.symbol)}</span>
                      </div>
                    )}

                    {/* Grand Total */}
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-900">{t('account.invoices.total') || 'TOTAL'}:</span>
                        <span className="font-bold text-orange-600 text-lg">
                          {formatMoney(viewingInvoice.total, viewingInvoice.currency.symbol)} {viewingInvoice.currency.code}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {viewingInvoice.customerNotes && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">
                      {t('account.invoices.notes') || 'Notes'}:
                    </h4>
                    <p className="text-sm text-gray-600">{viewingInvoice.customerNotes}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                  <p className="text-sm text-gray-500">
                    {t('account.invoices.thankYou') || 'Thank you for your purchase!'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    BioCycle Peptides Inc. | support@biocyclepeptides.com | www.biocyclepeptides.com
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* PRINT-ONLY VERSION (visible only when printing) */}
      {/* ===================================================== */}
      {viewingInvoice && (
        <div className="print-invoice-container hidden print:block">
          <div className="print-invoice-content">
            {/* Company header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: '#c85000' }}>BioCycle Peptides Inc.</h1>
                <p style={{ fontSize: '12px', color: '#666' }}>1234 Boulevard des Sciences</p>
                <p style={{ fontSize: '12px', color: '#666' }}>Montreal, QC H3C 1K3, Canada</p>
                <p style={{ fontSize: '12px', color: '#666' }}>(514) 555-0199 | support@biocyclepeptides.com</p>
                <p style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>
                  GST/TPS: {process.env.NEXT_PUBLIC_BUSINESS_TPS || '123456789 RT0001'} | QST/TVQ: {process.env.NEXT_PUBLIC_BUSINESS_TVQ || '1234567890 TQ0001'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '28px', fontWeight: 'bold' }}>INVOICE</h2>
                <p style={{ fontSize: '14px', color: '#333' }}>{viewingInvoice.invoiceNumber}</p>
                <p style={{ fontSize: '12px', color: '#666' }}>Date: {formatDate(viewingInvoice.date)}</p>
                <p style={{ fontSize: '12px', color: '#666' }}>Order: {viewingInvoice.orderNumber}</p>
              </div>
            </div>

            <hr style={{ borderColor: '#ddd', marginBottom: '16px' }} />

            {/* Ship To */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: 'bold', color: '#c85000', textTransform: 'uppercase', marginBottom: '4px' }}>
                Ship To
              </h3>
              <p style={{ fontSize: '13px', fontWeight: '600' }}>{viewingInvoice.shippingAddress.name}</p>
              <p style={{ fontSize: '12px', color: '#555' }}>{viewingInvoice.shippingAddress.address1}</p>
              {viewingInvoice.shippingAddress.address2 && (
                <p style={{ fontSize: '12px', color: '#555' }}>{viewingInvoice.shippingAddress.address2}</p>
              )}
              <p style={{ fontSize: '12px', color: '#555' }}>
                {viewingInvoice.shippingAddress.city}, {viewingInvoice.shippingAddress.state} {viewingInvoice.shippingAddress.postal}
              </p>
              <p style={{ fontSize: '12px', color: '#555' }}>{viewingInvoice.shippingAddress.country}</p>
            </div>

            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: '600', borderBottom: '1px solid #ddd' }}>Product</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', fontWeight: '600', borderBottom: '1px solid #ddd' }}>Qty</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: '600', borderBottom: '1px solid #ddd' }}>Unit Price</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: '600', borderBottom: '1px solid #ddd' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {viewingInvoice.items.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 12px', fontSize: '12px' }}>
                      {item.productName}
                      {item.formatName && <span style={{ color: '#888' }}> - {item.formatName}</span>}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px' }}>{item.quantity}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px' }}>
                      {formatMoney(item.unitPrice, viewingInvoice.currency.symbol)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600' }}>
                      {formatMoney(item.total, viewingInvoice.currency.symbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '250px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Subtotal:</span>
                  <span>{formatMoney(viewingInvoice.subtotal, viewingInvoice.currency.symbol)}</span>
                </div>
                {viewingInvoice.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', color: 'green' }}>
                    <span>Discount{viewingInvoice.promoCode ? ` (${viewingInvoice.promoCode})` : ''}:</span>
                    <span>-{formatMoney(viewingInvoice.discount, viewingInvoice.currency.symbol)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                  <span>Shipping:</span>
                  <span>{viewingInvoice.shippingCost > 0 ? formatMoney(viewingInvoice.shippingCost, viewingInvoice.currency.symbol) : 'FREE'}</span>
                </div>
                {viewingInvoice.taxTps > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>GST/TPS (5%):</span>
                    <span>{formatMoney(viewingInvoice.taxTps, viewingInvoice.currency.symbol)}</span>
                  </div>
                )}
                {viewingInvoice.taxTvq > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>QST/TVQ (9.975%):</span>
                    <span>{formatMoney(viewingInvoice.taxTvq, viewingInvoice.currency.symbol)}</span>
                  </div>
                )}
                {viewingInvoice.taxTvh > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>HST/TVH:</span>
                    <span>{formatMoney(viewingInvoice.taxTvh, viewingInvoice.currency.symbol)}</span>
                  </div>
                )}
                {viewingInvoice.taxPst > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span>PST:</span>
                    <span>{formatMoney(viewingInvoice.taxPst, viewingInvoice.currency.symbol)}</span>
                  </div>
                )}
                <div style={{ borderTop: '2px solid #333', paddingTop: '8px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
                  <span>TOTAL:</span>
                  <span>{formatMoney(viewingInvoice.total, viewingInvoice.currency.symbol)} {viewingInvoice.currency.code}</span>
                </div>
              </div>
            </div>

            {/* Print footer */}
            <div style={{ marginTop: '40px', textAlign: 'center', borderTop: '1px solid #ddd', paddingTop: '12px' }}>
              <p style={{ fontSize: '11px', color: '#999' }}>Thank you for your purchase!</p>
              <p style={{ fontSize: '10px', color: '#bbb' }}>BioCycle Peptides Inc. | support@biocyclepeptides.com | www.biocyclepeptides.com</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
