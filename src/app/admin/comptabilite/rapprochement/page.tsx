'use client';

import { useState } from 'react';

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  matched: boolean;
  matchedEntryId?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  matched: boolean;
}

export default function RapprochementPage() {
  const [selectedAccount, setSelectedAccount] = useState('desjardins');
  const [selectedMonth, setSelectedMonth] = useState('2026-01');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedBankTx, setSelectedBankTx] = useState<BankTransaction | null>(null);

  const bankTransactions: BankTransaction[] = [
    { id: 'b1', date: '2026-01-25', description: 'STRIPE TRANSFER', amount: 2500.00, type: 'CREDIT', matched: false },
    { id: 'b2', date: '2026-01-25', description: 'STRIPE PAYOUT', amount: 458.05, type: 'CREDIT', matched: false },
    { id: 'b3', date: '2026-01-24', description: 'GOOGLE ADS', amount: 125.00, type: 'DEBIT', matched: true, matchedEntryId: 'j3' },
    { id: 'b4', date: '2026-01-24', description: 'STRIPE TRANSFER', amount: 445.50, type: 'CREDIT', matched: true, matchedEntryId: 'j4' },
    { id: 'b5', date: '2026-01-23', description: 'POSTES CANADA', amount: 89.50, type: 'DEBIT', matched: true, matchedEntryId: 'j5' },
    { id: 'b6', date: '2026-01-22', description: 'STRIPE REFUND', amount: 125.00, type: 'DEBIT', matched: true, matchedEntryId: 'j6' },
    { id: 'b7', date: '2026-01-20', description: 'PAYMENT - MICROSOFT', amount: 300.00, type: 'DEBIT', matched: true, matchedEntryId: 'j7' },
    { id: 'b8', date: '2026-01-18', description: 'STRIPE TRANSFER', amount: 1890.00, type: 'CREDIT', matched: true, matchedEntryId: 'j8' },
  ];

  const journalEntries: JournalEntry[] = [
    { id: 'j1', date: '2026-01-25', entryNumber: 'JV-2026-0020', description: 'Transfert Stripe vers banque', amount: 2500.00, type: 'DEBIT', matched: false },
    { id: 'j2', date: '2026-01-25', entryNumber: 'JV-2026-0015', description: 'Vente #ORD-2026-0008', amount: 458.05, type: 'DEBIT', matched: false },
    { id: 'j3', date: '2026-01-24', entryNumber: 'JV-2026-0019', description: 'Frais Google Ads', amount: 125.00, type: 'CREDIT', matched: true },
    { id: 'j4', date: '2026-01-24', entryNumber: 'JV-2026-0014', description: 'Vente #ORD-2026-0007', amount: 445.50, type: 'DEBIT', matched: true },
    { id: 'j5', date: '2026-01-23', entryNumber: 'JV-2026-0018', description: 'Frais Postes Canada', amount: 89.50, type: 'CREDIT', matched: true },
    { id: 'j6', date: '2026-01-22', entryNumber: 'JV-2026-0013', description: 'Remboursement client', amount: 125.00, type: 'CREDIT', matched: true },
    { id: 'j7', date: '2026-01-20', entryNumber: 'JV-2026-0008', description: 'Azure hébergement', amount: 300.00, type: 'CREDIT', matched: true },
    { id: 'j8', date: '2026-01-18', entryNumber: 'JV-2026-0012', description: 'Vente #ORD-2026-0006', amount: 1890.00, type: 'DEBIT', matched: true },
  ];

  const unmatchedBank = bankTransactions.filter(t => !t.matched);
  const unmatchedJournal = journalEntries.filter(t => !t.matched);
  const matchedCount = bankTransactions.filter(t => t.matched).length;

  const bankBalance = 32450.00;
  const bookBalance = 32450.00;
  const difference = bankBalance - bookBalance;

  const handleMatch = (bankTx: BankTransaction) => {
    setSelectedBankTx(bankTx);
    setShowMatchModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapprochement bancaire</h1>
          <p className="text-gray-500">Conciliez vos relevés bancaires avec vos écritures</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importer relevé
          </button>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Auto-rapprocher
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Compte</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
            >
              <option value="desjardins">Desjardins - ****4521</option>
              <option value="td">TD Bank USD - ****8834</option>
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Période</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Solde relevé</p>
          <p className="text-2xl font-bold text-gray-900">{bankBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Solde comptable</p>
          <p className="text-2xl font-bold text-gray-900">{bookBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className={`rounded-xl p-4 border ${difference === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm ${difference === 0 ? 'text-green-600' : 'text-red-600'}`}>Différence</p>
          <p className={`text-2xl font-bold ${difference === 0 ? 'text-green-700' : 'text-red-700'}`}>
            {difference.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Progression</p>
          <p className="text-2xl font-bold text-blue-700">{Math.round((matchedCount / bankTransactions.length) * 100)}%</p>
          <p className="text-xs text-blue-600">{matchedCount}/{bankTransactions.length} rapprochés</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Bank Transactions */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-blue-50">
            <h3 className="font-semibold text-blue-900">Relevé bancaire ({unmatchedBank.length} non rapprochés)</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Montant</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {bankTransactions.map((tx) => (
                  <tr key={tx.id} className={tx.matched ? 'bg-green-50/50' : 'bg-yellow-50/50'}>
                    <td className="px-3 py-2 text-sm">{new Date(tx.date).toLocaleDateString('fr-CA')}</td>
                    <td className="px-3 py-2 text-sm truncate max-w-[150px]" title={tx.description}>{tx.description}</td>
                    <td className={`px-3 py-2 text-sm text-right font-medium ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {tx.matched ? (
                        <span className="text-green-600">
                          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMatch(tx)}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                        >
                          Rapprocher
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Journal Entries */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-emerald-50">
            <h3 className="font-semibold text-emerald-900">Écritures comptables ({unmatchedJournal.length} non rapprochées)</h3>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Montant</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {journalEntries.map((entry) => (
                  <tr key={entry.id} className={entry.matched ? 'bg-green-50/50' : 'bg-yellow-50/50'}>
                    <td className="px-3 py-2 text-sm">{new Date(entry.date).toLocaleDateString('fr-CA')}</td>
                    <td className="px-3 py-2">
                      <p className="text-sm truncate max-w-[150px]" title={entry.description}>{entry.description}</p>
                      <p className="text-xs text-gray-500">{entry.entryNumber}</p>
                    </td>
                    <td className={`px-3 py-2 text-sm text-right font-medium ${entry.type === 'DEBIT' ? 'text-green-600' : 'text-red-600'}`}>
                      {entry.type === 'DEBIT' ? '+' : '-'}{entry.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {entry.matched ? (
                        <span className="text-green-600">
                          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                          En attente
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Complete Reconciliation Button */}
      {difference === 0 && unmatchedBank.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <svg className="w-12 h-12 mx-auto text-green-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-green-900 mb-2">Rapprochement complet!</h3>
          <p className="text-green-700 mb-4">Toutes les transactions sont rapprochées et les soldes correspondent.</p>
          <button className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            Valider le rapprochement
          </button>
        </div>
      )}

      {/* Match Modal */}
      {showMatchModal && selectedBankTx && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Rapprocher la transaction</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600">Transaction bancaire</p>
                <p className="font-medium text-blue-900">{selectedBankTx.description}</p>
                <p className="text-lg font-bold text-blue-900">
                  {selectedBankTx.type === 'CREDIT' ? '+' : '-'}{selectedBankTx.amount.toFixed(2)} $
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Sélectionner l'écriture correspondante:</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {unmatchedJournal
                    .filter(e => Math.abs(e.amount - selectedBankTx.amount) < 0.01)
                    .map((entry) => (
                      <label key={entry.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input type="radio" name="matchEntry" className="text-emerald-600" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{entry.description}</p>
                          <p className="text-xs text-gray-500">{entry.entryNumber} • {new Date(entry.date).toLocaleDateString('fr-CA')}</p>
                        </div>
                        <span className={`font-medium ${entry.type === 'DEBIT' ? 'text-green-600' : 'text-red-600'}`}>
                          {entry.amount.toFixed(2)} $
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowMatchModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={() => { alert('Rapprochement effectué!'); setShowMatchModal(false); }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Rapprocher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
