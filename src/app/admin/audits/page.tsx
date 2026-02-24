'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { PageHeader } from '@/components/admin/PageHeader';

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
        <StatBox label="Critical" value={stats.critical} color="bg-red-100" />
        <StatBox label="High" value={stats.high} color="bg-orange-100" />
        <StatBox label="Medium" value={stats.medium} color="bg-yellow-100" />
        <StatBox label="Low" value={stats.low} color="bg-blue-100" />
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
