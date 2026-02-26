'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { PageHeader } from '@/components/admin/PageHeader';
import { addCSRFHeader } from '@/lib/csrf';

interface Finding {
  id: string;
  checkId: string;
  severity: string;
  title: string;
  description: string;
  filePath: string | null;
  lineNumber: number | null;
  codeSnippet: string | null;
  recommendation: string | null;
  fixed: boolean;
  fixedAt: string | null;
  fixedBy: string | null;
  falsePositive: boolean;
  function: { id: string; name: string; filePath: string; type: string } | null;
}

interface AuditRun {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  findingsCount: number;
  passedChecks: number;
  failedChecks: number;
  totalChecks: number;
  durationMs: number | null;
  runBy: string | null;
  summary: string | null;
}

interface AuditTypeDetail {
  id: string;
  code: string;
  name: string;
  nameFr: string | null;
  description: string;
  descriptionFr: string | null;
  severity: string;
  category: string;
  checklist: { id: string; check: string; description: string }[];
}

const severityBadge: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-blue-100 text-blue-800 border-blue-200',
  INFO: 'bg-slate-100 text-slate-800 border-slate-200',
};

export default function AuditDetailPage() {
  const params = useParams();
  const typeCode = params.type as string;
  const { locale } = useI18n();
  const isFr = locale === 'fr';

  const [auditType, setAuditType] = useState<AuditTypeDetail | null>(null);
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState(false);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterFixed, setFilterFixed] = useState<string>('');

  const fetchData = useCallback(async (page = 1) => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (selectedRun) params.set('runId', selectedRun);
      if (filterSeverity) params.set('severity', filterSeverity);
      if (filterFixed) params.set('fixed', filterFixed);

      const res = await fetch(`/api/admin/audits/${typeCode}?${params}`);
      const json = await res.json();
      if (json.data) {
        setAuditType(json.data.auditType);
        setRuns(json.data.runs);
        setFindings(json.data.findings);
        setPagination(json.data.pagination);
      }
    } catch (err) {
      console.error('Failed to fetch audit details:', err);
    } finally {
      setLoading(false);
    }
  }, [typeCode, selectedRun, filterSeverity, filterFixed]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunAudit = async () => {
    setRunningAudit(true);
    try {
      const res = await fetch('/api/admin/audits/run', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ auditTypeCode: typeCode }),
      });
      if (res.ok) {
        setSelectedRun(null);
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to run audit:', err);
    } finally {
      setRunningAudit(false);
    }
  };

  const handleToggleFixed = async (findingId: string, currentFixed: boolean) => {
    try {
      await fetch(`/api/admin/audits/findings/${findingId}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ fixed: !currentFixed }),
      });
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, fixed: !currentFixed } : f))
      );
    } catch (err) {
      console.error('Failed to update finding:', err);
    }
  };

  const handleToggleFalsePositive = async (findingId: string, current: boolean) => {
    try {
      await fetch(`/api/admin/audits/findings/${findingId}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ falsePositive: !current }),
      });
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, falsePositive: !current } : f))
      );
    } catch (err) {
      console.error('Failed to update finding:', err);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-64 bg-slate-200 rounded-lg" />
      </div>
    );
  }

  if (!auditType) {
    return <div className="text-red-600">{isFr ? 'Type d\'audit non trouvé' : 'Audit type not found'}</div>;
  }

  const latestRun = runs[0];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/audits" className="hover:text-sky-600">
          {isFr ? 'Audits' : 'Audits'}
        </Link>
        <span>/</span>
        <span className="text-slate-800 font-medium">{auditType.code}</span>
      </div>

      <PageHeader
        title={isFr && auditType.nameFr ? auditType.nameFr : auditType.name}
        subtitle={isFr && auditType.descriptionFr ? auditType.descriptionFr : auditType.description}
      />

      {/* Meta info + Run button */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${severityBadge[auditType.severity]}`}>
          {auditType.severity}
        </span>
        <span className="text-sm text-slate-500">{auditType.checklist.length} {isFr ? 'vérifications' : 'checks'}</span>
        <button
          onClick={handleRunAudit}
          disabled={runningAudit}
          className="ms-auto px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm font-medium"
        >
          {runningAudit
            ? (isFr ? 'Exécution en cours...' : 'Running...')
            : (isFr ? 'Lancer l\'audit' : 'Run Audit')}
        </button>
      </div>

      {/* Run History */}
      {runs.length > 0 && (
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            {isFr ? 'Historique des exécutions' : 'Run History'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => { setSelectedRun(run.id === selectedRun ? null : run.id); }}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  (selectedRun === run.id || (!selectedRun && run.id === runs[0]?.id))
                    ? 'bg-sky-50 border-sky-300 text-sky-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {new Date(run.startedAt).toLocaleDateString(locale)}{' '}
                <span className={run.findingsCount > 0 ? 'text-red-600' : 'text-green-600'}>
                  ({run.findingsCount})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Latest Run Summary */}
      {latestRun && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <SummaryCard label={isFr ? 'Statut' : 'Status'} value={latestRun.status} />
          <SummaryCard label={isFr ? 'Trouvailles' : 'Findings'} value={latestRun.findingsCount} highlight={latestRun.findingsCount > 0} />
          <SummaryCard label={isFr ? 'Réussis' : 'Passed'} value={latestRun.passedChecks} />
          <SummaryCard label={isFr ? 'Échoués' : 'Failed'} value={latestRun.failedChecks} highlight={latestRun.failedChecks > 0} />
          <SummaryCard label={isFr ? 'Durée' : 'Duration'} value={latestRun.durationMs ? `${(latestRun.durationMs / 1000).toFixed(1)}s` : '-'} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
        >
          <option value="">{isFr ? 'Toutes sévérités' : 'All severities'}</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
          <option value="INFO">Info</option>
        </select>
        <select
          value={filterFixed}
          onChange={(e) => setFilterFixed(e.target.value)}
          className="text-sm border border-slate-300 rounded-md px-3 py-1.5 bg-white"
        >
          <option value="">{isFr ? 'Tous statuts' : 'All statuses'}</option>
          <option value="false">{isFr ? 'Non corrigé' : 'Not fixed'}</option>
          <option value="true">{isFr ? 'Corrigé' : 'Fixed'}</option>
        </select>
        <span className="text-sm text-slate-500">
          {pagination.total} {isFr ? 'résultats' : 'results'}
        </span>
      </div>

      {/* Findings Table */}
      {findings.length > 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-start px-4 py-2.5 font-medium text-slate-600 w-24">{isFr ? 'Sévérité' : 'Severity'}</th>
                <th className="text-start px-4 py-2.5 font-medium text-slate-600">{isFr ? 'Titre' : 'Title'}</th>
                <th className="text-start px-4 py-2.5 font-medium text-slate-600 hidden lg:table-cell">{isFr ? 'Fichier' : 'File'}</th>
                <th className="text-start px-4 py-2.5 font-medium text-slate-600 w-20">{isFr ? 'Statut' : 'Status'}</th>
                <th className="text-start px-4 py-2.5 font-medium text-slate-600 w-28">{isFr ? 'Actions' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {findings.map((f) => (
                <>
                  <tr
                    key={f.id}
                    className={`hover:bg-slate-50 cursor-pointer ${f.fixed ? 'opacity-60' : ''} ${f.falsePositive ? 'opacity-40 line-through' : ''}`}
                    onClick={() => setExpandedFinding(expandedFinding === f.id ? null : f.id)}
                  >
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${severityBadge[f.severity]}`}>
                        {f.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{f.title}</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs hidden lg:table-cell truncate max-w-xs">
                      {f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ''}
                    </td>
                    <td className="px-4 py-2.5">
                      {f.fixed ? (
                        <span className="text-xs text-green-600 font-medium">✓ {isFr ? 'Corrigé' : 'Fixed'}</span>
                      ) : f.falsePositive ? (
                        <span className="text-xs text-slate-400 font-medium">FP</span>
                      ) : (
                        <span className="text-xs text-red-600 font-medium">{isFr ? 'Ouvert' : 'Open'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleFixed(f.id, f.fixed)}
                          className={`text-xs px-2 py-1 rounded border ${
                            f.fixed
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-green-50'
                          }`}
                          title={f.fixed ? (isFr ? 'Marquer non corrigé' : 'Mark unfixed') : (isFr ? 'Marquer corrigé' : 'Mark fixed')}
                        >
                          {f.fixed ? '✓' : '○'}
                        </button>
                        <button
                          onClick={() => handleToggleFalsePositive(f.id, f.falsePositive)}
                          className={`text-xs px-2 py-1 rounded border ${
                            f.falsePositive
                              ? 'bg-slate-100 border-slate-300 text-slate-600'
                              : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50'
                          }`}
                          title={isFr ? 'Faux positif' : 'False positive'}
                        >
                          FP
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedFinding === f.id && (
                    <tr key={`${f.id}-detail`}>
                      <td colSpan={5} className="px-4 py-3 bg-slate-50">
                        <div className="space-y-2 text-sm">
                          <p className="text-slate-700">{f.description}</p>
                          {f.filePath && (
                            <p className="text-slate-500 font-mono text-xs">
                              {isFr ? 'Fichier' : 'File'}: {f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ''}
                            </p>
                          )}
                          {f.codeSnippet && (
                            <pre className="bg-slate-800 text-slate-200 rounded p-3 text-xs overflow-x-auto">
                              {f.codeSnippet}
                            </pre>
                          )}
                          {f.recommendation && (
                            <div className="bg-sky-50 border border-sky-200 rounded p-2 text-sky-800 text-xs">
                              <strong>{isFr ? 'Recommandation' : 'Recommendation'}:</strong> {f.recommendation}
                            </div>
                          )}
                          {f.function && (
                            <p className="text-xs text-slate-500">
                              {isFr ? 'Fonction' : 'Function'}: {f.function.name} ({f.function.type}) — {f.function.filePath}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                {isFr ? 'Page' : 'Page'} {pagination.page} / {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchData(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="text-xs px-3 py-1 border rounded disabled:opacity-50"
                >
                  {isFr ? 'Précédent' : 'Previous'}
                </button>
                <button
                  onClick={() => fetchData(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="text-xs px-3 py-1 border rounded disabled:opacity-50"
                >
                  {isFr ? 'Suivant' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-400">
          {runs.length === 0
            ? (isFr ? 'Aucun audit exécuté. Lancez votre premier audit!' : 'No audits run yet. Launch your first audit!')
            : (isFr ? 'Aucune trouvaille pour ce filtre.' : 'No findings match this filter.')}
        </div>
      )}

      {/* Checklist */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          {isFr ? 'Liste de vérifications' : 'Checklist'} ({auditType.checklist.length})
        </h2>
        <div className="space-y-2">
          {auditType.checklist.map((item) => (
            <div key={item.id} className="flex items-start gap-2 text-sm">
              <span className="text-xs font-mono text-slate-400 mt-0.5 shrink-0">{item.id}</span>
              <div>
                <p className="font-medium text-slate-800">{item.check}</p>
                <p className="text-xs text-slate-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 text-center">
      <div className={`text-xl font-bold ${highlight ? 'text-red-600' : 'text-slate-800'}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
