'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  ListTodo,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Check,
  CalendarDays,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  StatCard,
  SelectFilter,
  FilterBar,
  EmptyState,
  StatusBadge,
} from '@/components/admin';
import { getAllCountriesWithCompliance } from '@/lib/countryObligations';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface TaskWithCountry {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  dueDate: string;
  frequency: string;
  countryCode: string;
  countryName: string;
  status: 'pending' | 'completed' | 'overdue';
}

interface TaxReportTask {
  id: string;
  region: string;
  regionCode: string;
  period: string;
  status: string;
  dueDate: string;
}

export default function FiscalTasksPage() {
  const { t, locale } = useI18n();
  const countries = useMemo(() => getAllCountriesWithCompliance(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiReportTasks, setApiReportTasks] = useState<TaxReportTask[]>([]);

  // Fetch tax reports to derive real deadline-based tasks
  useEffect(() => {
    const fetchTaxReports = async () => {
      try {
        setLoading(true);
        setError(null);
        const year = new Date().getFullYear();
        const res = await fetch(`/api/accounting/tax-reports?year=${year}`);
        if (res.ok) {
          const data = await res.json();
          const reports = (data.reports || []).map((r: Record<string, unknown>) => ({
            id: r.id as string,
            region: r.region as string,
            regionCode: r.regionCode as string,
            period: r.period as string,
            status: r.status as string,
            dueDate: r.dueDate as string,
          }));
          setApiReportTasks(reports);
        }
      } catch (err) {
        console.error(err);
        toast.error(t('common.errorOccurred'));
        setError(err instanceof Error ? err.message : t('admin.fiscalTasks.unknownError'));
      } finally {
        setLoading(false);
      }
    };

    fetchTaxReports();
  }, []);

  // Flatten all tasks from all countries AND merge with API report deadlines
  const allTasks = useMemo(() => {
    const tasks: TaskWithCountry[] = [];
    countries.forEach(country => {
      country.annualTasks.forEach(task => {
        tasks.push({
          ...task,
          countryCode: country.code,
          countryName: country.name,
          status: task.status || 'pending',
        });
      });
    });

    // Add deadline tasks from real API tax reports
    apiReportTasks
      .filter(r => r.status === 'GENERATED' || r.status === 'FILED')
      .forEach(report => {
        const daysUntil = Math.ceil((new Date(report.dueDate).getTime() - Date.now()) / 86400000);
        tasks.push({
          id: `report-${report.id}`,
          name: `${report.status === 'GENERATED' ? t('admin.fiscalTasks.declare') : t('admin.fiscalTasks.pay')} ${report.region} - ${report.period}`,
          nameFr: `${report.status === 'GENERATED' ? t('admin.fiscalTasks.declare') : t('admin.fiscalTasks.pay')} ${report.region} - ${report.period}`,
          description: t('admin.fiscalTasks.fiscalReport').replace('{region}', report.region).replace('{period}', report.period).replace('{date}', new Date(report.dueDate).toLocaleDateString(locale)),
          descriptionFr: t('admin.fiscalTasks.fiscalReportShort').replace('{region}', report.region).replace('{period}', report.period),
          dueDate: new Date(report.dueDate).toLocaleDateString(locale),
          frequency: 'monthly',
          countryCode: report.regionCode,
          countryName: report.region,
          status: daysUntil < 0 ? 'overdue' : 'pending',
        });
      });

    return tasks;
  }, [countries, apiReportTasks]);

  const [toggledTasks, setToggledTasks] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFrequency, setFilterFrequency] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');

  // Apply toggled status overrides to allTasks
  const tasks = useMemo(() => {
    return allTasks.map(task => {
      if (toggledTasks.has(task.id)) {
        return { ...task, status: task.status === 'completed' ? 'pending' as const : 'completed' as const };
      }
      return task;
    });
  }, [allTasks, toggledTasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesFrequency = filterFrequency === 'all' || task.frequency === filterFrequency;
      const matchesCountry = filterCountry === 'all' || task.countryCode === filterCountry;
      return matchesStatus && matchesFrequency && matchesCountry;
    });
  }, [tasks, filterStatus, filterFrequency, filterCountry]);

  // Group tasks by real due date proximity
  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskWithCountry[]> = {
      'urgent': [],
      'thisMonth': [],
      'thisQuarter': [],
      'later': [],
    };

    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const endOfQuarter = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 0);

    filteredTasks.forEach((task) => {
      // Overdue tasks are always urgent
      if (task.status === 'overdue') {
        groups.urgent.push(task);
        return;
      }

      // Parse the due date - try ISO format first, then localized
      let dueDate: Date | null = null;
      const isoMatch = task.dueDate.match(/\d{4}-\d{2}-\d{2}/);
      if (isoMatch) {
        dueDate = new Date(isoMatch[0]);
      } else {
        // Try parsing localized date
        const parsed = new Date(task.dueDate);
        if (!isNaN(parsed.getTime())) {
          dueDate = parsed;
        }
      }

      if (!dueDate || isNaN(dueDate.getTime())) {
        // Can't parse date - put in later
        groups.later.push(task);
        return;
      }

      const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);

      if (daysUntil < 0 || daysUntil <= 7) {
        groups.urgent.push(task);
      } else if (dueDate <= endOfMonth) {
        groups.thisMonth.push(task);
      } else if (dueDate <= endOfQuarter) {
        groups.thisQuarter.push(task);
      } else {
        groups.later.push(task);
      }
    });

    // Sort each group by due date (earliest first)
    const sortByDate = (a: TaskWithCountry, b: TaskWithCountry) => {
      return a.dueDate.localeCompare(b.dueDate);
    };
    groups.urgent.sort(sortByDate);
    groups.thisMonth.sort(sortByDate);
    groups.thisQuarter.sort(sortByDate);
    groups.later.sort(sortByDate);

    return groups;
  }, [filteredTasks]);

  const toggleTaskStatus = (taskId: string) => {
    setToggledTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  }), [tasks]);

  const frequencyLabel = (freq: string) => {
    if (freq === 'monthly') return t('admin.fiscalTasks.frequency.monthly');
    if (freq === 'quarterly') return t('admin.fiscalTasks.frequency.quarterly');
    return t('admin.fiscalTasks.frequency.annual');
  };

  if (loading) return <div className="p-8 text-center">{t('admin.fiscalTasks.loading')}</div>;
  if (error) return <div className="p-8 text-center text-red-600">{t('admin.fiscalTasks.errorPrefix')} {error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.fiscalTasks.title')}
        subtitle={t('admin.fiscalTasks.subtitle')}
        backHref="/admin/fiscal"
        backLabel={t('admin.fiscalTasks.backLabel')}
        actions={
          <Button variant="primary" icon={Plus}>
            {t('admin.fiscalTasks.addTask')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label={t('admin.fiscalTasks.stats.totalTasks')} value={stats.total} icon={ListTodo} />
        <StatCard label={t('admin.fiscalTasks.stats.pending')} value={stats.pending} icon={Clock} />
        <StatCard label={t('admin.fiscalTasks.stats.completed')} value={stats.completed} icon={CheckCircle2} />
        <StatCard label={t('admin.fiscalTasks.stats.overdue')} value={stats.overdue} icon={AlertTriangle} />
      </div>

      {/* Filters */}
      <FilterBar>
        <SelectFilter
          label={t('admin.fiscalTasks.filters.allStatuses')}
          value={filterStatus === 'all' ? '' : filterStatus}
          onChange={(v) => setFilterStatus(v || 'all')}
          options={[
            { value: 'pending', label: t('admin.fiscalTasks.filters.pending') },
            { value: 'completed', label: t('admin.fiscalTasks.filters.completed') },
            { value: 'overdue', label: t('admin.fiscalTasks.filters.overdue') },
          ]}
        />
        <SelectFilter
          label={t('admin.fiscalTasks.filters.allFrequencies')}
          value={filterFrequency === 'all' ? '' : filterFrequency}
          onChange={(v) => setFilterFrequency(v || 'all')}
          options={[
            { value: 'monthly', label: t('admin.fiscalTasks.filters.monthly') },
            { value: 'quarterly', label: t('admin.fiscalTasks.filters.quarterly') },
            { value: 'annually', label: t('admin.fiscalTasks.filters.annually') },
          ]}
        />
        <SelectFilter
          label={t('admin.fiscalTasks.filters.allCountries')}
          value={filterCountry === 'all' ? '' : filterCountry}
          onChange={(v) => setFilterCountry(v || 'all')}
          options={countries.map(c => ({ value: c.code, label: c.name }))}
        />
      </FilterBar>

      {/* Task Groups */}
      <div className="space-y-6">
        {groupedTasks.urgent.length > 0 && (
          <TaskGroup
            title={t('admin.fiscalTasks.groups.urgent')}
            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
            tasks={groupedTasks.urgent}
            onToggle={toggleTaskStatus}
            bgColor="bg-red-50"
            borderColor="border-red-200"
            frequencyLabel={frequencyLabel}
          />
        )}

        {groupedTasks.thisMonth.length > 0 && (
          <TaskGroup
            title={t('admin.fiscalTasks.groups.thisMonth')}
            icon={<CalendarDays className="w-5 h-5 text-yellow-600" />}
            tasks={groupedTasks.thisMonth}
            onToggle={toggleTaskStatus}
            bgColor="bg-yellow-50"
            borderColor="border-yellow-200"
            frequencyLabel={frequencyLabel}
          />
        )}

        {groupedTasks.thisQuarter.length > 0 && (
          <TaskGroup
            title={t('admin.fiscalTasks.groups.thisQuarter')}
            icon={<Clock className="w-5 h-5 text-sky-600" />}
            tasks={groupedTasks.thisQuarter}
            onToggle={toggleTaskStatus}
            bgColor="bg-sky-50"
            borderColor="border-sky-200"
            frequencyLabel={frequencyLabel}
          />
        )}

        {groupedTasks.later.length > 0 && (
          <TaskGroup
            title={t('admin.fiscalTasks.groups.later')}
            icon={<ListTodo className="w-5 h-5 text-slate-500" />}
            tasks={groupedTasks.later}
            onToggle={toggleTaskStatus}
            bgColor="bg-slate-50"
            borderColor="border-slate-200"
            frequencyLabel={frequencyLabel}
          />
        )}
      </div>

      {filteredTasks.length === 0 && (
        <EmptyState
          icon={ListTodo}
          title={t('admin.fiscalTasks.emptyTitle')}
          description={t('admin.fiscalTasks.emptyDescription')}
        />
      )}
    </div>
  );
}

function TaskGroup({
  title,
  icon,
  tasks,
  onToggle,
  bgColor,
  borderColor,
  frequencyLabel
}: {
  title: string;
  icon: React.ReactNode;
  tasks: TaskWithCountry[];
  onToggle: (id: string) => void;
  bgColor: string;
  borderColor: string;
  frequencyLabel: (freq: string) => string;
}) {
  return (
    <div className={`rounded-xl ${bgColor} border ${borderColor} overflow-hidden`}>
      <div className="px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
      </div>
      <div className="divide-y divide-slate-200">
        {tasks.map((task) => (
          <div key={task.id} className="px-6 py-4 bg-white hover:bg-slate-50">
            <div className="flex items-start gap-4">
              <button
                onClick={() => onToggle(task.id)}
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  task.status === 'completed'
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-slate-300 hover:border-green-500'
                }`}
              >
                {task.status === 'completed' && (
                  <Check className="w-4 h-4" />
                )}
              </button>

              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getCountryFlag(task.countryCode)}</span>
                    <h4 className={`font-semibold ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                      {task.name}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={
                      task.frequency === 'monthly' ? 'info' :
                      task.frequency === 'quarterly' ? 'primary' :
                      'warning'
                    }>
                      {frequencyLabel(task.frequency)}
                    </StatusBadge>
                    <Link
                      href={`/admin/fiscal/country/${task.countryCode}`}
                      className="text-sky-600 hover:text-sky-800 text-sm"
                    >
                      {task.countryName} &rarr;
                    </Link>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>{task.dueDate}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    CA: '\u{1F1E8}\u{1F1E6}', US: '\u{1F1FA}\u{1F1F8}', EU: '\u{1F1EA}\u{1F1FA}', GB: '\u{1F1EC}\u{1F1E7}', JP: '\u{1F1EF}\u{1F1F5}',
    AU: '\u{1F1E6}\u{1F1FA}', AE: '\u{1F1E6}\u{1F1EA}', IL: '\u{1F1EE}\u{1F1F1}', CL: '\u{1F1E8}\u{1F1F1}', PE: '\u{1F1F5}\u{1F1EA}',
  };
  return flags[code] || '\u{1F30D}';
}
