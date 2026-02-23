'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, Zap, Check, CheckCircle } from 'lucide-react';
import { PageHeader, Button, Modal, StatusBadge, SectionCard } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  reconciliationStatus: string;
  matchedEntryId?: string;
}

interface JournalEntry {
  id: string;
  date: string;
  entryNumber: string;
  description: string;
  totalDebits: number;
  totalCredits: number;
  type: string;
  status: string;
}

interface BankAccount {
  id: string;
  name: string;
  institution: string;
  accountNumber?: string;
  currentBalance: number;
}

export default function RapprochementPage() {
  const { t, formatCurrency, formatDate } = useI18n();
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('2026-01');
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedBankTx, setSelectedBankTx] = useState<BankTransaction | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [matching, setMatching] = useState(false);

  // Fetch bank accounts on mount
  const fetchBankAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/bank-accounts');
      if (!res.ok) throw new Error(t('admin.reconciliation.errorLoadAccounts'));
      const data = await res.json();
      setBankAccounts(data.accounts || []);
      if (data.accounts?.length > 0 && !selectedAccount) {
        setSelectedAccount(data.accounts[0].id);
      }
    } catch (err) {
      console.error('Fetch bank accounts error:', err);
      setError(err instanceof Error ? err.message : 'Impossible de charger les comptes bancaires');
    }
  }, [t, selectedAccount]);

  useEffect(() => {
    fetchBankAccounts();
  }, [fetchBankAccounts]);

  // Fetch transactions and journal entries when account or month changes
  const fetchData = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    setError(null);
    try {
      const [year, month] = selectedMonth.split('-');
      const from = `${year}-${month}-01`;
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      const [txRes, entriesRes] = await Promise.all([
        fetch(`/api/accounting/bank-transactions?bankAccountId=${selectedAccount}&from=${from}&to=${to}&limit=200`),
        fetch(`/api/accounting/entries?status=POSTED&limit=200`),
      ]);

      if (!txRes.ok) throw new Error(t('admin.reconciliation.errorLoadBankTx'));
      if (!entriesRes.ok) throw new Error(t('admin.reconciliation.errorLoadEntries'));

      const txData = await txRes.json();
      const entriesData = await entriesRes.json();

      setBankTransactions(txData.transactions || []);
      setJournalEntries(entriesData.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.reconciliation.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, selectedMonth, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const unmatchedBank = bankTransactions.filter(t => t.reconciliationStatus !== 'MATCHED');
  const unmatchedJournal = journalEntries.filter(e => {
    // Journal entries not yet matched to any bank transaction
    return !bankTransactions.some(bt => bt.matchedEntryId === e.id);
  });
  const matchedCount = bankTransactions.filter(t => t.reconciliationStatus === 'MATCHED').length;

  const currentAccount = bankAccounts.find(a => a.id === selectedAccount);
  const bankBalance = currentAccount?.currentBalance || 0;
  // Calculate book balance from journal entries (sum credits - sum debits for this account)
  const bookBalance = journalEntries.reduce((sum, e) => sum + e.totalCredits - e.totalDebits, 0);
  const difference = bankBalance - bookBalance;

  const handleMatch = (bankTx: BankTransaction) => {
    setSelectedBankTx(bankTx);
    setSelectedEntryId(null);
    setShowMatchModal(true);
  };

  const handleAutoReconcile = async () => {
    if (!selectedAccount) return;
    setReconciling(true);
    try {
      const res = await fetch('/api/accounting/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankAccountId: selectedAccount }),
      });
      if (!res.ok) throw new Error(t('admin.reconciliation.errorAutoReconcile'));
      const data = await res.json();
      const matchCount = data.result?.matched?.length || 0;
      toast.success(t('admin.reconciliation.autoReconcileComplete', { count: matchCount }));
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.reconciliation.errorReconciling'));
    } finally {
      setReconciling(false);
    }
  };

  const handleConfirmMatch = async () => {
    if (!selectedBankTx || !selectedEntryId) return;
    setMatching(true);
    try {
      const res = await fetch('/api/accounting/bank-transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedBankTx.id,
          reconciliationStatus: 'MATCHED',
          matchedEntryId: selectedEntryId,
        }),
      });
      if (!res.ok) throw new Error(t('admin.reconciliation.errorMatch'));
      setShowMatchModal(false);
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.reconciliation.errorReconciling'));
    } finally {
      setMatching(false);
    }
  };

  const theme = sectionThemes.bank;

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
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => { setError(null); fetchData(); }}
            className="text-red-700 underline font-medium hover:text-red-800"
          >
            R&eacute;essayer
          </button>
        </div>
      )}

      <PageHeader
        title={t('admin.reconciliation.title')}
        subtitle={t('admin.reconciliation.subtitle')}
        theme={theme}
        actions={
          <>
            <Button variant="secondary" icon={Upload}>{t('admin.reconciliation.importStatement')}</Button>
            <Button variant="primary" icon={Zap} onClick={handleAutoReconcile} disabled={reconciling}>
              {reconciling ? t('admin.reconciliation.autoReconciling') : t('admin.reconciliation.autoReconcile')}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <SectionCard theme={theme}>
        <div className="flex gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('admin.reconciliation.accountLabel')}</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="h-9 px-4 border border-slate-300 rounded-lg bg-white text-sm text-slate-700
                focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {bankAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.institution} - {acc.name}{acc.accountNumber ? ` (****${acc.accountNumber.slice(-4)})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('admin.reconciliation.periodLabel')}</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 px-4 border border-slate-300 rounded-lg text-sm text-slate-700
                focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </SectionCard>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.reconciliation.statementBalance')}</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(bankBalance)}</p>
        </SectionCard>
        <SectionCard theme={theme}>
          <p className="text-sm text-slate-500">{t('admin.reconciliation.bookBalance')}</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(bookBalance)}</p>
        </SectionCard>
        <div className={`rounded-xl p-4 border ${difference === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`text-sm ${difference === 0 ? 'text-green-600' : 'text-red-600'}`}>{t('admin.reconciliation.difference')}</p>
          <p className={`text-2xl font-bold ${difference === 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatCurrency(difference)}
          </p>
        </div>
        <div className={`rounded-xl p-4 border ${theme.borderLight} ${theme.surfaceLight}`}>
          <p className="text-sm text-sky-600">{t('admin.reconciliation.progress')}</p>
          <p className="text-2xl font-bold text-sky-700">{bankTransactions.length > 0 ? Math.round((matchedCount / bankTransactions.length) * 100) : 0}%</p>
          <p className="text-xs text-sky-600">{matchedCount}/{bankTransactions.length} {t('admin.reconciliation.reconciled')}</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Bank Transactions */}
        <SectionCard
          title={`${t('admin.reconciliation.bankStatement')} (${unmatchedBank.length} ${t('admin.reconciliation.unreconciled')})`}
          theme={theme}
          noPadding
        >
          <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-slate-500">{t('admin.reconciliation.dateCol')}</th>
                  <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-slate-500">{t('admin.reconciliation.descriptionCol')}</th>
                  <th scope="col" className="px-3 py-2 text-end text-xs font-semibold text-slate-500">{t('admin.reconciliation.amountCol')}</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-semibold text-slate-500">{t('admin.reconciliation.actionCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {bankTransactions.map((tx) => (
                  <tr key={tx.id} className={tx.reconciliationStatus === 'MATCHED' ? 'bg-green-50/50' : 'bg-yellow-50/50'}>
                    <td className="px-3 py-2 text-sm">{formatDate(tx.date)}</td>
                    <td className="px-3 py-2 text-sm truncate max-w-[150px]" title={tx.description}>{tx.description}</td>
                    <td className={`px-3 py-2 text-sm text-end font-medium ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {tx.reconciliationStatus === 'MATCHED' ? (
                        <span className="text-green-600">
                          <Check className="w-4 h-4 inline" />
                        </span>
                      ) : (
                        <button
                          onClick={() => handleMatch(tx)}
                          className={`px-2 py-1 ${theme.surfaceLight} text-sky-700 rounded text-xs hover:bg-sky-100`}
                        >
                          {t('admin.reconciliation.reconcileBtn')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {bankTransactions.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">{t('admin.reconciliation.noBankTransactions')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Journal Entries */}
        <SectionCard
          title={`${t('admin.reconciliation.journalEntries')} (${unmatchedJournal.length} ${t('admin.reconciliation.unreconciledEntries')})`}
          theme={theme}
          noPadding
        >
          <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-slate-500">{t('admin.reconciliation.dateCol')}</th>
                  <th scope="col" className="px-3 py-2 text-start text-xs font-semibold text-slate-500">{t('admin.reconciliation.descriptionCol')}</th>
                  <th scope="col" className="px-3 py-2 text-end text-xs font-semibold text-slate-500">{t('admin.reconciliation.amountCol')}</th>
                  <th scope="col" className="px-3 py-2 text-center text-xs font-semibold text-slate-500">{t('admin.reconciliation.statusCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {journalEntries.map((entry) => {
                  const isMatched = bankTransactions.some(bt => bt.matchedEntryId === entry.id);
                  const amount = Math.max(entry.totalDebits, entry.totalCredits);
                  return (
                    <tr key={entry.id} className={isMatched ? 'bg-green-50/50' : 'bg-yellow-50/50'}>
                      <td className="px-3 py-2 text-sm">{formatDate(entry.date)}</td>
                      <td className="px-3 py-2">
                        <p className="text-sm truncate max-w-[150px]" title={entry.description}>{entry.description}</p>
                        <p className="text-xs text-slate-500">{entry.entryNumber}</p>
                      </td>
                      <td className="px-3 py-2 text-sm text-end font-medium text-slate-700">
                        {formatCurrency(amount)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {isMatched ? (
                          <span className="text-green-600">
                            <Check className="w-4 h-4 inline" />
                          </span>
                        ) : (
                          <StatusBadge variant="warning">{t('admin.reconciliation.pending')}</StatusBadge>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {journalEntries.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">{t('admin.reconciliation.noJournalEntries')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      {/* Complete Reconciliation Button */}
      {difference === 0 && unmatchedBank.length === 0 && bankTransactions.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-green-600 mb-3" />
          <h3 className="text-lg font-semibold text-green-900 mb-2">{t('admin.reconciliation.reconciliationComplete')}</h3>
          <p className="text-green-700 mb-4">{t('admin.reconciliation.allTransactionsReconciled')}</p>
          <Button variant="primary" className={`${theme.btnPrimary} border-transparent text-white`}>
            {t('admin.reconciliation.validateReconciliation')}
          </Button>
        </div>
      )}

      {/* Match Modal */}
      <Modal
        isOpen={showMatchModal && !!selectedBankTx}
        onClose={() => setShowMatchModal(false)}
        title={t('admin.reconciliation.matchTransaction')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowMatchModal(false)}>{t('admin.reconciliation.cancel')}</Button>
            <Button
              variant="primary"
              onClick={handleConfirmMatch}
              disabled={!selectedEntryId || matching}
            >
              {matching ? t('admin.reconciliation.matching') : t('admin.reconciliation.reconcileBtn')}
            </Button>
          </>
        }
      >
        {selectedBankTx && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-blue-600">{t('admin.reconciliation.bankTransaction')}</p>
              <p className="font-medium text-blue-900">{selectedBankTx.description}</p>
              <p className="text-lg font-bold text-blue-900">
                {selectedBankTx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(selectedBankTx.amount)}
              </p>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">{t('admin.reconciliation.selectMatchingEntry')}</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {unmatchedJournal
                  .filter(e => {
                    const entryAmount = Math.max(e.totalDebits, e.totalCredits);
                    return Math.abs(entryAmount - selectedBankTx.amount) < 0.01;
                  })
                  .map((entry) => {
                    const entryAmount = Math.max(entry.totalDebits, entry.totalCredits);
                    return (
                      <label key={entry.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer">
                        <input
                          type="radio"
                          name="matchEntry"
                          className="text-emerald-600"
                          checked={selectedEntryId === entry.id}
                          onChange={() => setSelectedEntryId(entry.id)}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{entry.description}</p>
                          <p className="text-xs text-slate-500">{entry.entryNumber} &bull; {formatDate(entry.date)}</p>
                        </div>
                        <span className="font-medium text-slate-700">
                          {formatCurrency(entryAmount)}
                        </span>
                      </label>
                    );
                  })}
                {unmatchedJournal.filter(e => Math.abs(Math.max(e.totalDebits, e.totalCredits) - selectedBankTx.amount) < 0.01).length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">{t('admin.reconciliation.noMatchingEntry')}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
