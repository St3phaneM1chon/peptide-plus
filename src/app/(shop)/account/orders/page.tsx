'use client';

/**
 * PAGE MES COMMANDES - BioCycle Peptides
 * Avec génération de factures PDF
 */

import { useState, useEffect, useMemo, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  productName: string;
  formatName?: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
}

interface ShippingAddress {
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  subtotal: number;
  tax: number;
  taxDetails?: {
    gst?: number;
    pst?: number;
    qst?: number;
    hst?: number;
  };
  shippingCost: number;
  discount?: number;
  promoCode?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  createdAt: string;
  shippedAt?: string;
  deliveredAt?: string;
  paidAt?: string;
  items: OrderItem[];
  currency?: { code: string };
  shippingAddress?: ShippingAddress;
  billingAddress?: ShippingAddress;
  paymentMethod?: string;
}

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t, locale } = useI18n();
  const fmtPrice = (amount: number, currency: string = 'CAD') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount));
  const { addItem } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [viewingInvoice, setViewingInvoice] = useState<Order | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [exportDateFrom, setExportDateFrom] = useState('');
  const [exportDateTo, setExportDateTo] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<Order | null>(null);
  const [editingAddressOrderId, setEditingAddressOrderId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState({
    firstName: '',
    lastName: '',
    address1: '',
    address2: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'CA',
    phone: '',
  });
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/orders');
    }
  }, [status, router]);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error: unknown) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchOrders();
    }
  }, [session, fetchOrders]);

  const handleReorder = useCallback(async (orderId: string) => {
    setReorderingId(orderId);
    try {
      const res = await fetch(`/api/account/orders/${orderId}/reorder`, {
        method: 'POST',
      });

      if (!res.ok) {
        toast.error(t('account.orders.reorderError') || 'Failed to reorder');
        return;
      }

      const data = await res.json();
      const { items, unavailable } = data as {
        items: Array<{
          productId: string;
          formatId: string | null;
          slug: string;
          name: string;
          formatName: string | null;
          quantity: number;
          price: number;
          image: string | null;
        }>;
        unavailable: string[];
      };

      if (items.length === 0) {
        toast.error(t('account.orders.reorderAllUnavailable') || 'All items from this order are no longer available');
        return;
      }

      // Add each available item to the cart (suppress individual toasts)
      for (const item of items) {
        addItem({
          productId: item.productId,
          formatId: item.formatId || undefined,
          name: item.name,
          formatName: item.formatName || undefined,
          price: item.price,
          quantity: item.quantity,
          image: item.image || undefined,
        });
      }

      // Show summary toast
      if (unavailable.length > 0) {
        toast.warning(
          `${items.length} ${t('account.orders.reorderItemsAdded') || 'item(s) added to cart'}. ${unavailable.length} ${t('account.orders.reorderItemsUnavailable') || 'item(s) no longer available'}: ${unavailable.join(', ')}`
        );
      } else {
        toast.success(
          `${items.length} ${t('account.orders.reorderItemsAdded') || 'item(s) added to cart'}`
        );
      }
    } catch (error) {
      console.error('Reorder failed:', error);
      toast.error(t('account.orders.reorderError') || 'Failed to reorder');
    } finally {
      setReorderingId(null);
    }
  }, [addItem, t]);

  const handleCancelOrder = useCallback(async (order: Order) => {
    setCancellingId(order.id);
    try {
      const res = await fetch(`/api/account/orders/${order.id}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const errorData = await res.json();
        toast.error(errorData.message || errorData.error || t('toast.orders.cancelFailed'));
        return;
      }

      const data = await res.json();

      // Show success message
      if (data.refund && data.refund.amount > 0) {
        toast.success(
          t('toast.orders.cancelledWithRefund', { orderNumber: order.orderNumber, amount: new Intl.NumberFormat(locale, { style: 'currency', currency: order.currency?.code || 'CAD' }).format(data.refund.amount) }),
          { duration: 6000 }
        );
      } else {
        toast.success(t('toast.orders.cancelledSuccess', { orderNumber: order.orderNumber }));
      }

      // Refresh orders list
      await fetchOrders();

      // Close confirmation dialog
      setCancelConfirmOrder(null);
    } catch (error) {
      console.error('Cancel order failed:', error);
      toast.error(t('toast.orders.cancelFailed'));
    } finally {
      setCancellingId(null);
    }
  }, [fetchOrders, t]);

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-indigo-100 text-indigo-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    PENDING: t('orderFilters.pending'),
    CONFIRMED: t('orderFilters.confirmed'),
    PROCESSING: t('orderFilters.processing'),
    SHIPPED: t('orderFilters.shipped'),
    DELIVERED: t('orderFilters.delivered'),
    CANCELLED: t('orderFilters.cancelled'),
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(order =>
        order.orderNumber.toLowerCase().includes(term) ||
        order.items.some(item => item.productName.toLowerCase().includes(term))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'all') {
      const days = parseInt(dateFilter);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(order => new Date(order.createdAt) >= cutoff);
    }

    return result;
  }, [orders, searchTerm, statusFilter, dateFilter]);

  // Generate PDF Invoice
  const generateInvoicePDF = useCallback(async (order: Order) => {
    setGeneratingPdf(true);
    try {
      // Dynamic import of jsPDF
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      const currency = order.currency?.code || 'CAD';
      const formatMoney = (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount));
      
      // Header
      doc.setFontSize(24);
      doc.setTextColor(173, 71, 0); // Orange
      doc.text('BioCycle Peptides', 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(t('account.orders.pdfSubtitle'), 20, 32);

      // Invoice Title
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text(t('account.orders.pdfInvoiceTitle'), 150, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`N° ${order.orderNumber}`, 150, 32);
      doc.text(`${t('account.orders.pdfDate')}: ${new Date(order.createdAt).toLocaleDateString(locale)}`, 150, 38);

      // Line
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 45, 190, 45);

      // Billing Info
      let y = 55;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`${t('account.orders.pdfBilling')}:`, 20, y);
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const billing = order.billingAddress || order.shippingAddress;
      if (billing) {
        y += 6;
        doc.text(`${billing.firstName || ''} ${billing.lastName || ''}`.trim() || session?.user?.name || t('account.orders.pdfClient'), 20, y);
        if (billing.address1) { y += 5; doc.text(billing.address1, 20, y); }
        if (billing.address2) { y += 5; doc.text(billing.address2, 20, y); }
        if (billing.city || billing.province || billing.postalCode) {
          y += 5;
          doc.text(`${billing.city || ''}, ${billing.province || ''} ${billing.postalCode || ''}`.trim(), 20, y);
        }
        if (billing.country) { y += 5; doc.text(billing.country === 'CA' ? 'Canada' : billing.country, 20, y); }
      } else {
        y += 6;
        doc.text(session?.user?.name || t('account.orders.pdfClient'), 20, y);
        y += 5;
        doc.text(session?.user?.email || '', 20, y);
      }
      
      // Shipping Info
      y = 55;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(`${t('account.orders.pdfShipping')}:`, 110, y);
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const shipping = order.shippingAddress;
      if (shipping) {
        y += 6;
        doc.text(`${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() || t('account.orders.pdfClient'), 110, y);
        if (shipping.address1) { y += 5; doc.text(shipping.address1, 110, y); }
        if (shipping.address2) { y += 5; doc.text(shipping.address2, 110, y); }
        if (shipping.city || shipping.province || shipping.postalCode) {
          y += 5;
          doc.text(`${shipping.city || ''}, ${shipping.province || ''} ${shipping.postalCode || ''}`.trim(), 110, y);
        }
        if (shipping.country) { y += 5; doc.text(shipping.country === 'CA' ? 'Canada' : shipping.country, 110, y); }
      }

      // Items Table Header
      y = 100;
      doc.setFillColor(245, 245, 245);
      doc.rect(20, y - 5, 170, 10, 'F');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(t('account.orders.pdfDescription'), 22, y);
      doc.text(t('account.orders.pdfQty'), 120, y);
      doc.text(t('account.orders.pdfUnitPrice'), 140, y);
      doc.text(t('account.orders.pdfTotal'), 170, y);

      // Items
      y += 10;
      doc.setTextColor(60, 60, 60);
      order.items.forEach((item) => {
        doc.text(item.productName.substring(0, 50), 22, y);
        doc.text(String(item.quantity), 125, y);
        doc.text(formatMoney(item.unitPrice), 140, y);
        doc.text(formatMoney(item.unitPrice * item.quantity), 170, y);
        y += 7;
      });
      
      // Totals
      y += 5;
      doc.line(120, y, 190, y);
      y += 8;
      
      doc.text(`${t('account.orders.pdfSubtotal')}:`, 120, y);
      doc.text(formatMoney(order.subtotal), 170, y);

      if (order.discount && order.discount > 0) {
        y += 6;
        doc.setTextColor(0, 150, 0);
        doc.text(`${t('account.orders.pdfDiscount')}${order.promoCode ? ` (${order.promoCode})` : ''}:`, 120, y);
        doc.text(`-${formatMoney(order.discount)}`, 170, y);
        doc.setTextColor(60, 60, 60);
      }

      y += 6;
      doc.text(`${t('account.orders.pdfShipping')}:`, 120, y);
      doc.text(order.shippingCost > 0 ? formatMoney(order.shippingCost) : t('account.orders.pdfFreeShipping'), 170, y);
      
      // Tax details
      if (order.taxDetails) {
        if (order.taxDetails.gst && order.taxDetails.gst > 0) {
          y += 6;
          doc.text(`${t('account.orders.pdfGst')}:`, 120, y);
          doc.text(formatMoney(order.taxDetails.gst), 170, y);
        }
        if (order.taxDetails.qst && order.taxDetails.qst > 0) {
          y += 6;
          doc.text(`${t('account.orders.pdfQst')}:`, 120, y);
          doc.text(formatMoney(order.taxDetails.qst), 170, y);
        }
        if (order.taxDetails.pst && order.taxDetails.pst > 0) {
          y += 6;
          doc.text(`${t('account.orders.pdfPst')}:`, 120, y);
          doc.text(formatMoney(order.taxDetails.pst), 170, y);
        }
        if (order.taxDetails.hst && order.taxDetails.hst > 0) {
          y += 6;
          doc.text(`${t('account.orders.pdfHst')}:`, 120, y);
          doc.text(formatMoney(order.taxDetails.hst), 170, y);
        }
      } else if (order.tax > 0) {
        y += 6;
        doc.text(`${t('account.orders.pdfTaxes')}:`, 120, y);
        doc.text(formatMoney(order.tax), 170, y);
      }
      
      // Total
      y += 8;
      doc.setFillColor(173, 71, 0);
      doc.rect(115, y - 5, 75, 12, 'F');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text(`${t('account.orders.pdfTotalLabel')}:`, 120, y + 2);
      doc.text(formatMoney(order.total), 170, y + 2);

      // Payment Info
      y += 20;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`${t('account.orders.pdfPaymentStatus')}: ${order.paymentStatus === 'PAID' ? t('account.orders.pdfPaid') : order.paymentStatus}`, 20, y);
      if (order.paidAt) {
        doc.text(`${t('account.orders.pdfPaymentDate')}: ${new Date(order.paidAt).toLocaleDateString(locale)}`, 20, y + 5);
      }
      if (order.paymentMethod) {
        doc.text(`${t('account.orders.pdfMethod')}: ${order.paymentMethod}`, 20, y + 10);
      }

      // Footer
      y = 270;
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text(t('account.orders.pdfFooterDisclaimer'), 20, y);
      doc.text('support@biocyclepeptides.com | biocyclepeptides.com', 20, y + 5);
      
      // Save
      doc.save(`Facture_${order.orderNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(t('account.orders.pdfError'));
    } finally {
      setGeneratingPdf(false);
    }
  }, [session]);

  // Print Invoice
  const printInvoice = useCallback(() => {
    window.print();
  }, []);

  // Open edit address modal
  const handleEditAddress = useCallback((order: Order) => {
    const shipping = order.shippingAddress;
    if (shipping) {
      const [firstName = '', lastName = ''] = (shipping.firstName && shipping.lastName)
        ? [shipping.firstName, shipping.lastName]
        : (shipping.firstName || '').split(' ');

      setAddressForm({
        firstName: firstName || '',
        lastName: lastName || '',
        address1: shipping.address1 || '',
        address2: shipping.address2 || '',
        city: shipping.city || '',
        province: shipping.province || '',
        postalCode: shipping.postalCode || '',
        country: shipping.country || 'CA',
        phone: shipping.phone || '',
      });
    }
    setEditingAddressOrderId(order.id);
  }, []);

  // Close edit address modal
  const handleCancelEditAddress = useCallback(() => {
    setEditingAddressOrderId(null);
    setAddressForm({
      firstName: '',
      lastName: '',
      address1: '',
      address2: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'CA',
      phone: '',
    });
  }, []);

  // Save updated address
  const handleSaveAddress = useCallback(async () => {
    if (!editingAddressOrderId) return;

    setSavingAddress(true);
    try {
      const res = await fetch(`/api/account/orders/${editingAddressOrderId}/update-address`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressForm),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || t('toast.orders.addressUpdateFailed'));
        return;
      }

      const data = await res.json();

      // Update the orders list with the updated order
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === editingAddressOrderId
            ? {
                ...order,
                shippingAddress: data.order.shippingAddress,
              }
            : order
        )
      );

      toast.success(t('toast.orders.addressUpdated'));
      handleCancelEditAddress();
    } catch (error) {
      console.error('Update address failed:', error);
      toast.error(t('toast.orders.addressUpdateFailed'));
    } finally {
      setSavingAddress(false);
    }
  }, [editingAddressOrderId, addressForm, handleCancelEditAddress, t]);

  // Export Orders to CSV
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      // Build query params
      const params = new URLSearchParams();
      params.set('format', 'csv');

      if (exportDateFrom) {
        params.set('dateFrom', exportDateFrom);
      }
      if (exportDateTo) {
        params.set('dateTo', exportDateTo);
      }

      const res = await fetch(`/api/account/orders/export?${params.toString()}`);

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || t('toast.orders.exportFailed'));
        return;
      }

      // Get the CSV content
      const csvContent = await res.text();

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv; charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Get filename from Content-Disposition header or use default
      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `orders-export-${new Date().toISOString().split('T')[0]}.csv`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success(t('toast.orders.exportSuccess'));
      setShowDatePicker(false);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error(t('toast.orders.exportFailed'));
    } finally {
      setExporting(false);
    }
  }, [exportDateFrom, exportDateTo, t]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">{t('account.orders.breadcrumbHome')}</Link>
            <span className="mx-2">/</span>
            <Link href="/account" className="hover:text-orange-600">{t('account.orders.breadcrumbAccount')}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{t('account.orders.breadcrumbOrders')}</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">{t('account.orders.title')}</h1>
        </div>

        {/* Filters */}
        {orders.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('account.orders.searchPlaceholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full ps-10 pe-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                    <span className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  </div>
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">{t('orderFilters.allStatuses')}</option>
                  <option value="PENDING">{t('orderFilters.filterPending')}</option>
                  <option value="CONFIRMED">{t('orderFilters.filterConfirmed')}</option>
                  <option value="PROCESSING">{t('orderFilters.filterProcessing')}</option>
                  <option value="SHIPPED">{t('orderFilters.filterShipped')}</option>
                  <option value="DELIVERED">{t('orderFilters.filterDelivered')}</option>
                  <option value="CANCELLED">{t('orderFilters.filterCancelled')}</option>
                </select>

                {/* Date Filter */}
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">{t('account.orders.allDates')}</option>
                  <option value="7">{t('account.orders.last7Days')}</option>
                  <option value="30">{t('account.orders.last30Days')}</option>
                  <option value="90">{t('account.orders.last3Months')}</option>
                  <option value="365">{t('account.orders.thisYear')}</option>
                </select>

                {/* Export Button */}
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <span>⬇️</span>
                  Export Orders
                </button>
              </div>

              {/* Date Range Picker for Export */}
              {showDatePicker && (
                <div className="border-t border-gray-200 pt-4 mt-2">
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        From Date (optional)
                      </label>
                      <input
                        type="date"
                        value={exportDateFrom}
                        onChange={(e) => setExportDateFrom(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        To Date (optional)
                      </label>
                      <input
                        type="date"
                        value={exportDateTo}
                        onChange={(e) => setExportDateTo(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setExportDateFrom('');
                          setExportDateTo('');
                        }}
                        className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors"
                      >
                        Clear Dates
                      </button>
                      <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {exporting ? (
                          <>
                            <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                            Exporting...
                          </>
                        ) : (
                          <>
                            <span>📥</span>
                            Download CSV
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('account.orders.noOrders')}</h2>
            <p className="text-gray-600 mb-6">
              {t('account.orders.noOrdersDescription')}
            </p>
            <Link
              href="/shop"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {t('account.orders.discoverProducts')}
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">🔍</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('account.orders.noResults')}</h2>
            <p className="text-gray-600 mb-4">
              {t('account.orders.noResultsDescription')}
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setDateFilter('all');
              }}
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              {t('account.orders.resetFilters')}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">
              {filteredOrders.length} {t('account.orders.ordersFound', { count: filteredOrders.length })}
            </p>
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Order Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-gray-500">{t('account.orders.orderLabel')}</p>
                        <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('account.orders.dateLabel')}</p>
                        <p className="text-gray-900">
                          {new Date(order.createdAt).toLocaleDateString(locale, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">{t('account.orders.totalLabel')}</p>
                        <p className="font-semibold text-orange-600">
                          {fmtPrice(order.total, order.currency?.code || 'CAD')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                </div>

                {/* Order Items */}
                <div className="px-6 py-4">
                  <div className="space-y-3">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <span className="text-xl">🧪</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.productName}
                              {item.formatName ? ` — ${item.formatName}` : ''}
                            </p>
                            <p className="text-sm text-gray-500">
                              {t('account.orders.qty')}: {item.quantity} × {fmtPrice(item.unitPrice)}
                            </p>
                          </div>
                        </div>
                        <p className="font-medium text-gray-900">
                          {fmtPrice(Number(item.unitPrice) * item.quantity)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tracking Info */}
                {order.trackingNumber && (
                  <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-800 font-medium">
                          {order.carrier || t('account.orders.carrier')}: {order.trackingNumber}
                        </p>
                      </div>
                      {order.trackingUrl && (
                        <a
                          href={order.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          {t('account.orders.trackPackage')}
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Actions */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {order.deliveredAt && (
                      <span>{t('account.orders.deliveredOn')} {new Date(order.deliveredAt).toLocaleDateString(locale)}</span>
                    )}
                    {order.shippedAt && !order.deliveredAt && (
                      <span>{t('account.orders.shippedOn')} {new Date(order.shippedAt).toLocaleDateString(locale)}</span>
                    )}
                    {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                      <button
                        onClick={() => handleEditAddress(order)}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        ✏️ {t('account.orders.editAddress') || 'Edit Address'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {/* Invoice Buttons */}
                    <button
                      onClick={() => setViewingInvoice(order)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      {t('account.orders.viewInvoice')}
                    </button>
                    <button
                      onClick={() => generateInvoicePDF(order)}
                      disabled={generatingPdf}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1 disabled:opacity-50"
                    >
                      {generatingPdf ? '⏳' : '⬇️'} {t('account.orders.downloadPdf')}
                    </button>
                    {order.status === 'DELIVERED' && (
                      <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                        {t('account.orders.leaveReview')}
                      </button>
                    )}
                    {(order.status === 'DELIVERED' || order.status === 'SHIPPED' || order.status === 'CONFIRMED' || order.status === 'PROCESSING') && (
                      <button
                        onClick={() => handleReorder(order.id)}
                        disabled={reorderingId === order.id}
                        className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1 disabled:opacity-50"
                      >
                        {reorderingId === order.id ? (
                          <>
                            <span className="animate-spin inline-block w-3 h-3 border-2 border-orange-600 border-t-transparent rounded-full"></span>
                            {t('account.orders.reordering') || 'Reordering...'}
                          </>
                        ) : (
                          <>
                            {t('account.orders.reorder')}
                          </>
                        )}
                      </button>
                    )}
                    {/* Cancel Order Button - Only for PENDING or CONFIRMED orders */}
                    {(order.status === 'PENDING' || order.status === 'CONFIRMED') && (
                      <button
                        onClick={() => setCancelConfirmOrder(order)}
                        disabled={cancellingId === order.id}
                        className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1 disabled:opacity-50"
                      >
                        {cancellingId === order.id ? (
                          <>
                            <span className="animate-spin inline-block w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full"></span>
                            {t('account.orders.cancelling') || 'Cancelling...'}
                          </>
                        ) : (
                          <>
                            ❌ {t('account.orders.cancelOrder') || 'Cancel Order'}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Edit Address Modal */}
        {editingAddressOrderId && (
          <EditAddressModal
            addressForm={addressForm}
            setAddressForm={setAddressForm}
            onSave={handleSaveAddress}
            onCancel={handleCancelEditAddress}
            saving={savingAddress}
            t={t}
          />
        )}

        {/* Cancel Order Confirmation Modal */}
        {cancelConfirmOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-order-modal-title">
            <div className="bg-white rounded-2xl max-w-md w-full p-6">
              <h2 id="cancel-order-modal-title" className="text-xl font-bold text-gray-900 mb-4">
                {t('account.orders.cancelOrderConfirmTitle') || 'Cancel Order?'}
              </h2>
              <p className="text-gray-600 mb-4">
                {t('account.orders.cancelOrderConfirmMessage') || 'Are you sure you want to cancel this order? This action cannot be undone.'}
              </p>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">{t('account.orders.orderLabel')}</span>
                  <span className="font-semibold text-gray-900">{cancelConfirmOrder.orderNumber}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">{t('cart.total')}</span>
                  <span className="font-semibold text-gray-900">
                    {fmtPrice(cancelConfirmOrder.total, cancelConfirmOrder.currency?.code || 'CAD')}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">{t('account.orders.items') || 'Items'}</span>
                  <span className="text-gray-900">{cancelConfirmOrder.items.length}</span>
                </div>
              </div>

              {cancelConfirmOrder.paymentStatus === 'PAID' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-green-800">
                    💰 {t('account.orders.refundNote') || 'A refund will be processed to your original payment method within 5-10 business days.'}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setCancelConfirmOrder(null)}
                  disabled={cancellingId === cancelConfirmOrder.id}
                  className="flex-1 px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button
                  onClick={() => handleCancelOrder(cancelConfirmOrder)}
                  disabled={cancellingId === cancelConfirmOrder.id}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancellingId === cancelConfirmOrder.id ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                      {t('account.orders.cancelling') || 'Cancelling...'}
                    </>
                  ) : (
                    <>
                      {t('account.orders.confirmCancel') || 'Yes, Cancel Order'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Modal */}
        {viewingInvoice && (
          <InvoiceModal
            order={viewingInvoice}
            userEmail={session?.user?.email || ''}
            userName={session?.user?.name || ''}
            onClose={() => setViewingInvoice(null)}
            onDownload={() => generateInvoicePDF(viewingInvoice)}
            onPrint={printInvoice}
            t={t}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// EDIT ADDRESS MODAL COMPONENT
// ============================================
function EditAddressModal({
  addressForm,
  setAddressForm,
  onSave,
  onCancel,
  saving,
  t,
}: {
  addressForm: {
    firstName: string;
    lastName: string;
    address1: string;
    address2: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  setAddressForm: (form: typeof addressForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  t: (key: string) => string;
}) {
  const handleChange = (field: keyof typeof addressForm, value: string) => {
    setAddressForm({ ...addressForm, [field]: value });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-shipping-modal-title">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 id="edit-shipping-modal-title" className="text-xl font-bold text-gray-900">
            {t('account.orders.editShippingAddress') || 'Edit Shipping Address'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('checkout.firstName') || 'First Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('checkout.lastName') || 'Last Name'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Address Line 1 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('checkout.address1') || 'Address Line 1'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={addressForm.address1}
                onChange={(e) => handleChange('address1', e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* Address Line 2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('checkout.address2') || 'Address Line 2 (optional)'}
              </label>
              <input
                type="text"
                value={addressForm.address2}
                onChange={(e) => handleChange('address2', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            {/* City, Province, Postal Code */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('checkout.city') || 'City'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('checkout.province') || 'Province'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={addressForm.province}
                  onChange={(e) => handleChange('province', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="">Select</option>
                  <option value="AB">Alberta</option>
                  <option value="BC">British Columbia</option>
                  <option value="MB">Manitoba</option>
                  <option value="NB">New Brunswick</option>
                  <option value="NL">Newfoundland and Labrador</option>
                  <option value="NS">Nova Scotia</option>
                  <option value="NT">Northwest Territories</option>
                  <option value="NU">Nunavut</option>
                  <option value="ON">Ontario</option>
                  <option value="PE">Prince Edward Island</option>
                  <option value="QC">Quebec</option>
                  <option value="SK">Saskatchewan</option>
                  <option value="YT">Yukon</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('checkout.postalCode') || 'Postal Code'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressForm.postalCode}
                  onChange={(e) => handleChange('postalCode', e.target.value.toUpperCase())}
                  required
                  pattern="[A-Z][0-9][A-Z] ?[0-9][A-Z][0-9]"
                  placeholder={t('account.ordersSettings.placeholderPostalCode')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>

            {/* Country and Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('checkout.country') || 'Country'} <span className="text-red-500">*</span>
                </label>
                <select
                  value={addressForm.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="CA">Canada</option>
                  <option value="US">United States</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('checkout.phone') || 'Phone (optional)'}
                </label>
                <input
                  type="tel"
                  value={addressForm.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                {t('common.saving') || 'Saving...'}
              </>
            ) : (
              t('common.save') || 'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// INVOICE MODAL COMPONENT
// ============================================
function InvoiceModal({
  order,
  userEmail,
  userName,
  onClose,
  onDownload,
  onPrint,
  t,
  locale,
}: {
  order: Order;
  userEmail: string;
  userName: string;
  onClose: () => void;
  onDownload: () => void;
  onPrint: () => void;
  t: (key: string) => string;
  locale: string;
}) {
  const currency = order.currency?.code || 'CAD';
  const formatMoney = (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount));

  const billing = order.billingAddress || order.shippingAddress;
  const shipping = order.shippingAddress;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="invoice-preview-modal-title">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 id="invoice-preview-modal-title" className="text-lg font-bold">{t('account.orders.invoiceTitle')} {order.orderNumber}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              {t('account.orders.print')}
            </button>
            <button
              onClick={onDownload}
              className="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-1"
            >
              ⬇️ PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
          </div>
        </div>

        {/* Invoice Content - Printable */}
        <div className="flex-1 overflow-y-auto p-6 print:p-0" id="invoice-content">
          <div className="bg-white print:shadow-none">
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold text-orange-500">BioCycle Peptides</h1>
                <p className="text-gray-500 text-sm">{t('account.orders.pdfSubtitle')}</p>
                <p className="text-gray-500 text-sm mt-2">support@biocyclepeptides.com</p>
                <p className="text-gray-500 text-sm">biocyclepeptides.com</p>
              </div>
              <div className="text-end">
                <h2 className="text-xl font-bold text-gray-900">{t('account.orders.pdfInvoiceTitle')}</h2>
                <p className="text-gray-600">N° {order.orderNumber}</p>
                <p className="text-gray-500 text-sm mt-2">
                  {t('account.orders.pdfDate')}: {new Date(order.createdAt).toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                {order.paidAt && (
                  <p className="text-green-600 text-sm font-medium mt-1">
                    {t('account.orders.paidOn')} {new Date(order.paidAt).toLocaleDateString(locale)}
                  </p>
                )}
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">{t('account.orders.pdfBilling')}</h3>
                <div className="text-sm text-gray-600">
                  {billing ? (
                    <>
                      <p className="font-medium">{`${billing.firstName || ''} ${billing.lastName || ''}`.trim() || userName}</p>
                      {billing.address1 && <p>{billing.address1}</p>}
                      {billing.address2 && <p>{billing.address2}</p>}
                      {(billing.city || billing.province || billing.postalCode) && (
                        <p>{`${billing.city || ''}, ${billing.province || ''} ${billing.postalCode || ''}`.trim()}</p>
                      )}
                      {billing.country && <p>{billing.country === 'CA' ? 'Canada' : billing.country}</p>}
                      {billing.phone && <p>📞 {billing.phone}</p>}
                    </>
                  ) : (
                    <>
                      <p className="font-medium">{userName}</p>
                      <p>{userEmail}</p>
                    </>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">{t('account.orders.pdfShipping')}</h3>
                <div className="text-sm text-gray-600">
                  {shipping ? (
                    <>
                      <p className="font-medium">{`${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() || userName}</p>
                      {shipping.address1 && <p>{shipping.address1}</p>}
                      {shipping.address2 && <p>{shipping.address2}</p>}
                      {(shipping.city || shipping.province || shipping.postalCode) && (
                        <p>{`${shipping.city || ''}, ${shipping.province || ''} ${shipping.postalCode || ''}`.trim()}</p>
                      )}
                      {shipping.country && <p>{shipping.country === 'CA' ? 'Canada' : shipping.country}</p>}
                    </>
                  ) : (
                    <p className="text-gray-400 italic">{t('account.orders.sameAsBilling')}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-start text-sm font-semibold text-gray-900">{t('account.orders.pdfDescription')}</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{t('account.orders.pdfQty')}</th>
                    <th className="px-4 py-3 text-end text-sm font-semibold text-gray-900">{t('account.orders.pdfUnitPrice')}</th>
                    <th className="px-4 py-3 text-end text-sm font-semibold text-gray-900">{t('account.orders.pdfTotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {item.productName}
                          {item.formatName ? ` — ${item.formatName}` : ''}
                        </p>
                        {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-end text-gray-600">{formatMoney(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-end font-medium text-gray-900">
                        {formatMoney(item.unitPrice * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('account.orders.pdfSubtotal')}:</span>
                  <span className="text-gray-900">{formatMoney(order.subtotal)}</span>
                </div>

                {order.discount && order.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{t('account.orders.pdfDiscount')}{order.promoCode ? ` (${order.promoCode})` : ''}:</span>
                    <span>-{formatMoney(order.discount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('account.orders.pdfShipping')}:</span>
                  <span className="text-gray-900">
                    {order.shippingCost > 0 ? formatMoney(order.shippingCost) : t('account.orders.pdfFreeShipping')}
                  </span>
                </div>
                
                {/* Tax Details */}
                {order.taxDetails ? (
                  <>
                    {order.taxDetails.gst && order.taxDetails.gst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('account.orders.pdfGst')}:</span>
                        <span className="text-gray-900">{formatMoney(order.taxDetails.gst)}</span>
                      </div>
                    )}
                    {order.taxDetails.qst && order.taxDetails.qst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('account.orders.pdfQst')}:</span>
                        <span className="text-gray-900">{formatMoney(order.taxDetails.qst)}</span>
                      </div>
                    )}
                    {order.taxDetails.pst && order.taxDetails.pst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('account.orders.pdfPst')}:</span>
                        <span className="text-gray-900">{formatMoney(order.taxDetails.pst)}</span>
                      </div>
                    )}
                    {order.taxDetails.hst && order.taxDetails.hst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{t('account.orders.pdfHst')}:</span>
                        <span className="text-gray-900">{formatMoney(order.taxDetails.hst)}</span>
                      </div>
                    )}
                  </>
                ) : order.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t('account.orders.pdfTaxes')}:</span>
                    <span className="text-gray-900">{formatMoney(order.tax)}</span>
                  </div>
                )}
                
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-900">{t('account.orders.pdfTotalLabel')}:</span>
                    <span className="text-orange-600 text-lg">{formatMoney(order.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment & Shipping Info */}
            <div className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">{t('account.orders.paymentInfo')}</h4>
                <p className="text-gray-600">
                  {t('account.orders.statusLabel')}: <span className={order.paymentStatus === 'PAID' ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                    {order.paymentStatus === 'PAID' ? t('account.orders.pdfPaid') : order.paymentStatus}
                  </span>
                </p>
                {order.paymentMethod && <p className="text-gray-600">{t('account.orders.pdfMethod')}: {order.paymentMethod}</p>}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">{t('account.orders.shippingInfo')}</h4>
                <p className="text-gray-600">
                  {t('account.orders.statusLabel')}: <span className="font-medium">{order.status}</span>
                </p>
                {order.trackingNumber && (
                  <p className="text-gray-600">{t('account.orders.tracking')}: {order.carrier} - {order.trackingNumber}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
              <p>{t('account.orders.pdfFooterDisclaimer')}</p>
              <p className="mt-1">{t('account.orders.thankYou')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
