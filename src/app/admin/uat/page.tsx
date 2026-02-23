'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, Play, Trash2, Eye, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Info,
  RefreshCw, MapPin
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// =====================================================
// TYPES
// =====================================================

interface UatRun {
  id: string;
  runNumber: number;
  status: string;
  canadaOnly: boolean;
  totalScenarios: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  cleanedUp: boolean;
}

interface UatTestError {
  id: string;
  category: string;
  severity: string;
  message: string;
  expected: string | null;
  actual: string | null;
  context: Record<string, unknown> | null;
}

interface UatTestCase {
  id: string;
  scenarioCode: string;
  scenarioName: string;
  region: string;
  status: string;
  orderId: string | null;
  orderNumber: string | null;
  expectedTaxes: { tps?: number; tvq?: number; tvh?: number; pst?: number; total?: number } | null;
  actualTaxes: { tps?: number; tvq?: number; tvh?: number; total?: number } | null;
  expectedTotal: string | null;
  actualTotal: string | null;
  verifications: Record<string, boolean> | null;
  errors: UatTestError[];
  durationMs: number | null;
}

interface TaxReportRow {
  region: string;
  salesCount: number;
  totalSales: number;
  tpsCollected: number;
  tvqCollected: number;
  tvhCollected: number;
  pstCollected: number;
  totalTaxCollected: number;
  expectedTotalTax: number;
  difference: number;
}

interface TaxReport {
  rows: TaxReportRow[];
  totalSales: number;
  totalTaxCollected: number;
  totalExpectedTax: number;
  totalDifference: number;
}

interface RunDetail {
  run: UatRun;
  testCases: UatTestCase[];
  taxReport: TaxReport;
}

// =====================================================
// MAIN PAGE
// =====================================================

export default function UatPage() {
  const { t, locale } = useI18n();
  const [runs, setRuns] = useState<UatRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [canadaOnly, setCanadaOnly] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<RunDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pollingRunId, setPollingRunId] = useState<string | null>(null);
  const [cleaningUp, setCleaningUp] = useState<string | null>(null);

  // Fetch runs list
  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/uat');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (e) {
      console.error('Failed to fetch runs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Polling for active run
  useEffect(() => {
    if (!pollingRunId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/uat/${pollingRunId}?status=true`);
        if (res.ok) {
          const json = await res.json();
          const statusData = json.data;
          // Update the run in the list
          setRuns(prev => prev.map(r => r.id === pollingRunId ? { ...r, ...statusData } : r));
          if (statusData.status !== 'RUNNING') {
            setPollingRunId(null);
            fetchRuns();
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pollingRunId, fetchRuns]);

  // Launch run
  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const res = await fetch('/api/admin/uat', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ canadaOnly }),
      });
      if (res.ok) {
        const data = await res.json();
        setPollingRunId(data.runId);
        setShowModal(false);
        await fetchRuns();
      } else {
        const err = await res.json();
        toast.error(err.error || t('admin.uat.launchError'));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('admin.uat.unknownError'));
    } finally {
      setLaunching(false);
    }
  };

  // View detail
  const handleViewDetail = async (runId: string) => {
    setSelectedRunId(runId);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/uat/${runId}`);
      if (res.ok) {
        const json = await res.json();
        setRunDetail(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch run detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Cleanup
  const handleCleanup = async (runId: string) => {
    if (!confirm(t('admin.uat.cleanupConfirm'))) return;
    setCleaningUp(runId);
    try {
      const res = await fetch(`/api/admin/uat/${runId}`, { method: 'DELETE', headers: addCSRFHeader() });
      if (res.ok) {
        const json = await res.json();
        const counts = Object.entries(json.data.deleted).map(([k, v]) => `${k}: ${v}`).join(', ');
        toast.success(`${t('admin.uat.cleanupDone')}\n\n${counts}`);
        fetchRuns();
        if (selectedRunId === runId) {
          setSelectedRunId(null);
          setRunDetail(null);
        }
      }
    } catch (e: unknown) {
      toast.error(t('admin.uat.errorPrefix') + (e instanceof Error ? e.message : t('admin.uat.unknownError')));
    } finally {
      setCleaningUp(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FlaskConical className="w-7 h-7 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('admin.uat.title')}</h1>
            <p className="text-sm text-slate-500">{t('admin.uat.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Play className="w-4 h-4" />
          {t('admin.uat.launchTest')}
        </button>
      </div>

      {/* Launch Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="uat-modal-title">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 id="uat-modal-title" className="text-lg font-bold text-slate-800 mb-4">{t('admin.uat.newRunTitle')}</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canadaOnly}
                  onChange={(e) => setCanadaOnly(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700">{t('admin.uat.canadaOnly')}</span>
                  <p className="text-xs text-slate-500">
                    {canadaOnly ? t('admin.uat.canadaOnlyDesc34') : t('admin.uat.canadaOnlyDesc49')}
                  </p>
                </div>
              </label>

              {!canadaOnly && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-amber-700 text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    {t('admin.uat.intlWarning')}
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500 space-y-1">
                  <p>{t('admin.uat.provincesInfo')}</p>
                  <p>{t('admin.uat.scenariosInfo')}</p>
                  <p>{t('admin.uat.verificationsInfo')}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
              >
                {t('admin.uat.cancelBtn')}
              </button>
              <button
                onClick={handleLaunch}
                disabled={launching}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {t('admin.uat.startBtn', { count: canadaOnly ? 34 : 49 })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Runs List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">{t('admin.uat.runHistory')}</h2>
          <button onClick={fetchRuns} className="text-slate-400 hover:text-slate-600">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400" role="status" aria-label="Loading">
            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            <span className="sr-only">Loading...</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {t('admin.uat.noRuns')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">{t('admin.uat.dateCol')}</th>
                  <th className="px-5 py-3">{t('admin.uat.statusCol')}</th>
                  <th className="px-5 py-3">{t('admin.uat.scopeCol')}</th>
                  <th className="px-5 py-3 text-center">{t('admin.uat.scenariosCol')}</th>
                  <th className="px-5 py-3 text-center">{t('admin.uat.passedCol')}</th>
                  <th className="px-5 py-3 text-center">{t('admin.uat.failedCol')}</th>
                  <th className="px-5 py-3">{t('admin.uat.durationCol')}</th>
                  <th className="px-5 py-3">{t('admin.uat.actionsCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {runs.map(run => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono text-slate-600">#{run.runNumber}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {new Date(run.startedAt).toLocaleDateString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        <MapPin className="w-3 h-3" />
                        {run.canadaOnly ? t('admin.uat.canada') : t('admin.uat.global')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center font-mono">{run.totalScenarios}</td>
                    <td className="px-5 py-3 text-center font-mono text-green-600">{run.passedCount}</td>
                    <td className="px-5 py-3 text-center font-mono text-red-600">{run.failedCount}</td>
                    <td className="px-5 py-3 text-slate-500 font-mono text-xs">
                      {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : run.status === 'RUNNING' ? '...' : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewDetail(run.id)}
                          className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-slate-700"
                          title={t('admin.uat.viewDetail')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!run.cleanedUp && run.status !== 'RUNNING' && (
                          <button
                            onClick={() => handleCleanup(run.id)}
                            disabled={cleaningUp === run.id}
                            className="p-1.5 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-600 disabled:opacity-50"
                            title={t('admin.uat.cleanData')}
                          >
                            {cleaningUp === run.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                        {run.cleanedUp && (
                          <span className="text-xs text-slate-400 ms-1">{t('admin.uat.cleanedUp')}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Run Detail Panel */}
      {selectedRunId && (
        <RunDetailPanel
          runDetail={runDetail}
          loading={loadingDetail}
          onClose={() => { setSelectedRunId(null); setRunDetail(null); }}
          onCleanup={() => handleCleanup(selectedRunId)}
          cleaningUp={cleaningUp === selectedRunId}
        />
      )}
    </div>
  );
}

// =====================================================
// COMPONENTS
// =====================================================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: React.ReactNode }> = {
    RUNNING: { color: 'bg-blue-100 text-blue-700', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
    COMPLETED: { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
    FAILED: { color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
    CANCELLED: { color: 'bg-slate-100 text-slate-600', icon: <Clock className="w-3 h-3" /> },
    PASSED: { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
    PENDING: { color: 'bg-slate-100 text-slate-500', icon: <Clock className="w-3 h-3" /> },
    SKIPPED: { color: 'bg-amber-100 text-amber-700', icon: <AlertTriangle className="w-3 h-3" /> },
  };

  const c = config[status] || config.PENDING;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.color}`}>
      {c.icon}
      {status}
    </span>
  );
}

function RunDetailPanel({
  runDetail,
  loading,
  onClose,
  onCleanup,
  cleaningUp,
}: {
  runDetail: RunDetail | null;
  loading: boolean;
  onClose: () => void;
  onCleanup: () => void;
  cleaningUp: boolean;
}) {
  const { t } = useI18n();
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cases' | 'taxes' | 'errors'>('cases');

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center" role="status" aria-label="Loading">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-500" />
        <p className="text-sm text-slate-400 mt-2">{t('admin.uat.loadingDetail')}</p>
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!runDetail) return null;

  const { run, testCases, taxReport } = runDetail;
  const allErrors = testCases.flatMap(tc => tc.errors.map(e => ({ ...e, scenarioCode: tc.scenarioCode, region: tc.region })));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-slate-800">Run #{run.runNumber}</h2>
          <StatusBadge status={run.status} />
          {run.durationMs && (
            <span className="text-xs text-slate-400">{(run.durationMs / 1000).toFixed(1)}s</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!run.cleanedUp && run.status !== 'RUNNING' && (
            <button
              onClick={onCleanup}
              disabled={cleaningUp}
              className="flex items-center gap-1 text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              {cleaningUp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {t('admin.uat.cleanup')}
            </button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs px-3 py-1.5 border border-slate-200 rounded-lg">
            {t('admin.uat.close')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5">
        <SummaryCard label={t('admin.uat.totalLabel')} value={run.totalScenarios} color="text-slate-700" />
        <SummaryCard label={t('admin.uat.passedLabel')} value={run.passedCount} color="text-green-600" />
        <SummaryCard label={t('admin.uat.failedLabel')} value={run.failedCount} color="text-red-600" />
        <SummaryCard label={t('admin.uat.skippedLabel')} value={run.skippedCount} color="text-amber-600" />
      </div>

      {/* Progress Bar */}
      <div className="px-5 pb-3">
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${(run.passedCount / Math.max(run.totalScenarios, 1)) * 100}%` }} />
          <div className="h-full bg-red-500 transition-all" style={{ width: `${(run.failedCount / Math.max(run.totalScenarios, 1)) * 100}%` }} />
          <div className="h-full bg-amber-400 transition-all" style={{ width: `${(run.skippedCount / Math.max(run.totalScenarios, 1)) * 100}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-100 px-5 flex gap-4">
        {[
          { key: 'cases', label: t('admin.uat.testCasesTab'), count: testCases.length },
          { key: 'taxes', label: t('admin.uat.taxReportTab'), count: taxReport.rows.length },
          { key: 'errors', label: t('admin.uat.errorsTab'), count: allErrors.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className="ms-1.5 text-xs bg-slate-100 px-1.5 py-0.5 rounded-full">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {activeTab === 'cases' && (
          <TestCasesTable testCases={testCases} expandedCase={expandedCase} onToggle={setExpandedCase} />
        )}
        {activeTab === 'taxes' && (
          <TaxReportTable taxReport={taxReport} />
        )}
        {activeTab === 'errors' && (
          <ErrorsList errors={allErrors} />
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function TestCasesTable({
  testCases,
  expandedCase,
  onToggle,
}: {
  testCases: UatTestCase[];
  expandedCase: string | null;
  onToggle: (id: string | null) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-1">
      {testCases.map(tc => (
        <div key={tc.id} className="border border-slate-100 rounded-lg overflow-hidden">
          <button
            onClick={() => onToggle(expandedCase === tc.id ? null : tc.id)}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-start hover:bg-slate-50 text-sm"
          >
            {expandedCase === tc.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            <StatusBadge status={tc.status} />
            <span className="font-mono text-xs text-slate-500 w-32 flex-shrink-0">{tc.scenarioCode}</span>
            <span className="text-slate-600 truncate flex-1">{tc.scenarioName}</span>
            <span className="text-xs text-slate-400 w-10 flex-shrink-0">{tc.region}</span>
            {tc.orderNumber && <span className="font-mono text-xs text-slate-400">{tc.orderNumber}</span>}
            {tc.durationMs && <span className="text-xs text-slate-400 w-14 text-end">{tc.durationMs}ms</span>}
            {tc.errors.length > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{tc.errors.length} err</span>
            )}
          </button>

          {expandedCase === tc.id && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 space-y-3">
              {/* Taxes comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">{t('admin.uat.expectedTaxes')}</p>
                  <TaxDisplay taxes={tc.expectedTaxes} />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">{t('admin.uat.actualTaxes')}</p>
                  <TaxDisplay taxes={tc.actualTaxes} />
                </div>
              </div>

              {/* Totals */}
              <div className="flex gap-4 text-xs">
                <span className="text-slate-500">{t('admin.uat.expectedTotal')}: <strong>{tc.expectedTotal ? `${Number(tc.expectedTotal).toFixed(2)}$` : '-'}</strong></span>
                <span className="text-slate-500">{t('admin.uat.actualTotal')}: <strong>{tc.actualTotal ? `${Number(tc.actualTotal).toFixed(2)}$` : '-'}</strong></span>
              </div>

              {/* Verifications */}
              {tc.verifications && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">{t('admin.uat.verifications')}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(tc.verifications).map(([key, passed]) => (
                      <span
                        key={key}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                          passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {key}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {tc.errors.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-500 mb-1">{t('admin.uat.errorsCount', { count: tc.errors.length })}</p>
                  <div className="space-y-1">
                    {tc.errors.map(err => (
                      <ErrorCard key={err.id} error={err} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TaxDisplay({ taxes }: { taxes: Record<string, number> | null }) {
  const { t, formatCurrency } = useI18n();
  if (!taxes) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className="flex gap-3 text-xs font-mono">
      {taxes.tps !== undefined && taxes.tps > 0 && <span>{t('admin.accounting.tax.tps')}: {formatCurrency(Number(taxes.tps))}</span>}
      {taxes.tvq !== undefined && taxes.tvq > 0 && <span>{t('admin.accounting.tax.tvq')}: {formatCurrency(Number(taxes.tvq))}</span>}
      {taxes.tvh !== undefined && taxes.tvh > 0 && <span>{t('admin.accounting.tax.tvh')}: {formatCurrency(Number(taxes.tvh))}</span>}
      {taxes.pst !== undefined && taxes.pst > 0 && <span>{t('admin.accounting.tax.pst')}: {formatCurrency(Number(taxes.pst))}</span>}
      {taxes.total !== undefined && <span className="font-bold">{t('admin.uat.totalLabel')}: {formatCurrency(Number(taxes.total))}</span>}
    </div>
  );
}

function TaxReportTable({ taxReport }: { taxReport: TaxReport }) {
  const { t, formatCurrency } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <th className="px-3 py-2">{t('admin.uat.region')}</th>
            <th className="px-3 py-2 text-end">{t('admin.uat.sales')}</th>
            <th className="px-3 py-2 text-end">{t('admin.uat.totalSales')}</th>
            <th className="px-3 py-2 text-end">{t('admin.accounting.tax.tps')}</th>
            <th className="px-3 py-2 text-end">{t('admin.accounting.tax.tvq')}</th>
            <th className="px-3 py-2 text-end">{t('admin.accounting.tax.tvh')}</th>
            <th className="px-3 py-2 text-end">{t('admin.accounting.tax.pst')}</th>
            <th className="px-3 py-2 text-end">{t('admin.uat.totalTaxes')}</th>
            <th className="px-3 py-2 text-end">{t('admin.uat.expectedCol')}</th>
            <th className="px-3 py-2 text-end">{t('admin.uat.difference')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {taxReport.rows.map(row => (
            <tr key={row.region} className="hover:bg-slate-50">
              <td className="px-3 py-2 font-medium">{row.region}</td>
              <td className="px-3 py-2 text-end font-mono">{row.salesCount}</td>
              <td className="px-3 py-2 text-end font-mono">{formatCurrency(row.totalSales)}</td>
              <td className="px-3 py-2 text-end font-mono">{row.tpsCollected > 0 ? formatCurrency(row.tpsCollected) : '-'}</td>
              <td className="px-3 py-2 text-end font-mono">{row.tvqCollected > 0 ? formatCurrency(row.tvqCollected) : '-'}</td>
              <td className="px-3 py-2 text-end font-mono">{row.tvhCollected > 0 ? formatCurrency(row.tvhCollected) : '-'}</td>
              <td className="px-3 py-2 text-end font-mono">{row.pstCollected > 0 ? formatCurrency(row.pstCollected) : '-'}</td>
              <td className="px-3 py-2 text-end font-mono font-medium">{formatCurrency(row.totalTaxCollected)}</td>
              <td className="px-3 py-2 text-end font-mono">{formatCurrency(row.expectedTotalTax)}</td>
              <td className={`px-3 py-2 text-end font-mono font-medium ${Math.abs(row.difference) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                {row.difference > 0 ? '+' : ''}{formatCurrency(row.difference)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-200 font-bold">
            <td className="px-3 py-2">{t('admin.uat.totalRow')}</td>
            <td className="px-3 py-2 text-end">{taxReport.rows.reduce((s, r) => s + r.salesCount, 0)}</td>
            <td className="px-3 py-2 text-end font-mono">{formatCurrency(taxReport.totalSales)}</td>
            <td className="px-3 py-2" colSpan={4}></td>
            <td className="px-3 py-2 text-end font-mono">{formatCurrency(taxReport.totalTaxCollected)}</td>
            <td className="px-3 py-2 text-end font-mono">{formatCurrency(taxReport.totalExpectedTax)}</td>
            <td className={`px-3 py-2 text-end font-mono ${Math.abs(taxReport.totalDifference) > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
              {taxReport.totalDifference > 0 ? '+' : ''}{formatCurrency(taxReport.totalDifference)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ErrorsList({ errors }: { errors: (UatTestError & { scenarioCode: string; region: string })[] }) {
  const { t } = useI18n();
  const [expandedError, setExpandedError] = useState<string | null>(null);

  if (errors.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <CheckCircle2 className="w-8 h-8 mx-auto text-green-400" />
        <p className="mt-2 text-sm">{t('admin.uat.noErrors')}</p>
      </div>
    );
  }

  // Group by category
  const grouped = errors.reduce<Record<string, typeof errors>>((acc, err) => {
    if (!acc[err.category]) acc[err.category] = [];
    acc[err.category].push(err);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, errs]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {category} ({errs.length})
          </h3>
          <div className="space-y-1">
            {errs.map(err => (
              <ErrorCard key={err.id} error={err} expanded={expandedError === err.id} onToggle={() => setExpandedError(expandedError === err.id ? null : err.id)} showScenario />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorCard({
  error,
  expanded,
  onToggle,
  showScenario,
}: {
  error: UatTestError & { scenarioCode?: string; region?: string };
  expanded?: boolean;
  onToggle?: () => void;
  showScenario?: boolean;
}) {
  const { t } = useI18n();
  const severityColor = {
    ERROR: 'border-red-200 bg-red-50',
    WARNING: 'border-amber-200 bg-amber-50',
    INFO: 'border-blue-200 bg-blue-50',
  }[error.severity] || 'border-slate-200 bg-slate-50';

  const severityIcon = {
    ERROR: <XCircle className="w-3.5 h-3.5 text-red-500" />,
    WARNING: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
    INFO: <Info className="w-3.5 h-3.5 text-blue-500" />,
  }[error.severity];

  return (
    <div
      className={`border rounded-lg ${severityColor} ${onToggle ? 'cursor-pointer' : ''}`}
      onClick={onToggle}
    >
      <div className="px-3 py-2 flex items-start gap-2">
        {severityIcon}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-700">{error.message}</p>
          <div className="flex gap-3 mt-1 text-[10px] text-slate-500">
            {showScenario && error.scenarioCode && <span>{error.scenarioCode} ({error.region})</span>}
            {error.expected && <span>{t('admin.uat.expected')}: <strong>{error.expected}</strong></span>}
            {error.actual && <span>{t('admin.uat.actual')}: <strong>{error.actual}</strong></span>}
          </div>
        </div>
      </div>
      {expanded && error.context && (
        <div className="px-3 py-2 border-t border-slate-200 bg-white/50">
          <pre className="text-[10px] text-slate-600 overflow-x-auto">{JSON.stringify(error.context, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
