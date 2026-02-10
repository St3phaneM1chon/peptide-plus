'use client';

import { useState } from 'react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  date: string;
  dueDate: string;
  customer: {
    name: string;
    email: string;
    address: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  tps: number;
  tvq: number;
  total: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paidAt?: string;
  paymentMethod?: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function FacturesClientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const invoices: Invoice[] = [
    {
      id: '1',
      invoiceNumber: 'INV-2026-0058',
      orderId: 'ORD-2026-0008',
      date: '2026-01-25',
      dueDate: '2026-02-24',
      customer: { name: 'Jean Tremblay', email: 'jean.t@email.com', address: '123 Rue Principale, Montréal QC H2X 1A1' },
      items: [
        { description: 'BPC-157 5mg', quantity: 2, unitPrice: 149.99, total: 299.98 },
        { description: 'TB-500 2mg', quantity: 1, unitPrice: 89.99, total: 89.99 },
      ],
      subtotal: 389.97,
      tps: 19.50,
      tvq: 38.93,
      total: 448.40,
      status: 'PAID',
      paidAt: '2026-01-25',
      paymentMethod: 'Stripe'
    },
    {
      id: '2',
      invoiceNumber: 'INV-2026-0057',
      orderId: 'ORD-2026-0007',
      date: '2026-01-22',
      dueDate: '2026-02-21',
      customer: { name: 'Marie Dubois', email: 'marie.d@email.com', address: '456 Avenue des Pins, Québec QC G1R 2S4' },
      items: [
        { description: 'Semaglutide 5mg', quantity: 1, unitPrice: 389.99, total: 389.99 },
      ],
      subtotal: 389.99,
      tps: 19.50,
      tvq: 38.93,
      total: 448.42,
      status: 'PAID',
      paidAt: '2026-01-22',
      paymentMethod: 'PayPal'
    },
    {
      id: '3',
      invoiceNumber: 'INV-2026-0056',
      orderId: 'ORD-2026-0006',
      date: '2026-01-18',
      dueDate: '2026-02-17',
      customer: { name: 'Pierre Gagnon', email: 'pierre.g@email.com', address: '789 Boul. St-Laurent, Montréal QC H2T 1R2' },
      items: [
        { description: 'BPC-157 10mg', quantity: 3, unitPrice: 249.99, total: 749.97 },
        { description: 'NAD+ 500mg', quantity: 2, unitPrice: 199.99, total: 399.98 },
        { description: 'Syringes Pack (10)', quantity: 1, unitPrice: 29.99, total: 29.99 },
      ],
      subtotal: 1179.94,
      tps: 59.00,
      tvq: 117.79,
      total: 1356.73,
      status: 'PAID',
      paidAt: '2026-01-18',
      paymentMethod: 'Stripe'
    },
    {
      id: '4',
      invoiceNumber: 'INV-2026-0045',
      orderId: 'ORD-2025-0892',
      date: '2025-11-25',
      dueDate: '2025-12-25',
      customer: { name: 'Sophie Martin', email: 'sophie.m@email.com', address: '321 Rue Notre-Dame, Sherbrooke QC J1H 2E5' },
      items: [
        { description: 'GHK-Cu 50mg', quantity: 1, unitPrice: 159.99, total: 159.99 },
      ],
      subtotal: 159.99,
      tps: 8.00,
      tvq: 15.97,
      total: 183.96,
      status: 'OVERDUE',
    },
    {
      id: '5',
      invoiceNumber: 'INV-2026-0055',
      orderId: 'ORD-2026-0005',
      date: '2026-01-15',
      dueDate: '2026-02-14',
      customer: { name: 'Luc Bergeron', email: 'luc.b@email.com', address: '654 Rue King, Longueuil QC J4K 3C8' },
      items: [
        { description: 'Tirzepatide 10mg', quantity: 1, unitPrice: 459.99, total: 459.99 },
      ],
      subtotal: 459.99,
      tps: 23.00,
      tvq: 45.92,
      total: 528.91,
      status: 'SENT',
    },
  ];

  const filteredInvoices = invoices.filter(invoice => {
    if (searchTerm && !invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !invoice.customer.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (selectedStatus && invoice.status !== selectedStatus) return false;
    return true;
  });

  const statusLabels: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
    SENT: { label: 'Envoyée', color: 'bg-blue-100 text-blue-800' },
    PAID: { label: 'Payée', color: 'bg-green-100 text-green-800' },
    OVERDUE: { label: 'En retard', color: 'bg-red-100 text-red-800' },
    CANCELLED: { label: 'Annulée', color: 'bg-gray-100 text-gray-600' },
  };

  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0);
  const totalPending = invoices.filter(i => i.status === 'SENT').reduce((sum, i) => sum + i.total, 0);
  const totalOverdue = invoices.filter(i => i.status === 'OVERDUE').reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures clients</h1>
          <p className="text-gray-500">Gérez les factures de vente</p>
        </div>
        <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nouvelle facture
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total factures</p>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Payées</p>
          <p className="text-2xl font-bold text-green-700">{totalPaid.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">En attente</p>
          <p className="text-2xl font-bold text-blue-700">{totalPending.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-600">En retard</p>
          <p className="text-2xl font-bold text-red-700">{totalOverdue.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par numéro ou client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="">Tous les statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="SENT">Envoyée</option>
            <option value="PAID">Payée</option>
            <option value="OVERDUE">En retard</option>
          </select>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Exporter
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N° Facture</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Échéance</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedInvoice(invoice)}
                    className="font-mono text-sm text-blue-600 hover:underline"
                  >
                    {invoice.invoiceNumber}
                  </button>
                  <p className="text-xs text-gray-500">Commande: {invoice.orderId}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{invoice.customer.name}</p>
                  <p className="text-xs text-gray-500">{invoice.customer.email}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(invoice.date).toLocaleDateString('fr-CA')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(invoice.dueDate).toLocaleDateString('fr-CA')}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {invoice.total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[invoice.status].color}`}>
                    {statusLabels[invoice.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => setSelectedInvoice(invoice)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Voir"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                      title="Télécharger PDF"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                    {invoice.status === 'SENT' && (
                      <button
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                        title="Marquer payée"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</h3>
                <p className="text-sm text-gray-500">Commande: {selectedInvoice.orderId}</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Facturer à</h4>
                  <p className="font-medium text-gray-900">{selectedInvoice.customer.name}</p>
                  <p className="text-sm text-gray-600">{selectedInvoice.customer.email}</p>
                  <p className="text-sm text-gray-600">{selectedInvoice.customer.address}</p>
                </div>
                <div className="text-right">
                  <div className="mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusLabels[selectedInvoice.status].color}`}>
                      {statusLabels[selectedInvoice.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Date: {new Date(selectedInvoice.date).toLocaleDateString('fr-CA')}</p>
                  <p className="text-sm text-gray-500">Échéance: {new Date(selectedInvoice.dueDate).toLocaleDateString('fr-CA')}</p>
                  {selectedInvoice.paidAt && (
                    <p className="text-sm text-green-600">Payée le: {new Date(selectedInvoice.paidAt).toLocaleDateString('fr-CA')}</p>
                  )}
                </div>
              </div>

              {/* Items */}
              <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Qté</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Prix unitaire</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedInvoice.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{item.unitPrice.toFixed(2)} $</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{item.total.toFixed(2)} $</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Sous-total</span>
                    <span className="text-gray-900">{selectedInvoice.subtotal.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">TPS (5%)</span>
                    <span className="text-gray-900">{selectedInvoice.tps.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">TVQ (9.975%)</span>
                    <span className="text-gray-900">{selectedInvoice.tvq.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                    <span>Total</span>
                    <span className="text-emerald-600">{selectedInvoice.total.toFixed(2)} $</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Télécharger PDF
                </button>
                <button className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Envoyer par email
                </button>
                {selectedInvoice.status !== 'PAID' && selectedInvoice.status !== 'CANCELLED' && (
                  <button className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 ml-auto">
                    Marquer comme payée
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
