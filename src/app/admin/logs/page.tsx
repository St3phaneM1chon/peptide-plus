'use client';

import { useState, useEffect } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  action: string;
  userId?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

const levelColors: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-800',
  WARNING: 'bg-yellow-100 text-yellow-800',
  ERROR: 'bg-red-100 text-red-800',
  DEBUG: 'bg-gray-100 text-gray-800',
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ level: '', search: '', action: '' });
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchLogs();
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 10000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh]);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setLogs([]);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    if (filter.level && log.level !== filter.level) return false;
    if (filter.action && !log.action.toLowerCase().includes(filter.action.toLowerCase())) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!log.action.toLowerCase().includes(search) &&
          !log.userName?.toLowerCase().includes(search) &&
          !JSON.stringify(log.details).toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: logs.length,
    errors: logs.filter(l => l.level === 'ERROR').length,
    warnings: logs.filter(l => l.level === 'WARNING').length,
  };

  const actionLabels: Record<string, string> = {
    USER_LOGIN: 'Connexion utilisateur',
    ADMIN_LOGIN: 'Connexion admin',
    ORDER_CREATED: 'Commande créée',
    ORDER_PAYMENT_SUCCESS: 'Paiement réussi',
    PAYMENT_RETRY: 'Tentative paiement',
    EMAIL_SEND_FAILED: 'Échec email',
    PROMO_CODE_USED: 'Code promo utilisé',
    PRODUCT_UPDATED: 'Produit modifié',
    LOW_STOCK_ALERT: 'Alerte stock bas',
    CRON_JOB_RUN: 'Tâche planifiée',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs & Audit</h1>
          <p className="text-gray-500">Suivez toutes les activités du système</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-amber-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            Actualiser
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            Exporter
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total (24h)</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Info</p>
          <p className="text-2xl font-bold text-blue-700">{logs.filter(l => l.level === 'INFO').length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">Avertissements</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.warnings}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-600">Erreurs</p>
          <p className="text-2xl font-bold text-red-700">{stats.errors}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Rechercher..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.level}
            onChange={(e) => setFilter({ ...filter, level: e.target.value })}
          >
            <option value="">Tous les niveaux</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="DEBUG">Debug</option>
          </select>
          <input
            type="text"
            placeholder="Filtrer par action..."
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.action}
            onChange={(e) => setFilter({ ...filter, action: e.target.value })}
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date/Heure</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Niveau</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Utilisateur</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">IP</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 font-mono text-sm">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">
                  {new Date(log.timestamp).toLocaleString('fr-CA')}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${levelColors[log.level]}`}>
                    {log.level}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-900">{actionLabels[log.action] || log.action}</p>
                  <code className="text-xs text-gray-400">{log.action}</code>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {log.userName || '-'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {log.ipAddress || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {log.details && (
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200"
                    >
                      Voir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredLogs.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Aucun log trouvé
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{actionLabels[selectedLog.action] || selectedLog.action}</h3>
                <p className="text-sm text-gray-500">{new Date(selectedLog.timestamp).toLocaleString('fr-CA')}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-gray-100 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-x-auto">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
