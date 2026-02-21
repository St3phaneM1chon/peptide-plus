'use client';

import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { PageHeader, SectionCard } from '@/components/admin';
import { toast } from 'sonner';

interface BankConnection {
  id: string;
  bankName: string;
  accountName: string;
  accountMask: string;
  balance: number;
  currency: string;
  lastSync: Date;
  status: 'ACTIVE' | 'REQUIRES_REAUTH' | 'ERROR';
}

interface BankAccount {
  id: string;
  name: string;
  institution: string;
  accountNumber?: string;
  currentBalance: number;
  currency: string;
  isActive: boolean;
}

interface ImportedTransaction {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  category?: string;
  suggestedAccount?: string;
  confidence: number;
  selected: boolean;
}

interface ImportHistoryItem {
  date: string;
  source: string;
  count: number;
  importBatch: string;
}

export default function BankImportPage() {
  const { t, formatCurrency, formatDate, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'connections' | 'import' | 'history'>('connections');
  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState('');

  const [importedTransactions, setImportedTransactions] = useState<ImportedTransaction[]>([]);
  const [importing, setImporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFormat, setCsvFormat] = useState<'desjardins' | 'td' | 'rbc' | 'generic'>('desjardins');

  // Fetch bank accounts on mount
  useEffect(() => {
    async function fetchBankAccounts() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/accounting/bank-accounts');
        if (!res.ok) throw new Error(t('admin.bankImport.errorLoadAccounts'));
        const data = await res.json();
        const accounts = data.accounts || [];
        setBankAccounts(accounts);
        if (accounts.length > 0 && !selectedBankAccountId) {
          setSelectedBankAccountId(accounts[0].id);
        }
        // Map bank accounts to connections format for the connections tab
        setConnections(accounts.filter((a: BankAccount) => a.isActive).map((a: BankAccount) => ({
          id: a.id,
          bankName: a.institution,
          accountName: a.name,
          accountMask: a.accountNumber ? `****${a.accountNumber.slice(-4)}` : '',
          balance: a.currentBalance,
          currency: a.currency || 'CAD',
          lastSync: new Date(),
          status: 'ACTIVE' as const,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : t('admin.bankImport.errorLoading'));
      } finally {
        setLoading(false);
      }
    }
    fetchBankAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch import history (recent bank transactions grouped by importBatch)
  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch('/api/accounting/bank-transactions?limit=200');
        if (!res.ok) return;
        const data = await res.json();
        const transactions = data.transactions || [];
        // Group by importBatch
        const batches: Record<string, { date: string; count: number; source: string }> = {};
        for (const tx of transactions) {
          const batch = tx.importBatch || 'manual';
          if (!batches[batch]) {
            batches[batch] = {
              date: tx.importedAt || tx.date,
              count: 0,
              source: tx.bankAccount?.institution || 'Import CSV',
            };
          }
          batches[batch].count++;
        }
        setImportHistory(Object.entries(batches).map(([key, val]) => ({
          importBatch: key,
          date: val.date,
          source: val.source,
          count: val.count,
        })));
      } catch {
        // silent - history is non-critical
      }
    }
    fetchHistory();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Parse the uploaded CSV file
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', csvFormat);

      const response = await fetch('/api/accounting/bank-import/parse', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      const txs = (data.transactions || []).map((t: ImportedTransaction, i: number) => ({
        ...t,
        id: t.id || `import-${i}`,
        date: new Date(t.date),
        selected: true,
        confidence: t.confidence || 0.5,
      }));
      setImportedTransactions(txs);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setImportedTransactions([]);
    } finally {
      setImporting(false);
      setActiveTab('import');
    }
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(true);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Update last sync
    setConnections(prev => prev.map(c =>
      c.id === connectionId ? { ...c, lastSync: new Date() } : c
    ));

    setSyncing(false);
    toast.success(t('admin.bankImport.syncComplete'));
  };

  const handleImportSelected = async () => {
    const selected = importedTransactions.filter(t => t.selected);
    if (selected.length === 0) return;
    if (!selectedBankAccountId) {
      toast.error(t('admin.bankImport.selectAccountAlert'));
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/accounting/bank-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankAccountId: selectedBankAccountId,
          transactions: selected.map(t => ({
            date: t.date instanceof Date ? t.date.toISOString() : t.date,
            description: t.description,
            amount: t.amount,
            type: t.type,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || t('admin.bankImport.errorImport'));
      }

      const data = await res.json();
      toast.success(t('admin.bankImport.importSuccess', { count: data.imported }));
      setImportedTransactions([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.bankImport.errorDuringImport'));
    } finally {
      setImporting(false);
    }
  };

  const toggleTransaction = (id: string) => {
    setImportedTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, selected: !t.selected } : t
    ));
  };

  const toggleAll = () => {
    const allSelected = importedTransactions.every(t => t.selected);
    setImportedTransactions(prev => prev.map(t => ({ ...t, selected: !allSelected })));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
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
  if (error) return <div className="p-8 text-center text-red-400">{t('admin.bankImport.errorPrefix')} {error}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('admin.bankImport.title')}
        subtitle={t('admin.bankImport.subtitle')}
        theme={theme}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {[
          { id: 'connections', label: t('admin.bankImport.tabConnections') },
          { id: 'import', label: t('admin.bankImport.tabImportCSV') },
          { id: 'history', label: t('admin.bankImport.tabHistory') },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? `${theme.btnPrimary} text-white`
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Connexions Tab */}
      {activeTab === 'connections' && (
        <div className="space-y-6">
          {/* Existing connections */}
          <div className="grid gap-4">
            {connections.map(conn => (
              <SectionCard key={conn.id} theme={theme}>
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 ${theme.statIconBg} rounded-xl flex items-center justify-center`}>
                      <span className={`text-lg font-bold ${theme.statIconColor}`}>B</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{conn.bankName}</h3>
                      <p className="text-sm text-slate-500">{conn.accountName} &bull; {conn.accountMask}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {t('admin.bankImport.lastSync')} {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(conn.lastSync)}
                      </p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-xl font-bold text-slate-900">
                      {new Intl.NumberFormat(locale, { style: 'currency', currency: conn.currency }).format(conn.balance)}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      conn.status === 'ACTIVE' ? 'bg-green-50 text-green-700' :
                      conn.status === 'REQUIRES_REAUTH' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {conn.status === 'ACTIVE' ? t('admin.bankImport.connected') :
                       conn.status === 'REQUIRES_REAUTH' ? t('admin.bankImport.reauthRequired') : t('admin.bankImport.errorStatus')}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncing}
                    className={`px-3 py-1.5 ${theme.btnPrimary} text-white text-sm rounded-lg disabled:opacity-50`}
                  >
                    {syncing ? t('admin.bankImport.syncing') : t('admin.bankImport.syncBtn')}
                  </button>
                  <button className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg">
                    {t('admin.bankImport.settingsBtn')}
                  </button>
                  <button className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm rounded-lg">
                    {t('admin.bankImport.disconnect')}
                  </button>
                </div>
              </SectionCard>
            ))}
            {connections.length === 0 && (
              <SectionCard theme={theme} className="text-center">
                <p className="text-slate-400">{t('admin.bankImport.noAccountsConfigured')}</p>
              </SectionCard>
            )}
          </div>

          {/* Add new connection */}
          <div className="bg-white rounded-xl p-6 border-2 border-dashed border-slate-300">
            <div className="text-center">
              <p className="text-lg font-medium text-slate-900 mb-2">{t('admin.bankImport.connectNewAccount')}</p>
              <p className="text-sm text-slate-500 mb-4">{t('admin.bankImport.connectNewAccountDesc')}</p>
              <div className="flex justify-center gap-4">
                <button className={`px-4 py-2 ${theme.btnPrimary} text-white rounded-lg`}>
                  {t('admin.bankImport.connectViaPlaid')}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                {t('admin.bankImport.secureConnection')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {importedTransactions.length === 0 ? (
            <div className="bg-white rounded-xl p-8 border-2 border-dashed border-slate-300">
              <div className="text-center">
                <div className={`w-16 h-16 mx-auto mb-4 ${theme.statIconBg} rounded-2xl flex items-center justify-center`}>
                  <span className={`text-2xl font-bold ${theme.statIconColor}`}>CSV</span>
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">{t('admin.bankImport.importBankStatement')}</h3>
                <p className="text-sm text-slate-500 mb-4">{t('admin.bankImport.supportedFormats')}</p>

                <div className="flex justify-center gap-4 mb-4">
                  <select
                    value={csvFormat}
                    onChange={e => setCsvFormat(e.target.value as typeof csvFormat)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="desjardins">Desjardins</option>
                    <option value="td">TD Canada Trust</option>
                    <option value="rbc">RBC</option>
                    <option value="generic">{t('admin.bankImport.genericCSV')}</option>
                  </select>

                  {bankAccounts.length > 0 && (
                    <select
                      value={selectedBankAccountId}
                      onChange={e => setSelectedBankAccountId(e.target.value)}
                      className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    >
                      {bankAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.institution} - {acc.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className={`px-4 py-2 ${theme.btnPrimary} text-white rounded-lg disabled:opacity-50`}
                  >
                    {importing ? t('admin.bankImport.analyzing') : t('admin.bankImport.selectCSVFile')}
                  </button>
                </div>

                <p className="text-xs text-slate-400">
                  {t('admin.bankImport.autoCategorize')}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Bank account selector for import */}
              {bankAccounts.length > 0 && (
                <SectionCard theme={theme}>
                  <label className="text-sm text-slate-600 me-3">{t('admin.bankImport.destinationAccount')}</label>
                  <select
                    value={selectedBankAccountId}
                    onChange={e => setSelectedBankAccountId(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    {bankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.institution} - {acc.name}
                      </option>
                    ))}
                  </select>
                </SectionCard>
              )}

              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <SectionCard theme={theme}>
                  <p className="text-sm text-slate-500">{t('admin.bankImport.transactions')}</p>
                  <p className="text-2xl font-bold text-slate-900">{importedTransactions.length}</p>
                </SectionCard>
                <SectionCard theme={theme}>
                  <p className="text-sm text-slate-500">{t('admin.bankImport.selected')}</p>
                  <p className="text-2xl font-bold text-sky-600">{importedTransactions.filter(t => t.selected).length}</p>
                </SectionCard>
                <SectionCard theme={theme}>
                  <p className="text-sm text-slate-500">{t('admin.bankImport.avgConfidence')}</p>
                  <p className="text-2xl font-bold text-green-600">
                    {importedTransactions.length > 0 ? Math.round(importedTransactions.reduce((sum, t) => sum + t.confidence, 0) / importedTransactions.length * 100) : 0}%
                  </p>
                </SectionCard>
                <SectionCard theme={theme}>
                  <p className="text-sm text-slate-500">{t('admin.bankImport.toReview')}</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {importedTransactions.filter(t => t.confidence < 0.7).length}
                  </p>
                </SectionCard>
              </div>

              {/* Transaction list */}
              <SectionCard theme={theme} noPadding headerAction={
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importedTransactions.every(t => t.selected)}
                      onChange={toggleAll}
                      className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <span className="text-sm text-slate-600">{t('admin.bankImport.selectAll')}</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setImportedTransactions([])}
                      className="px-3 py-1.5 text-slate-500 hover:text-slate-700 text-sm"
                    >
                      {t('admin.bankImport.cancelImport')}
                    </button>
                    <button
                      onClick={handleImportSelected}
                      disabled={importing || !importedTransactions.some(t => t.selected)}
                      className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      {importing ? t('admin.bankImport.importing') : t('admin.bankImport.importCount', { count: importedTransactions.filter(tx => tx.selected).length })}
                    </button>
                  </div>
                </div>
              }>
                <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase w-10"></th>
                      <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.bankImport.dateCol')}</th>
                      <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.bankImport.descriptionCol')}</th>
                      <th className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.bankImport.amountCol')}</th>
                      <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.bankImport.suggestedCategory')}</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.bankImport.confidence')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {importedTransactions.map(tx => (
                      <tr
                        key={tx.id}
                        className={`hover:bg-slate-50 ${tx.confidence < 0.7 ? 'bg-yellow-50/50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={tx.selected}
                            onChange={() => toggleTransaction(tx.id)}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-900">
                          {formatDate(tx.date instanceof Date ? tx.date : new Date(tx.date))}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-slate-900">{tx.description}</p>
                        </td>
                        <td className={`px-4 py-3 text-end font-medium ${tx.type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.type === 'CREDIT' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            defaultValue={tx.suggestedAccount || ''}
                            className="px-2 py-1 bg-white border border-slate-300 rounded text-sm text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          >
                            <option value="">{t('admin.bankImport.unclassified')}</option>
                            <option value="1040">1040 - Stripe</option>
                            <option value="4010">4010 - {t('admin.bankImport.accountSales')}</option>
                            <option value="6010">6010 - {t('admin.bankImport.accountShipping')}</option>
                            <option value="6210">6210 - {t('admin.bankImport.accountMarketing')}</option>
                            <option value="6310">6310 - {t('admin.bankImport.accountHosting')}</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${getConfidenceColor(tx.confidence)}`}>
                            {Math.round(tx.confidence * 100)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </SectionCard>
            </>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <SectionCard title={t('admin.bankImport.tabHistory')} theme={theme} noPadding>
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.bankImport.dateCol')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.bankImport.sourceCol')}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold text-slate-500 uppercase">{t('admin.bankImport.transactionsCol')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.bankImport.statusCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {importHistory.map((item, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-900">{formatDate(item.date)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item.source}</td>
                  <td className="px-4 py-3 text-end text-sm font-medium text-slate-900">{item.count}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">{t('admin.bankImport.completed')}</span>
                  </td>
                </tr>
              ))}
              {importHistory.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t('admin.bankImport.noImportHistory')}</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
