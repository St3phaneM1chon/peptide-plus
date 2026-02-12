'use client';

import { useState, useEffect, useCallback } from 'react';
import { Printer, Download, Check, Clock } from 'lucide-react';
import { PageHeader, Button } from '@/components/admin';

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

interface AccountOption {
  code: string;
  name: string;
  balance: number;
}

interface LedgerAccount {
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: string;
  entries: Array<{
    entryNumber: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  balance: number;
}

export default function GrandLivrePage() {
  const [selectedAccount, setSelectedAccount] = useState('1010');
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-01-31');
  const [searchTerm, setSearchTerm] = useState('');
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerSummary, setLedgerSummary] = useState<{ totalDebits: number; totalCredits: number; balance: number }>({ totalDebits: 0, totalCredits: 0, balance: 0 });

  // Fetch chart of accounts for dropdown
  useEffect(() => {
    fetchChartOfAccounts();
  }, []);

  const fetchChartOfAccounts = async () => {
    try {
      const res = await fetch('/api/accounting/chart-of-accounts');
      const json = await res.json();
      if (json.accounts) {
        const mapped: AccountOption[] = json.accounts.map((a: Record<string, unknown>) => ({
          code: a.code as string,
          name: a.name as string,
          balance: 0,
        }));
        setAccounts(mapped);
      }
    } catch (err) {
      console.error('Error fetching chart of accounts:', err);
    }
  };

  const fetchLedgerEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccount) params.set('accountCode', selectedAccount);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/accounting/general-ledger?${params.toString()}`);
      const json = await res.json();

      if (json.accounts && json.accounts.length > 0) {
        const ledgerAccount: LedgerAccount = json.accounts[0];
        const mapped: Transaction[] = ledgerAccount.entries.map((entry, idx) => ({
          id: String(idx + 1),
          date: entry.date,
          journalEntry: entry.entryNumber,
          description: entry.description,
          accountCode: ledgerAccount.accountCode,
          accountName: ledgerAccount.accountName,
          debit: entry.debit,
          credit: entry.credit,
          balance: entry.balance,
          reconciled: false,
        }));
        setTransactions(mapped);
        setLedgerSummary({
          totalDebits: ledgerAccount.totalDebits,
          totalCredits: ledgerAccount.totalCredits,
          balance: ledgerAccount.balance,
        });
        // Update account balance in list
        setAccounts(prev => prev.map(a =>
          a.code === ledgerAccount.accountCode
            ? { ...a, balance: ledgerAccount.balance }
            : a
        ));
      } else {
        setTransactions([]);
        setLedgerSummary({ totalDebits: 0, totalCredits: 0, balance: 0 });
      }
    } catch (err) {
      console.error('Error fetching general ledger:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, dateFrom, dateTo]);

  // Fetch ledger entries when account or dates change
  useEffect(() => {
    fetchLedgerEntries();
  }, [fetchLedgerEntries]);

  const filteredTransactions = transactions.filter(t => {
    if (searchTerm && !t.description.toLowerCase().includes(searchTerm.toLowerCase()) && !t.reference?.includes(searchTerm)) {
      return false;
    }
    return true;
  });

  const totalDebit = filteredTransactions.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = filteredTransactions.reduce((sum, t) => sum + t.credit, 0);
  const currentAccount = accounts.find(a => a.code === selectedAccount);

  if (loading && accounts.length === 0) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grand Livre"
        subtitle="Historique d\u00e9taill\u00e9 des transactions par compte"
        actions={
          <>
            <Button variant="secondary" icon={Printer}>Imprimer</Button>
            <Button variant="primary" icon={Download}>Exporter PDF</Button>
          </>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">Compte</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-700
                focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {accounts.map(account => (
                <option key={account.code} value={account.code}>
                  {account.code} - {account.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm text-slate-700
                focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm text-slate-700
                focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Recherche</label>
            <input
              type="text"
              placeholder="Description, r\u00e9f\u00e9rence..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm text-slate-700
                placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Account Summary */}
      <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-emerald-600 font-medium">Compte s\u00e9lectionn\u00e9</p>
            <h2 className="text-xl font-bold text-emerald-900">{currentAccount?.code} - {currentAccount?.name}</h2>
          </div>
          <div className="text-right">
            <p className="text-sm text-emerald-600">Solde actuel</p>
            <p className="text-3xl font-bold text-emerald-900">
              {(ledgerSummary.balance || currentAccount?.balance || 0).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
            </p>
          </div>
        </div>
      </div>

      {/* Loading indicator for entries */}
      {loading && (
        <div className="p-4 text-center text-slate-500">Chargement des \u00e9critures...</div>
      )}

      {/* Transactions Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">N\u00b0 \u00c9criture</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Description</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">R\u00e9f\u00e9rence</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">D\u00e9bit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Cr\u00e9dit</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Solde</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Rapp.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-900">
                    {new Date(transaction.date).toLocaleDateString('fr-CA')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-blue-600 hover:underline cursor-pointer">
                      {transaction.journalEntry}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900 max-w-xs truncate">
                    {transaction.description}
                  </td>
                  <td className="px-4 py-3">
                    {transaction.reference && (
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-xs font-mono text-slate-600">
                        {transaction.reference}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {transaction.debit > 0 && (
                      <span className="font-medium text-slate-900">
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
                  <td className="px-4 py-3 text-right font-medium text-slate-900">
                    {transaction.balance.toLocaleString('fr-CA', { minimumFractionDigits: 2 })} $
                  </td>
                  <td className="px-4 py-3 text-center">
                    {transaction.reconciled ? (
                      <span className="text-green-600">
                        <Check className="w-5 h-5 inline" />
                      </span>
                    ) : (
                      <span className="text-slate-300">
                        <Clock className="w-5 h-5 inline" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-900">
                  Total p\u00e9riode
                </td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">
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
      <div className="flex items-center gap-6 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600" />
          <span>Rapproch\u00e9</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-300" />
          <span>En attente de rapprochement</span>
        </div>
      </div>
    </div>
  );
}
