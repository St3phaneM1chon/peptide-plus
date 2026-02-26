'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Plus, CreditCard, Landmark, PiggyBank, Check } from 'lucide-react';
import { PageHeader, Button, StatusBadge, SectionCard } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

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
  const { t, formatCurrency, formatDate, locale } = useI18n();
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});
  const [expectedInflows, setExpectedInflows] = useState(0);
  const [expectedOutflows, setExpectedOutflows] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchBankAccounts = useCallback(async () => {
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
      console.error(err);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchCurrencyRates = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/currencies');
      const json = await res.json();
      if (json.currencies) {
        const rates: Record<string, number> = {};
        for (const c of json.currencies) {
          rates[c.code] = Number(c.exchangeRate) || 1;
        }
        setCurrencyRates(rates);
      }
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
  }, [t]);

  const fetchExpectedInflows = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/customer-invoices?status=PENDING&limit=1000');
      const json = await res.json();
      if (json.invoices) {
        const total = json.invoices.reduce(
          (sum: number, inv: { total: number; amountPaid?: number }) =>
            sum + (Number(inv.total) - Number(inv.amountPaid || 0)),
          0
        );
        setExpectedInflows(total);
      }
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
  }, [t]);

  const fetchExpectedOutflows = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/recurring');
      if (!res.ok) {
        setExpectedOutflows(0);
        return;
      }
      const json = await res.json();
      if (json.entries) {
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const frequencyMultiplier: Record<string, number> = {
          DAILY: 30,
          WEEKLY: 4,
          BIWEEKLY: 2,
          MONTHLY: 1,
          QUARTERLY: 1 / 3,
          YEARLY: 1 / 12,
        };

        const total = json.entries
          .filter((entry: { nextRunDate?: string; isActive?: boolean }) => {
            if (entry.isActive === false) return false;
            if (!entry.nextRunDate) return true;
            return new Date(entry.nextRunDate) <= thirtyDaysFromNow;
          })
          .reduce((sum: number, entry: { amount: number; frequency?: string }) => {
            const multiplier = frequencyMultiplier[entry.frequency || 'MONTHLY'] || 1;
            return sum + Math.abs(Number(entry.amount)) * multiplier;
          }, 0);

        setExpectedOutflows(total);
      }
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
  }, [t]);

  const mapBankType = (type: string): BankAccount['type'] => {
    if (type === 'SAVINGS') return 'SAVINGS';
    if (type === 'STRIPE' || type === 'PAYPAL' || type === 'PAYMENT_PROCESSOR') return 'PAYMENT_PROCESSOR';
    return 'CHECKING';
  };

  // Fetch recent transactions from bank-transactions API
  const fetchRecentTransactions = useCallback(async () => {
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
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
  }, [t]);

  useEffect(() => {
    Promise.all([
      fetchBankAccounts(),
      fetchCurrencyRates(),
      fetchExpectedInflows(),
      fetchExpectedOutflows(),
      fetchRecentTransactions(),
    ]);
  }, [fetchBankAccounts, fetchCurrencyRates, fetchExpectedInflows, fetchExpectedOutflows, fetchRecentTransactions]);

  const totalBalance = accounts.reduce((sum, acc) => {
    if (acc.currency !== 'CAD') {
      const rate = currencyRates[acc.currency] || 1;
      return sum + (acc.balance * rate);
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

  const theme = sectionThemes.bank;

  // Ribbon actions
  const handleRibbonSynchronize = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/bank-sync', { method: 'POST', headers: addCSRFHeader() });
      if (!res.ok) throw new Error();
      toast.success(t('admin.banking.syncSuccess') || 'Synchronisation bancaire lancee');
      fetchBankAccounts();
      fetchRecentTransactions();
    } catch {
      toast.error(t('admin.banking.syncError') || 'Erreur de synchronisation. Verifiez les connexions bancaires.');
    }
  }, [fetchBankAccounts, fetchRecentTransactions, t]);
  const handleRibbonImportStatement = useCallback(() => {
    window.location.href = '/admin/comptabilite/import-bancaire';
  }, []);
  const handleRibbonReconcile = useCallback(() => {
    window.location.href = '/admin/comptabilite/rapprochement';
  }, []);
  const handleRibbonAutoMatch = useCallback(() => {
    window.location.href = '/admin/comptabilite/rapprochement';
  }, []);
  const handleRibbonBankRules = useCallback(() => {
    window.location.href = '/admin/comptabilite/regles-bancaires';
  }, []);
  const handleRibbonExport = useCallback(() => {
    if (recentTransactions.length === 0) { toast.error(t('admin.banking.noTransactionsToExport') || 'Aucune transaction a exporter'); return; }
    const bom = '\uFEFF';
    const headers = [t('admin.banking.colDate') || 'Date', t('admin.banking.colDescription') || 'Description', t('admin.banking.colAmount') || 'Montant', t('admin.banking.colType') || 'Type', t('admin.banking.colReconciled') || 'Rapproche'];
    const rows = recentTransactions.map(tx => [tx.date, tx.description, String(tx.amount), tx.type || '', tx.reconciled ? 'Oui' : 'Non']);
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `transactions-bancaires-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.banking.exportSuccess') || `${recentTransactions.length} transactions exportees`);
  }, [recentTransactions, t]);

  useRibbonAction('synchronize', handleRibbonSynchronize);
  useRibbonAction('importStatement', handleRibbonImportStatement);
  useRibbonAction('reconcile', handleRibbonReconcile);
  useRibbonAction('autoMatch', handleRibbonAutoMatch);
  useRibbonAction('bankRules', handleRibbonBankRules);
  useRibbonAction('export', handleRibbonExport);

  if (loading) return (
    <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.bankAccounts.title')}
        subtitle={t('admin.bankAccounts.subtitle')}
        theme={theme}
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw}>{t('admin.bankAccounts.sync')}</Button>
            <Button variant="primary" icon={Plus}>{t('admin.bankAccounts.addAccount')}</Button>
          </>
        }
      />

      {/* Total Balance */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-emerald-100">{t('admin.bankAccounts.totalBalanceCAD')}</p>
            <p className="text-4xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
            <p className="text-emerald-200 text-sm mt-2">{accounts.length} {t('admin.bankAccounts.activeAccounts')}</p>
          </div>
          <div className="text-end">
            <p className="text-emerald-100 text-sm">{t('admin.bankAccounts.pendingTransactions')}</p>
            <p className="text-2xl font-bold">{pendingReconciliation}</p>
            <p className="text-emerald-200 text-sm">{t('admin.bankAccounts.toReconcile')}</p>
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                {new Intl.NumberFormat(locale, { style: 'currency', currency: account.currency }).format(account.balance)}
              </p>
              <p className="text-xs text-slate-500 mt-2">
                {t('admin.bankAccounts.syncPrefix')} {account.lastSync ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(account.lastSync)) : t('admin.bankAccounts.never')}
              </p>
            </div>
          );
        })}
      </div>

      {/* Recent Transactions */}
      <SectionCard
        title={t('admin.bankAccounts.recentTransactions')}
        theme={theme}
        noPadding
        headerAction={
          <a href="/admin/comptabilite/rapprochement" className="text-sm text-sky-600 hover:text-sky-700 font-medium">
            {t('admin.bankAccounts.viewAll')} &rarr;
          </a>
        }
      >
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.bankAccounts.dateCol')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.bankAccounts.descriptionCol')}</th>
              <th scope="col" className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.bankAccounts.categoryCol')}</th>
              <th scope="col" className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.bankAccounts.amountCol')}</th>
              <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.bankAccounts.statusCol')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {recentTransactions.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm text-slate-900">
                  {transaction.date ? formatDate(transaction.date) : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-900">{transaction.description}</td>
                <td className="px-4 py-3">
                  {transaction.category && (
                    <span className="px-2 py-0.5 bg-slate-100 rounded text-xs text-slate-700">
                      {transaction.category}
                    </span>
                  )}
                </td>
                <td className={`px-4 py-3 text-end font-medium ${
                  transaction.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {transaction.type === 'CREDIT' ? '+' : '-'}{formatCurrency(transaction.amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  {transaction.reconciled ? (
                    <span className="text-green-600">
                      <Check className="w-5 h-5 inline" />
                    </span>
                  ) : (
                    <StatusBadge variant="warning">{t('admin.bankAccounts.pending')}</StatusBadge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </SectionCard>

      {/* Cash Flow Forecast */}
      <SectionCard title={t('admin.bankAccounts.cashFlowForecast')} theme={theme}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-500">{t('admin.bankAccounts.currentBalance')}</p>
            <p className="text-xl font-bold text-slate-900">{formatCurrency(totalBalance)}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-600">{t('admin.bankAccounts.expectedInflows')}</p>
            <p className="text-xl font-bold text-green-700">+{formatCurrency(expectedInflows)}</p>
            <p className="text-xs text-green-600 mt-1">{t('admin.bankAccounts.estimatedSales')}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-600">{t('admin.bankAccounts.expectedOutflows')}</p>
            <p className="text-xl font-bold text-red-700">-{formatCurrency(expectedOutflows)}</p>
            <p className="text-xs text-red-600 mt-1">{t('admin.bankAccounts.invoicesAndRecurring')}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-600">{t('admin.bankAccounts.projectedBalance30d')}</p>
            <p className="text-xl font-bold text-blue-700">{formatCurrency(totalBalance + expectedInflows - expectedOutflows)}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
