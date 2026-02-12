'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Plus, CreditCard, Landmark, PiggyBank, Check } from 'lucide-react';
import { PageHeader, Button, StatusBadge } from '@/components/admin';

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
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBankAccounts();
  }, []);

  const fetchBankAccounts = async () => {
    try {
      const res = await fetch('/api/accounting/bank-accounts');
      const json = await res.json();
      if (json.accounts) {
        const mapped: BankAccount[] = json.accounts.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          name: a.name as string,
          type: mapBankType(a.type as string),
          currency: (a.currency as string) || 'CAD',
          balance: Number(a.currentBalance) || 0,
          lastSync: (a.lastSyncAt as string) || new Date().toISOString(),
          accountNumber: (a.accountNumber as string) || '',
          institution: (a.institution as string) || '',
          isActive: a.isActive as boolean,
        }));
        setAccounts(mapped);
      }
    } catch (err) {
      console.error('Error fetching bank accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const mapBankType = (type: string): BankAccount['type'] => {
    if (type === 'SAVINGS') return 'SAVINGS';
    if (type === 'STRIPE' || type === 'PAYPAL' || type === 'PAYMENT_PROCESSOR') return 'PAYMENT_PROCESSOR';
    return 'CHECKING';
  };

  // Fetch recent transactions from bank-transactions API
  useEffect(() => {
    fetchRecentTransactions();
  }, []);

  const fetchRecentTransactions = async () => {
    try {
      const res = await fetch('/api/accounting/bank-transactions?limit=6');
      const json = await res.json();
      if (json.transactions) {
        const mapped: Transaction[] = json.transactions.map((t: Record<string, unknown>) => ({
          id: t.id as string,
          date: (t.date as string) || (t.createdAt as string) || '',
          description: (t.description as string) || '',
          amount: Math.abs(Number(t.amount) || 0),
          type: Number(t.amount) >= 0 ? 'CREDIT' : 'DEBIT',
          category: (t.category as string) || undefined,
          reconciled: (t.reconciled as boolean) || false,
        }));
        setRecentTransactions(mapped);
      }
    } catch (err) {
      console.error('Error fetching recent transactions:', err);
    }
  };

  const totalBalance = accounts.reduce((sum, acc) => {
    if (acc.currency === 'USD') {
      return sum + (acc.balance * 1.36); // Conversion approximative
    }
    return sum + acc.balance;
  }, 0);

  const pendingReconciliation = recentTransactions.filter(t => !t.reconciled).length;

  const getAccountIcon = (type: BankAccount['type']) => {
    switch (type) {
      case 'PAYMENT_PROCESSOR': return CreditCard;
      case 'SAVINGS': return PiggyBank;
      default: return Landmark;
    }
  };

  const getAccountIconColor = (type: BankAccount['type']) => {
    switch (type) {
      case 'PAYMENT_PROCESSOR': return 'text-purple-600';
      case 'SAVINGS': return 'text-blue-600';
      default: return 'text-emerald-600';
    }
  };

  const getAccountIconBg = (type: BankAccount['type']) => {
    switch (type) {
      case 'PAYMENT_PROCESSOR': return 'bg-purple-100';
      case 'SAVINGS': return 'bg-blue-100';
      default: return 'bg-emerald-100';
    }
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptes bancaires"
        subtitle="G\u00e9rez vos comptes et suivez les soldes"
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw}>Synchroniser</Button>
            <Button variant="primary" icon={Plus}>Ajouter compte</Button>
          </>
        }
      />

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
            <p className="text-emerald-200 text-sm">\u00e0 rapprocher</p>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-3 gap-4">
        {accounts.map((account) => {
          const Icon = getAccountIcon(account.type);
          return (
            <div
              key={account.id}
              onClick={() => setSelectedAccount(account)}
              className={`bg-white rounded-xl p-5 border cursor-pointer transition-all hover:shadow-md ${
                selectedAccount?.id === account.id ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`p-2 rounded-lg ${getAccountIconBg(account.type)}`}>
                    <Icon className={`w-5 h-5 ${getAccountIconColor(account.type)}`} />
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">{account.name}</p>
                    <p className="text-xs text-slate-500">{account.institution} &bull; {account.accountNumber}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  account.currency === 'USD' ? 'bg-green-100 text-green-800' :
                  account.currency === 'EUR' ? 'bg-blue-100 text-blue-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {account.currency}
                </span>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {account.balance.toLocaleString('fr-CA', { style: 'currency', currency: account.currency })}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                Sync: {account.lastSync ? new Date(account.lastSync).toLocaleString('fr-CA') : 'Jamais'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Transactions r\u00e9centes</h3>
          <a href="/admin/comptabilite/rapprochement" className="text-sm text-emerald-600 hover:text-emerald-700">
            Voir tout &rarr;
          </a>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cat\u00e9gorie</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Montant</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {recentTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm text-slate-900">
                  {transaction.date ? new Date(transaction.date).toLocaleDateString('fr-CA') : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-900">{transaction.description}</td>
                <td className="px-4 py-3">
                  {transaction.category && (
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-700">
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
                      <Check className="w-5 h-5 inline" />
                    </span>
                  ) : (
                    <StatusBadge variant="warning">En attente</StatusBadge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cash Flow Forecast */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Pr\u00e9vision de tr\u00e9sorerie (30 jours)</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">Solde actuel</p>
            <p className="text-xl font-bold text-slate-900">{totalBalance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">Entr\u00e9es pr\u00e9vues</p>
            <p className="text-xl font-bold text-green-700">+12,500 $</p>
            <p className="text-xs text-green-600 mt-1">Ventes estim\u00e9es</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600">Sorties pr\u00e9vues</p>
            <p className="text-xl font-bold text-red-700">-8,200 $</p>
            <p className="text-xs text-red-600 mt-1">Factures &amp; r\u00e9currents</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">Solde pr\u00e9vu (30j)</p>
            <p className="text-xl font-bold text-blue-700">{(totalBalance + 12500 - 8200).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
