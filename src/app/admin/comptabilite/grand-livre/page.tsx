'use client';

import { useState } from 'react';

interface Transaction {
  id: string;
  date: string;
  journalEntry: string;
  description: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  reference?: string;
  reconciled: boolean;
}

export default function GrandLivrePage() {
  const [selectedAccount, setSelectedAccount] = useState('1010');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-31');
  const [searchTerm, setSearchTerm] = useState('');

  const accounts = [
    { code: '1010', name: 'Compte bancaire principal (CAD)', balance: 32450.00 },
    { code: '1030', name: 'Compte PayPal', balance: 3580.50 },
    { code: '1040', name: 'Compte Stripe', balance: 4000.00 },
    { code: '1110', name: 'Comptes clients Canada', balance: 6200.00 },
    { code: '2110', name: 'TPS à payer', balance: 1420.00 },
    { code: '2120', name: 'TVQ à payer', balance: 2830.00 },
    { code: '4010', name: 'Ventes Canada', balance: 195000.00 },
    { code: '5010', name: 'Achats de marchandises', balance: 95000.00 },
    { code: '6110', name: 'Frais Stripe', balance: 6200.00 },
  ];

  const transactions: Transaction[] = [
    { id: '1', date: '2026-01-02', journalEntry: 'JV-2026-0001', description: 'Solde d\'ouverture janvier', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 28500.00, credit: 0, balance: 28500.00, reconciled: true },
    { id: '2', date: '2026-01-03', journalEntry: 'JV-2026-0002', description: 'Vente en ligne #ORD-2026-0001', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 450.00, credit: 0, balance: 28950.00, reference: 'ORD-2026-0001', reconciled: true },
    { id: '3', date: '2026-01-03', journalEntry: 'JV-2026-0003', description: 'Frais Stripe sur vente #ORD-2026-0001', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 0, credit: 13.05, balance: 28936.95, reference: 'STR-001', reconciled: true },
    { id: '4', date: '2026-01-05', journalEntry: 'JV-2026-0004', description: 'Vente en ligne #ORD-2026-0002', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 285.00, credit: 0, balance: 29221.95, reference: 'ORD-2026-0002', reconciled: true },
    { id: '5', date: '2026-01-05', journalEntry: 'JV-2026-0005', description: 'Vente en ligne #ORD-2026-0003', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 892.50, credit: 0, balance: 30114.45, reference: 'ORD-2026-0003', reconciled: true },
    { id: '6', date: '2026-01-07', journalEntry: 'JV-2026-0006', description: 'Paiement fournisseur - PeptidesCo', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 0, credit: 3500.00, balance: 26614.45, reference: 'CHQ-001', reconciled: true },
    { id: '7', date: '2026-01-08', journalEntry: 'JV-2026-0007', description: 'Vente en ligne #ORD-2026-0004', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 1250.00, credit: 0, balance: 27864.45, reference: 'ORD-2026-0004', reconciled: true },
    { id: '8', date: '2026-01-10', journalEntry: 'JV-2026-0008', description: 'Frais Azure hébergement mensuel', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 0, credit: 300.00, balance: 27564.45, reference: 'AZR-001', reconciled: true },
    { id: '9', date: '2026-01-12', journalEntry: 'JV-2026-0009', description: 'Transfert depuis PayPal', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 2500.00, credit: 0, balance: 30064.45, reference: 'TRF-001', reconciled: true },
    { id: '10', date: '2026-01-15', journalEntry: 'JV-2026-0010', description: 'Vente en ligne #ORD-2026-0005', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 567.00, credit: 0, balance: 30631.45, reference: 'ORD-2026-0005', reconciled: false },
    { id: '11', date: '2026-01-15', journalEntry: 'JV-2026-0011', description: 'Frais Google Ads janvier', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 0, credit: 850.00, balance: 29781.45, reference: 'GAD-001', reconciled: false },
    { id: '12', date: '2026-01-18', journalEntry: 'JV-2026-0012', description: 'Vente en ligne #ORD-2026-0006', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 1890.00, credit: 0, balance: 31671.45, reference: 'ORD-2026-0006', reconciled: false },
    { id: '13', date: '2026-01-20', journalEntry: 'JV-2026-0013', description: 'Remboursement client #RMB-001', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 0, credit: 125.00, balance: 31546.45, reference: 'RMB-001', reconciled: false },
    { id: '14', date: '2026-01-22', journalEntry: 'JV-2026-0014', description: 'Vente en ligne #ORD-2026-0007', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 445.50, credit: 0, balance: 31991.95, reference: 'ORD-2026-0007', reconciled: false },
    { id: '15', date: '2026-01-25', journalEntry: 'JV-2026-0015', description: 'Vente en ligne #ORD-2026-0008', accountCode: '1010', accountName: 'Compte bancaire principal', debit: 458.05, credit: 0, balance: 32450.00, reference: 'ORD-2026-0008', reconciled: false },
  ];

  const filteredTransactions = transactions.filter(t => {
    if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase()) && !t.reference?.includes(searchTerm)) {
      return false;
    }
    return true;
  });

  const totalDebit = filteredTransactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = filteredTransactions.reduce((sum, t) => sum + t.credit, 0);
  const currentAccount = accounts.find(a => a.code === selectedAccount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grand Livre</h1>
          <p className="text-gray-500">Historique détaillé des transactions par compte</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimer
          </button>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Compte</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
            >
              {accounts.map(account => (
                <option key={account.code} value={account.code}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Recherche</label>
            <input
              type="text"
              placeholder="Description, référence..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Account Summary */}
      <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-600 font-medium">Compte sélectionné</p>
            <h2 className="text-xl font-bold text-emerald-900">{currentAccount?.code} - {currentAccount?.name}</h2>
          </div>
          <div className="text-right">
            <p className="text-sm text-emerald-600">Solde actuel</p>
            <p className="text-3xl font-bold text-emerald-900">
              {currentAccount?.balance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
            </p>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">N° Écriture</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Référence</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Débit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Crédit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Solde</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Rapp.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(transaction.date).toLocaleDateString('fr-CA')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-blue-600 hover:underline cursor-pointer">
                      {transaction.journalEntry}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                    {transaction.description}
                  </td>
                  <td className="px-4 py-3">
                    {transaction.reference && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-600">
                        {transaction.reference}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {transaction.debit > 0 && (
                      <span className="font-medium text-gray-900">
                        {transaction.debit.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {transaction.credit > 0 && (
                      <span className="font-medium text-red-600">
                        {transaction.credit.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {transaction.balance.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                  </td>
                  <td className="px-4 py-3 text-center">
                    {transaction.reconciled ? (
                      <span className="text-green-600">
                        <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="text-gray-300">
                        <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-900">
                  Total période
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {totalDebit.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                </td>
                <td className="px-4 py-3 text-right font-bold text-red-600">
                  {totalCredit.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-600">
                  {(totalDebit - totalCredit).toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Rapproché</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>En attente de rapprochement</span>
        </div>
      </div>
    </div>
  );
}
