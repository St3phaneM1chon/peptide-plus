'use client';

/**
 * PAGE MES COMMANDES - BioCycle Peptides
 * Avec génération de factures PDF
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [viewingInvoice, setViewingInvoice] = useState<Order | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/orders');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchOrders();
    }
  }, [session]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-indigo-100 text-indigo-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'En attente',
    CONFIRMED: 'Confirmée',
    PROCESSING: 'En préparation',
    SHIPPED: 'Expédiée',
    DELIVERED: 'Livrée',
    CANCELLED: 'Annulée',
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
      const formatMoney = (amount: number) => `$${Number(amount).toFixed(2)} ${currency}`;
      
      // Header
      doc.setFontSize(24);
      doc.setTextColor(234, 88, 12); // Orange
      doc.text('BioCycle Peptides', 20, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Peptides de recherche de haute qualité', 20, 32);
      
      // Invoice Title
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);
      doc.text('FACTURE', 150, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`N° ${order.orderNumber}`, 150, 32);
      doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString('fr-CA')}`, 150, 38);
      
      // Line
      doc.setDrawColor(200, 200, 200);
      doc.line(20, 45, 190, 45);
      
      // Billing Info
      let y = 55;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Facturation:', 20, y);
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const billing = order.billingAddress || order.shippingAddress;
      if (billing) {
        y += 6;
        doc.text(`${billing.firstName || ''} ${billing.lastName || ''}`.trim() || session?.user?.name || 'Client', 20, y);
        if (billing.address1) { y += 5; doc.text(billing.address1, 20, y); }
        if (billing.address2) { y += 5; doc.text(billing.address2, 20, y); }
        if (billing.city || billing.province || billing.postalCode) {
          y += 5;
          doc.text(`${billing.city || ''}, ${billing.province || ''} ${billing.postalCode || ''}`.trim(), 20, y);
        }
        if (billing.country) { y += 5; doc.text(billing.country === 'CA' ? 'Canada' : billing.country, 20, y); }
      } else {
        y += 6;
        doc.text(session?.user?.name || 'Client', 20, y);
        y += 5;
        doc.text(session?.user?.email || '', 20, y);
      }
      
      // Shipping Info
      y = 55;
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text('Livraison:', 110, y);
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      const shipping = order.shippingAddress;
      if (shipping) {
        y += 6;
        doc.text(`${shipping.firstName || ''} ${shipping.lastName || ''}`.trim() || 'Client', 110, y);
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
      doc.text('Description', 22, y);
      doc.text('Qté', 120, y);
      doc.text('Prix unit.', 140, y);
      doc.text('Total', 170, y);
      
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
      
      doc.text('Sous-total:', 120, y);
      doc.text(formatMoney(order.subtotal), 170, y);
      
      if (order.discount && order.discount > 0) {
        y += 6;
        doc.setTextColor(0, 150, 0);
        doc.text(`Réduction${order.promoCode ? ` (${order.promoCode})` : ''}:`, 120, y);
        doc.text(`-${formatMoney(order.discount)}`, 170, y);
        doc.setTextColor(60, 60, 60);
      }
      
      y += 6;
      doc.text('Livraison:', 120, y);
      doc.text(order.shippingCost > 0 ? formatMoney(order.shippingCost) : 'Gratuite', 170, y);
      
      // Tax details
      if (order.taxDetails) {
        if (order.taxDetails.gst && order.taxDetails.gst > 0) {
          y += 6;
          doc.text('TPS (5%):', 120, y);
          doc.text(formatMoney(order.taxDetails.gst), 170, y);
        }
        if (order.taxDetails.qst && order.taxDetails.qst > 0) {
          y += 6;
          doc.text('TVQ (9.975%):', 120, y);
          doc.text(formatMoney(order.taxDetails.qst), 170, y);
        }
        if (order.taxDetails.pst && order.taxDetails.pst > 0) {
          y += 6;
          doc.text('TVP:', 120, y);
          doc.text(formatMoney(order.taxDetails.pst), 170, y);
        }
        if (order.taxDetails.hst && order.taxDetails.hst > 0) {
          y += 6;
          doc.text('TVH:', 120, y);
          doc.text(formatMoney(order.taxDetails.hst), 170, y);
        }
      } else if (order.tax > 0) {
        y += 6;
        doc.text('Taxes:', 120, y);
        doc.text(formatMoney(order.tax), 170, y);
      }
      
      // Total
      y += 8;
      doc.setFillColor(234, 88, 12);
      doc.rect(115, y - 5, 75, 12, 'F');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text('TOTAL:', 120, y + 2);
      doc.text(formatMoney(order.total), 170, y + 2);
      
      // Payment Info
      y += 20;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Statut du paiement: ${order.paymentStatus === 'PAID' ? 'Payé' : order.paymentStatus}`, 20, y);
      if (order.paidAt) {
        doc.text(`Date de paiement: ${new Date(order.paidAt).toLocaleDateString('fr-CA')}`, 20, y + 5);
      }
      if (order.paymentMethod) {
        doc.text(`Méthode: ${order.paymentMethod}`, 20, y + 10);
      }
      
      // Footer
      y = 270;
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('BioCycle Peptides - Peptides de recherche uniquement. Non destiné à la consommation humaine.', 20, y);
      doc.text('support@biocyclepeptides.com | biocyclepeptides.com', 20, y + 5);
      
      // Save
      doc.save(`Facture_${order.orderNumber}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erreur lors de la génération du PDF. Veuillez réessayer.');
    } finally {
      setGeneratingPdf(false);
    }
  }, [session]);

  // Print Invoice
  const printInvoice = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">Accueil</Link>
            <span className="mx-2">/</span>
            <Link href="/account" className="hover:text-orange-600">Mon compte</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">Mes commandes</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">📦 Mes commandes</h1>
        </div>

        {/* Filters */}
        {orders.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Rechercher par n° de commande ou produit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                </div>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="PENDING">⏳ En attente</option>
                <option value="CONFIRMED">✅ Confirmée</option>
                <option value="PROCESSING">📦 En préparation</option>
                <option value="SHIPPED">🚚 Expédiée</option>
                <option value="DELIVERED">✓ Livrée</option>
                <option value="CANCELLED">❌ Annulée</option>
              </select>

              {/* Date Filter */}
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">Toutes les dates</option>
                <option value="7">7 derniers jours</option>
                <option value="30">30 derniers jours</option>
                <option value="90">3 derniers mois</option>
                <option value="365">Cette année</option>
              </select>
            </div>
          </div>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">📦</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune commande</h2>
            <p className="text-gray-600 mb-6">
              Vous n&apos;avez pas encore passé de commande.
            </p>
            <Link
              href="/shop"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Découvrir nos produits
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-3xl">🔍</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucun résultat</h2>
            <p className="text-gray-600 mb-4">
              Aucune commande ne correspond à vos critères.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setDateFilter('all');
              }}
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">
              {filteredOrders.length} commande{filteredOrders.length > 1 ? 's' : ''} trouvée{filteredOrders.length > 1 ? 's' : ''}
            </p>
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Order Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-gray-500">Commande</p>
                        <p className="font-semibold text-gray-900">{order.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Date</p>
                        <p className="text-gray-900">
                          {new Date(order.createdAt).toLocaleDateString('fr-CA', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total</p>
                        <p className="font-semibold text-orange-600">
                          ${Number(order.total).toFixed(2)} {order.currency?.code || 'CAD'}
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
                              Qté: {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <p className="font-medium text-gray-900">
                          ${(Number(item.unitPrice) * item.quantity).toFixed(2)}
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
                          📦 {order.carrier || 'Transporteur'}: {order.trackingNumber}
                        </p>
                      </div>
                      {order.trackingUrl && (
                        <a
                          href={order.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          Suivre le colis →
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Actions */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {order.deliveredAt && (
                      <span>Livrée le {new Date(order.deliveredAt).toLocaleDateString('fr-CA')}</span>
                    )}
                    {order.shippedAt && !order.deliveredAt && (
                      <span>Expédiée le {new Date(order.shippedAt).toLocaleDateString('fr-CA')}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {/* Invoice Buttons */}
                    <button
                      onClick={() => setViewingInvoice(order)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    >
                      📄 Voir facture
                    </button>
                    <button
                      onClick={() => generateInvoicePDF(order)}
                      disabled={generatingPdf}
                      className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1 disabled:opacity-50"
                    >
                      {generatingPdf ? '⏳' : '⬇️'} Télécharger PDF
                    </button>
                    {order.status === 'DELIVERED' && (
                      <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                        Laisser un avis
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/shop?reorder=${order.id}`)}
                      className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Commander à nouveau
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
          />
        )}
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
}: {
  order: Order;
  userEmail: string;
  userName: string;
  onClose: () => void;
  onDownload: () => void;
  onPrint: () => void;
}) {
  const currency = order.currency?.code || 'CAD';
  const formatMoney = (amount: number) => `$${Number(amount).toFixed(2)} ${currency}`;
  
  const billing = order.billingAddress || order.shippingAddress;
  const shipping = order.shippingAddress;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold">Facture {order.orderNumber}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrint}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1"
            >
              🖨️ Imprimer
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
                <p className="text-gray-500 text-sm">Peptides de recherche de haute qualité</p>
                <p className="text-gray-500 text-sm mt-2">support@biocyclepeptides.com</p>
                <p className="text-gray-500 text-sm">biocyclepeptides.com</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-gray-900">FACTURE</h2>
                <p className="text-gray-600">N° {order.orderNumber}</p>
                <p className="text-gray-500 text-sm mt-2">
                  Date: {new Date(order.createdAt).toLocaleDateString('fr-CA', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                {order.paidAt && (
                  <p className="text-green-600 text-sm font-medium mt-1">
                    ✓ Payée le {new Date(order.paidAt).toLocaleDateString('fr-CA')}
                  </p>
                )}
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Facturation</h3>
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
                <h3 className="font-semibold text-gray-900 mb-2">Livraison</h3>
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
                    <p className="text-gray-400 italic">Même adresse que facturation</p>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Qté</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Prix unit.</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total</th>
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
                      <td className="px-4 py-3 text-right text-gray-600">{formatMoney(item.unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
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
                  <span className="text-gray-600">Sous-total:</span>
                  <span className="text-gray-900">{formatMoney(order.subtotal)}</span>
                </div>
                
                {order.discount && order.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Réduction{order.promoCode ? ` (${order.promoCode})` : ''}:</span>
                    <span>-{formatMoney(order.discount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Livraison:</span>
                  <span className="text-gray-900">
                    {order.shippingCost > 0 ? formatMoney(order.shippingCost) : 'Gratuite'}
                  </span>
                </div>
                
                {/* Tax Details */}
                {order.taxDetails ? (
                  <>
                    {order.taxDetails.gst && order.taxDetails.gst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TPS (5%):</span>
                        <span className="text-gray-900">{formatMoney(order.taxDetails.gst)}</span>
                      </div>
                    )}
                    {order.taxDetails.qst && order.taxDetails.qst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TVQ (9.975%):</span>
                        <span className="text-gray-900">{formatMoney(order.taxDetails.qst)}</span>
                      </div>
                    )}
                    {order.taxDetails.pst && order.taxDetails.pst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TVP:</span>
                        <span className="text-gray-900">{formatMoney(order.taxDetails.pst)}</span>
                      </div>
                    )}
                    {order.taxDetails.hst && order.taxDetails.hst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TVH:</span>
                        <span className="text-gray-900">{formatMoney(order.taxDetails.hst)}</span>
                      </div>
                    )}
                  </>
                ) : order.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Taxes:</span>
                    <span className="text-gray-900">{formatMoney(order.tax)}</span>
                  </div>
                )}
                
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between font-bold">
                    <span className="text-gray-900">Total:</span>
                    <span className="text-orange-600 text-lg">{formatMoney(order.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment & Shipping Info */}
            <div className="mt-8 pt-6 border-t border-gray-200 grid grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Informations de paiement</h4>
                <p className="text-gray-600">
                  Statut: <span className={order.paymentStatus === 'PAID' ? 'text-green-600 font-medium' : 'text-yellow-600'}>
                    {order.paymentStatus === 'PAID' ? '✓ Payé' : order.paymentStatus}
                  </span>
                </p>
                {order.paymentMethod && <p className="text-gray-600">Méthode: {order.paymentMethod}</p>}
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Expédition</h4>
                <p className="text-gray-600">
                  Statut: <span className="font-medium">{order.status}</span>
                </p>
                {order.trackingNumber && (
                  <p className="text-gray-600">Suivi: {order.carrier} - {order.trackingNumber}</p>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
              <p>BioCycle Peptides - Peptides de recherche uniquement. Non destiné à la consommation humaine.</p>
              <p className="mt-1">Merci pour votre confiance!</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
