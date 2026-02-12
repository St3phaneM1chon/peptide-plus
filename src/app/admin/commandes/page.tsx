'use client';

import { useState, useEffect } from 'react';
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
  Eye,
  Package,
  AlertTriangle,
  FileText,
} from 'lucide-react';

import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/admin/StatusBadge';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input, Textarea } from '@/components/admin/FormField';

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

const statusOptions = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'SHIPPED', label: 'Shipped' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const statusOptionValues = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const reshipReasons = [
  'Colis perdu en transit',
  'Colis endommage',
  'Colis retourne a l\'expediteur',
  'Adresse incorrecte - renvoi',
  'Contenu manquant dans le colis',
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState({ status: '', search: '', dateFrom: '', dateTo: '' });
  const [updating, setUpdating] = useState(false);

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

  // Enriched detail data
  const [creditNotes, setCreditNotes] = useState<CreditNoteRef[]>([]);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/admin/orders');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrders([]);
    }
    setLoading(false);
  };

  const fetchOrderDetail = async (orderId: string) => {
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
      }
    } catch (err) {
      console.error('Error fetching order detail:', err);
    }
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setCreditNotes([]);
    fetchOrderDetail(order.id);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdating(true);
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (err) {
      console.error('Error updating order:', err);
    }
    setUpdating(false);
  };

  const updateTracking = async (orderId: string, carrier: string, trackingNumber: string) => {
    setUpdating(true);
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carrier, trackingNumber }),
      });
      setOrders(orders.map(o => o.id === orderId ? { ...o, carrier, trackingNumber } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, carrier, trackingNumber });
      }
    } catch (err) {
      console.error('Error updating tracking:', err);
    }
    setUpdating(false);
  };

  // ─── REFUND ─────────────────────────────────────────────────────

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
      setRefundError('Montant invalide');
      return;
    }
    if (!refundReason.trim()) {
      setRefundError('La raison est requise');
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
        setRefundError(data.error || 'Erreur lors du remboursement');
        return;
      }
      // Refresh
      setShowRefundModal(false);
      await fetchOrders();
      await fetchOrderDetail(selectedOrder.id);
    } catch (err) {
      setRefundError('Erreur reseau');
    } finally {
      setRefunding(false);
    }
  };

  // ─── RESHIP ─────────────────────────────────────────────────────

  const openReshipModal = () => {
    setReshipReason(reshipReasons[0]);
    setReshipError('');
    setShowReshipModal(true);
  };

  const handleReship = async () => {
    if (!selectedOrder) return;
    if (!reshipReason.trim()) {
      setReshipError('La raison est requise');
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
        setReshipError(data.error || 'Erreur lors de la re-expedition');
        return;
      }
      setShowReshipModal(false);
      await fetchOrders();
      await fetchOrderDetail(selectedOrder.id);
    } catch (err) {
      setReshipError('Erreur reseau');
    } finally {
      setReshipping(false);
    }
  };

  // ─── FILTERS ────────────────────────────────────────────────────

  const filteredOrders = orders.filter(order => {
    if (filter.status && order.status !== filter.status) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!order.orderNumber.toLowerCase().includes(search) &&
          !order.userName?.toLowerCase().includes(search) &&
          !order.userEmail?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'PENDING').length,
    processing: orders.filter(o => o.status === 'PROCESSING').length,
    shipped: orders.filter(o => o.status === 'SHIPPED').length,
    delivered: orders.filter(o => o.status === 'DELIVERED').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  const canRefund = selectedOrder &&
    (selectedOrder.paymentStatus === 'PAID' || selectedOrder.paymentStatus === 'PARTIAL_REFUND');
  const canReship = selectedOrder &&
    (selectedOrder.status === 'SHIPPED' || selectedOrder.status === 'DELIVERED');

  const columns: Column<Order>[] = [
    {
      key: 'orderNumber',
      header: 'Commande',
      sortable: true,
      render: (order) => (
        <div>
          <p className="font-semibold text-slate-900">
            {order.orderNumber}
            {order.orderType === 'REPLACEMENT' && (
              <span className="ml-1 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">RESHIP</span>
            )}
          </p>
          <p className="text-xs text-slate-500">{order.items.length} article(s)</p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Client',
      sortable: true,
      render: (order) => (
        <div>
          <p className="text-slate-900">{order.userName}</p>
          <p className="text-xs text-slate-500">{order.userEmail}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      sortable: true,
      align: 'right',
      render: (order) => (
        <div>
          <p className="font-semibold text-slate-900">{order.total.toFixed(2)} {order.currencyCode}</p>
          {order.promoCode && (
            <p className="text-xs text-emerald-600">Code: {order.promoCode}</p>
          )}
        </div>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'Paiement',
      render: (order) => <PaymentStatusBadge status={order.paymentStatus} />,
    },
    {
      key: 'status',
      header: 'Statut',
      render: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      render: (order) => (
        <span className="text-slate-500">
          {new Date(order.createdAt).toLocaleDateString('fr-CA')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (order) => (
        <Button
          variant="ghost"
          size="sm"
          icon={Eye}
          onClick={(e) => {
            e.stopPropagation();
            openOrderDetail(order);
          }}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Commandes"
        subtitle="Gerez toutes les commandes clients"
        actions={
          <Button variant="secondary" icon={Download}>
            Exporter CSV
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total" value={stats.total} icon={ShoppingBag} />
        <StatCard label="En attente" value={stats.pending} icon={Clock} />
        <StatCard label="En traitement" value={stats.processing} icon={Cog} />
        <StatCard label="Expediees" value={stats.shipped} icon={Truck} />
        <StatCard label="Livrees" value={stats.delivered} icon={PackageCheck} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(value) => setFilter({ ...filter, search: value })}
        searchPlaceholder="Rechercher (no commande, client, email)..."
      >
        <SelectFilter
          label="Tous les statuts"
          value={filter.status}
          onChange={(value) => setFilter({ ...filter, status: value })}
          options={statusOptions}
        />
        <input
          type="date"
          className="h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          value={filter.dateFrom}
          onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
        />
        <input
          type="date"
          className="h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          value={filter.dateTo}
          onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
        />
      </FilterBar>

      {/* Orders Table */}
      <DataTable
        columns={columns}
        data={filteredOrders}
        keyExtractor={(order) => order.id}
        onRowClick={(order) => openOrderDetail(order)}
        emptyTitle="Aucune commande trouvee"
        emptyDescription="Aucune commande ne correspond a vos filtres."
      />

      {/* Order Detail Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => { setSelectedOrder(null); setCreditNotes([]); }}
        title={`Commande ${selectedOrder?.orderNumber ?? ''}`}
        subtitle={selectedOrder ? new Date(selectedOrder.createdAt).toLocaleString('fr-CA') : undefined}
        size="xl"
        footer={
          <>
            <Button variant="primary" icon={Mail}>
              Envoyer email confirmation
            </Button>
            <Button variant="secondary" icon={Printer}>
              Imprimer bon de livraison
            </Button>
            {canReship && (
              <Button variant="secondary" icon={Package} onClick={openReshipModal}>
                Re-expedier (colis perdu)
              </Button>
            )}
            {canRefund && (
              <Button variant="danger" icon={RotateCcw} className="ml-auto" onClick={openRefundModal}>
                Rembourser
              </Button>
            )}
          </>
        }
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Replacement banner */}
            {selectedOrder.orderType === 'REPLACEMENT' && selectedOrder.parentOrder && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-600" />
                <span className="text-sm text-amber-800">
                  Re-expedition de <strong>{selectedOrder.parentOrder.orderNumber}</strong>
                </span>
              </div>
            )}

            {/* Status & Actions */}
            <div className="flex flex-wrap gap-4 items-center">
              <FormField label="Statut commande">
                <select
                  value={selectedOrder.status}
                  onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
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
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Client</h3>
                <p className="text-slate-700">{selectedOrder.userName}</p>
                <p className="text-slate-500 text-sm">{selectedOrder.userEmail}</p>
                <Link href={`/admin/clients/${selectedOrder.userId}`} className="text-sky-600 text-sm hover:underline">
                  Voir le profil &rarr;
                </Link>
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-2">Adresse de livraison</h3>
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
              <h3 className="font-semibold text-slate-900 mb-3">Suivi de livraison</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Transporteur">
                  <select
                    defaultValue={selectedOrder.carrier || ''}
                    onChange={(e) => updateTracking(selectedOrder.id, e.target.value, selectedOrder.trackingNumber || '')}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="">Selectionner...</option>
                    <option value="Postes Canada">Postes Canada</option>
                    <option value="FedEx">FedEx</option>
                    <option value="UPS">UPS</option>
                    <option value="Purolator">Purolator</option>
                    <option value="DHL">DHL</option>
                  </select>
                </FormField>
                <FormField label="Numero de suivi">
                  <Input
                    type="text"
                    defaultValue={selectedOrder.trackingNumber || ''}
                    placeholder="Ex: 1234567890"
                    onBlur={(e) => updateTracking(selectedOrder.id, selectedOrder.carrier || '', e.target.value)}
                  />
                </FormField>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="font-semibold text-slate-900 mb-3">Articles</h3>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Produit</th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Qte</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Prix unit.</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Total</th>
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
                        <td className="px-4 py-3 text-right text-sm text-slate-700">{item.unitPrice.toFixed(2)} $</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">{item.total.toFixed(2)} $</td>
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
                  <span>Sous-total</span>
                  <span>{selectedOrder.subtotal.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-slate-600 text-sm">
                  <span>Livraison</span>
                  <span>{selectedOrder.shippingCost === 0 ? 'GRATUIT' : `${selectedOrder.shippingCost.toFixed(2)} $`}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 text-sm">
                    <span>Reduction {selectedOrder.promoCode && `(${selectedOrder.promoCode})`}</span>
                    <span>-{selectedOrder.discount.toFixed(2)} $</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 text-sm">
                  <span>Taxes</span>
                  <span>{selectedOrder.tax.toFixed(2)} $</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-300">
                  <span>Total</span>
                  <span>{selectedOrder.total.toFixed(2)} {selectedOrder.currencyCode}</span>
                </div>
              </div>
            </div>

            {/* Credit Notes Section */}
            {creditNotes.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Notes de credit ({creditNotes.length})
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
                        <span className="text-red-600 ml-2">{cn.reason}</span>
                      </div>
                      <span className="font-medium text-red-700">-{cn.total.toFixed(2)} $</span>
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
                  Re-expeditions ({selectedOrder.replacementOrders.length})
                </h3>
                <div className="space-y-2">
                  {selectedOrder.replacementOrders.map((ro) => (
                    <div key={ro.id} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-mono text-amber-700">{ro.orderNumber}</span>
                        <span className="text-amber-600 ml-2">{ro.replacementReason}</span>
                      </div>
                      <span className="text-xs text-amber-600">
                        {new Date(ro.createdAt).toLocaleDateString('fr-CA')} - {ro.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Notes */}
            <FormField label="Notes internes">
              <Textarea
                rows={3}
                defaultValue={selectedOrder.adminNotes || ''}
                placeholder="Notes visibles uniquement par l'admin..."
              />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ─── REFUND MODAL ────────────────────────────────────────── */}
      <Modal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        title="Remboursement"
        subtitle={`Commande ${selectedOrder?.orderNumber || ''}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRefundModal(false)}>
              Annuler
            </Button>
            <Button variant="danger" icon={RotateCcw} onClick={handleRefund} disabled={refunding}>
              {refunding ? 'Traitement...' : 'Confirmer le remboursement'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <p className="text-sm text-amber-800">
              Remboursement comptable uniquement. Aucun remboursement Stripe ne sera effectue.
              La note de credit sera generee automatiquement.
            </p>
          </div>

          <FormField label="Montant du remboursement ($)">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={selectedOrder?.total}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
          </FormField>

          <FormField label="Raison du remboursement">
            <Textarea
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Ex: Produit defectueux, erreur de commande..."
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
        title="Re-expedition (colis perdu)"
        subtitle={`Commande ${selectedOrder?.orderNumber || ''}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowReshipModal(false)}>
              Annuler
            </Button>
            <Button variant="primary" icon={Package} onClick={handleReship} disabled={reshipping}>
              {reshipping ? 'Traitement...' : 'Confirmer la re-expedition'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Une nouvelle commande de remplacement a $0 sera creee. Le stock sera decremente
              et une perte inventaire sera comptabilisee.
            </p>
          </div>

          <FormField label="Raison de la re-expedition">
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
              <h4 className="text-sm font-medium text-slate-700 mb-2">Articles a re-expedier</h4>
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="px-3 py-2 flex justify-between text-sm">
                    <span className="text-slate-700">
                      {item.productName}
                      {item.formatName && <span className="text-slate-400 ml-1">({item.formatName})</span>}
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
    </div>
  );
}
