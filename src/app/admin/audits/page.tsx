'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  ShieldCheck,
  ShieldAlert,
  FileDown,
  Filter,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Audit label formatters (inlined to avoid importing Node.js crypto module) ──

function formatAuditAction(action: string): string {
  const labels: Record<string, string> = {
    CREATE: 'Creation',
    UPDATE: 'Modification',
    DELETE: 'Suppression',
    LOGIN: 'Connexion',
    LOGOUT: 'Deconnexion',
    FAILED_LOGIN: 'Tentative echouee',
    EXPORT: 'Export',
    IMPORT: 'Import',
    BULK_UPDATE: 'Mise a jour en lot',
    SETTINGS_CHANGE: 'Modification parametres',
    PERMISSION_CHANGE: 'Modification permissions',
    REFUND: 'Remboursement',
    VOID: 'Annulation',
    APPROVE: 'Approbation',
    REJECT: 'Rejet',
    USER_REGISTERED: 'Inscription',
    UPDATE_ORDER_STATUS: 'Statut commande',
  };
  return labels[action] || action;
}

function formatEntityType(type: string): string {
  const labels: Record<string, string> = {
    Product: 'Produit',
    Order: 'Commande',
    User: 'Utilisateur',
    Category: 'Categorie',
    Settings: 'Parametres',
    Permission: 'Permission',
    Email: 'Email',
    Media: 'Media',
    Page: 'Page',
    product: 'Produit',
    order: 'Commande',
    user: 'Utilisateur',
    category: 'Categorie',
    settings: 'Parametres',
    permission: 'Permission',
    discount: 'Reduction',
    promo_code: 'Code promo',
    journal_entry: 'Ecriture comptable',
    email: 'Email',
    page: 'Page',
    media: 'Media',
  };
  return labels[type] || type;
}

interface AuditTypeInfo {
  id: string;
  code: string;
  name: string;
  nameFr: string | null;
  description: string;
  descriptionFr: string | null;
  severity: string;
  category: string;
  checklistCount: number;
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    findingsCount: number;
    passedChecks: number;
    failedChecks: number;
    durationMs: number | null;
  } | null;
}

interface BatchProgress {
  running: boolean;
  label: string;
  completed: number;
  total: number;
  currentCode: string;
  results: Array<{ code: string; findingsCount: number; status: string }>;
}

// ── Audit Log Trail Types ─────────────────────────────────────

interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: {
    previousValue?: unknown;
    newValue?: unknown;
    metadata?: Record<string, unknown>;
  } | null;
  currentHash?: string | null;
  previousHash?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogFilters {
  action: string;
  entityType: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
}

const ENTITY_TYPES = ['', 'Product', 'Order', 'User', 'Category', 'Settings', 'Permission', 'Email', 'Media', 'Page'];
const ACTION_TYPES = ['', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'FAILED_LOGIN', 'EXPORT', 'IMPORT',
  'BULK_UPDATE', 'SETTINGS_CHANGE', 'PERMISSION_CHANGE', 'REFUND', 'VOID', 'APPROVE', 'REJECT',
  'USER_REGISTERED', 'UPDATE_ORDER_STATUS'];

const severityColors: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  HIGH: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  MEDIUM: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  LOW: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
};

const severityBadge: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800',
  HIGH: 'bg-orange-100 text-orange-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  LOW: 'bg-blue-100 text-blue-800',
};

const categoryLabels: Record<string, { en: string; fr: string }> = {
  security: { en: 'Security', fr: 'Sécurité' },
  integrity: { en: 'Integrity', fr: 'Intégrité' },
  compliance: { en: 'Compliance', fr: 'Conformité' },
  performance: { en: 'Performance', fr: 'Performance' },
  quality: { en: 'Quality', fr: 'Qualité' },
};

export default function AuditDashboardPage() {
  const { locale } = useI18n();
  const isFr = locale === 'fr';
  const [auditTypes, setAuditTypes] = useState<AuditTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // ─── Audit Trail (Log) State ──────────────────────────────
  const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogPage, setAuditLogPage] = useState(1);
  const [auditLogTotal, setAuditLogTotal] = useState(0);
  const [auditLogTotalPages, setAuditLogTotalPages] = useState(0);
  const [chainVerification, setChainVerification] = useState<{ valid: boolean; brokenAt?: number; checked: boolean }>({
    valid: true,
    checked: false,
  });
  const [logFilters, setLogFilters] = useState<AuditLogFilters>({
    action: '',
    entityType: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showLogFilters, setShowLogFilters] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // ─── Audit Trail Functions ────────────────────────────────

  const fetchAuditLogs = useCallback(async (page: number = 1) => {
    setAuditLogsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (logFilters.action) params.set('action', logFilters.action);
      if (logFilters.entityType) params.set('targetType', logFilters.entityType);
      if (logFilters.userId) params.set('adminUserId', logFilters.userId);
      if (logFilters.dateFrom) params.set('from', logFilters.dateFrom);
      if (logFilters.dateTo) params.set('to', logFilters.dateTo);

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data;
        setAuditLogs(data.entries || []);
        setAuditLogTotal(data.total || 0);
        setAuditLogTotalPages(data.totalPages || 0);
        setAuditLogPage(data.page || 1);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      toast.error(isFr ? 'Erreur de chargement des journaux' : 'Failed to load audit logs');
    }
    setAuditLogsLoading(false);
  }, [logFilters, isFr]);

  const verifyHashChain = useCallback(() => {
    // Client-side verification of hash chain integrity
    let valid = true;
    let brokenAt: number | undefined;

    for (let i = 1; i < auditLogs.length; i++) {
      const current = auditLogs[i];
      const previous = auditLogs[i - 1];
      // If both have hashes, verify chain linkage
      if (current.previousHash && previous.currentHash) {
        if (current.previousHash !== previous.currentHash) {
          valid = false;
          brokenAt = i;
          break;
        }
      }
    }

    setChainVerification({ valid, brokenAt, checked: true });

    if (valid) {
      toast.success(isFr ? 'Chaine de hachage valide - aucune alteration detectee' : 'Hash chain valid - no tampering detected');
    } else {
      toast.error(isFr ? `Rupture de chaine detectee a l'entree ${brokenAt}` : `Chain break detected at entry ${brokenAt}`);
    }
  }, [auditLogs, isFr]);

  const exportAuditCsv = useCallback(async () => {
    setExportingCsv(true);
    try {
      // Fetch all logs matching current filters (up to 1000)
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', '1000');
      if (logFilters.action) params.set('action', logFilters.action);
      if (logFilters.entityType) params.set('targetType', logFilters.entityType);
      if (logFilters.userId) params.set('adminUserId', logFilters.userId);
      if (logFilters.dateFrom) params.set('from', logFilters.dateFrom);
      if (logFilters.dateTo) params.set('to', logFilters.dateTo);

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const entries: AuditLogEntry[] = json.data.entries || [];

      const BOM = '\uFEFF';
      const headers = ['ID', 'Date', 'Action', 'Type entite', 'ID entite', 'Utilisateur', 'IP', 'Hash actuel', 'Hash precedent', 'User Agent'];
      const rows = entries.map(e => [
        e.id,
        new Date(e.createdAt).toISOString(),
        e.action,
        e.entityType,
        e.entityId || '',
        e.userId || '',
        e.ipAddress || '',
        e.currentHash || '',
        e.previousHash || '',
        (e.userAgent || '').replace(/"/g, '""'),
      ]);

      const csv = BOM + [headers, ...rows]
        .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(isFr ? `${entries.length} entrees exportees` : `${entries.length} entries exported`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error(isFr ? 'Erreur d\'export' : 'Export failed');
    }
    setExportingCsv(false);
  }, [logFilters, isFr]);

  useEffect(() => {
    if (showAuditTrail) {
      fetchAuditLogs(1);
    }
  }, [showAuditTrail, fetchAuditLogs]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/audits');
      const json = await res.json();
      if (json.data) setAuditTypes(json.data);
    } catch (err) {
      console.error('Failed to fetch audit dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const isAnyRunning = !!runningAudit || !!batchProgress?.running;

  const handleRunAudit = async (code: string) => {
    if (isAnyRunning) return;
    setRunningAudit(code);
    try {
      const res = await fetch('/api/admin/audits/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditTypeCode: code }),
      });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch (err) {
      console.error('Failed to run audit:', err);
    } finally {
      setRunningAudit(null);
    }
  };

  const handleRunBatch = async (severity: string) => {
    if (isAnyRunning) return;

    const label = severity === 'ALL'
      ? (isFr ? 'Tous les audits' : 'All Audits')
      : `${severity} ${isFr ? 'audits' : 'Audits'}`;

    const targetCodes = severity === 'ALL'
      ? auditTypes.map((a) => a.code)
      : auditTypes.filter((a) => a.severity === severity).map((a) => a.code);

    setBatchProgress({
      running: true,
      label,
      completed: 0,
      total: targetCodes.length,
      currentCode: targetCodes[0] || '',
      results: [],
    });

    try {
      const res = await fetch('/api/admin/audits/run-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(severity === 'ALL' ? { severity: 'ALL' } : { severity }),
      });

      if (res.ok) {
        const json = await res.json();
        setBatchProgress((prev) =>
          prev
            ? {
                ...prev,
                running: false,
                completed: json.data.completed,
                results: json.data.results || [],
              }
            : null
        );
        await fetchDashboard();
      }
    } catch (err) {
      console.error('Failed to run batch audit:', err);
    } finally {
      setBatchProgress((prev) => (prev ? { ...prev, running: false } : null));
    }
  };

  const dismissBatchResults = () => setBatchProgress(null);

  const filtered = auditTypes.filter((at) => {
    if (filterSeverity !== 'ALL' && at.severity !== filterSeverity) return false;
    if (filterCategory !== 'ALL' && at.category !== filterCategory) return false;
    return true;
  });

  const stats = {
    total: auditTypes.length,
    critical: auditTypes.filter((a) => a.severity === 'CRITICAL').length,
    high: auditTypes.filter((a) => a.severity === 'HIGH').length,
    medium: auditTypes.filter((a) => a.severity === 'MEDIUM').length,
    low: auditTypes.filter((a) => a.severity === 'LOW').length,
    totalFindings: auditTypes.reduce((sum, a) => sum + (a.lastRun?.findingsCount || 0), 0),
    ranAtLeastOnce: auditTypes.filter((a) => a.lastRun).length,
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-slate-200 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isFr ? 'Audits de Code' : 'Code Audits'}
        subtitle={
          isFr
            ? `${stats.total} types d'audit pour sécurité, solidité, intégrité et performance`
            : `${stats.total} audit types for security, solidity, integrity and performance`
        }
      />

      {/* Batch Execution Buttons */}
      <div className="flex flex-wrap gap-3 items-center bg-slate-50 border border-slate-200 rounded-lg p-4">
        <span className="text-sm font-semibold text-slate-700">
          {isFr ? 'Exécution:' : 'Execute:'}
        </span>
        <button
          onClick={() => handleRunBatch('ALL')}
          disabled={isAnyRunning}
          className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-md hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {batchProgress?.running && batchProgress.label.includes('All')
            ? (isFr ? 'Exécution...' : 'Running...')
            : (isFr ? 'Tous les audits' : 'Run All')}
        </button>
        <button
          onClick={() => handleRunBatch('CRITICAL')}
          disabled={isAnyRunning}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {batchProgress?.running && batchProgress.label.includes('CRITICAL')
            ? (isFr ? 'Exécution...' : 'Running...')
            : (isFr ? 'Critiques seulement' : 'Run Critical')}
        </button>
        <button
          onClick={() => handleRunBatch('HIGH')}
          disabled={isAnyRunning}
          className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-md hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {batchProgress?.running && batchProgress.label.includes('HIGH')
            ? (isFr ? 'Exécution...' : 'Running...')
            : (isFr ? 'Hauts seulement' : 'Run High')}
        </button>
        {isAnyRunning && (
          <span className="text-sm text-slate-500 animate-pulse ml-2">
            {batchProgress
              ? `${batchProgress.completed}/${batchProgress.total}...`
              : (isFr ? `Exécution de ${runningAudit}...` : `Running ${runningAudit}...`)}
          </span>
        )}
      </div>

      {/* Batch Results Banner */}
      {batchProgress && !batchProgress.running && batchProgress.results.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-green-800">
              {isFr ? 'Résultats du lot' : 'Batch Results'}: {batchProgress.label}
            </h3>
            <button
              onClick={dismissBatchResults}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              {isFr ? 'Fermer' : 'Dismiss'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {batchProgress.results.map((r) => (
              <span
                key={r.code}
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  r.status === 'FAILED'
                    ? 'bg-red-100 text-red-700'
                    : r.findingsCount === 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {r.code}: {r.status === 'FAILED' ? 'ERR' : r.findingsCount}
              </span>
            ))}
          </div>
          <p className="text-xs text-green-700 mt-2">
            {batchProgress.completed}/{batchProgress.total} {isFr ? 'complétés' : 'completed'} &middot;{' '}
            {batchProgress.results.reduce((s, r) => s + (r.findingsCount || 0), 0)} {isFr ? 'trouvailles totales' : 'total findings'}
          </p>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatBox label={isFr ? 'Total Audits' : 'Total Audits'} value={stats.total} color="bg-slate-100" />
        <StatBox label={isFr ? 'Critique' : 'Critical'} value={stats.critical} color="bg-red-100" />
        <StatBox label={isFr ? 'Élevé' : 'High'} value={stats.high} color="bg-orange-100" />
        <StatBox label={isFr ? 'Moyen' : 'Medium'} value={stats.medium} color="bg-yellow-100" />
        <StatBox label={isFr ? 'Faible' : 'Low'} value={stats.low} color="bg-blue-100" />
        <StatBox label={isFr ? 'Trouvailles' : 'Findings'} value={stats.totalFindings} color="bg-purple-100" />
        <StatBox label={isFr ? 'Exécutés' : 'Executed'} value={`${stats.ranAtLeastOnce}/${stats.total}`} color="bg-green-100" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-slate-600">{isFr ? 'Filtrer:' : 'Filter:'}</span>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
        >
          <option value="ALL">{isFr ? 'Toutes sévérités' : 'All severities'}</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
        >
          <option value="ALL">{isFr ? 'Toutes catégories' : 'All categories'}</option>
          {Object.entries(categoryLabels).map(([key, label]) => (
            <option key={key} value={key}>{isFr ? label.fr : label.en}</option>
          ))}
        </select>
        <Link
          href="/admin/audits/catalog"
          className="ms-auto text-sm text-sky-600 hover:text-sky-800 font-medium"
        >
          {isFr ? 'Catalogue de fonctions' : 'Function Catalog'} &rarr;
        </Link>
      </div>

      {/* Audit Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((at) => {
          const colors = severityColors[at.severity] || severityColors.LOW;
          const isRunning = runningAudit === at.code;

          return (
            <div
              key={at.id}
              className={`rounded-lg border ${colors.border} ${colors.bg} p-4 transition-shadow hover:shadow-md ${isRunning ? 'ring-2 ring-sky-400' : ''}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${severityBadge[at.severity]}`}>
                      {at.severity}
                    </span>
                    <span className="text-xs text-slate-500 bg-white/60 px-2 py-0.5 rounded-full">
                      {isFr ? categoryLabels[at.category]?.fr : categoryLabels[at.category]?.en}
                    </span>
                  </div>
                  <h3 className={`font-semibold text-sm ${colors.text} truncate`}>
                    {isFr && at.nameFr ? at.nameFr : at.name}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {isFr && at.descriptionFr ? at.descriptionFr : at.description}
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono shrink-0">{at.code}</span>
              </div>

              {/* Last Run Info */}
              <div className="mt-3 pt-3 border-t border-slate-200/60">
                {at.lastRun ? (
                  <div className="flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={at.lastRun.findingsCount > 0 ? 'text-red-600 font-semibold' : 'text-green-600 font-semibold'}>
                          {at.lastRun.findingsCount} {isFr ? 'trouvailles' : 'findings'}
                        </span>
                        <span className="text-slate-400">|</span>
                        <span className="text-green-600">{at.lastRun.passedChecks} {isFr ? 'réussis' : 'passed'}</span>
                      </div>
                      <div className="text-slate-400">
                        {new Date(at.lastRun.startedAt).toLocaleDateString(locale)} &middot;{' '}
                        {at.lastRun.durationMs ? `${(at.lastRun.durationMs / 1000).toFixed(1)}s` : ''}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <Link
                        href={`/admin/audits/${at.code}`}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 text-xs"
                      >
                        {isFr ? 'Voir' : 'View'}
                      </Link>
                      <button
                        onClick={() => handleRunAudit(at.code)}
                        disabled={isAnyRunning}
                        className="px-2.5 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50 text-xs"
                      >
                        {isRunning ? (
                          <span className="inline-block animate-spin">&#8635;</span>
                        ) : (
                          isFr ? 'Lancer' : 'Run'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 italic">{isFr ? 'Jamais exécuté' : 'Never run'}</span>
                    <div className="flex gap-1.5">
                      <Link
                        href={`/admin/audits/${at.code}`}
                        className="px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 text-xs"
                      >
                        {isFr ? 'Détails' : 'Details'}
                      </Link>
                      <button
                        onClick={() => handleRunAudit(at.code)}
                        disabled={isAnyRunning}
                        className="px-2.5 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 disabled:opacity-50 text-xs"
                      >
                        {isRunning ? (
                          <span className="inline-block animate-spin">&#8635;</span>
                        ) : (
                          isFr ? 'Lancer' : 'Run'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Checklist count */}
              <div className="mt-2 text-xs text-slate-400">
                {at.checklistCount} {isFr ? 'vérifications' : 'checks'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           AUDIT TRAIL / LOG SECTION
           ═══════════════════════════════════════════════════════════════ */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowAuditTrail(!showAuditTrail)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Hash className="w-5 h-5 text-slate-600" />
            <div className="text-start">
              <h3 className="text-sm font-semibold text-slate-800">
                {isFr ? 'Journal d\'audit (Piste de verification)' : 'Audit Trail (Verification Log)'}
              </h3>
              <p className="text-xs text-slate-500">
                {isFr
                  ? 'Actions administrateur avec chaine de hachage SHA-256 anti-falsification'
                  : 'Admin actions with SHA-256 hash chain for tamper evidence'}
              </p>
            </div>
          </div>
          {showAuditTrail ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showAuditTrail && (
          <div className="p-4 space-y-4">
            {/* Toolbar: Hash verification + Export + Filters toggle */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Hash Chain Verification */}
              <button
                onClick={verifyHashChain}
                disabled={auditLogs.length === 0}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                {chainVerification.checked ? (
                  chainVerification.valid ? (
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                  )
                ) : (
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                )}
                {isFr ? 'Verifier la chaine' : 'Verify Chain'}
              </button>

              {/* Chain status badge */}
              {chainVerification.checked && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  chainVerification.valid
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {chainVerification.valid
                    ? (isFr ? 'Chaine integre' : 'Chain intact')
                    : (isFr ? `Rupture a l'entree #${chainVerification.brokenAt}` : `Break at entry #${chainVerification.brokenAt}`)
                  }
                </span>
              )}

              <div className="flex-1" />

              {/* Filter toggle */}
              <button
                onClick={() => setShowLogFilters(!showLogFilters)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  showLogFilters ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                {isFr ? 'Filtres' : 'Filters'}
              </button>

              {/* Export CSV */}
              <button
                onClick={exportAuditCsv}
                disabled={exportingCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border bg-white border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <FileDown className="w-3.5 h-3.5" />
                {exportingCsv
                  ? (isFr ? 'Export...' : 'Exporting...')
                  : (isFr ? 'Exporter CSV' : 'Export CSV')
                }
              </button>

              {/* Refresh */}
              <button
                onClick={() => fetchAuditLogs(auditLogPage)}
                className="p-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 transition-colors"
                title={isFr ? 'Actualiser' : 'Refresh'}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${auditLogsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filter Panel */}
            {showLogFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    {isFr ? 'Type d\'entite' : 'Entity Type'}
                  </label>
                  <select
                    value={logFilters.entityType}
                    onChange={(e) => {
                      setLogFilters(prev => ({ ...prev, entityType: e.target.value }));
                      setAuditLogPage(1);
                    }}
                    className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white"
                  >
                    <option value="">{isFr ? 'Tous' : 'All'}</option>
                    {ENTITY_TYPES.filter(Boolean).map(t => (
                      <option key={t} value={t}>{formatEntityType(t)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Action</label>
                  <select
                    value={logFilters.action}
                    onChange={(e) => {
                      setLogFilters(prev => ({ ...prev, action: e.target.value }));
                      setAuditLogPage(1);
                    }}
                    className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white"
                  >
                    <option value="">{isFr ? 'Toutes' : 'All'}</option>
                    {ACTION_TYPES.filter(Boolean).map(a => (
                      <option key={a} value={a}>{formatAuditAction(a)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    {isFr ? 'Utilisateur (ID)' : 'User (ID)'}
                  </label>
                  <input
                    type="text"
                    value={logFilters.userId}
                    onChange={(e) => {
                      setLogFilters(prev => ({ ...prev, userId: e.target.value }));
                      setAuditLogPage(1);
                    }}
                    placeholder={isFr ? 'ID utilisateur...' : 'User ID...'}
                    className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    {isFr ? 'Date debut' : 'From'}
                  </label>
                  <input
                    type="date"
                    value={logFilters.dateFrom}
                    onChange={(e) => {
                      setLogFilters(prev => ({ ...prev, dateFrom: e.target.value }));
                      setAuditLogPage(1);
                    }}
                    className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">
                    {isFr ? 'Date fin' : 'To'}
                  </label>
                  <input
                    type="date"
                    value={logFilters.dateTo}
                    onChange={(e) => {
                      setLogFilters(prev => ({ ...prev, dateTo: e.target.value }));
                      setAuditLogPage(1);
                    }}
                    className="w-full h-8 px-2 text-xs border border-slate-300 rounded bg-white"
                  />
                </div>
              </div>
            )}

            {/* Audit Log Table */}
            {auditLogsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                {isFr ? 'Aucune entree dans le journal d\'audit' : 'No audit log entries found'}
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-start text-xs font-medium text-slate-500">{isFr ? 'Date' : 'Date'}</th>
                        <th className="px-3 py-2 text-start text-xs font-medium text-slate-500">Action</th>
                        <th className="px-3 py-2 text-start text-xs font-medium text-slate-500">{isFr ? 'Type' : 'Entity'}</th>
                        <th className="px-3 py-2 text-start text-xs font-medium text-slate-500">{isFr ? 'ID Entite' : 'Entity ID'}</th>
                        <th className="px-3 py-2 text-start text-xs font-medium text-slate-500">{isFr ? 'Utilisateur' : 'User'}</th>
                        <th className="px-3 py-2 text-start text-xs font-medium text-slate-500">IP</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">
                          <span className="flex items-center gap-1 justify-center">
                            <Hash className="w-3 h-3" />
                            {isFr ? 'Chaine' : 'Chain'}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.map((entry, idx) => {
                        // Determine chain status for this entry
                        let chainStatus: 'valid' | 'broken' | 'unknown' = 'unknown';
                        if (entry.currentHash && entry.previousHash) {
                          if (idx > 0 && auditLogs[idx - 1]?.currentHash) {
                            chainStatus = entry.previousHash === auditLogs[idx - 1].currentHash ? 'valid' : 'broken';
                          } else {
                            chainStatus = 'valid'; // First entry or no previous to compare
                          }
                        }

                        return (
                          <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                              {new Date(entry.createdAt).toLocaleDateString(locale, {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                entry.action.includes('DELETE') || entry.action.includes('REJECT') || entry.action.includes('FAILED')
                                  ? 'bg-red-100 text-red-700'
                                  : entry.action.includes('CREATE') || entry.action.includes('APPROVE') || entry.action.includes('REGISTER')
                                  ? 'bg-green-100 text-green-700'
                                  : entry.action.includes('LOGIN') || entry.action.includes('LOGOUT')
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {formatAuditAction(entry.action)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600">
                              {formatEntityType(entry.entityType)}
                            </td>
                            <td className="px-3 py-2">
                              <code className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                                {entry.entityId ? (entry.entityId.length > 16 ? entry.entityId.slice(0, 16) + '...' : entry.entityId) : '-'}
                              </code>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="text-xs text-slate-600">
                                  {entry.userId ? (entry.userId.length > 12 ? entry.userId.slice(0, 12) + '...' : entry.userId) : '-'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                              {entry.ipAddress || '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {chainStatus === 'valid' ? (
                                <ShieldCheck className="w-4 h-4 text-green-500 mx-auto" title={isFr ? 'Chaine valide' : 'Chain valid'} />
                              ) : chainStatus === 'broken' ? (
                                <ShieldAlert className="w-4 h-4 text-red-500 mx-auto" title={isFr ? 'Rupture de chaine' : 'Chain broken'} />
                              ) : (
                                <span className="text-xs text-slate-300" title={isFr ? 'Pas de hash' : 'No hash'}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {auditLogTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                    <p className="text-xs text-slate-500">
                      {isFr
                        ? `Page ${auditLogPage} sur ${auditLogTotalPages} (${auditLogTotal} entrees)`
                        : `Page ${auditLogPage} of ${auditLogTotalPages} (${auditLogTotal} entries)`
                      }
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setAuditLogPage(p => p - 1); fetchAuditLogs(auditLogPage - 1); }}
                        disabled={auditLogPage <= 1}
                        className="px-3 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFr ? 'Precedent' : 'Previous'}
                      </button>
                      <button
                        onClick={() => { setAuditLogPage(p => p + 1); fetchAuditLogs(auditLogPage + 1); }}
                        disabled={auditLogPage >= auditLogTotalPages}
                        className="px-3 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFr ? 'Suivant' : 'Next'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className={`${color} rounded-lg px-3 py-2 text-center`}>
      <div className="text-lg font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}
