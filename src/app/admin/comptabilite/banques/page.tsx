'use client';

import { useState } from 'react';

interface BankAccount {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'PAYMENT_PROCESSOR';
  currency: 'CAD' | 'USD' | 'EUR';
  balance: number;
  lastSync: string;
  accountNumber: string;
  institution: string;
  isActive: boolean;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  category?: string;
  reconciled: boolean;
}

export default function BanquesPage() {
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);

  const accounts: BankAccount[] = [
    { id: '1', name: 'Compte principal Desjardins', type: 'CHECKING', currency: 'CAD', balance: 32450.00, lastSync: '2026-01-25T14:30:00Z', accountNumber: '****4521', institution: 'Desjardins', isActive: true },
    { id: '2', name: 'Compte USD TD', type: 'CHECKING', currency: 'USD', balance: 5200.00, lastSync: '2026-01-25T14:30:00Z', accountNumber: '****8834', institution: 'TD Bank', isActive: true },
    { id: '3', name: 'Stripe', type: 'PAYMENT_PROCESSOR', currency: 'CAD', balance: 4000.00, lastSync: '2026-01-25T15:00:00Z', accountNumber: 'acct_xxxxx', institution: 'Stripe', isActive: true },
    { id: '4', name: 'PayPal', type: 'PAYMENT_PROCESSOR', currency: 'CAD', balance: 3580.50, lastSync: '2026-01-25T14:45:00Z', accountNumber: 'info@biocycle.ca', institution: 'PayPal', isActive: true },
    { id: '5', name: 'Compte épargne', type: 'SAVINGS', currency: 'CAD', balance: 15000.00, lastSync: '2026-01-20T10:00:00Z', accountNumber: '****7712', institution: 'Desjardins', isActive: true },
  ];

  const recentTransactions: Transaction[] = [
    { id: '1', date: '2026-01-25', description: 'Virement Stripe', amount: 2500.00, type: 'CREDIT', category: 'Ventes', reconciled: false },
    { id: '2', date: '2026-01-25', description: 'Vente #ORD-2026-0008', amount: 458.05, type: 'CREDIT', category: 'Ventes', reconciled: false },
    { id: '3', date: '2026-01-24', description: 'Google Ads', amount: 125.00, type: 'DEBIT', category: 'Marketing', reconciled: true },
    { id: '4', date: '2026-01-24', description: 'Vente #ORD-2026-0007', amount: 445.50, type: 'CREDIT', category: 'Ventes', reconciled: true },
    { id: '5', date: '2026-01-23', description: 'Postes Canada', amount: 89.50, type: 'DEBIT', category: 'Livraison', reconciled: true },
    { id: '6', date: '2026-01-22', description: 'Remboursement client', amount: 125.00, type: 'DEBIT', category: 'Remboursements', reconciled: true },
  ];

  const totalBalance = accounts.reduce((sum, acc) => {
    if (acc.currency === 'USD') {
      return sum + (acc.balance * 1.36); // Conversion approximative
    }
    return sum + acc.balance;
  }, 0);

  const pendingReconciliation = recentTransactions.filter(t => !t.reconciled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comptes bancaires</h1>
          <p className="text-gray-500">Gérez vos comptes et suivez les soldes</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Synchroniser
          </button>
          <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Ajouter compte
          </button>
        </div>
      </div>

      {/* Total Balance */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100">Solde total (CAD)</p>
            <p className="text-4xl font-bold mt-1">{totalBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
            <p className="text-emerald-200 text-sm mt-2">{accounts.length} comptes actifs</p>
          </div>
          <div className="text-right">
            <p className="text-emerald-100 text-sm">Transactions en attente</p>
            <p className="text-2xl font-bold">{pendingReconciliation}</p>
            <p className="text-emerald-200 text-sm">à rapprocher</p>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-3 gap-4">
        {accounts.map((account) => (
          <div
            key={account.id}
            onClick={() => setSelectedAccount(account)}
            className={`bg-white rounded-xl p-5 border cursor-pointer transition-all hover:shadow-md ${
              selectedAccount?.id === account.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className={`p-2 rounded-lg ${
                  account.type === 'PAYMENT_PROCESSOR' ? 'bg-purple-100' :
                  account.type === 'SAVINGS' ? 'bg-blue-100' : 'bg-emerald-100'
                }`}>
                  {account.type === 'PAYMENT_PROCESSOR' ? (
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  ) : (
                    <svg className={`w-5 h-5 ${account.type === 'SAVINGS' ? 'text-blue-600' : 'text-emerald-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l9-4 9 4v2H3V6zm0 4h18v10a2 2 0 01-2 2H5a2 2 0 01-2-2V10z" />
                    </svg>
                  )}
                </span>
                <div>
                  <p className="font-medium text-gray-900">{account.name}</p>
                  <p className="text-xs text-gray-500">{account.institution} • {account.accountNumber}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                account.currency === 'USD' ? 'bg-green-100 text-green-800' :
                account.currency === 'EUR' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {account.currency}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {account.balance.toLocaleString('fr-CA', { style: 'currency', currency: account.currency })}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Sync: {new Date(account.lastSync).toLocaleString('fr-CA')}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Transactions récentes</h3>
          <a href="/admin/comptabilite/rapprochement" className="text-sm text-emerald-600 hover:text-emerald-700">
            Voir tout →
          </a>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Montant</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {recentTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(transaction.date).toLocaleDateString('fr-CA')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{transaction.description}</td>
                <td className="px-4 py-3">
                  {transaction.category && (
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-700">
                      {transaction.category}
                    </span>
                  )}
                </td>
                <td className={`px-4 py-3 text-right font-medium ${
                  transaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.type === 'CREDIT' ? '+' : '-'}{transaction.amount.toFixed(2)} $
                </td>
                <td className="px-4 py-3 text-center">
                  {transaction.reconciled ? (
                    <span className="text-green-600">
                      <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Cash Flow Forecast */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Prévision de trésorerie (30 jours)</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Solde actuel</p>
            <p className="text-xl font-bold text-gray-900">{totalBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Entrées prévues</p>
            <p className="text-xl font-bold text-green-700">+12,500 $</p>
            <p className="text-xs text-green-600 mt-1">Ventes estimées</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600">Sorties prévues</p>
            <p className="text-xl font-bold text-red-700">-8,200 $</p>
            <p className="text-xs text-red-600 mt-1">Factures & récurrents</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">Solde prévu (30j)</p>
            <p className="text-xl font-bold text-blue-700">{(totalBalance + 12500 - 8200).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
