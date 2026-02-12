'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  productId?: string;
  productSku?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId?: string;
  customerName: string;
  customerEmail?: string;
  subtotal: number;
  shippingCost: number;
  discount: number;
  taxTps: number;
  taxTvq: number;
  taxTvh: number;
  taxPst: number;
  total: number;
  amountPaid: number;
  balance: number;
  currency: string;
  invoiceDate: string;
  dueDate: string;
  paidAt?: string | null;
  status: string;
  pdfUrl?: string | null;
  notes?: string | null;
  items: InvoiceItem[];
}

const statusColors: Record<string, string> = {
  PAID: 'bg-green-100 text-green-800',
  SENT: 'bg-yellow-100 text-yellow-800',
  DRAFT: 'bg-gray-100 text-gray-800',
  PARTIAL: 'bg-blue-100 text-blue-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-red-100 text-red-800',
  VOID: 'bg-gray-100 text-gray-500',
};

const statusLabels: Record<string, string> = {
  PAID: 'Payee',
  SENT: 'Envoyee',
  DRAFT: 'Brouillon',
  PARTIAL: 'Partielle',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulee',
  VOID: 'Annulee',
};

export default function InvoicesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/invoices');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchInvoices();
    }
  }, [session]);

  const fetchInvoices = async () => {
    try {
      const res = await fetch('/api/account/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(term) ||
          inv.customerName.toLowerCase().includes(term)
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((inv) => inv.status === statusFilter);
    }

    return result;
  }, [invoices, searchTerm, statusFilter]);

  const generateInvoicePDF = useCallback(
    async (invoice: Invoice) => {
      setGeneratingPdf(true);
      try {
        const { default: jsPDF } = await import('jspdf');
        const doc = new jsPDF();

        const formatMoney = (amount: number) => `$${Number(amount).toFixed(2)} ${invoice.currency}`;

        // Header
        doc.setFontSize(24);
        doc.setTextColor(234, 88, 12);
        doc.text('BioCycle Peptides', 20, 25);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('Peptides de recherche de haute qualite', 20, 32);

        // Invoice title
        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text('FACTURE', 150, 25);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`N° ${invoice.invoiceNumber}`, 150, 32);
        doc.text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString('fr-CA')}`, 150, 38);

        doc.setDrawColor(200, 200, 200);
        doc.line(20, 45, 190, 45);

        // Client info
        let y = 55;
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text('Client:', 20, y);
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);
        y += 6;
        doc.text(invoice.customerName, 20, y);
        if (invoice.customerEmail) {
          y += 5;
          doc.text(invoice.customerEmail, 20, y);
        }

        // Items table header
        y = 85;
        doc.setFillColor(245, 245, 245);
        doc.rect(20, y - 5, 170, 10, 'F');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text('Description', 22, y);
        doc.text('Qte', 120, y);
        doc.text('Prix unit.', 140, y);
        doc.text('Total', 170, y);

        // Items
        y += 10;
        doc.setTextColor(60, 60, 60);
        invoice.items.forEach((item) => {
          doc.text(item.description.substring(0, 50), 22, y);
          doc.text(String(item.quantity), 125, y);
          doc.text(formatMoney(item.unitPrice), 140, y);
          doc.text(formatMoney(item.total), 170, y);
          y += 7;
        });

        // Totals
        y += 5;
        doc.line(120, y, 190, y);
        y += 8;
        doc.text('Sous-total:', 120, y);
        doc.text(formatMoney(invoice.subtotal), 170, y);

        if (invoice.discount > 0) {
          y += 6;
          doc.setTextColor(0, 150, 0);
          doc.text('Reduction:', 120, y);
          doc.text(`-${formatMoney(invoice.discount)}`, 170, y);
          doc.setTextColor(60, 60, 60);
        }

        y += 6;
        doc.text('Livraison:', 120, y);
        doc.text(invoice.shippingCost > 0 ? formatMoney(invoice.shippingCost) : 'Gratuite', 170, y);

        if (invoice.taxTps > 0) {
          y += 6;
          doc.text('TPS (5%):', 120, y);
          doc.text(formatMoney(invoice.taxTps), 170, y);
        }
        if (invoice.taxTvq > 0) {
          y += 6;
          doc.text('TVQ (9.975%):', 120, y);
          doc.text(formatMoney(invoice.taxTvq), 170, y);
        }
        if (invoice.taxTvh > 0) {
          y += 6;
          doc.text('TVH:', 120, y);
          doc.text(formatMoney(invoice.taxTvh), 170, y);
        }
        if (invoice.taxPst > 0) {
          y += 6;
          doc.text('TVP:', 120, y);
          doc.text(formatMoney(invoice.taxPst), 170, y);
        }

        // Total
        y += 8;
        doc.setFillColor(234, 88, 12);
        doc.rect(115, y - 5, 75, 12, 'F');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text('TOTAL:', 120, y + 2);
        doc.text(formatMoney(invoice.total), 170, y + 2);

        // Footer
        const fy = 270;
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text(
          'BioCycle Peptides - Peptides de recherche uniquement. Non destine a la consommation humaine.',
          20,
          fy
        );
        doc.text('support@biocyclepeptides.com | biocyclepeptides.com', 20, fy + 5);

        doc.save(`Facture_${invoice.invoiceNumber}.pdf`);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Erreur lors de la generation du PDF.');
      } finally {
        setGeneratingPdf(false);
      }
    },
    []
  );

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) return null;

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
            <span className="text-gray-900">Mes factures</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">Mes factures</h1>
        </div>

        {/* Filters */}
        {invoices.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Rechercher par numero de facture..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                </div>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="PAID">Payee</option>
                <option value="SENT">Envoyee</option>
                <option value="OVERDUE">En retard</option>
                <option value="PARTIAL">Partielle</option>
                <option value="DRAFT">Brouillon</option>
              </select>
            </div>
          </div>
        )}

        {/* Invoices List */}
        {invoices.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune facture</h2>
            <p className="text-gray-600 mb-6">Vos factures apparaitront ici apres vos commandes.</p>
            <Link
              href="/shop"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Decouvrir nos produits
            </Link>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Aucun resultat</h2>
            <p className="text-gray-600 mb-4">Aucune facture ne correspond a vos criteres.</p>
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              Reinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              {filteredInvoices.length} facture{filteredInvoices.length > 1 ? 's' : ''} trouvee{filteredInvoices.length > 1 ? 's' : ''}
            </p>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N° Facture</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Montant</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <p className="font-medium text-gray-900">{invoice.invoiceNumber}</p>
                          {invoice.orderId && (
                            <p className="text-xs text-gray-500">Commande: {invoice.orderId.slice(0, 8)}...</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(invoice.invoiceDate).toLocaleDateString('fr-CA', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-900">
                            ${invoice.total.toFixed(2)} {invoice.currency}
                          </p>
                          {invoice.balance > 0 && (
                            <p className="text-xs text-red-600">Solde: ${invoice.balance.toFixed(2)}</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[invoice.status] || 'bg-gray-100 text-gray-800'}`}>
                            {statusLabels[invoice.status] || invoice.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setViewingInvoice(invoice)}
                              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Voir
                            </button>
                            <button
                              onClick={() => generateInvoicePDF(invoice)}
                              disabled={generatingPdf}
                              className="text-sm text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                            >
                              PDF
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Detail Modal */}
        {viewingInvoice && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <h2 className="text-lg font-bold">Facture {viewingInvoice.invoiceNumber}</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generateInvoicePDF(viewingInvoice)}
                    disabled={generatingPdf}
                    className="px-3 py-1.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    PDF
                  </button>
                  <button onClick={() => setViewingInvoice(null)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {/* Invoice header */}
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h1 className="text-2xl font-bold text-orange-500">BioCycle Peptides</h1>
                    <p className="text-gray-500 text-sm">Peptides de recherche de haute qualite</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold text-gray-900">FACTURE</h2>
                    <p className="text-gray-600">N° {viewingInvoice.invoiceNumber}</p>
                    <p className="text-gray-500 text-sm mt-2">
                      Date: {new Date(viewingInvoice.invoiceDate).toLocaleDateString('fr-CA', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                    {viewingInvoice.paidAt && (
                      <p className="text-green-600 text-sm font-medium mt-1">
                        Payee le {new Date(viewingInvoice.paidAt).toLocaleDateString('fr-CA')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Client info */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-1">Client</h3>
                  <p className="text-sm text-gray-600">{viewingInvoice.customerName}</p>
                  {viewingInvoice.customerEmail && (
                    <p className="text-sm text-gray-500">{viewingInvoice.customerEmail}</p>
                  )}
                </div>

                {/* Items */}
                <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Qte</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Prix unit.</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {viewingInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-600">${item.unitPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900">${item.total.toFixed(2)}</td>
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
                      <span className="text-gray-900">${viewingInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    {viewingInvoice.discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Reduction:</span>
                        <span>-${viewingInvoice.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Livraison:</span>
                      <span>{viewingInvoice.shippingCost > 0 ? `$${viewingInvoice.shippingCost.toFixed(2)}` : 'Gratuite'}</span>
                    </div>
                    {viewingInvoice.taxTps > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TPS (5%):</span>
                        <span>${viewingInvoice.taxTps.toFixed(2)}</span>
                      </div>
                    )}
                    {viewingInvoice.taxTvq > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TVQ (9.975%):</span>
                        <span>${viewingInvoice.taxTvq.toFixed(2)}</span>
                      </div>
                    )}
                    {viewingInvoice.taxTvh > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TVH:</span>
                        <span>${viewingInvoice.taxTvh.toFixed(2)}</span>
                      </div>
                    )}
                    {viewingInvoice.taxPst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">TVP:</span>
                        <span>${viewingInvoice.taxPst.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-2 mt-2">
                      <div className="flex justify-between font-bold">
                        <span>Total:</span>
                        <span className="text-orange-600 text-lg">${viewingInvoice.total.toFixed(2)} {viewingInvoice.currency}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
