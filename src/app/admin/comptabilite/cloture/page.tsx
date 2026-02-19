'use client';

import { useState, useEffect } from 'react';
import { Check, Loader2, Info, Save, Lock } from 'lucide-react';
import { PageHeader, StatusBadge, Button } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';

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

type BadgeVariant = 'info' | 'warning' | 'success' | 'neutral';

export default function CloturePage() {
  const { t, formatDate } = useI18n();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [lockingPeriod, setLockingPeriod] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all periods
  const fetchPeriods = async () => {
    try {
      const res = await fetch('/api/accounting/periods');
      if (!res.ok) throw new Error(t('admin.closing.errorLoadPeriods'));
      const data = await res.json();
      const fetchedPeriods: Period[] = (data.periods || []).sort(
        (a: Period, b: Period) => b.code.localeCompare(a.code)
      );
      setPeriods(fetchedPeriods);
      if (fetchedPeriods.length > 0 && !selectedPeriod) {
        setSelectedPeriod(fetchedPeriods[0].code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin.closing.errorUnknown'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch checklist for selected period
  const fetchChecklist = async (code: string) => {
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
  };

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

  useEffect(() => {
    fetchPeriods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      fetchChecklist(selectedPeriod);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod]);

  const theme = sectionThemes.compliance;

  if (loading) return (
    <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
      <div className="grid grid-cols-4 gap-4">
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
      <div className="grid grid-cols-3 gap-4">
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

      {/* Current Period Details */}
      {currentPeriod && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 bg-emerald-50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-emerald-900">{currentPeriod.name}</h2>
                <p className="text-emerald-700">{t('admin.closing.closingChecklist')}</p>
              </div>
              <div className="text-end">
                <p className="text-sm text-emerald-600">{t('admin.closing.progressLabel')}</p>
                <p className="text-2xl font-bold text-emerald-900">{okTasks}/{checklist.length}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {checklistLoading ? (
              <div className="text-center py-8 text-slate-500">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                {t('admin.closing.analyzing')}
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
              <Button
                variant="primary"
                icon={Lock}
                disabled={!canLock || lockingPeriod}
                onClick={handleLockPeriod}
                className={!canLock ? 'bg-slate-300 text-slate-500 cursor-not-allowed hover:bg-slate-300 border-slate-300' : `${theme.btnPrimary} border-transparent text-white`}
              >
                {lockingPeriod ? t('admin.closing.locking') : t('admin.closing.closePeriod')}
              </Button>
            </div>
          </div>
        </div>
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
