'use client';

import { useState } from 'react';

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  type: 'MANUAL' | 'AUTO_SALE' | 'AUTO_PURCHASE' | 'AUTO_PAYMENT' | 'RECURRING';
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
  lines: JournalLine[];
  createdBy: string;
  createdAt: string;
  reference?: string;
  attachments?: number;
}

interface JournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  description?: string;
  debit: number;
  credit: number;
}

export default function EcrituresPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);

  const entries: JournalEntry[] = [
    {
      id: '1',
      entryNumber: 'JV-2026-0015',
      date: '2026-01-25',
      description: 'Vente en ligne #ORD-2026-0008',
      type: 'AUTO_SALE',
      status: 'POSTED',
      reference: 'ORD-2026-0008',
      createdBy: 'Système',
      createdAt: '2026-01-25T14:32:00Z',
      attachments: 1,
      lines: [
        { id: '1', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 458.05, credit: 0 },
        { id: '2', accountCode: '4010', accountName: 'Ventes Canada', debit: 0, credit: 398.30 },
        { id: '3', accountCode: '2110', accountName: 'TPS à payer', debit: 0, credit: 19.92 },
        { id: '4', accountCode: '2120', accountName: 'TVQ à payer', debit: 0, credit: 39.83 },
      ]
    },
    {
      id: '2',
      entryNumber: 'JV-2026-0014',
      date: '2026-01-22',
      description: 'Vente en ligne #ORD-2026-0007',
      type: 'AUTO_SALE',
      status: 'POSTED',
      reference: 'ORD-2026-0007',
      createdBy: 'Système',
      createdAt: '2026-01-22T10:15:00Z',
      attachments: 1,
      lines: [
        { id: '1', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 445.50, credit: 0 },
        { id: '2', accountCode: '4010', accountName: 'Ventes Canada', debit: 0, credit: 387.38 },
        { id: '3', accountCode: '2110', accountName: 'TPS à payer', debit: 0, credit: 19.37 },
        { id: '4', accountCode: '2120', accountName: 'TVQ à payer', debit: 0, credit: 38.75 },
      ]
    },
    {
      id: '3',
      entryNumber: 'JV-2026-0013',
      date: '2026-01-20',
      description: 'Remboursement client #RMB-001',
      type: 'MANUAL',
      status: 'POSTED',
      reference: 'RMB-001',
      createdBy: 'Admin',
      createdAt: '2026-01-20T16:45:00Z',
      lines: [
        { id: '1', accountCode: '4900', accountName: 'Remises et retours', debit: 108.68, credit: 0 },
        { id: '2', accountCode: '2110', accountName: 'TPS à payer', debit: 5.43, credit: 0 },
        { id: '3', accountCode: '2120', accountName: 'TVQ à payer', debit: 10.89, credit: 0 },
        { id: '4', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 0, credit: 125.00 },
      ]
    },
    {
      id: '4',
      entryNumber: 'JV-2026-0012',
      date: '2026-01-18',
      description: 'Vente en ligne #ORD-2026-0006',
      type: 'AUTO_SALE',
      status: 'POSTED',
      reference: 'ORD-2026-0006',
      createdBy: 'Système',
      createdAt: '2026-01-18T09:22:00Z',
      attachments: 1,
      lines: [
        { id: '1', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 1890.00, credit: 0 },
        { id: '2', accountCode: '4010', accountName: 'Ventes Canada', debit: 0, credit: 1643.48 },
        { id: '3', accountCode: '2110', accountName: 'TPS à payer', debit: 0, credit: 82.17 },
        { id: '4', accountCode: '2120', accountName: 'TVQ à payer', debit: 0, credit: 164.35 },
      ]
    },
    {
      id: '5',
      entryNumber: 'JV-2026-0011',
      date: '2026-01-15',
      description: 'Frais Google Ads janvier',
      type: 'AUTO_PAYMENT',
      status: 'POSTED',
      reference: 'GAD-001',
      createdBy: 'Système',
      createdAt: '2026-01-15T12:00:00Z',
      lines: [
        { id: '1', accountCode: '6210', accountName: 'Google Ads', debit: 850.00, credit: 0 },
        { id: '2', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 0, credit: 850.00 },
      ]
    },
    {
      id: '6',
      entryNumber: 'JV-2026-0010',
      date: '2026-01-15',
      description: 'Vente en ligne #ORD-2026-0005',
      type: 'AUTO_SALE',
      status: 'POSTED',
      reference: 'ORD-2026-0005',
      createdBy: 'Système',
      createdAt: '2026-01-15T11:30:00Z',
      attachments: 1,
      lines: [
        { id: '1', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 567.00, credit: 0 },
        { id: '2', accountCode: '4010', accountName: 'Ventes Canada', debit: 0, credit: 493.04 },
        { id: '3', accountCode: '2110', accountName: 'TPS à payer', debit: 0, credit: 24.65 },
        { id: '4', accountCode: '2120', accountName: 'TVQ à payer', debit: 0, credit: 49.31 },
      ]
    },
    {
      id: '7',
      entryNumber: 'JV-2026-0009',
      date: '2026-01-12',
      description: 'Transfert depuis PayPal',
      type: 'MANUAL',
      status: 'POSTED',
      reference: 'TRF-001',
      createdBy: 'Admin',
      createdAt: '2026-01-12T14:20:00Z',
      lines: [
        { id: '1', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 2500.00, credit: 0 },
        { id: '2', accountCode: '1030', accountName: 'Compte PayPal', debit: 0, credit: 2500.00 },
      ]
    },
    {
      id: '8',
      entryNumber: 'JV-2026-0008',
      date: '2026-01-10',
      description: 'Frais Azure hébergement mensuel',
      type: 'RECURRING',
      status: 'POSTED',
      reference: 'AZR-001',
      createdBy: 'Système',
      createdAt: '2026-01-10T00:00:00Z',
      lines: [
        { id: '1', accountCode: '6310', accountName: 'Azure/Hébergement', debit: 300.00, credit: 0 },
        { id: '2', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 0, credit: 300.00 },
      ]
    },
    {
      id: '9',
      entryNumber: 'JV-2026-0016',
      date: '2026-01-31',
      description: 'Amortissement mensuel janvier',
      type: 'RECURRING',
      status: 'DRAFT',
      createdBy: 'Système',
      createdAt: '2026-01-25T00:00:00Z',
      lines: [
        { id: '1', accountCode: '6800', accountName: 'Amortissement', debit: 125.00, credit: 0 },
        { id: '2', accountCode: '1590', accountName: 'Amortissement cumulé', debit: 0, credit: 125.00 },
      ]
    },
  ];

  const filteredEntries = entries.filter(entry => {
    if (searchTerm && !entry.description.toLowerCase().includes(searchTerm.toLowerCase()) && !entry.entryNumber.includes(searchTerm)) {
      return false;
    }
    if (selectedType && entry.type !== selectedType) return false;
    if (selectedStatus && entry.status !== selectedStatus) return false;
    return true;
  });

  const typeLabels: Record<string, { label: string; color: string }> = {
    MANUAL: { label: 'Manuelle', color: 'bg-blue-100 text-blue-800' },
    AUTO_SALE: { label: 'Vente auto', color: 'bg-green-100 text-green-800' },
    AUTO_PURCHASE: { label: 'Achat auto', color: 'bg-orange-100 text-orange-800' },
    AUTO_PAYMENT: { label: 'Paiement auto', color: 'bg-purple-100 text-purple-800' },
    RECURRING: { label: 'Récurrent', color: 'bg-gray-100 text-gray-800' },
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Brouillon', color: 'bg-yellow-100 text-yellow-800' },
    POSTED: { label: 'Comptabilisé', color: 'bg-green-100 text-green-800' },
    VOIDED: { label: 'Annulé', color: 'bg-red-100 text-red-800' },
  };

  const totalDebit = (entry: JournalEntry) => entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = (entry: JournalEntry) => entry.lines.reduce((sum, l) => sum + l.credit, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Écritures de journal</h1>
          <p className="text-gray-500">Gérez les écritures comptables</p>
        </div>
        <button
          onClick={() => setShowNewEntryModal(true)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nouvelle écriture
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total ce mois</p>
          <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
          <p className="text-xs text-gray-500 mt-1">écritures</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Comptabilisées</p>
          <p className="text-2xl font-bold text-green-700">{entries.filter(e => e.status === 'POSTED').length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">Brouillons</p>
          <p className="text-2xl font-bold text-yellow-700">{entries.filter(e => e.status === 'DRAFT').length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Automatiques</p>
          <p className="text-2xl font-bold text-blue-700">{entries.filter(e => e.type.startsWith('AUTO')).length}</p>
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
              placeholder="Rechercher par description ou numéro..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="">Tous les types</option>
            <option value="MANUAL">Manuelle</option>
            <option value="AUTO_SALE">Vente auto</option>
            <option value="AUTO_PURCHASE">Achat auto</option>
            <option value="AUTO_PAYMENT">Paiement auto</option>
            <option value="RECURRING">Récurrent</option>
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="">Tous les statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="POSTED">Comptabilisé</option>
            <option value="VOIDED">Annulé</option>
          </select>
        </div>
      </div>

      {/* Entries Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N° Écriture</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Débit</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Crédit</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button
                    onClick={() => { setSelectedEntry(entry); setShowModal(true); }}
                    className="font-mono text-sm text-blue-600 hover:underline"
                  >
                    {entry.entryNumber}
                  </button>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(entry.date).toLocaleDateString('fr-CA')}
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-900 truncate max-w-xs">{entry.description}</p>
                  {entry.reference && (
                    <p className="text-xs text-gray-500">Réf: {entry.reference}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeLabels[entry.type].color}`}>
                    {typeLabels[entry.type].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {totalDebit(entry).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">
                  {totalCredit(entry).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[entry.status].color}`}>
                    {statusLabels[entry.status].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => { setSelectedEntry(entry); setShowModal(true); }}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="Voir détails"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    {entry.status === 'DRAFT' && (
                      <button
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                        title="Comptabiliser"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                    {entry.attachments && entry.attachments > 0 && (
                      <span className="text-xs text-gray-400 ml-1">
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Entry Detail Modal */}
      {showModal && selectedEntry && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedEntry.entryNumber}</h3>
                <p className="text-sm text-gray-500">{selectedEntry.description}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">{new Date(selectedEntry.date).toLocaleDateString('fr-CA')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeLabels[selectedEntry.type].color}`}>
                    {typeLabels[selectedEntry.type].label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Statut</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[selectedEntry.status].color}`}>
                    {statusLabels[selectedEntry.status].label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Créé par</p>
                  <p className="font-medium">{selectedEntry.createdBy}</p>
                </div>
              </div>

              {/* Journal Lines */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Lignes d'écriture</h4>
                <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Compte</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Débit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Crédit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {selectedEntry.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-2">
                          <span className="font-mono text-sm text-gray-600">{line.accountCode}</span>
                          <span className="text-sm text-gray-900 ml-2">{line.accountName}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">{line.description || '-'}</td>
                        <td className="px-4 py-2 text-right">
                          {line.debit > 0 && (
                            <span className="font-medium text-gray-900">
                              {line.debit.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {line.credit > 0 && (
                            <span className="font-medium text-gray-900">
                              {line.credit.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 font-semibold text-gray-900">Total</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900">
                        {totalDebit(selectedEntry).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900">
                        {totalCredit(selectedEntry).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                      </td>
                    </tr>
                  </tfoot>
                </table>
                {totalDebit(selectedEntry) === totalCredit(selectedEntry) ? (
                  <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Écriture équilibrée
                  </p>
                ) : (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Écriture déséquilibrée!
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {selectedEntry.status === 'DRAFT' && (
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    Comptabiliser
                  </button>
                )}
                {selectedEntry.status === 'POSTED' && (
                  <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200">
                    Contre-passer
                  </button>
                )}
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                  Dupliquer
                </button>
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 ml-auto">
                  Imprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Entry Modal */}
      {showNewEntryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold text-gray-900">Nouvelle écriture de journal</h3>
              <button onClick={() => setShowNewEntryModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Header Fields */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    placeholder="Description de l'écriture..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Journal Lines */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Lignes d'écriture</h4>
                  <button className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Ajouter une ligne
                  </button>
                </div>
                <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Compte</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 w-32">Débit</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 w-32">Crédit</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-2">
                        <select className="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                          <option value="">Sélectionner...</option>
                          <option value="1010">1010 - Compte bancaire principal</option>
                          <option value="1030">1030 - Compte PayPal</option>
                          <option value="4010">4010 - Ventes Canada</option>
                          <option value="6210">6210 - Google Ads</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded text-sm" placeholder="Description..." />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right" placeholder="0.00" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right" placeholder="0.00" />
                      </td>
                      <td className="px-2">
                        <button className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2">
                        <select className="w-full px-2 py-1 border border-gray-300 rounded text-sm">
                          <option value="">Sélectionner...</option>
                          <option value="1010">1010 - Compte bancaire principal</option>
                          <option value="1030">1030 - Compte PayPal</option>
                          <option value="4010">4010 - Ventes Canada</option>
                          <option value="6210">6210 - Google Ads</option>
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" className="w-full px-2 py-1 border border-gray-300 rounded text-sm" placeholder="Description..." />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right" placeholder="0.00" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right" placeholder="0.00" />
                      </td>
                      <td className="px-2">
                        <button className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 font-semibold text-gray-900">Total</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900">0.00 $</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900">0.00 $</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Reference and Attachments */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Référence (optionnel)</label>
                  <input
                    type="text"
                    placeholder="N° facture, commande..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pièce jointe</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-emerald-400 cursor-pointer">
                    <p className="text-sm text-gray-500">Glisser un fichier ou cliquer pour téléverser</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowNewEntryModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Annuler
                </button>
                <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                  Sauvegarder brouillon
                </button>
                <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 ml-auto">
                  Comptabiliser
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
