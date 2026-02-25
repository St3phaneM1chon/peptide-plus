'use client';

import { useState, useEffect, useCallback } from 'react';
import { Check, Loader2, Info, Save, Lock, Unlock, Shield, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';
import { PageHeader, StatusBadge, Button, SectionCard, type BadgeVariant } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

interface ChecklistItem {
  id: string;
  label: string;
  status: 'pending' | 'ok' | 'warning' | 'error';
  detail?: string;
  count?: number;
}

interface Period {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  status: 'OPEN' | 'IN_REVIEW' | 'CLOSED' | 'LOCKED';
  closingChecklist?: string | null;
}


export default function CloturePage() {
  const { t, formatDate } = useI18n();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [lockingPeriod, setLockingPeriod] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all periods, returns the first period code so callers can kick off checklist in parallel
  const fetchPeriods = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/accounting/periods');
      if (!res.ok) throw new Error(t('admin.closing.errorLoadPeriods'));
      const data = await res.json();
      const fetchedPeriods: Period[] = (data.periods || []).sort(
        (a: Period, b: Period) => b.code.localeCompare(a.code)
      );
      setPeriods(fetchedPeriods);
      if (fetchedPeriods.length > 0 && !selectedPeriod) {
        const firstCode = fetchedPeriods[0].code;
        setSelectedPeriod(firstCode);
        return firstCode;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.closing.errorUnknown'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [t, selectedPeriod]);

  // Fetch checklist for selected period
  const fetchChecklist = useCallback(async (code: string) => {
    if (!code) return;
    setChecklistLoading(true);
    try {
      const res = await fetch(`/api/accounting/periods/${code}/close`);
      if (!res.ok) throw new Error(t('admin.closing.errorLoadChecklist'));
      const data = await res.json();
      setChecklist(data.checklist || []);
    } catch (err) {
      console.error('Checklist error:', err);
      // If checklist fetch fails, try to parse from period's closingChecklist
      const period = periods.find(p => p.code === code);
      if (period?.closingChecklist) {
        try {
          setChecklist(JSON.parse(period.closingChecklist));
        } catch {
          setChecklist([]);
        }
      } else {
        setChecklist([]);
      }
    } finally {
      setChecklistLoading(false);
    }
  }, [t, periods]);

  // Lock/close a period
  const handleLockPeriod = async () => {
    if (!selectedPeriod || lockingPeriod) return;
    setLockingPeriod(true);
    try {
      const res = await fetch(`/api/accounting/periods/${selectedPeriod}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closedBy: 'admin' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('admin.closing.errorLocking'));
      }
      // Refresh periods and checklist
      await fetchPeriods();
      await fetchChecklist(selectedPeriod);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.closing.errorLockingPeriod'));
    } finally {
      setLockingPeriod(false);
    }
  };

  // Unlock/reopen a period
  const handleUnlockPeriod = async () => {
    if (!selectedPeriod || lockingPeriod) return;
    const period = periods.find(p => p.code === selectedPeriod);
    if (!period || period.status !== 'LOCKED') {
      toast.error(t('admin.closing.validationError'));
      return;
    }
    setLockingPeriod(true);
    try {
      const res = await fetch('/api/accounting/periods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: selectedPeriod, status: 'OPEN' }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('admin.closing.unlockSuccess'));
      await fetchPeriods();
      await fetchChecklist(selectedPeriod);
    } catch {
      toast.error(t('admin.closing.errorLockingPeriod'));
    } finally {
      setLockingPeriod(false);
    }
  };

  useEffect(() => {
    // Fetch periods and, once we have the first period code, fetch its checklist in parallel
    fetchPeriods().then((firstCode) => {
      if (firstCode) fetchChecklist(firstCode);
    });
  }, [fetchPeriods, fetchChecklist]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchChecklist(selectedPeriod);
    }
  }, [selectedPeriod, fetchChecklist]);

  // Ribbon actions
  const handleRibbonVerifyBalances = useCallback(() => { fetchChecklist(selectedPeriod); }, [fetchChecklist, selectedPeriod]);
  const handleRibbonAuditTrail = useCallback(() => {
    window.location.href = '/admin/comptabilite/audit';
  }, []);
  const handleRibbonClosePeriod = useCallback(() => { handleLockPeriod(); }, [handleLockPeriod]);
  const handleRibbonReopen = useCallback(async () => {
    if (!selectedPeriod) { toast.info(t('admin.periodClosing.selectPeriod') || 'Selectionnez une periode a rouvrir.'); return; }
    const period = periods.find(p => p.code === selectedPeriod);
    if (!period || period.status !== 'LOCKED') { toast.error(t('admin.periodClosing.notLocked') || 'Seule une periode verrouillee peut etre rouverte.'); return; }
    try {
      const res = await fetch('/api/accounting/periods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: selectedPeriod, status: 'OPEN' }),
      });
      if (!res.ok) throw new Error();
      toast.success(t('admin.periodClosing.reopened') || `Periode ${selectedPeriod} rouverte`);
      const firstCode = await fetchPeriods();
      if (firstCode) fetchChecklist(firstCode);
    } catch {
      toast.error(t('admin.periodClosing.reopenError') || 'Erreur lors de la reouverture');
    }
  }, [selectedPeriod, periods, fetchPeriods, fetchChecklist, t]);
  const handleRibbonFiscalCalendar = useCallback(() => {
    window.location.href = '/admin/comptabilite/calendrier-fiscal';
  }, []);
  const handleRibbonTaxReturn = useCallback(() => {
    window.location.href = '/admin/comptabilite/declaration-tps-tvq';
  }, []);
  const handleRibbonExport = useCallback(() => {
    if (checklist.length === 0) { toast.error(t('admin.periodClosing.noChecklistToExport') || 'Aucune checklist a exporter'); return; }
    const bom = '\uFEFF';
    const headers = [t('admin.periodClosing.colTask') || 'Tache', t('admin.periodClosing.colCompleted') || 'Complete'];
    const rows = checklist.map(item => [item.label || item.id, item.status === 'ok' ? 'Oui' : item.status]);
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `cloture-${selectedPeriod}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.periodClosing.exportSuccess') || 'Checklist exportee');
  }, [checklist, selectedPeriod, t]);

  useRibbonAction('verifyBalances', handleRibbonVerifyBalances);
  useRibbonAction('auditTrail', handleRibbonAuditTrail);
  useRibbonAction('closePeriod', handleRibbonClosePeriod);
  useRibbonAction('reopen', handleRibbonReopen);
  useRibbonAction('fiscalCalendar', handleRibbonFiscalCalendar);
  useRibbonAction('taxReturn', handleRibbonTaxReturn);
  useRibbonAction('export', handleRibbonExport);

  const theme = sectionThemes.compliance;

  if (loading) return (
    <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>)}
      </div>
      <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
    </div>
  );
  if (error) return <div className="p-8 text-center text-red-600">{t('admin.closing.errorPrefix')} {error}</div>;

  const currentPeriod = periods.find(p => p.code === selectedPeriod) || periods[0];
  const okTasks = checklist.filter(t => t.status === 'ok').length;
  const errorTasks = checklist.filter(t => t.status === 'error').length;
  const canLock = checklist.length > 0 && errorTasks === 0 && currentPeriod?.status !== 'LOCKED';

  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    OPEN: { label: t('admin.closing.statusOpen'), variant: 'info' },
    IN_REVIEW: { label: t('admin.closing.statusInReview'), variant: 'warning' },
    CLOSED: { label: t('admin.closing.statusClosed'), variant: 'success' },
    LOCKED: { label: t('admin.closing.statusLocked'), variant: 'neutral' },
  };

  const taskStatusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    pending: { label: t('admin.closing.taskPending'), variant: 'neutral' },
    ok: { label: t('admin.closing.taskOk'), variant: 'success' },
    warning: { label: t('admin.closing.taskWarning'), variant: 'warning' },
    error: { label: t('admin.closing.taskError'), variant: 'info' },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.closing.title')}
        subtitle={t('admin.closing.subtitle')}
        theme={theme}
      />

      {/* Period Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {periods.map((period) => {
          const savedChecklist: ChecklistItem[] = period.closingChecklist
            ? (() => { try { return JSON.parse(period.closingChecklist); } catch { return []; } })()
            : [];
          const doneCount = savedChecklist.filter((t: ChecklistItem) => t.status === 'ok').length;
          return (
            <div
              key={period.id}
              onClick={() => setSelectedPeriod(period.code)}
              className={`bg-white rounded-xl p-5 border cursor-pointer transition-all hover:shadow-md ${
                selectedPeriod === period.code ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">{period.name}</h3>
                <StatusBadge variant={statusConfig[period.status]?.variant || 'neutral'}>
                  {statusConfig[period.status]?.label || period.status}
                </StatusBadge>
              </div>
              <p className="text-sm text-slate-500 mb-3">
                {formatDate(period.startDate)} - {formatDate(period.endDate)}
              </p>
              {savedChecklist.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${(doneCount / savedChecklist.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    {doneCount}/{savedChecklist.length}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion Percentage Overview */}
      {currentPeriod && checklist.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                okTasks === checklist.length ? 'bg-green-100' : errorTasks > 0 ? 'bg-red-100' : 'bg-amber-100'
              }`}>
                {okTasks === checklist.length ? (
                  <ShieldCheck className="w-6 h-6 text-green-600" />
                ) : errorTasks > 0 ? (
                  <ShieldAlert className="w-6 h-6 text-red-600" />
                ) : (
                  <Shield className="w-6 h-6 text-amber-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{t('admin.closing.stepByStep')}</h3>
                <p className="text-sm text-slate-500">
                  {t('admin.closing.stepsCompleted').replace('{done}', String(okTasks)).replace('{total}', String(checklist.length))}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-slate-900">
                {checklist.length > 0 ? Math.round((okTasks / checklist.length) * 100) : 0}%
              </p>
              <p className="text-xs text-slate-500">
                {t('admin.closing.completionPercentage').replace('{value}', String(checklist.length > 0 ? Math.round((okTasks / checklist.length) * 100) : 0))}
              </p>
            </div>
          </div>
          {/* Large progress bar */}
          <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                okTasks === checklist.length ? 'bg-green-500' : errorTasks > 0 ? 'bg-red-500' : 'bg-amber-500'
              }`}
              style={{ width: `${checklist.length > 0 ? (okTasks / checklist.length) * 100 : 0}%` }}
            />
          </div>
          {/* Step indicators */}
          <div className="flex items-center justify-between mt-3">
            {checklist.map((task, idx) => (
              <div key={task.id} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  task.status === 'ok' ? 'bg-green-500 text-white' :
                  task.status === 'error' ? 'bg-red-500 text-white' :
                  task.status === 'warning' ? 'bg-yellow-500 text-white' :
                  'bg-slate-200 text-slate-500'
                }`}>
                  {task.status === 'ok' ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 text-center max-w-[60px] truncate">{task.label?.split(' ').slice(0, 2).join(' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Period Details */}
      {currentPeriod && (
        <SectionCard
          title={currentPeriod.name}
          theme={theme}
          headerAction={
            <div className="text-end">
              <p className="text-sm text-slate-500">{t('admin.closing.progressLabel')}</p>
              <p className="text-2xl font-bold text-amber-700">{okTasks}/{checklist.length}</p>
            </div>
          }
          noPadding
        >

          <div className="p-6">
            {checklistLoading ? (
              <div className="text-center py-8 text-slate-500" role="status" aria-label="Loading">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                {t('admin.closing.analyzing')}
                <span className="sr-only">Loading...</span>
              </div>
            ) : checklist.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {t('admin.closing.clickToVerify')}
              </div>
            ) : (
              <div className="space-y-3">
                {checklist.map((task) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      task.status === 'ok' ? 'bg-green-50 border-green-200' :
                      task.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                      task.status === 'error' ? 'bg-red-50 border-red-200' :
                      'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {task.status === 'ok' ? (
                        <span className="w-8 h-8 flex items-center justify-center bg-green-500 text-white rounded-full">
                          <Check className="w-5 h-5" />
                        </span>
                      ) : task.status === 'warning' ? (
                        <span className="w-8 h-8 flex items-center justify-center bg-yellow-500 text-white rounded-full">
                          <Info className="w-5 h-5" />
                        </span>
                      ) : task.status === 'error' ? (
                        <span className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-full">
                          <span className="text-sm font-bold">!</span>
                        </span>
                      ) : (
                        <span className="w-8 h-8 flex items-center justify-center bg-slate-300 text-white rounded-full">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900">{task.label}</h4>
                        {task.count !== undefined && task.count > 0 && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">{task.count}</span>
                        )}
                      </div>
                      {task.detail && (
                        <p className="text-sm text-slate-500 mt-0.5">{task.detail}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge variant={taskStatusConfig[task.status]?.variant || 'neutral'}>
                        {taskStatusConfig[task.status]?.label || task.status}
                      </StatusBadge>
                      {/* Validation indicator */}
                      {task.status === 'ok' && (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {t('admin.closing.validationOk')}
                        </span>
                      )}
                      {task.status === 'pending' && (
                        <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {t('admin.closing.validationPending')}
                        </span>
                      )}
                      {task.status === 'error' && (
                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          {t('admin.closing.validationError')}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              {currentPeriod.status === 'LOCKED' ? (
                <span className="text-slate-500">&#128274; {t('admin.closing.periodLocked')}</span>
              ) : errorTasks > 0 ? (
                <span className="text-red-600">&#9888; {t('admin.closing.errorsToFix', { count: errorTasks })}</span>
              ) : checklist.length > 0 && errorTasks === 0 ? (
                <span className="text-green-600">&#10003; {t('admin.closing.noBlockingErrors')}</span>
              ) : (
                <span className="text-yellow-600">&#9888; {t('admin.closing.runVerification')}</span>
              )}
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                icon={Save}
                onClick={() => fetchChecklist(selectedPeriod)}
                disabled={checklistLoading}
              >
                {t('admin.closing.rerunVerification')}
              </Button>
              {currentPeriod?.status === 'LOCKED' ? (
                <Button
                  variant="secondary"
                  icon={Unlock}
                  onClick={handleUnlockPeriod}
                  disabled={lockingPeriod}
                  className="border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                >
                  {lockingPeriod ? t('admin.closing.locking') : t('admin.closing.unlockPeriod')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon={Lock}
                  disabled={!canLock || lockingPeriod}
                  onClick={handleLockPeriod}
                  className={!canLock ? 'bg-slate-300 text-slate-500 cursor-not-allowed hover:bg-slate-300 border-slate-300' : `${theme.btnPrimary} border-transparent text-white`}
                >
                  {lockingPeriod ? t('admin.closing.locking') : t('admin.closing.lockPeriod')}
                </Button>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Info className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">{t('admin.closing.tipsTitle')}</h3>
        </div>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-500">&#8226;</span>
            {t('admin.closing.tip1')}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">&#8226;</span>
            {t('admin.closing.tip2')}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">&#8226;</span>
            {t('admin.closing.tip3')}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">&#8226;</span>
            {t('admin.closing.tip4')}
          </li>
        </ul>
      </div>
    </div>
  );
}
