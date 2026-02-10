'use client';

import { useState } from 'react';

interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  supplier: {
    name: string;
    email: string;
  };
  date: string;
  dueDate: string;
  items: { description: string; amount: number }[];
  subtotal: number;
  taxes: number;
  total: number;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'OVERDUE';
  paidAt?: string;
  category: string;
}

export default function FacturesFournisseursPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedInvoice, setSelectedInvoice] = useState<SupplierInvoice | null>(null);

  const invoices: SupplierInvoice[] = [
    {
      id: '1',
      invoiceNumber: 'PEP-2026-0234',
      supplier: { name: 'PeptidesCo International', email: 'billing@peptideseco.com' },
      date: '2026-01-20',
      dueDate: '2026-02-20',
      items: [
        { description: 'BPC-157 Raw Material (100g)', amount: 2500.00 },
        { description: 'TB-500 Raw Material (50g)', amount: 1800.00 },
        { description: 'Shipping & Handling', amount: 150.00 },
      ],
      subtotal: 4450.00,
      taxes: 0,
      total: 4450.00,
      status: 'APPROVED',
      category: 'Achats marchandises'
    },
    {
      id: '2',
      invoiceNumber: 'AZR-2026-JAN',
      supplier: { name: 'Microsoft Azure', email: 'azure@microsoft.com' },
      date: '2026-01-01',
      dueDate: '2026-01-31',
      items: [
        { description: 'Azure App Service - Standard S1', amount: 180.00 },
        { description: 'Azure SQL Database', amount: 95.00 },
        { description: 'Azure Storage', amount: 25.00 },
      ],
      subtotal: 300.00,
      taxes: 0,
      total: 300.00,
      status: 'PAID',
      paidAt: '2026-01-10',
      category: 'Hébergement'
    },
    {
      id: '3',
      invoiceNumber: 'GAD-2026-0112',
      supplier: { name: 'Google Ads', email: 'billing@google.com' },
      date: '2026-01-15',
      dueDate: '2026-01-31',
      items: [
        { description: 'Google Ads - January Campaign', amount: 850.00 },
      ],
      subtotal: 850.00,
      taxes: 0,
      total: 850.00,
      status: 'PAID',
      paidAt: '2026-01-15',
      category: 'Marketing'
    },
    {
      id: '4',
      invoiceNumber: 'PC-2026-0089',
      supplier: { name: 'Postes Canada', email: 'business@postescanada.ca' },
      date: '2026-01-22',
      dueDate: '2026-02-22',
      items: [
        { description: 'Frais d\'expédition - Janvier (Lots 1-50)', amount: 1250.00 },
      ],
      subtotal: 1250.00,
      taxes: 62.50,
      total: 1312.50,
      status: 'PENDING',
      category: 'Livraison'
    },
    {
      id: '5',
      invoiceNumber: 'CPA-2025-Q4',
      supplier: { name: 'Cabinet Comptable Lavoie', email: 'info@cplavoie.ca' },
      date: '2025-12-31',
      dueDate: '2026-01-15',
      items: [
        { description: 'Services comptables Q4 2025', amount: 1500.00 },
        { description: 'Préparation déclarations TPS/TVQ', amount: 350.00 },
      ],
      subtotal: 1850.00,
      taxes: 277.01,
      total: 2127.01,
      status: 'OVERDUE',
      category: 'Frais professionnels'
    },
  ];

  const filteredInvoices = invoices.filter(invoice => {
    if (searchTerm && !invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !invoice.supplier.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (selectedStatus && invoice.status !== selectedStatus) return false;
    return true;
  });

  const statusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
    APPROVED: { label: 'Approuvée', color: 'bg-blue-100 text-blue-800' },
    PAID: { label: 'Payée', color: 'bg-green-100 text-green-800' },
    OVERDUE: { label: 'En retard', color: 'bg-red-100 text-red-800' },
  };

  const totalPending = invoices.filter(i => i.status === 'PENDING' || i.status === 'APPROVED').reduce((sum, i) => sum + i.total, 0);
  const totalOverdue = invoices.filter(i => i.status === 'OVERDUE').reduce((sum, i) => sum + i.total, 0);
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures fournisseurs</h1>
          <p className="text-gray-500">Gérez les factures d'achat</p>
        </div>
        <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Ajouter facture
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total factures</p>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">À payer</p>
          <p className="text-2xl font-bold text-yellow-700">{totalPending.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-600">En retard</p>
          <p className="text-2xl font-bold text-red-700">{totalOverdue.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Payées ce mois</p>
          <p className="text-2xl font-bold text-green-700">{totalPaid.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
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
              placeholder="Rechercher par numéro ou fournisseur..."
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
            <option value="PENDING">En attente</option>
            <option value="APPROVED">Approuvée</option>
            <option value="PAID">Payée</option>
            <option value="OVERDUE">En retard</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N° Facture</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fournisseur</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
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
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">{invoice.supplier.name}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
                    {invoice.category}
                  </span>
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
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    {(invoice.status === 'PENDING' || invoice.status === 'APPROVED' || invoice.status === 'OVERDUE') && (
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
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedInvoice.invoiceNumber}</h3>
                <p className="text-sm text-gray-500">{selectedInvoice.supplier.name}</p>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Catégorie</p>
                  <p className="font-medium">{selectedInvoice.category}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Statut</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[selectedInvoice.status].color}`}>
                    {statusLabels[selectedInvoice.status].label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Date facture</p>
                  <p className="font-medium">{new Date(selectedInvoice.date).toLocaleDateString('fr-CA')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Échéance</p>
                  <p className="font-medium">{new Date(selectedInvoice.dueDate).toLocaleDateString('fr-CA')}</p>
                </div>
              </div>

              <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {selectedInvoice.items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3 text-gray-900">{item.description}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">{item.amount.toFixed(2)} $</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Sous-total</span>
                    <span>{selectedInvoice.subtotal.toFixed(2)} $</span>
                  </div>
                  {selectedInvoice.taxes > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Taxes</span>
                      <span>{selectedInvoice.taxes.toFixed(2)} $</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                    <span>Total</span>
                    <span className="text-emerald-600">{selectedInvoice.total.toFixed(2)} $</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {selectedInvoice.status === 'PENDING' && (
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Approuver
                  </button>
                )}
                {(selectedInvoice.status === 'APPROVED' || selectedInvoice.status === 'OVERDUE') && (
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Marquer payée
                  </button>
                )}
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 ml-auto">
                  Télécharger
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
