'use client';

import { useState, useEffect } from 'react';

interface AuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  entityType: string;
  entityId: string;
  entityNumber?: string;
  userName: string;
  ipAddress?: string;
  changes: { field: string; oldValue: any; newValue: any }[];
}

const actionLabels: Record<string, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  POST: 'Validation',
  VOID: 'Annulation',
  APPROVE: 'Approbation',
  RECONCILE: 'Rapprochement',
  CLOSE_PERIOD: 'Clôture',
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
  EXPORT: 'Export',
};

const entityLabels: Record<string, string> = {
  JOURNAL_ENTRY: 'Écriture',
  CUSTOMER_INVOICE: 'Facture client',
  SUPPLIER_INVOICE: 'Facture fournisseur',
  BANK_TRANSACTION: 'Transaction bancaire',
  CHART_OF_ACCOUNT: 'Compte',
  TAX_REPORT: 'Déclaration fiscale',
  SETTINGS: 'Paramètres',
  USER: 'Utilisateur',
};

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-900/30 text-green-400',
  UPDATE: 'bg-blue-900/30 text-blue-400',
  DELETE: 'bg-red-900/30 text-red-400',
  POST: 'bg-amber-900/30 text-amber-400',
  VOID: 'bg-red-900/30 text-red-400',
  APPROVE: 'bg-green-900/30 text-green-400',
  RECONCILE: 'bg-purple-900/30 text-purple-400',
  LOGIN: 'bg-neutral-700 text-neutral-300',
  LOGOUT: 'bg-neutral-700 text-neutral-300',
};

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    user: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const response = await fetch('/api/accounting/audit');
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (error) {
      console.error('Error loading audit entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = entries.filter(entry => {
    if (filters.action && entry.action !== filters.action) return false;
    if (filters.entityType && entry.entityType !== filters.entityType) return false;
    if (filters.user && !entry.userName.toLowerCase().includes(filters.user.toLowerCase())) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!entry.entityNumber?.toLowerCase().includes(searchLower) &&
          !entry.userName.toLowerCase().includes(searchLower)) return false;
    }
    return true;
  });

  const handleExport = async () => {
    setExporting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate CSV
    const headers = ['Date/Heure', 'Action', 'Type', 'Document', 'Utilisateur', 'IP', 'Modifications'];
    const rows = filteredEntries.map(e => [
      e.timestamp.toISOString(),
      actionLabels[e.action] || e.action,
      entityLabels[e.entityType] || e.entityType,
      e.entityNumber || e.entityId,
      e.userName,
      e.ipAddress || '',
      e.changes.map(c => `${c.field}: ${c.oldValue} → ${c.newValue}`).join('; '),
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    setExporting(false);
  };

  // Stats
  const todayCount = entries.filter(e => 
    new Date(e.timestamp).toDateString() === new Date().toDateString()
  ).length;
  const uniqueUsers = new Set(entries.map(e => e.userName)).size;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Piste d'audit</h1>
          <p className="text-neutral-400 mt-1">Historique complet de toutes les actions comptables</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {exporting ? 'Export...' : '📥 Exporter CSV'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Actions aujourd'hui</p>
          <p className="text-2xl font-bold text-white mt-1">{todayCount}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Total actions</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{entries.length}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Utilisateurs actifs</p>
          <p className="text-2xl font-bold text-white mt-1">{uniqueUsers}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Après filtres</p>
          <p className="text-2xl font-bold text-white mt-1">{filteredEntries.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm"
            >
              <option value="">Toutes</option>
              {Object.entries(actionLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Type d'entité</label>
            <select
              value={filters.entityType}
              onChange={e => setFilters(prev => ({ ...prev, entityType: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm"
            >
              <option value="">Tous</option>
              {Object.entries(entityLabels).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Utilisateur</label>
            <input
              type="text"
              value={filters.user}
              onChange={e => setFilters(prev => ({ ...prev, user: e.target.value }))}
              placeholder="Rechercher..."
              className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Recherche</label>
            <input
              type="text"
              value={filters.search}
              onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="N° document..."
              className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setFilters({ action: '', entityType: '', user: '', dateFrom: '', dateTo: '', search: '' })}
              className="px-4 py-2 text-neutral-400 hover:text-white text-sm"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        <div className="divide-y divide-neutral-700">
          {filteredEntries.map(entry => (
            <div 
              key={entry.id} 
              className="p-4 hover:bg-neutral-700/30 cursor-pointer"
              onClick={() => setSelectedEntry(entry)}
            >
              <div className="flex items-start gap-4">
                <div className="text-center min-w-[60px]">
                  <p className="text-xs text-neutral-500">
                    {entry.timestamp.toLocaleDateString('fr-CA')}
                  </p>
                  <p className="text-sm text-neutral-300">
                    {entry.timestamp.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                
                <span className={`px-2 py-1 rounded text-xs font-medium ${actionColors[entry.action] || 'bg-neutral-700 text-neutral-300'}`}>
                  {actionLabels[entry.action] || entry.action}
                </span>
                
                <div className="flex-1">
                  <p className="text-white">
                    <span className="text-neutral-400">{entityLabels[entry.entityType] || entry.entityType}:</span>{' '}
                    <span className="font-medium">{entry.entityNumber || entry.entityId}</span>
                  </p>
                  {entry.changes.length > 0 && (
                    <p className="text-sm text-neutral-400 mt-1">
                      {entry.changes.slice(0, 2).map(c => c.field).join(', ')}
                      {entry.changes.length > 2 && ` +${entry.changes.length - 2} autres`}
                    </p>
                  )}
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-neutral-300">{entry.userName}</p>
                  {entry.ipAddress && (
                    <p className="text-xs text-neutral-500">{entry.ipAddress}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Détails de l'audit</h2>
              <button onClick={() => setSelectedEntry(null)} className="text-neutral-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-neutral-400">Date/Heure</p>
                  <p className="text-white">{selectedEntry.timestamp.toLocaleString('fr-CA')}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Action</p>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${actionColors[selectedEntry.action]}`}>
                    {actionLabels[selectedEntry.action]}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Type</p>
                  <p className="text-white">{entityLabels[selectedEntry.entityType]}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Document</p>
                  <p className="text-white font-mono">{selectedEntry.entityNumber || selectedEntry.entityId}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Utilisateur</p>
                  <p className="text-white">{selectedEntry.userName}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-400">Adresse IP</p>
                  <p className="text-white font-mono">{selectedEntry.ipAddress || '-'}</p>
                </div>
              </div>

              {selectedEntry.changes.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-neutral-300 mb-2">Modifications</p>
                  <div className="bg-neutral-900 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-700/50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs text-neutral-400">Champ</th>
                          <th className="px-3 py-2 text-left text-xs text-neutral-400">Ancienne valeur</th>
                          <th className="px-3 py-2 text-left text-xs text-neutral-400">Nouvelle valeur</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-700">
                        {selectedEntry.changes.map((change, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 text-white">{change.field}</td>
                            <td className="px-3 py-2 text-red-400 font-mono text-xs">
                              {change.oldValue === null ? <span className="text-neutral-500 italic">vide</span> : String(change.oldValue)}
                            </td>
                            <td className="px-3 py-2 text-green-400 font-mono text-xs">
                              {String(change.newValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
