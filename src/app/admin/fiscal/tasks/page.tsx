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
  const countries = getAllCountriesWithCompliance();
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
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
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
          name: `${report.status === 'GENERATED' ? 'Declarer' : 'Payer'} ${report.region} - ${report.period}`,
          nameFr: `${report.status === 'GENERATED' ? 'Declarer' : 'Payer'} ${report.region} - ${report.period}`,
          description: `Rapport fiscal ${report.region} pour la periode ${report.period}. Echeance: ${new Date(report.dueDate).toLocaleDateString('fr-CA')}`,
          descriptionFr: `Rapport fiscal ${report.region} pour la periode ${report.period}`,
          dueDate: new Date(report.dueDate).toLocaleDateString('fr-CA'),
          frequency: 'monthly',
          countryCode: report.regionCode,
          countryName: report.region,
          status: daysUntil < 0 ? 'overdue' : 'pending',
        });
      });

    return tasks;
  }, [countries, apiReportTasks]);

  const [tasks, setTasks] = useState<TaskWithCountry[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterFrequency, setFilterFrequency] = useState<string>('all');
  const [filterCountry, setFilterCountry] = useState<string>('all');

  // Update tasks when allTasks changes
  useEffect(() => {
    setTasks(allTasks);
  }, [allTasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesFrequency = filterFrequency === 'all' || task.frequency === filterFrequency;
      const matchesCountry = filterCountry === 'all' || task.countryCode === filterCountry;
      return matchesStatus && matchesFrequency && matchesCountry;
    });
  }, [tasks, filterStatus, filterFrequency, filterCountry]);

  // Group tasks by due date period
  const groupedTasks = useMemo(() => {
    const groups: Record<string, TaskWithCountry[]> = {
      'urgent': [],
      'thisMonth': [],
      'thisQuarter': [],
      'later': [],
    };

    // For demo, we'll just distribute them
    filteredTasks.forEach((task, index) => {
      if (index % 4 === 0) groups.urgent.push(task);
      else if (index % 4 === 1) groups.thisMonth.push(task);
      else if (index % 4 === 2) groups.thisQuarter.push(task);
      else groups.later.push(task);
    });

    return groups;
  }, [filteredTasks]);

  const toggleTaskStatus = (taskId: string) => {
    setTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' as const }
        : t
    ));
  };

  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  }), [tasks]);

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Erreur: {error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Taches & Echeances Fiscales"
        subtitle="Suivi des declarations et obligations pour tous les pays"
        backHref="/admin/fiscal"
        backLabel="Obligations Fiscales"
        actions={
          <Button variant="primary" icon={Plus}>
            Ajouter une tache
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Taches totales" value={stats.total} icon={ListTodo} />
        <StatCard label="En attente" value={stats.pending} icon={Clock} />
        <StatCard label="Completees" value={stats.completed} icon={CheckCircle2} />
        <StatCard label="En retard" value={stats.overdue} icon={AlertTriangle} />
      </div>

      {/* Filters */}
      <FilterBar>
        <SelectFilter
          label="Tous les statuts"
          value={filterStatus === 'all' ? '' : filterStatus}
          onChange={(v) => setFilterStatus(v || 'all')}
          options={[
            { value: 'pending', label: 'En attente' },
            { value: 'completed', label: 'Completees' },
            { value: 'overdue', label: 'En retard' },
          ]}
        />
        <SelectFilter
          label="Toutes les frequences"
          value={filterFrequency === 'all' ? '' : filterFrequency}
          onChange={(v) => setFilterFrequency(v || 'all')}
          options={[
            { value: 'monthly', label: 'Mensuelle' },
            { value: 'quarterly', label: 'Trimestrielle' },
            { value: 'annually', label: 'Annuelle' },
          ]}
        />
        <SelectFilter
          label="Tous les pays"
          value={filterCountry === 'all' ? '' : filterCountry}
          onChange={(v) => setFilterCountry(v || 'all')}
          options={countries.map(c => ({ value: c.code, label: c.name }))}
        />
      </FilterBar>

      {/* Task Groups */}
      <div className="space-y-6">
        {groupedTasks.urgent.length > 0 && (
          <TaskGroup
            title="Urgent - Cette semaine"
            icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
            tasks={groupedTasks.urgent}
            onToggle={toggleTaskStatus}
            bgColor="bg-red-50"
            borderColor="border-red-200"
          />
        )}

        {groupedTasks.thisMonth.length > 0 && (
          <TaskGroup
            title="Ce mois-ci"
            icon={<CalendarDays className="w-5 h-5 text-yellow-600" />}
            tasks={groupedTasks.thisMonth}
            onToggle={toggleTaskStatus}
            bgColor="bg-yellow-50"
            borderColor="border-yellow-200"
          />
        )}

        {groupedTasks.thisQuarter.length > 0 && (
          <TaskGroup
            title="Ce trimestre"
            icon={<Clock className="w-5 h-5 text-sky-600" />}
            tasks={groupedTasks.thisQuarter}
            onToggle={toggleTaskStatus}
            bgColor="bg-sky-50"
            borderColor="border-sky-200"
          />
        )}

        {groupedTasks.later.length > 0 && (
          <TaskGroup
            title="Plus tard"
            icon={<ListTodo className="w-5 h-5 text-slate-500" />}
            tasks={groupedTasks.later}
            onToggle={toggleTaskStatus}
            bgColor="bg-slate-50"
            borderColor="border-slate-200"
          />
        )}
      </div>

      {filteredTasks.length === 0 && (
        <EmptyState
          icon={ListTodo}
          title="Aucune tache trouvee"
          description="Aucune tache trouvee avec ces criteres"
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
  borderColor
}: {
  title: string;
  icon: React.ReactNode;
  tasks: TaskWithCountry[];
  onToggle: (id: string) => void;
  bgColor: string;
  borderColor: string;
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
                      {task.frequency === 'monthly' ? 'Mensuel' :
                       task.frequency === 'quarterly' ? 'Trimestriel' : 'Annuel'}
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
                  <span>Echeance: {task.dueDate}</span>
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
