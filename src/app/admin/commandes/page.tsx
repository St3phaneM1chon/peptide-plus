'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Download,
  ShoppingBag,
  Clock,
  Cog,
  Truck,
  PackageCheck,
  Mail,
  Printer,
  RotateCcw,
  Package,
  AlertTriangle,
  FileText,
  CheckSquare,
  Square,
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Tag,
  StickyNote,
  History,
} from 'lucide-react';

import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input, Textarea } from '@/components/admin/FormField';
import { PaymentStatusBadge } from '@/components/admin/StatusBadge';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem, ContentListGroup } from '@/components/admin/outlook';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import OrderTimeline from '@/components/admin/OrderTimeline';
import type { TimelineEvent } from '@/components/admin/OrderTimeline';
import { assessFraudRisk, type FraudResult } from '@/lib/fraud-detection';
import { autoTagOrder, getTagColor, DEFAULT_TAG_RULES } from '@/lib/order-auto-tagger';

// ── Types ─────────────────────────────────────────────────────

interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  subtotal: number;
  shippingCost: number;
  discount: number;
  tax: number;
  taxTps?: number;
  taxTvq?: number;
  taxTvh?: number;
  total: number;
  currencyCode: string;
  promoCode?: string;
  paymentStatus: string;
  status: string;
  shippingName: string;
  shippingAddress1: string;
  shippingCity: string;
  shippingState: string;
  shippingPostal: string;
  shippingCountry: string;
  carrier?: string;
  trackingNumber?: string;
  adminNotes?: string;
  orderType?: string;
  parentOrderId?: string;
  parentOrder?: { id: string; orderNumber: string } | null;
  replacementOrders?: { id: string; orderNumber: string; status: string; replacementReason: string; createdAt: string }[];
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    formatName?: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

interface CreditNoteRef {
  id: string;
  creditNoteNumber: string;
  total: number;
  reason: string;
  status: string;
  issuedAt: string | null;
}

interface PaymentErrorRef {
  id: string;
  stripePaymentId: string;
  errorType: string;
  errorMessage: string;
  amount: number;
  currency: string;
  customerEmail: string | null;
  metadata: { paymentMethodType?: string[]; declineCode?: string } | null;
  createdAt: string;
}

const statusOptionValues = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

// ── Helpers ───────────────────────────────────────────────────

/** Map order status to badge variant for ContentList */
function statusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'CONFIRMED': return 'info';
    case 'PROCESSING': return 'info';
    case 'SHIPPED': return 'info';
    case 'DELIVERED': return 'success';
    case 'CANCELLED': return 'error';
    default: return 'neutral';
  }
}

function statusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/** Fraud risk badge config */
function fraudRiskConfig(level: FraudResult['riskLevel']): { label: string; className: string; icon: typeof Shield } {
  switch (level) {
    case 'CRITICAL':
      return { label: 'Critique', className: 'bg-red-100 text-red-700 border-red-200', icon: ShieldAlert };
    case 'HIGH':
      return { label: 'Elevé', className: 'bg-orange-100 text-orange-700 border-orange-200', icon: ShieldAlert };
    case 'MEDIUM':
      return { label: 'Moyen', className: 'bg-amber-100 text-amber-700 border-amber-200', icon: Shield };
    case 'LOW':
    default:
      return { label: 'Faible', className: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: ShieldCheck };
  }
}

/** Compute auto-tags for an order from the list */
function computeOrderTags(order: Order): string[] {
  return autoTagOrder({
    total: order.total,
    itemCount: order.items?.length || 0,
    isFirstOrder: false, // Not available from list data
    customerTier: '', // Not available from list data
    shippingCountry: order.shippingCountry || 'CA',
    promoCode: order.promoCode,
  });
}

/** Build timeline events from order data */
function buildTimelineEvents(order: Order, creditNotes: CreditNoteRef[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Order creation
  events.push({
    id: `${order.id}-created`,
    type: 'created',
    title: 'Commande créée',
    description: `Commande #${order.orderNumber} pour ${order.items?.length || 0} article(s)`,
    timestamp: new Date(order.createdAt),
  });

  // Payment
  if (order.paymentStatus === 'PAID' || order.paymentStatus === 'PARTIAL_REFUND' || order.paymentStatus === 'REFUNDED') {
    events.push({
      id: `${order.id}-paid`,
      type: 'paid',
      title: 'Paiement reçu',
      description: `Montant: ${order.total.toFixed(2)} ${order.currencyCode}`,
      timestamp: new Date(new Date(order.createdAt).getTime() + 60000),
    });
  }

  // Status-based events
  if (['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status)) {
    events.push({
      id: `${order.id}-processing`,
      type: 'processing',
      title: 'En traitement',
      timestamp: new Date(new Date(order.createdAt).getTime() + 120000),
    });
  }

  if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
    events.push({
      id: `${order.id}-shipped`,
      type: 'shipped',
      title: 'Expédiée',
      description: order.carrier ? `Via ${order.carrier}${order.trackingNumber ? ` - ${order.trackingNumber}` : ''}` : undefined,
      timestamp: new Date(new Date(order.createdAt).getTime() + 180000),
      metadata: order.trackingNumber ? { 'Suivi': order.trackingNumber } : undefined,
    });
  }

  if (order.status === 'DELIVERED') {
    events.push({
      id: `${order.id}-delivered`,
      type: 'delivered',
      title: 'Livrée',
      timestamp: new Date(new Date(order.createdAt).getTime() + 240000),
    });
  }

  if (order.status === 'CANCELLED') {
    events.push({
      id: `${order.id}-cancelled`,
      type: 'cancelled',
      title: 'Annulée',
      timestamp: new Date(new Date(order.createdAt).getTime() + 120000),
    });
  }

  // Refunds from credit notes
  for (const cn of creditNotes) {
    events.push({
      id: `cn-${cn.id}`,
      type: 'refunded',
      title: `Remboursement ${cn.creditNoteNumber}`,
      description: `${cn.reason} - ${cn.total.toFixed(2)} ${order.currencyCode}`,
      timestamp: cn.issuedAt ? new Date(cn.issuedAt) : new Date(),
    });
  }

  // Admin notes
  if (order.adminNotes) {
    events.push({
      id: `${order.id}-note`,
      type: 'note',
      title: 'Note interne',
      description: order.adminNotes,
      timestamp: new Date(new Date(order.createdAt).getTime() + 300000),
    });
  }

  // Replacement orders
  if (order.replacementOrders) {
    for (const ro of order.replacementOrders) {
      events.push({
        id: `reship-${ro.id}`,
        type: 'return',
        title: `Ré-expédition ${ro.orderNumber}`,
        description: ro.replacementReason,
        timestamp: new Date(ro.createdAt),
      });
    }
  }

  return events;
}

/** Group orders by date buckets: Today, Yesterday, This Week, Older */
function groupOrdersByDate(orders: Order[], labels?: { today: string; yesterday: string; thisWeek: string; older: string; replacement: string }, fmtCurrency?: (amount: number) => string, fraudResults?: Record<string, FraudResult>): ContentListGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const buckets: Record<string, Order[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  for (const order of orders) {
    const d = new Date(order.createdAt);
    if (d >= today) {
      buckets.today.push(order);
    } else if (d >= yesterday) {
      buckets.yesterday.push(order);
    } else if (d >= weekAgo) {
      buckets.thisWeek.push(order);
    } else {
      buckets.older.push(order);
    }
  }

  const toItem = (order: Order): ContentListItem => {
    const badges: ContentListItem['badges'] = [
      { text: statusLabel(order.status), variant: statusBadgeVariant(order.status) },
    ];

    // Replacement badge
    if (order.orderType === 'REPLACEMENT') {
      badges.push({ text: labels?.replacement || 'Replacement', variant: 'warning' as const });
    }

    // Fraud risk badge (only for MEDIUM+ risk)
    const fraud = fraudResults?.[order.id];
    if (fraud && (fraud.riskLevel === 'HIGH' || fraud.riskLevel === 'CRITICAL')) {
      badges.push({ text: `Risque ${fraud.riskLevel === 'CRITICAL' ? 'critique' : 'élevé'}`, variant: 'error' as const });
    } else if (fraud && fraud.riskLevel === 'MEDIUM') {
      badges.push({ text: 'Risque moyen', variant: 'warning' as const });
    }

    // Auto-tags (show first 2 tags as badges)
    const tags = computeOrderTags(order);
    for (const tag of tags.slice(0, 2)) {
      const rule = DEFAULT_TAG_RULES.find(r => r.tag === tag);
      badges.push({ text: rule?.name || tag, variant: 'info' as const });
    }

    return {
      id: order.id,
      avatar: { text: order.userName || order.shippingName || 'C' },
      title: `#${order.orderNumber}`,
      subtitle: order.userName || order.userEmail || '',
      preview: `${fmtCurrency ? fmtCurrency(order.total) : String(order.total)} - ${order.items?.length || 0} articles`,
      timestamp: order.createdAt,
      badges,
    };
  };

  const groups: ContentListGroup[] = [];

  if (buckets.today.length > 0) {
    groups.push({ label: labels?.today || 'Today', items: buckets.today.map(toItem), defaultOpen: true });
  }
  if (buckets.yesterday.length > 0) {
    groups.push({ label: labels?.yesterday || 'Yesterday', items: buckets.yesterday.map(toItem), defaultOpen: true });
  }
  if (buckets.thisWeek.length > 0) {
    groups.push({ label: labels?.thisWeek || 'This Week', items: buckets.thisWeek.map(toItem), defaultOpen: true });
  }
  if (buckets.older.length > 0) {
    groups.push({ label: labels?.older || 'Older', items: buckets.older.map(toItem), defaultOpen: false });
  }

  return groups;
}

// ── Main Component ────────────────────────────────────────────

export default function OrdersPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Email state
  const [sendingEmail, setSendingEmail] = useState(false);

  // Refund states
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState('');

  // Reship states
  const [showReshipModal, setShowReshipModal] = useState(false);
  const [reshipReason, setReshipReason] = useState('');
  const [reshipping, setReshipping] = useState(false);
  const [reshipError, setReshipError] = useState('');

  // UX FIX: ConfirmDialog for cancel order action
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [showBulkBar, setShowBulkBar] = useState(false);

  // Enriched detail data
  const [creditNotes, setCreditNotes] = useState<CreditNoteRef[]>([]);
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrorRef[]>([]);

  // Timeline toggle
  const [showTimeline, setShowTimeline] = useState(false);

  // Quick add note modal
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Bulk print
  const [bulkPrinting, setBulkPrinting] = useState(false);

  // Fraud detection cache (lightweight client-side assessment)
  const [fraudResults, setFraudResults] = useState<Record<string, FraudResult>>({});

  const reshipReasons = useMemo(() => [
    t('admin.commandes.reshipReasonLost'),
    t('admin.commandes.reshipReasonDamaged'),
    t('admin.commandes.reshipReasonReturned'),
    t('admin.commandes.reshipReasonAddress'),
    t('admin.commandes.reshipReasonMissing'),
  ], [t]);

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetchWithRetry('/api/admin/orders?limit=100');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      toast.error(t('common.error'));
      setOrders([]);
    }
    setLoading(false);
  };

  const fetchOrderDetail = useCallback(async (orderId: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`);
      const data = await res.json();
      if (data.order) {
        const enrichedOrder: Order = {
          ...data.order,
          subtotal: Number(data.order.subtotal),
          shippingCost: Number(data.order.shippingCost),
          discount: Number(data.order.discount),
          tax: Number(data.order.tax),
          taxTps: Number(data.order.taxTps),
          taxTvq: Number(data.order.taxTvq),
          taxTvh: Number(data.order.taxTvh),
          total: Number(data.order.total),
          userName: data.customer?.name,
          userEmail: data.customer?.email,
          currencyCode: data.order.currency?.code || 'CAD',
          items: data.order.items.map((item: Record<string, unknown>) => ({
            ...item,
            unitPrice: Number(item.unitPrice),
            total: Number(item.total),
            discount: Number(item.discount),
          })),
        };
        setSelectedOrder(enrichedOrder);
        setCreditNotes(data.creditNotes || []);
        setPaymentErrors(data.paymentErrors || []);
      }
    } catch (err) {
      console.error('Error fetching order detail:', err);
    }
  }, []);

  const handleSelectOrder = useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    // Set a basic version from the list first (for instant UI feedback)
    const listOrder = orders.find(o => o.id === orderId);
    if (listOrder) {
      setSelectedOrder(listOrder);
    }
    setCreditNotes([]);
    setPaymentErrors([]);
    // Then fetch the full detail
    fetchOrderDetail(orderId);
  }, [orders, fetchOrderDetail]);

  // ─── Filtering (moved up so bulk/print callbacks can reference filteredOrders) ──

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Status filter
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      // Search filter
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (
          !order.orderNumber.toLowerCase().includes(search) &&
          !order.userName?.toLowerCase().includes(search) &&
          !order.userEmail?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, statusFilter, searchValue]);

  const stats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter(o => o.status === 'PENDING').length,
    processing: orders.filter(o => o.status === 'PROCESSING').length,
    shipped: orders.filter(o => o.status === 'SHIPPED').length,
    delivered: orders.filter(o => o.status === 'DELIVERED').length,
  }), [orders]);

  // ─── Status update ──────────────────────────────────────────

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        setUpdating(false);
        return;
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      toast.success(t('admin.commandes.statusUpdated') || 'Order status updated');
    } catch (err) {
      console.error('Error updating order:', err);
      toast.error(t('common.networkError'));
    }
    setUpdating(false);
  };

  const updateTracking = async (orderId: string, carrier: string, trackingNumber: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, trackingNumber }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        setUpdating(false);
        return;
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, carrier, trackingNumber } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, carrier, trackingNumber });
      }
    } catch (err) {
      console.error('Error updating tracking:', err);
      toast.error(t('common.networkError'));
    }
    setUpdating(false);
  };

  // ─── Refund ─────────────────────────────────────────────────

  const openRefundModal = () => {
    if (!selectedOrder) return;
    setRefundAmount(selectedOrder.total.toFixed(2));
    setRefundReason('');
    setRefundError('');
    setShowRefundModal(true);
  };

  const handleRefund = async () => {
    if (!selectedOrder) return;
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      setRefundError(t('admin.commandes.invalidAmount'));
      return;
    }
    if (!refundReason.trim()) {
      setRefundError(t('admin.commandes.reasonRequired'));
      return;
    }

    setRefunding(true);
    setRefundError('');
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}?action=refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: refundReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRefundError(data.error || t('admin.commandes.refundError'));
        return;
      }
      setShowRefundModal(false);
      await fetchOrders();
      await fetchOrderDetail(selectedOrder.id);
    } catch (error) {
      console.error('[OrdersPage] Refund request failed:', error);
      setRefundError(t('admin.commandes.networkError'));
    } finally {
      setRefunding(false);
    }
  };

  // ─── Reship ─────────────────────────────────────────────────

  const openReshipModal = () => {
    setReshipReason(reshipReasons[0]);
    setReshipError('');
    setShowReshipModal(true);
  };

  const handleReship = async () => {
    if (!selectedOrder) return;
    if (!reshipReason.trim()) {
      setReshipError(t('admin.commandes.reasonRequired'));
      return;
    }

    setReshipping(true);
    setReshipError('');
    try {
      const res = await fetch(`/api/admin/orders/${selectedOrder.id}?action=reship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reshipReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReshipError(data.error || t('admin.commandes.reshipError'));
        return;
      }
      setShowReshipModal(false);
      await fetchOrders();
      await fetchOrderDetail(selectedOrder.id);
    } catch {
      setReshipError(t('admin.commandes.networkError'));
    } finally {
      setReshipping(false);
    }
  };

  // ─── Export CSV ────────────────────────────────────────

  const handleExportCsv = useCallback(() => {
    if (filteredOrders.length === 0) {
      toast.error(t('admin.commandes.noOrdersToExport'));
      return;
    }

    const headers = [
      'Order #', 'Date', 'Customer', 'Email', 'Status', 'Payment',
      'Subtotal', 'Shipping', 'Discount', 'Tax', 'Total', 'Currency',
      'Carrier', 'Tracking', 'Items',
    ];

    const rows = filteredOrders.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toISOString().slice(0, 10),
      o.userName || o.shippingName || '',
      o.userEmail || '',
      o.status,
      o.paymentStatus,
      o.subtotal.toFixed(2),
      o.shippingCost.toFixed(2),
      o.discount.toFixed(2),
      o.tax.toFixed(2),
      o.total.toFixed(2),
      o.currencyCode || 'CAD',
      o.carrier || '',
      o.trackingNumber || '',
      String(o.items?.length || 0),
    ]);

    const BOM = '\uFEFF';
    const csv =
      BOM +
      [headers, ...rows]
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.commandes.exportCsvSuccess'));
  }, [filteredOrders, t]);

  // ─── Send Confirmation Email ──────────────────────────

  const handleSendConfirmationEmail = useCallback(async () => {
    if (!selectedOrder) return;
    setSendingEmail(true);
    try {
      const res = await fetch('/api/emails/send-order-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          emailType: 'confirmation',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.commandes.emailError'));
        return;
      }
      toast.success(t('admin.commandes.emailSent'));
    } catch {
      toast.error(t('admin.commandes.emailError'));
    } finally {
      setSendingEmail(false);
    }
  }, [selectedOrder, t]);

  // ─── Fraud detection (lightweight client-side) ─────────────
  useEffect(() => {
    if (orders.length === 0) return;
    const results: Record<string, FraudResult> = {};
    for (const order of orders) {
      results[order.id] = assessFraudRisk({
        userId: order.userId,
        email: order.userEmail || '',
        total: order.total,
        shippingCountry: order.shippingCountry || 'CA',
        shippingAddress: order.shippingAddress1 || '',
        orderTimestamp: new Date(order.createdAt),
      });
    }
    setFraudResults(results);
  }, [orders]);

  // ─── Quick Add Note ───────────────────────────────────────

  const handleAddNote = useCallback(async () => {
    if (!selectedOrder || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const existingNotes = selectedOrder.adminNotes || '';
      const timestamp = new Date().toLocaleString('fr-CA');
      const updatedNotes = existingNotes
        ? `${existingNotes}\n\n[${timestamp}] ${newNote.trim()}`
        : `[${timestamp}] ${newNote.trim()}`;

      const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNotes: updatedNotes }),
      });
      if (res.ok) {
        setSelectedOrder({ ...selectedOrder, adminNotes: updatedNotes });
        toast.success(t('admin.commandes.notesSaved'));
        setShowAddNoteModal(false);
        setNewNote('');
      }
    } catch (error) {
      console.warn('[OrdersPage] Failed to save quick note:', error);
      toast.error(t('admin.commandes.networkError'));
    } finally {
      setSavingNote(false);
    }
  }, [selectedOrder, newNote, t]);

  // ─── Bulk Print Batch ─────────────────────────────────────

  const handleBulkPrint = useCallback(async () => {
    if (selectedOrderIds.size === 0) {
      toast.info(t('admin.commandes.selectOrderFirst'));
      return;
    }
    setBulkPrinting(true);
    try {
      const res = await fetch('/api/admin/orders/print-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: Array.from(selectedOrderIds) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.commandes.bulkPrintError'));
        setBulkPrinting(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      URL.revokeObjectURL(url);
      toast.success(t('admin.commandes.bulkPrintSuccess'));
    } catch {
      toast.error(t('admin.commandes.networkError'));
    } finally {
      setBulkPrinting(false);
    }
  }, [selectedOrderIds, t]);

  // ─── Bulk Selection Helpers ──────────────────────────────

  const selectAllFiltered = useCallback(() => {
    setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
  }, [filteredOrders]);

  const clearSelection = useCallback(() => {
    setSelectedOrderIds(new Set());
    setShowBulkBar(false);
    setBulkStatus('');
  }, []);

  // Show/hide bulk bar based on selection
  useEffect(() => {
    setShowBulkBar(selectedOrderIds.size > 0);
  }, [selectedOrderIds]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedOrderIds(new Set());
  }, [statusFilter, searchValue]);

  // ─── Bulk Status Update ──────────────────────────────

  const handleBulkStatusUpdate = useCallback(async (newStatus: string) => {
    if (selectedOrderIds.size === 0 || !newStatus) return;

    setBulkUpdating(true);
    try {
      const payload = {
        orders: Array.from(selectedOrderIds).map(orderId => ({
          orderId,
          status: newStatus,
        })),
      };

      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t('common.updateFailed'));
        return;
      }

      const { summary, results } = data;

      if (summary.failed > 0) {
        const failedOrders = results
          .filter((r: { success: boolean }) => !r.success)
          .map((r: { orderNumber?: string; error?: string }) => r.orderNumber || r.error)
          .join(', ');
        toast.warning(
          t('admin.commandes.bulkPartialSuccess', {
            succeeded: String(summary.succeeded),
            failed: String(summary.failed),
          }) || `${summary.succeeded} updated, ${summary.failed} failed: ${failedOrders}`
        );
      } else {
        toast.success(
          t('admin.commandes.bulkStatusUpdated', { count: String(summary.succeeded) })
            || `${summary.succeeded} orders updated`
        );
      }

      // Refresh orders list
      await fetchOrders();
      clearSelection();
    } catch (err) {
      console.error('Bulk status update error:', err);
      toast.error(t('common.networkError'));
    } finally {
      setBulkUpdating(false);
    }
  }, [selectedOrderIds, t, clearSelection]);

  // ─── Print Filtered Orders List ──────────────────────

  const handlePrintOrdersList = useCallback(() => {
    if (filteredOrders.length === 0) {
      toast.error(t('admin.commandes.emptyTitle'));
      return;
    }

    const rowsHtml = filteredOrders
      .map(
        (o) =>
          `<tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace">#${o.orderNumber}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${new Date(o.createdAt).toLocaleDateString(locale)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${o.userName || o.shippingName || ''}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${statusLabel(o.status)}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${o.items?.length || 0}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace">${formatCurrency(o.total)}</td>
          </tr>`
      )
      .join('');

    const totalAmount = filteredOrders.reduce((acc, o) => acc + o.total, 0);

    const html = `<!DOCTYPE html>
<html><head><title>${t('admin.commandes.printOrdersListTitle') || 'Orders List'}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 32px; color: #1e293b; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; padding: 8px 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b; }
  .summary { background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 14px; display: flex; justify-content: space-between; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>${t('admin.commandes.printOrdersListTitle') || 'Orders List'}</h1>
<p class="meta">${t('admin.commandes.printGeneratedOn') || 'Generated on'} ${new Date().toLocaleDateString(locale)} &mdash; ${filteredOrders.length} ${t('admin.commandes.printOrdersCount') || 'orders'}</p>
<table>
  <thead><tr>
    <th>${t('admin.commandes.colOrder')}</th>
    <th>${t('admin.commandes.colDate')}</th>
    <th>${t('admin.commandes.colCustomer')}</th>
    <th>${t('admin.commandes.colStatus')}</th>
    <th style="text-align:center">${t('admin.commandes.colQty')}</th>
    <th style="text-align:right">${t('admin.commandes.colTotal')}</th>
  </tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<div class="summary">
  <span><strong>${filteredOrders.length}</strong> ${t('admin.commandes.printOrdersCount') || 'orders'}</span>
  <span><strong>${t('admin.commandes.total')}: ${formatCurrency(totalAmount)}</strong></span>
</div>
</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }, [filteredOrders, t, locale, formatCurrency]);

  // ─── Print Delivery Slip ──────────────────────────────

  const handlePrintDeliverySlip = useCallback(() => {
    if (!selectedOrder) return;

    const itemsHtml = selectedOrder.items
      .map(
        (item) =>
          `<tr>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0">${item.productName}${item.formatName ? ` <small style="color:#64748b">(${item.formatName})</small>` : ''}</td>
            <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${item.quantity}</td>
          </tr>`
      )
      .join('');

    const html = `<!DOCTYPE html>
<html><head><title>${t('admin.commandes.printDeliverySlipTitle')} - ${selectedOrder.orderNumber}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; padding: 32px; color: #1e293b; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .section h3 { font-size: 13px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; letter-spacing: 0.05em; }
  .section p { margin: 2px 0; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { text-align: left; padding: 8px 12px; background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 12px; text-transform: uppercase; color: #64748b; }
  .notes { background: #f8fafc; padding: 12px; border-radius: 6px; font-size: 13px; }
  @media print { body { padding: 0; } }
</style></head><body>
<h1>${t('admin.commandes.printDeliverySlipTitle')}</h1>
<p class="meta">#${selectedOrder.orderNumber} &mdash; ${new Date(selectedOrder.createdAt).toLocaleDateString(locale)}</p>
<div class="grid">
  <div class="section">
    <h3>${t('admin.commandes.printShipTo')}</h3>
    <p><strong>${selectedOrder.shippingName}</strong></p>
    <p>${selectedOrder.shippingAddress1}</p>
    <p>${selectedOrder.shippingCity}, ${selectedOrder.shippingState} ${selectedOrder.shippingPostal}</p>
    <p>${selectedOrder.shippingCountry}</p>
  </div>
  <div class="section">
    <h3>${t('admin.commandes.customerTitle')}</h3>
    <p>${selectedOrder.userName || ''}</p>
    <p>${selectedOrder.userEmail || ''}</p>
    ${selectedOrder.carrier ? `<p style="margin-top:12px"><strong>${t('admin.commandes.carrierLabel')}:</strong> ${selectedOrder.carrier}</p>` : ''}
    ${selectedOrder.trackingNumber ? `<p><strong>${t('admin.commandes.trackingNumberLabel')}:</strong> ${selectedOrder.trackingNumber}</p>` : ''}
  </div>
</div>
<table>
  <thead><tr>
    <th>${t('admin.commandes.colProduct')}</th>
    <th style="text-align:center">${t('admin.commandes.colQty')}</th>
  </tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
${selectedOrder.adminNotes ? `<div class="notes"><strong>${t('admin.commandes.printNotes')}:</strong><br/>${selectedOrder.adminNotes.replace(/\n/g, '<br/>')}</div>` : ''}
</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }, [selectedOrder, t, locale]);

  // ─── Ribbon Actions ─────────────────────────────────────────

  const ribbonNewOrder = useCallback(() => {
    // Toggle bulk selection mode: when activated, all filtered orders become selectable
    if (selectedOrderIds.size > 0) {
      clearSelection();
    } else {
      selectAllFiltered();
    }
  }, [selectedOrderIds, clearSelection, selectAllFiltered]);

  const ribbonDelete = useCallback(() => {
    // Cancel selected order via ConfirmDialog
    if (selectedOrder) {
      setConfirmCancelOrderId(selectedOrder.id);
    } else {
      toast.info(t('admin.commandes.selectOrderFirst') || 'Select an order first');
    }
  }, [selectedOrder, t]);

  const ribbonPrint = useCallback(() => {
    if (selectedOrder) {
      handlePrintDeliverySlip();
    } else {
      // Print list of all filtered orders
      handlePrintOrdersList();
    }
  }, [selectedOrder, handlePrintDeliverySlip, handlePrintOrdersList]);

  const ribbonMarkShipped = useCallback(() => {
    if (selectedOrder) {
      updateOrderStatus(selectedOrder.id, 'SHIPPED');
    }
  }, [selectedOrder]);

  const ribbonRefund = useCallback(() => {
    if (selectedOrder) {
      openRefundModal();
    }
  }, [selectedOrder]);

  const ribbonExport = useCallback(() => {
    handleExportCsv();
  }, [handleExportCsv]);

  useRibbonAction('newOrder', ribbonNewOrder);
  useRibbonAction('delete', ribbonDelete);
  useRibbonAction('print', ribbonPrint);
  useRibbonAction('markShipped', ribbonMarkShipped);
  useRibbonAction('refund', ribbonRefund);
  useRibbonAction('export', ribbonExport);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.commandes.allStatuses'), count: stats.total },
    { key: 'PENDING', label: t('admin.commandes.statusPending'), count: stats.pending },
    { key: 'PROCESSING', label: t('admin.commandes.statusProcessing'), count: stats.processing },
    { key: 'SHIPPED', label: t('admin.commandes.statusShipped'), count: stats.shipped },
    { key: 'DELIVERED', label: t('admin.commandes.statusDelivered'), count: stats.delivered },
  ], [t, stats]);

  const dateLabels = useMemo(() => ({
    today: t('admin.commandes.today'),
    yesterday: t('admin.commandes.yesterday'),
    thisWeek: t('admin.commandes.thisWeek'),
    older: t('admin.commandes.older'),
    replacement: t('admin.commandes.replacement'),
  }), [t]);
  const orderGroups = useMemo(() => groupOrdersByDate(filteredOrders, dateLabels, formatCurrency, fraudResults), [filteredOrders, dateLabels, formatCurrency, fraudResults]);

  // ─── Auto-select first item ────────────────────────────────

  useEffect(() => {
    if (!loading && filteredOrders.length > 0) {
      const currentStillVisible = selectedOrderId &&
        filteredOrders.some(order => order.id === selectedOrderId);
      if (!currentStillVisible) {
        handleSelectOrder(filteredOrders[0].id);
      }
    }
  }, [filteredOrders, loading, selectedOrderId, handleSelectOrder]);

  // ─── Detail pane helpers ────────────────────────────────────

  const canRefund = selectedOrder &&
    (selectedOrder.paymentStatus === 'PAID' || selectedOrder.paymentStatus === 'PARTIAL_REFUND');
  const canReship = selectedOrder &&
    (selectedOrder.status === 'SHIPPED' || selectedOrder.status === 'DELIVERED');

  // ─── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.commandes.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.commandes.subtitle')}</p>
          </div>
          <Button variant="secondary" icon={Download} size="sm" onClick={handleExportCsv}>
            {t('admin.commandes.exportCsv')}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label={t('admin.commandes.statTotal')} value={stats.total} icon={ShoppingBag} />
          <StatCard label={t('admin.commandes.statPending')} value={stats.pending} icon={Clock} />
          <StatCard label={t('admin.commandes.statProcessing')} value={stats.processing} icon={Cog} />
          <StatCard label={t('admin.commandes.statShipped')} value={stats.shipped} icon={Truck} />
          <StatCard label={t('admin.commandes.statDelivered')} value={stats.delivered} icon={PackageCheck} />
        </div>
      </div>

      {/* Bulk Action Bar */}
      {showBulkBar && selectedOrderIds.size > 0 && (
        <div className="mx-4 lg:mx-6 mb-2 flex-shrink-0">
          <div className="flex items-center gap-3 bg-sky-50 border border-sky-200 rounded-lg px-4 py-2.5">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-sky-600" />
              <span className="text-sm font-medium text-sky-800">
                {t('admin.commandes.bulkSelected', { count: String(selectedOrderIds.size) })
                  || `${selectedOrderIds.size} order(s) selected`}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="h-8 px-2 rounded border border-sky-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">{t('admin.commandes.bulkSelectStatus') || 'Change status to...'}</option>
                {statusOptionValues.map(s => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>

              <Button
                variant="primary"
                size="sm"
                disabled={!bulkStatus || bulkUpdating}
                onClick={() => handleBulkStatusUpdate(bulkStatus)}
              >
                {bulkUpdating
                  ? (t('admin.commandes.processing'))
                  : (t('admin.commandes.bulkApply') || 'Apply')}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                icon={Printer}
                disabled={bulkPrinting}
                onClick={handleBulkPrint}
              >
                {bulkPrinting
                  ? (t('admin.commandes.processing'))
                  : (t('admin.commandes.bulkPrint') || 'Imprimer sélection')}
              </Button>

              <button
                type="button"
                onClick={() => selectAllFiltered()}
                className="text-xs text-sky-700 hover:text-sky-900 hover:underline px-1"
              >
                {t('admin.commandes.bulkSelectAll') || 'Select all'}
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="p-1 rounded hover:bg-sky-100 text-sky-600"
                title={t('admin.commandes.cancel')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedOrderId}
          list={
            <ContentList
              groups={orderGroups}
              selectedId={selectedOrderId}
              onSelect={handleSelectOrder}
              filterTabs={filterTabs}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.commandes.searchPlaceholder')}
              loading={loading}
              emptyIcon={ShoppingBag}
              emptyTitle={t('admin.commandes.emptyTitle')}
              emptyDescription={t('admin.commandes.emptyDescription')}
              headerActions={
                <button
                  type="button"
                  onClick={() => {
                    if (selectedOrderIds.size > 0) {
                      clearSelection();
                    } else {
                      selectAllFiltered();
                    }
                  }}
                  className={`p-1.5 rounded transition-colors ${
                    selectedOrderIds.size > 0
                      ? 'text-sky-700 bg-sky-100 hover:bg-sky-200'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                  title={
                    selectedOrderIds.size > 0
                      ? (t('admin.commandes.bulkClearSelection') || 'Clear selection')
                      : (t('admin.commandes.bulkSelectAll') || 'Select all')
                  }
                >
                  {selectedOrderIds.size > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              }
            />
          }
          detail={
            selectedOrder ? (
              <DetailPane
                header={{
                  title: t('admin.commandes.orderTitle', { orderNumber: selectedOrder.orderNumber }),
                  subtitle: new Date(selectedOrder.createdAt).toLocaleString(locale),
                  avatar: { text: selectedOrder.userName || selectedOrder.shippingName || 'C' },
                  onBack: () => { setSelectedOrderId(null); setSelectedOrder(null); },
                  backLabel: t('admin.commandes.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={Mail} onClick={handleSendConfirmationEmail} disabled={sendingEmail}>
                        {sendingEmail ? t('admin.commandes.emailSending') : t('admin.commandes.sendConfirmationEmail')}
                      </Button>
                      <Button variant="ghost" size="sm" icon={Printer} onClick={handlePrintDeliverySlip}>
                        {t('admin.commandes.printDeliverySlip')}
                      </Button>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Replacement banner */}
                  {selectedOrder.orderType === 'REPLACEMENT' && selectedOrder.parentOrder && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-600" />
                      <span className="text-sm text-amber-800">
                        {t('admin.commandes.reshipBanner')} <strong>{selectedOrder.parentOrder.orderNumber}</strong>
                      </span>
                    </div>
                  )}

                  {/* Fraud Detection Badge */}
                  {fraudResults[selectedOrder.id] && fraudResults[selectedOrder.id].riskLevel !== 'LOW' && (() => {
                    const fraud = fraudResults[selectedOrder.id];
                    const config = fraudRiskConfig(fraud.riskLevel);
                    const FraudIcon = config.icon;
                    return (
                      <div className={`rounded-lg p-3 border flex items-start gap-3 ${config.className}`}>
                        <FraudIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm">
                              {t('admin.commandes.fraudRiskLabel')}: {config.label} ({fraud.riskScore}/100)
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              fraud.recommendation === 'DECLINE' ? 'bg-red-200 text-red-800' :
                              fraud.recommendation === 'REVIEW' ? 'bg-amber-200 text-amber-800' :
                              'bg-emerald-200 text-emerald-800'
                            }`}>
                              {fraud.recommendation === 'DECLINE' ? t('admin.commandes.fraudDecline') :
                               fraud.recommendation === 'REVIEW' ? t('admin.commandes.fraudReview') :
                               t('admin.commandes.fraudApprove')}
                            </span>
                          </div>
                          <ul className="text-xs space-y-0.5">
                            {fraud.signals.map((s, i) => (
                              <li key={i}>{s.description} (+{s.score} pts)</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Auto-Tags */}
                  {(() => {
                    const tags = computeOrderTags(selectedOrder);
                    if (tags.length === 0) return null;
                    return (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag className="w-4 h-4 text-slate-400" />
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                            style={{ backgroundColor: `${getTagColor(tag)}15`, color: getTagColor(tag), borderColor: `${getTagColor(tag)}40` }}
                          >
                            {DEFAULT_TAG_RULES.find(r => r.tag === tag)?.name || tag}
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {/* Status & Actions */}
                  <div className="flex flex-wrap gap-4 items-center">
                    <FormField label={t('admin.commandes.orderStatusLabel')}>
                      <select
                        value={selectedOrder.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          if (newStatus === 'CANCELLED') {
                            e.target.value = selectedOrder.status;
                            setConfirmCancelOrderId(selectedOrder.id);
                            return;
                          }
                          updateOrderStatus(selectedOrder.id, newStatus);
                        }}
                        disabled={updating}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      >
                        {statusOptionValues.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </FormField>
                    <div className="pt-6">
                      <PaymentStatusBadge status={selectedOrder.paymentStatus} />
                    </div>
                    <div className="flex gap-2 ml-auto pt-6">
                      {canReship && (
                        <Button variant="secondary" size="sm" icon={Package} onClick={openReshipModal}>
                          {t('admin.commandes.reshipLostPackage')}
                        </Button>
                      )}
                      {canRefund && (
                        <Button variant="danger" size="sm" icon={RotateCcw} onClick={openRefundModal}>
                          {t('admin.commandes.refund')}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Truck}
                      onClick={() => updateOrderStatus(selectedOrder.id, 'SHIPPED')}
                      disabled={updating || selectedOrder.status === 'SHIPPED' || selectedOrder.status === 'DELIVERED' || selectedOrder.status === 'CANCELLED'}
                    >
                      {t('admin.commandes.quickMarkShipped')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={StickyNote}
                      onClick={() => { setNewNote(''); setShowAddNoteModal(true); }}
                    >
                      {t('admin.commandes.quickAddNote')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={History}
                      onClick={() => setShowTimeline(!showTimeline)}
                    >
                      {showTimeline ? t('admin.commandes.hideTimeline') : t('admin.commandes.showTimeline')}
                    </Button>
                  </div>

                  {/* Order Timeline */}
                  {showTimeline && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                        <History className="w-4 h-4" />
                        {t('admin.commandes.timelineTitle')}
                      </h3>
                      <OrderTimeline events={buildTimelineEvents(selectedOrder, creditNotes)} />
                    </div>
                  )}

                  {/* Customer Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">{t('admin.commandes.customerTitle')}</h3>
                      <p className="text-slate-700">{selectedOrder.userName}</p>
                      <p className="text-slate-500 text-sm">{selectedOrder.userEmail}</p>
                      <Link href={`/admin/clients/${selectedOrder.userId}`} className="text-sky-600 text-sm hover:underline">
                        {t('admin.commandes.viewProfile')} &rarr;
                      </Link>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-2">{t('admin.commandes.shippingAddressTitle')}</h3>
                      <p className="text-slate-700">{selectedOrder.shippingName}</p>
                      <p className="text-slate-500 text-sm">{selectedOrder.shippingAddress1}</p>
                      <p className="text-slate-500 text-sm">
                        {selectedOrder.shippingCity}, {selectedOrder.shippingState} {selectedOrder.shippingPostal}
                      </p>
                      <p className="text-slate-500 text-sm">{selectedOrder.shippingCountry}</p>
                    </div>
                  </div>

                  {/* Tracking */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.commandes.trackingTitle')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label={t('admin.commandes.carrierLabel')}>
                        <select
                          defaultValue={selectedOrder.carrier || ''}
                          onChange={(e) => updateTracking(selectedOrder.id, e.target.value, selectedOrder.trackingNumber || '')}
                          className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                        >
                          <option value="">{t('admin.commandes.carrierSelect')}</option>
                          <option value="Postes Canada">{t('admin.commandes.carrierCanadaPost') || 'Canada Post'}</option>
                          <option value="FedEx">FedEx</option>
                          <option value="UPS">UPS</option>
                          <option value="Purolator">Purolator</option>
                          <option value="DHL">DHL</option>
                        </select>
                      </FormField>
                      <FormField label={t('admin.commandes.trackingNumberLabel')}>
                        <Input
                          type="text"
                          defaultValue={selectedOrder.trackingNumber || ''}
                          placeholder={t('admin.commandes.trackingPlaceholder')}
                          onBlur={(e) => updateTracking(selectedOrder.id, selectedOrder.carrier || '', e.target.value)}
                        />
                      </FormField>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.commandes.itemsTitle')}</h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-2 text-start text-xs font-medium text-slate-500 uppercase">{t('admin.commandes.colProduct')}</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">{t('admin.commandes.colQty')}</th>
                            <th className="px-4 py-2 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.commandes.colUnitPrice')}</th>
                            <th className="px-4 py-2 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.commandes.colTotal')}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedOrder.items.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{item.productName}</p>
                                {item.formatName && (
                                  <p className="text-xs text-slate-500">{item.formatName}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center text-sm text-slate-700">{item.quantity}</td>
                              <td className="px-4 py-3 text-end text-sm text-slate-700">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-4 py-3 text-end text-sm font-medium text-slate-900">{formatCurrency(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-600 text-sm">
                        <span>{t('admin.commandes.subtotal')}</span>
                        <span>{formatCurrency(selectedOrder.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-sm">
                        <span>{t('admin.commandes.shipping')}</span>
                        <span>{selectedOrder.shippingCost === 0 ? t('admin.commandes.shippingFree') : formatCurrency(selectedOrder.shippingCost)}</span>
                      </div>
                      {selectedOrder.discount > 0 && (
                        <div className="flex justify-between text-emerald-600 text-sm">
                          <span>{t('admin.commandes.discount')} {selectedOrder.promoCode && `(${selectedOrder.promoCode})`}</span>
                          <span>-{formatCurrency(selectedOrder.discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600 text-sm">
                        <span>{t('admin.commandes.taxes')}</span>
                        <span>{formatCurrency(selectedOrder.tax)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-300">
                        <span>{t('admin.commandes.total')}</span>
                        <span>{formatCurrency(selectedOrder.total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Credit Notes Section */}
                  {creditNotes.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {t('admin.commandes.creditNotesTitle', { count: creditNotes.length })}
                      </h3>
                      <div className="space-y-2">
                        {creditNotes.map((cn) => (
                          <div key={cn.id} className="flex items-center justify-between text-sm">
                            <div>
                              <Link
                                href="/admin/comptabilite/notes-credit"
                                className="font-mono text-red-700 hover:underline"
                              >
                                {cn.creditNoteNumber}
                              </Link>
                              <span className="text-red-600 ms-2">{cn.reason}</span>
                            </div>
                            <span className="font-medium text-red-700">-{formatCurrency(cn.total)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment Errors Section */}
                  {paymentErrors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {t('admin.commandes.paymentErrors')} ({paymentErrors.length})
                      </h3>
                      <div className="space-y-3">
                        {paymentErrors.map((pe) => (
                          <div key={pe.id} className="bg-white rounded-lg p-3 border border-red-100">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-mono text-xs text-slate-500">{pe.stripePaymentId}</p>
                                <p className="font-medium text-red-700">{pe.errorType}</p>
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(pe.createdAt).toLocaleString(locale)}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 mb-2">{pe.errorMessage}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-slate-600">
                              <div>
                                <span className="text-slate-400">{t('admin.commandes.peAmount')}: </span>
                                <span className="font-mono">{formatCurrency(pe.amount)}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">{t('admin.commandes.peEmail')}: </span>
                                <span className="font-mono">{pe.customerEmail || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">{t('admin.commandes.peMethod')}: </span>
                                <span className="font-mono">{pe.metadata?.paymentMethodType?.join(', ') || 'N/A'}</span>
                              </div>
                            </div>
                            {pe.metadata?.declineCode && (
                              <div className="mt-2 text-xs">
                                <span className="text-slate-400">{t('admin.commandes.peDeclineCode')}: </span>
                                <span className="font-mono text-red-600">{pe.metadata.declineCode}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Replacement Orders Section */}
                  {selectedOrder.replacementOrders && selectedOrder.replacementOrders.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        {t('admin.commandes.reshipmentsTitle', { count: selectedOrder.replacementOrders.length })}
                      </h3>
                      <div className="space-y-2">
                        {selectedOrder.replacementOrders.map((ro) => (
                          <div key={ro.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-mono text-amber-700">{ro.orderNumber}</span>
                              <span className="text-amber-600 ms-2">{ro.replacementReason}</span>
                            </div>
                            <span className="text-xs text-amber-600">
                              {new Date(ro.createdAt).toLocaleDateString(locale)} - {ro.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Admin Notes */}
                  <FormField label={t('admin.commandes.adminNotesLabel')}>
                    <Textarea
                      rows={3}
                      defaultValue={selectedOrder.adminNotes || ''}
                      placeholder={t('admin.commandes.adminNotesPlaceholder')}
                      onBlur={async (e) => {
                        const val = e.target.value;
                        if (val === (selectedOrder.adminNotes || '')) return;
                        try {
                          const res = await fetch(`/api/admin/orders/${selectedOrder.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ adminNotes: val }),
                          });
                          if (res.ok) {
                            setSelectedOrder({ ...selectedOrder, adminNotes: val });
                            toast.success(t('admin.commandes.notesSaved'));
                          }
                        } catch (error) { console.warn('[OrdersPage] Failed to save admin notes:', error); }
                      }}
                    />
                  </FormField>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={ShoppingBag}
                emptyTitle={t('admin.commandes.emptyTitle')}
                emptyDescription={t('admin.commandes.emptyDescription')}
              />
            )
          }
        />
      </div>

      {/* ─── REFUND MODAL ────────────────────────────────────────── */}
      <Modal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        title={t('admin.commandes.refundTitle')}
        subtitle={t('admin.commandes.refundOrderSubtitle', { orderNumber: selectedOrder?.orderNumber || '' })}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRefundModal(false)}>
              {t('admin.commandes.cancel')}
            </Button>
            <Button variant="danger" icon={RotateCcw} onClick={handleRefund} disabled={refunding}>
              {refunding ? t('admin.commandes.processing') : t('admin.commandes.confirmRefund')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800">
              {t('admin.commandes.refundWarning')}
            </p>
          </div>

          <FormField label={t('admin.commandes.refundAmountLabel')}>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={selectedOrder?.total}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          </FormField>

          <FormField label={t('admin.commandes.refundReasonLabel')}>
            <Textarea
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder={t('admin.commandes.refundReasonPlaceholder')}
            />
          </FormField>

          {refundError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{refundError}</p>
          )}
        </div>
      </Modal>

      {/* ─── RESHIP MODAL ────────────────────────────────────────── */}
      <Modal
        isOpen={showReshipModal}
        onClose={() => setShowReshipModal(false)}
        title={t('admin.commandes.reshipTitle')}
        subtitle={t('admin.commandes.refundOrderSubtitle', { orderNumber: selectedOrder?.orderNumber || '' })}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowReshipModal(false)}>
              {t('admin.commandes.cancel')}
            </Button>
            <Button variant="primary" icon={Package} onClick={handleReship} disabled={reshipping}>
              {reshipping ? t('admin.commandes.processing') : t('admin.commandes.confirmReship')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              {t('admin.commandes.reshipInfo')}
            </p>
          </div>

          <FormField label={t('admin.commandes.reshipReasonLabel')}>
            <select
              value={reshipReason}
              onChange={(e) => setReshipReason(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {reshipReasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </FormField>

          {selectedOrder && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">{t('admin.commandes.itemsToReship')}</h4>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="px-3 py-2 flex justify-between text-sm">
                    <span className="text-slate-700">
                      {item.productName}
                      {item.formatName && <span className="text-slate-400 ms-1">({item.formatName})</span>}
                    </span>
                    <span className="text-slate-500">x{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {reshipError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{reshipError}</p>
          )}
        </div>
      </Modal>

      {/* ─── CANCEL ORDER CONFIRM DIALOG ───────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmCancelOrderId}
        title={t('admin.commandes.cancelOrderTitle') || 'Cancel Order'}
        message={t('admin.commandes.confirmCancel') || 'Are you sure you want to cancel this order? This action cannot be undone.'}
        variant="danger"
        confirmLabel={t('admin.commandes.confirmCancelBtn') || 'Cancel Order'}
        onConfirm={() => {
          if (confirmCancelOrderId) {
            updateOrderStatus(confirmCancelOrderId, 'CANCELLED');
          }
          setConfirmCancelOrderId(null);
        }}
        onCancel={() => setConfirmCancelOrderId(null)}
      />

      {/* ─── QUICK ADD NOTE MODAL ──────────────────────────────── */}
      <Modal
        isOpen={showAddNoteModal}
        onClose={() => setShowAddNoteModal(false)}
        title={t('admin.commandes.addNoteTitle')}
        subtitle={selectedOrder ? t('admin.commandes.refundOrderSubtitle', { orderNumber: selectedOrder.orderNumber }) : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddNoteModal(false)}>
              {t('admin.commandes.cancel')}
            </Button>
            <Button variant="primary" icon={StickyNote} onClick={handleAddNote} disabled={savingNote || !newNote.trim()}>
              {savingNote ? t('admin.commandes.processing') : t('admin.commandes.saveNote')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.commandes.noteLabel')}>
            <Textarea
              rows={4}
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={t('admin.commandes.notePlaceholder')}
              autoFocus
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
