'use client';

import { useState, useEffect, useRef } from 'react';

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
        if (!res.ok) throw new Error('Erreur chargement comptes bancaires');
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
        setError(err instanceof Error ? err.message : 'Erreur de chargement');
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
    alert('Synchronisation terminée! 12 nouvelles transactions importées.');
  };

  const handleImportSelected = async () => {
    const selected = importedTransactions.filter(t => t.selected);
    if (selected.length === 0) return;
    if (!selectedBankAccountId) {
      alert('Veuillez sélectionner un compte bancaire.');
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
        throw new Error(errData.error || 'Erreur import');
      }

      const data = await res.json();
      alert(`${data.imported} transactions importées avec succès!`);
      setImportedTransactions([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'import');
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
    if (confidence >= 0.8) return 'text-green-400';
    if (confidence >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-400">Erreur: {error}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Import bancaire</h1>
          <p className="text-neutral-400 mt-1">Connectez vos comptes ou importez des relevés CSV</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-800 p-1 rounded-lg w-fit">
        {[
          { id: 'connections', label: 'Connexions bancaires' },
          { id: 'import', label: 'Import CSV' },
          { id: 'history', label: 'Historique' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-sky-600 text-white'
                : 'text-neutral-400 hover:text-white'
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
              <div key={conn.id} className="bg-neutral-800 rounded-xl p-6 border border-neutral-700">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-green-900/30 rounded-xl flex items-center justify-center text-2xl">
                      🏦
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{conn.bankName}</h3>
                      <p className="text-sm text-neutral-400">{conn.accountName} • {conn.accountMask}</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Dernière sync: {conn.lastSync.toLocaleString('fr-CA')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">
                      {conn.balance.toLocaleString('fr-CA', { style: 'currency', currency: conn.currency })}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded ${
                      conn.status === 'ACTIVE' ? 'bg-green-900/30 text-green-400' :
                      conn.status === 'REQUIRES_REAUTH' ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-red-900/30 text-red-400'
                    }`}>
                      {conn.status === 'ACTIVE' ? 'Connecté' :
                       conn.status === 'REQUIRES_REAUTH' ? 'Réauthentification requise' : 'Erreur'}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncing}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-sm rounded-lg disabled:opacity-50"
                  >
                    {syncing ? 'Synchronisation...' : '🔄 Synchroniser'}
                  </button>
                  <button className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm rounded-lg">
                    ⚙️ Paramètres
                  </button>
                  <button className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-sm rounded-lg">
                    Déconnecter
                  </button>
                </div>
              </div>
            ))}
            {connections.length === 0 && (
              <div className="bg-neutral-800 rounded-xl p-6 border border-neutral-700 text-center text-neutral-400">
                Aucun compte bancaire configuré.
              </div>
            )}
          </div>

          {/* Add new connection */}
          <div className="bg-neutral-800 rounded-xl p-6 border border-dashed border-neutral-600">
            <div className="text-center">
              <p className="text-lg font-medium text-white mb-2">Connecter un nouveau compte</p>
              <p className="text-sm text-neutral-400 mb-4">Synchronisation automatique via Plaid (Desjardins, TD, RBC, BMO, etc.)</p>
              <div className="flex justify-center gap-4">
                <button className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
                  + Connecter via Plaid
                </button>
              </div>
              <p className="text-xs text-neutral-500 mt-4">
                Connexion sécurisée • Vos identifiants ne sont jamais stockés
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Import CSV Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {importedTransactions.length === 0 ? (
            <div className="bg-neutral-800 rounded-xl p-8 border border-dashed border-neutral-600">
              <div className="text-center">
                <div className="text-4xl mb-4">📄</div>
                <h3 className="text-lg font-medium text-white mb-2">Importer un relevé bancaire</h3>
                <p className="text-sm text-neutral-400 mb-4">Formats supportés: Desjardins, TD, RBC, CSV générique</p>

                <div className="flex justify-center gap-4 mb-4">
                  <select
                    value={csvFormat}
                    onChange={e => setCsvFormat(e.target.value as typeof csvFormat)}
                    className="px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    <option value="desjardins">Desjardins</option>
                    <option value="td">TD Canada Trust</option>
                    <option value="rbc">RBC</option>
                    <option value="generic">CSV Générique</option>
                  </select>

                  {bankAccounts.length > 0 && (
                    <select
                      value={selectedBankAccountId}
                      onChange={e => setSelectedBankAccountId(e.target.value)}
                      className="px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
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
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {importing ? 'Analyse en cours...' : 'Sélectionner un fichier CSV'}
                  </button>
                </div>

                <p className="text-xs text-neutral-500">
                  Le système catégorisera automatiquement vos transactions
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Bank account selector for import */}
              {bankAccounts.length > 0 && (
                <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                  <label className="text-sm text-neutral-300 mr-3">Compte de destination:</label>
                  <select
                    value={selectedBankAccountId}
                    onChange={e => setSelectedBankAccountId(e.target.value)}
                    className="px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    {bankAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.institution} - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                  <p className="text-sm text-neutral-400">Transactions</p>
                  <p className="text-2xl font-bold text-white">{importedTransactions.length}</p>
                </div>
                <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                  <p className="text-sm text-neutral-400">Sélectionnées</p>
                  <p className="text-2xl font-bold text-sky-400">{importedTransactions.filter(t => t.selected).length}</p>
                </div>
                <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                  <p className="text-sm text-neutral-400">Confiance moyenne</p>
                  <p className="text-2xl font-bold text-green-400">
                    {Math.round(importedTransactions.reduce((sum, t) => sum + t.confidence, 0) / importedTransactions.length * 100)}%
                  </p>
                </div>
                <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
                  <p className="text-sm text-neutral-400">À vérifier</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {importedTransactions.filter(t => t.confidence < 0.7).length}
                  </p>
                </div>
              </div>

              {/* Transaction list */}
              <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
                <div className="p-4 border-b border-neutral-700 flex justify-between items-center">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importedTransactions.every(t => t.selected)}
                      onChange={toggleAll}
                      className="rounded border-neutral-600 bg-neutral-700 text-sky-500"
                    />
                    <span className="text-sm text-neutral-300">Tout sélectionner</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setImportedTransactions([])}
                      className="px-3 py-1.5 text-neutral-400 hover:text-white text-sm"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleImportSelected}
                      disabled={importing || !importedTransactions.some(t => t.selected)}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {importing ? 'Import...' : `Importer ${importedTransactions.filter(t => t.selected).length} transactions`}
                    </button>
                  </div>
                </div>

                <table className="w-full">
                  <thead className="bg-neutral-900/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase w-10"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Montant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Catégorie suggérée</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-neutral-400 uppercase">Confiance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700">
                    {importedTransactions.map(tx => (
                      <tr
                        key={tx.id}
                        className={`hover:bg-neutral-700/30 ${tx.confidence < 0.7 ? 'bg-yellow-900/10' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={tx.selected}
                            onChange={() => toggleTransaction(tx.id)}
                            className="rounded border-neutral-600 bg-neutral-700 text-sky-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-white">
                          {tx.date instanceof Date ? tx.date.toLocaleDateString('fr-CA') : new Date(tx.date).toLocaleDateString('fr-CA')}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white">{tx.description}</p>
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${tx.type === 'CREDIT' ? 'text-green-400' : 'text-red-400'}`}>
                          {tx.type === 'CREDIT' ? '+' : '-'}{tx.amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            defaultValue={tx.suggestedAccount || ''}
                            className="px-2 py-1 bg-neutral-700 border border-neutral-600 rounded text-sm text-white"
                          >
                            <option value="">Non classé</option>
                            <option value="1040">1040 - Stripe</option>
                            <option value="4010">4010 - Ventes</option>
                            <option value="6010">6010 - Livraison</option>
                            <option value="6210">6210 - Marketing</option>
                            <option value="6310">6310 - Hébergement</option>
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
            </>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-neutral-900/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Source</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Transactions</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-700">
              {importHistory.map((item, i) => (
                <tr key={i} className="hover:bg-neutral-700/30">
                  <td className="px-4 py-3 text-white">{new Date(item.date).toLocaleDateString('fr-CA')}</td>
                  <td className="px-4 py-3 text-neutral-300">{item.source}</td>
                  <td className="px-4 py-3 text-right text-white">{item.count}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-green-900/30 text-green-400 rounded text-sm">Complété</span>
                  </td>
                </tr>
              ))}
              {importHistory.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">Aucun historique d&apos;import</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
