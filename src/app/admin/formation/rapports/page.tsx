'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, DataTable, EmptyState, type Column } from '@/components/admin';
import { FilterBar, SelectFilter } from '@/components/admin';
import { FileText, Download, BarChart3, Shield, Award, TrendingUp } from 'lucide-react';

type ReportType = 'completionByDept' | 'ufcCredits' | 'complianceStatus' | 'courseEffectiveness';

interface ReportConfig {
  key: ReportType;
  icon: typeof FileText;
  titleKey: string;
  descKey: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReportRow = Record<string, any>;

export default function RapportsPage() {
  const { t } = useTranslations();

  const [activeReport, setActiveReport] = useState<ReportType | null>(null);
  const [dateRange, setDateRange] = useState('all');
  const [reportData, setReportData] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  const reports: ReportConfig[] = [
    { key: 'completionByDept', icon: BarChart3, titleKey: 'admin.lms.reports.completionByDept', descKey: 'admin.lms.reports.completionByDeptDesc' },
    { key: 'ufcCredits', icon: Award, titleKey: 'admin.lms.reports.ufcCredits', descKey: 'admin.lms.reports.ufcCreditsDesc' },
    { key: 'complianceStatus', icon: Shield, titleKey: 'admin.lms.reports.complianceStatus', descKey: 'admin.lms.reports.complianceStatusDesc' },
    { key: 'courseEffectiveness', icon: TrendingUp, titleKey: 'admin.lms.reports.courseEffectiveness', descKey: 'admin.lms.reports.courseEffectivenessDesc' },
  ];

  const dateOptions = [
    { value: '30', label: t('admin.lms.reports.last30Days') },
    { value: '90', label: t('admin.lms.reports.last90Days') },
    { value: '365', label: t('admin.lms.reports.lastYear') },
    { value: 'all', label: t('admin.lms.reports.allTime') },
  ];

  const fetchReport = useCallback(async (type: ReportType) => {
    setLoading(true);
    setActiveReport(type);
    try {
      const params = new URLSearchParams({ reportType: type });
      if (dateRange !== 'all') params.set('days', dateRange);
      const res = await fetch(`/api/admin/lms/analytics?${params}`);
      const data = await res.json();
      const rows = data.data ?? data.rows ?? data;
      setReportData(Array.isArray(rows) ? rows : []);
    } catch {
      setReportData([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  const exportCsv = useCallback(() => {
    if (reportData.length === 0) return;
    const headers = Object.keys(reportData[0]);
    const csvRows = [
      headers.join(','),
      ...reportData.map(row =>
        headers.map(h => {
          const val = row[h];
          const str = String(val ?? '');
          return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(',')
      ),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${activeReport}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reportData, activeReport]);

  // Column definitions per report type
  const getColumns = (): Column<ReportRow>[] => {
    switch (activeReport) {
      case 'completionByDept':
        return [
          { key: 'department', header: t('admin.lms.reports.department'), render: (r) => <span className="font-medium text-slate-900">{r.department ?? r.name ?? '—'}</span> },
          { key: 'totalEnrolled', header: t('admin.lms.reports.totalEnrolled'), align: 'center', render: (r) => <span className="tabular-nums">{r.totalEnrolled ?? r.enrolled ?? 0}</span> },
          { key: 'completed', header: t('admin.lms.reports.completedCount'), align: 'center', render: (r) => <span className="tabular-nums">{r.completedCount ?? r.completed ?? 0}</span> },
          {
            key: 'rate', header: t('admin.lms.reports.completionRate'), render: (r) => {
              const rate = r.completionRate ?? (r.totalEnrolled ? ((r.completedCount ?? r.completed ?? 0) / r.totalEnrolled * 100) : 0);
              return (
                <div className="flex items-center gap-2">
                  <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(rate, 100)}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums">{Number(rate).toFixed(0)}%</span>
                </div>
              );
            },
          },
        ];
      case 'ufcCredits':
        return [
          { key: 'name', header: t('admin.lms.reports.studentName'), render: (r) => <span className="font-medium text-slate-900">{r.studentName ?? r.name ?? '—'}</span> },
          { key: 'totalUfc', header: t('admin.lms.reports.totalUfc'), align: 'center', render: (r) => <span className="tabular-nums font-medium">{r.totalUfc ?? r.ufcCredits ?? 0}</span> },
          { key: 'earned', header: t('admin.lms.reports.earnedThisPeriod'), align: 'center', render: (r) => <span className="tabular-nums text-emerald-600">{r.earnedThisPeriod ?? r.periodCredits ?? 0}</span> },
        ];
      case 'complianceStatus':
        return [
          { key: 'name', header: t('admin.lms.reports.employeeName'), render: (r) => <span className="font-medium text-slate-900">{r.employeeName ?? r.name ?? '—'}</span> },
          { key: 'required', header: t('admin.lms.reports.requiredTrainings'), align: 'center', render: (r) => <span className="tabular-nums">{r.requiredTrainings ?? r.required ?? 0}</span> },
          { key: 'completed', header: t('admin.lms.reports.completedTrainings'), align: 'center', render: (r) => <span className="tabular-nums text-emerald-600">{r.completedTrainings ?? r.completed ?? 0}</span> },
          { key: 'overdue', header: t('admin.lms.reports.overdueTrainings'), align: 'center', render: (r) => <span className={`tabular-nums ${(r.overdueTrainings ?? r.overdue ?? 0) > 0 ? 'text-red-600 font-medium' : 'text-slate-500'}`}>{r.overdueTrainings ?? r.overdue ?? 0}</span> },
          {
            key: 'status', header: t('admin.lms.reports.status'), render: (r) => {
              const overdue = r.overdueTrainings ?? r.overdue ?? 0;
              return (
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${overdue > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {overdue > 0 ? t('admin.lms.progressTracking.nonCompliant') : t('admin.lms.progressTracking.compliant')}
                </span>
              );
            },
          },
        ];
      case 'courseEffectiveness':
        return [
          { key: 'name', header: t('admin.lms.reports.courseName'), render: (r) => <span className="font-medium text-slate-900">{r.courseName ?? r.name ?? '—'}</span> },
          { key: 'enrolled', header: t('admin.lms.reports.totalEnrolled'), align: 'center', render: (r) => <span className="tabular-nums">{r.totalEnrolled ?? r.enrolled ?? 0}</span> },
          {
            key: 'completionRate', header: t('admin.lms.reports.completionRate'), render: (r) => {
              const rate = r.completionRate ?? 0;
              return (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(rate, 100)}%` }} />
                  </div>
                  <span className="text-xs tabular-nums">{Number(rate).toFixed(0)}%</span>
                </div>
              );
            },
          },
          { key: 'avgScore', header: t('admin.lms.reports.avgScore'), align: 'center', render: (r) => <span className="tabular-nums">{r.avgScore != null ? `${Number(r.avgScore).toFixed(0)}%` : '—'}</span> },
          { key: 'passRate', header: t('admin.lms.reports.passRate'), align: 'center', render: (r) => <span className="tabular-nums">{r.passRate != null ? `${Number(r.passRate).toFixed(0)}%` : '—'}</span> },
          { key: 'avgTime', header: t('admin.lms.reports.avgCompletionTime'), render: (r) => <span className="text-sm text-slate-600">{r.avgCompletionTime ?? r.avgTime ?? '—'}</span> },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.reports.title')}
        subtitle={t('admin.lms.reports.subtitle')}
        backHref="/admin/formation"
      />

      {/* Report type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {reports.map((report) => {
          const Icon = report.icon;
          const isActive = activeReport === report.key;
          return (
            <button
              key={report.key}
              onClick={() => fetchReport(report.key)}
              className={`
                text-left p-4 rounded-xl border-2 transition-all duration-200
                ${isActive
                  ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }
              `}
            >
              <div className={`p-2 rounded-lg inline-flex mb-2 ${isActive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
              </div>
              <h3 className={`text-sm font-medium ${isActive ? 'text-indigo-900' : 'text-slate-900'}`}>
                {t(report.titleKey)}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {t(report.descKey)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filters + export */}
      {activeReport && (
        <FilterBar
          actions={
            <div className="flex items-center gap-2">
              <SelectFilter
                label={t('admin.lms.reports.dateRange')}
                value={dateRange}
                onChange={(v) => { setDateRange(v); if (activeReport) fetchReport(activeReport); }}
                options={dateOptions}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={exportCsv}
                disabled={reportData.length === 0}
              >
                <Download className="mr-1.5 h-4 w-4" />
                {t('admin.lms.reports.exportCsv')}
              </Button>
            </div>
          }
        />
      )}

      {/* Report data table */}
      {!activeReport ? (
        <EmptyState
          icon={FileText}
          title={t('admin.lms.reports.selectReport')}
          description={t('admin.lms.reports.subtitle')}
        />
      ) : (
        <DataTable
          columns={getColumns()}
          data={reportData}
          keyExtractor={(r) => r.id ?? r.name ?? r.department ?? r.employeeName ?? r.courseName ?? r.studentName ?? '0'}
          loading={loading}
          emptyTitle={t('admin.lms.reports.noReportData')}
          emptyDescription={t('admin.lms.reports.noReportDataDesc')}
        />
      )}
    </div>
  );
}
