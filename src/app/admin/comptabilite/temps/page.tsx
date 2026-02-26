'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock, Play, Square, Plus, Calendar, BarChart3, FileText,
  CheckCircle, XCircle, Trash2, Edit3, RefreshCw, DollarSign,
  FolderOpen, Download, Filter, Send,
} from 'lucide-react';
import { PageHeader, Button, SectionCard, StatusBadge, Modal } from '@/components/admin';
import type { BadgeVariant } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// =============================================================================
// Types
// =============================================================================

interface TimeEntry {
  id: string;
  employeeId: string | null;
  userId: string | null;
  userName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  hoursWorked: number;
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  taskCategory: string | null;
  isBillable: boolean;
  billableRate: number | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
}

interface TimeProject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  clientName: string | null;
  budget: number | null;
  budgetAmount: number | null;
  defaultRate: number | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  hoursUsed: number;
  createdAt: string;
}

interface SummaryData {
  summary: {
    totalEntries: number;
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    billableAmount: number;
    statusCounts: Record<string, number>;
  };
  groupBy: string;
  groups: Array<{
    key: string;
    totalHours: number;
    billableHours: number;
    billableAmount: number;
    entryCount: number;
  }>;
}

// =============================================================================
// Constants
// =============================================================================

const TASK_CATEGORIES = [
  { value: 'development', label: 'Developpement' },
  { value: 'design', label: 'Design' },
  { value: 'admin', label: 'Administration' },
  { value: 'support', label: 'Support' },
  { value: 'accounting', label: 'Comptabilite' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'meeting', label: 'Reunion' },
  { value: 'research', label: 'Recherche' },
  { value: 'other', label: 'Autre' },
];

// =============================================================================
// Helper functions
// =============================================================================

function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'DRAFT': return 'neutral';
    case 'SUBMITTED': return 'info';
    case 'APPROVED': return 'success';
    case 'REJECTED': return 'error';
    case 'ACTIVE': return 'success';
    case 'COMPLETED': return 'info';
    case 'ON_HOLD': return 'warning';
    case 'ARCHIVED': return 'neutral';
    default: return 'neutral';
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Brouillon',
    SUBMITTED: 'Soumis',
    APPROVED: 'Approuve',
    REJECTED: 'Rejete',
    ACTIVE: 'Actif',
    COMPLETED: 'Termine',
    ON_HOLD: 'En pause',
    ARCHIVED: 'Archive',
  };
  return labels[status] || status;
}

function categoryLabel(cat: string | null): string {
  if (!cat) return '-';
  const found = TASK_CATEGORIES.find((c) => c.value === cat);
  return found ? found.label : cat;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

function formatHours(h: number): string {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  if (hrs === 0) return `${mins}min`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h${mins.toString().padStart(2, '0')}`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function TimeTrackingPage() {
  useI18n();
  const theme = sectionThemes.compliance;

  const [activeTab, setActiveTab] = useState<'timesheet' | 'projects' | 'reports' | 'approvals'>('timesheet');
  const [loading, setLoading] = useState(true);

  // =========================================================================
  // Timer State
  // =========================================================================
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerEntryId, setTimerEntryId] = useState<string | null>(null);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timerDescription, setTimerDescription] = useState('');
  const [timerProject, setTimerProject] = useState('');
  const [timerCategory, setTimerCategory] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // =========================================================================
  // Entries State
  // =========================================================================
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [entryForm, setEntryForm] = useState({
    userName: '', date: todayString(), hoursWorked: '',
    description: '', projectName: '', taskCategory: '',
    isBillable: false, billableRate: '', notes: '',
  });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // =========================================================================
  // Projects State
  // =========================================================================
  const [projects, setProjects] = useState<TimeProject[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '', code: '', description: '', clientName: '',
    budget: '', budgetAmount: '', defaultRate: '', status: 'ACTIVE',
    startDate: '', endDate: '',
  });

  // =========================================================================
  // Reports State
  // =========================================================================
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [reportGroupBy, setReportGroupBy] = useState('employee');
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  // =========================================================================
  // Approval State
  // =========================================================================
  const [pendingEntries, setPendingEntries] = useState<TimeEntry[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);

  const tabs = [
    { id: 'timesheet' as const, label: 'Feuille de temps', icon: Calendar },
    { id: 'projects' as const, label: 'Projets', icon: FolderOpen },
    { id: 'reports' as const, label: 'Rapports', icon: BarChart3 },
    { id: 'approvals' as const, label: 'Approbations', icon: CheckCircle },
  ];

  // =========================================================================
  // Timer Logic
  // =========================================================================

  useEffect(() => {
    if (timerRunning && timerStartTime) {
      timerRef.current = setInterval(() => {
        setTimerElapsed(Math.floor((Date.now() - timerStartTime.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timerStartTime]);

  const startTimer = async () => {
    if (!timerDescription.trim()) {
      toast.error('Ajoutez une description pour le minuteur');
      return;
    }
    try {
      const res = await fetch('/api/accounting/time-tracking/timer', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'start',
          userName: 'Admin', // TODO: use session user name
          description: timerDescription,
          projectName: timerProject || null,
          taskCategory: timerCategory || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur demarrage minuteur');
        return;
      }
      setTimerEntryId(json.entry.id);
      setTimerStartTime(new Date(json.entry.startTime));
      setTimerElapsed(0);
      setTimerRunning(true);
      toast.success('Minuteur demarre');
    } catch {
      toast.error('Erreur de demarrage du minuteur');
    }
  };

  const stopTimer = async () => {
    if (!timerEntryId) return;
    try {
      const res = await fetch('/api/accounting/time-tracking/timer', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'stop',
          entryId: timerEntryId,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur arret minuteur');
        return;
      }
      setTimerRunning(false);
      setTimerEntryId(null);
      setTimerStartTime(null);
      setTimerElapsed(0);
      setTimerDescription('');
      setTimerProject('');
      setTimerCategory('');
      toast.success(`Minuteur arrete: ${formatHours(json.entry.hoursWorked)}`);
      fetchEntries();
    } catch {
      toast.error('Erreur d\'arret du minuteur');
    }
  };

  // =========================================================================
  // Data Fetching
  // =========================================================================

  const fetchEntries = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (filterStatus) params.set('status', filterStatus);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);

      const res = await fetch(`/api/accounting/time-tracking?${params}`);
      const json = await res.json();
      if (json.entries) setEntries(json.entries);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement des entrees de temps');
    }
  }, [filterStatus, filterDateFrom, filterDateTo]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/time-tracking/projects?limit=100');
      const json = await res.json();
      if (json.projects) setProjects(json.projects);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement des projets');
    }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/time-tracking?status=SUBMITTED&limit=100');
      const json = await res.json();
      if (json.entries) setPendingEntries(json.entries);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchEntries(), fetchProjects(), fetchPending()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchEntries, fetchProjects, fetchPending]);

  // Re-fetch entries when filters change
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // =========================================================================
  // Entry Actions
  // =========================================================================

  const resetEntryForm = () => {
    setEntryForm({
      userName: '', date: todayString(), hoursWorked: '',
      description: '', projectName: '', taskCategory: '',
      isBillable: false, billableRate: '', notes: '',
    });
  };

  const createEntry = async () => {
    if (!entryForm.userName || !entryForm.hoursWorked) {
      toast.error('Nom et heures sont requis');
      return;
    }
    try {
      const res = await fetch('/api/accounting/time-tracking', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...entryForm,
          hoursWorked: parseFloat(entryForm.hoursWorked),
          billableRate: entryForm.billableRate ? parseFloat(entryForm.billableRate) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Entree de temps creee');
      setShowNewEntryModal(false);
      resetEntryForm();
      fetchEntries();
    } catch {
      toast.error('Erreur de creation');
    }
  };

  const updateEntry = async () => {
    if (!editingEntry) return;
    try {
      const res = await fetch(`/api/accounting/time-tracking/${editingEntry.id}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...entryForm,
          hoursWorked: parseFloat(entryForm.hoursWorked),
          billableRate: entryForm.billableRate ? parseFloat(entryForm.billableRate) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Entree de temps mise a jour');
      setEditingEntry(null);
      resetEntryForm();
      fetchEntries();
    } catch {
      toast.error('Erreur de mise a jour');
    }
  };

  const deleteEntry = async (id: string) => {
    if (!confirm('Supprimer cette entree de temps?')) return;
    try {
      const res = await fetch(`/api/accounting/time-tracking/${id}`, {
        method: 'DELETE',
        headers: addCSRFHeader({}),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Entree supprimee');
      fetchEntries();
    } catch {
      toast.error('Erreur de suppression');
    }
  };

  const submitEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/accounting/time-tracking/${id}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'SUBMITTED' }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Entree soumise pour approbation');
      fetchEntries();
      fetchPending();
    } catch {
      toast.error('Erreur de soumission');
    }
  };

  const startEditing = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEntryForm({
      userName: entry.userName,
      date: entry.date,
      hoursWorked: entry.hoursWorked.toString(),
      description: entry.description || '',
      projectName: entry.projectName || '',
      taskCategory: entry.taskCategory || '',
      isBillable: entry.isBillable,
      billableRate: entry.billableRate?.toString() || '',
      notes: entry.notes || '',
    });
  };

  // =========================================================================
  // Approval Actions
  // =========================================================================

  const approveEntry = async (id: string) => {
    try {
      const res = await fetch(`/api/accounting/time-tracking/${id}/approve`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'approve', approvedBy: 'Admin' }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Entree approuvee');
      fetchPending();
      fetchEntries();
    } catch {
      toast.error('Erreur d\'approbation');
    }
  };

  const rejectEntry = async (id: string) => {
    if (!rejectReason.trim()) {
      toast.error('La raison du rejet est requise');
      return;
    }
    try {
      const res = await fetch(`/api/accounting/time-tracking/${id}/approve`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'reject', rejectedReason: rejectReason, approvedBy: 'Admin' }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Entree rejetee');
      setShowRejectModal(null);
      setRejectReason('');
      fetchPending();
      fetchEntries();
    } catch {
      toast.error('Erreur de rejet');
    }
  };

  // =========================================================================
  // Project Actions
  // =========================================================================

  const resetProjectForm = () => {
    setProjectForm({
      name: '', code: '', description: '', clientName: '',
      budget: '', budgetAmount: '', defaultRate: '', status: 'ACTIVE',
      startDate: '', endDate: '',
    });
  };

  const createProject = async () => {
    if (!projectForm.name || !projectForm.code) {
      toast.error('Nom et code sont requis');
      return;
    }
    try {
      const res = await fetch('/api/accounting/time-tracking/projects', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...projectForm,
          budget: projectForm.budget ? parseFloat(projectForm.budget) : null,
          budgetAmount: projectForm.budgetAmount ? parseFloat(projectForm.budgetAmount) : null,
          defaultRate: projectForm.defaultRate ? parseFloat(projectForm.defaultRate) : null,
          startDate: projectForm.startDate || null,
          endDate: projectForm.endDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success(`Projet "${json.project.name}" cree`);
      setShowNewProjectModal(false);
      resetProjectForm();
      fetchProjects();
    } catch {
      toast.error('Erreur de creation du projet');
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Supprimer ce projet?')) return;
    try {
      const res = await fetch(`/api/accounting/time-tracking/projects/${id}`, {
        method: 'DELETE',
        headers: addCSRFHeader({}),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Projet supprime');
      fetchProjects();
    } catch {
      toast.error('Erreur de suppression');
    }
  };

  // =========================================================================
  // Reports
  // =========================================================================

  const loadSummary = async () => {
    setReportLoading(true);
    setSummaryData(null);
    try {
      const params = new URLSearchParams({ groupBy: reportGroupBy });
      if (reportDateFrom) params.set('dateFrom', reportDateFrom);
      if (reportDateTo) params.set('dateTo', reportDateTo);

      const res = await fetch(`/api/accounting/time-tracking/summary?${params}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      setSummaryData(json);
    } catch {
      toast.error('Erreur de chargement du rapport');
    } finally {
      setReportLoading(false);
    }
  };

  const exportCSV = () => {
    if (!summaryData) return;
    const header = 'Cle,Heures totales,Heures facturables,Montant facturable,Entrees\n';
    const rows = summaryData.groups.map((g) =>
      `"${g.key}",${g.totalHours},${g.billableHours},${g.billableAmount},${g.entryCount}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `temps-rapport-${reportGroupBy}-${todayString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exporte');
  };

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-500">Chargement du suivi de temps...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suivi du temps"
        subtitle="Feuilles de temps, minuteur et rapports - BioCycle Peptides"
        theme={theme}
        actions={
          <div className="flex gap-2">
            <Button variant="primary" icon={Plus} onClick={() => {
              if (activeTab === 'projects') setShowNewProjectModal(true);
              else { resetEntryForm(); setShowNewEntryModal(true); }
            }}>
              {activeTab === 'projects' ? 'Nouveau projet' : 'Nouvelle entree'}
            </Button>
          </div>
        }
      />

      {/* ================================================================= */}
      {/* Timer Widget */}
      {/* ================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${timerRunning ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`} />
            <span className="text-2xl font-mono font-bold text-slate-900">{formatElapsed(timerElapsed)}</span>
          </div>

          <input
            type="text"
            placeholder="Description de la tache..."
            value={timerDescription}
            onChange={(e) => setTimerDescription(e.target.value)}
            disabled={timerRunning}
            className="flex-1 min-w-[200px] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50"
          />

          <select
            value={timerProject}
            onChange={(e) => setTimerProject(e.target.value)}
            disabled={timerRunning}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50"
          >
            <option value="">Projet (optionnel)</option>
            {projects.filter((p) => p.status === 'ACTIVE').map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>

          <select
            value={timerCategory}
            onChange={(e) => setTimerCategory(e.target.value)}
            disabled={timerRunning}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50"
          >
            <option value="">Categorie</option>
            {TASK_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          {!timerRunning ? (
            <button
              onClick={startTimer}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Demarrer
            </button>
          ) : (
            <button
              onClick={stopTimer}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Square className="w-4 h-4" />
              Arreter
            </button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-50 rounded-lg">
              <Clock className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatHours(entries.reduce((s, e) => s + e.hoursWorked, 0))}</p>
              <p className="text-xs text-slate-500">Heures totales</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {formatHours(entries.filter((e) => e.isBillable).reduce((s, e) => s + e.hoursWorked, 0))}
              </p>
              <p className="text-xs text-slate-500">Heures facturables</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <FolderOpen className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{projects.filter((p) => p.status === 'ACTIVE').length}</p>
              <p className="text-xs text-slate-500">Projets actifs</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 rounded-lg">
              <FileText className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{pendingEntries.length}</p>
              <p className="text-xs text-slate-500">En attente d&apos;approbation</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'approvals' && pendingEntries.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                  {pendingEntries.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* TAB: Timesheet */}
      {/* ================================================================= */}
      {activeTab === 'timesheet' && (
        <SectionCard title="Feuille de temps" theme={theme}>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-sm"
              >
                <option value="">Tous les statuts</option>
                <option value="DRAFT">Brouillon</option>
                <option value="SUBMITTED">Soumis</option>
                <option value="APPROVED">Approuve</option>
                <option value="REJECTED">Rejete</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-sm"
                placeholder="Du"
              />
              <span className="text-slate-400">-</span>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="px-2 py-1.5 border border-slate-200 rounded-md text-sm"
                placeholder="Au"
              />
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Aucune entree de temps</p>
              <Button variant="primary" icon={Plus} className="mt-4" onClick={() => { resetEntryForm(); setShowNewEntryModal(true); }}>
                Creer la premiere entree
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Date</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Employe</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Description</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Projet</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Categorie</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Heures</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-600">Facturable</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Statut</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3 font-medium">{entry.date}</td>
                      <td className="py-3 px-3">{entry.userName}</td>
                      <td className="py-3 px-3 max-w-[200px] truncate" title={entry.description || ''}>
                        {entry.description || '-'}
                      </td>
                      <td className="py-3 px-3">{entry.projectName || '-'}</td>
                      <td className="py-3 px-3">{categoryLabel(entry.taskCategory)}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium">{formatHours(entry.hoursWorked)}</td>
                      <td className="py-3 px-3 text-center">
                        {entry.isBillable ? (
                          <span className="text-emerald-600 text-xs font-medium">Oui</span>
                        ) : (
                          <span className="text-slate-400 text-xs">Non</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge variant={statusBadgeVariant(entry.status)} dot>
                          {statusLabel(entry.status)}
                        </StatusBadge>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {entry.status === 'DRAFT' && (
                            <>
                              <button
                                title="Modifier"
                                className="p-1.5 rounded hover:bg-sky-50 text-sky-600"
                                onClick={() => startEditing(entry)}
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                title="Soumettre"
                                className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                                onClick={() => submitEntry(entry.id)}
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              <button
                                title="Supprimer"
                                className="p-1.5 rounded hover:bg-red-50 text-red-500"
                                onClick={() => deleteEntry(entry.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {entry.status === 'REJECTED' && (
                            <span className="text-xs text-red-500" title={entry.rejectedReason || ''}>
                              {entry.rejectedReason?.slice(0, 30) || 'Rejete'}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ================================================================= */}
      {/* TAB: Projects */}
      {/* ================================================================= */}
      {activeTab === 'projects' && (
        <SectionCard
          title="Projets"
          theme={theme}
          headerAction={
            <Button variant="primary" size="sm" icon={Plus} onClick={() => { resetProjectForm(); setShowNewProjectModal(true); }}>
              Ajouter
            </Button>
          }
        >
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Aucun projet</p>
              <Button variant="primary" icon={Plus} className="mt-4" onClick={() => { resetProjectForm(); setShowNewProjectModal(true); }}>
                Creer le premier projet
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Code</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Nom</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Client</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Budget (h)</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Utilise (h)</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Progression</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Taux</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Statut</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const budgetPct = project.budget ? Math.min(100, Math.round((project.hoursUsed / project.budget) * 100)) : null;
                    return (
                      <tr key={project.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-3 font-mono text-sm font-medium">{project.code}</td>
                        <td className="py-3 px-3 font-medium">{project.name}</td>
                        <td className="py-3 px-3">{project.clientName || '-'}</td>
                        <td className="py-3 px-3 text-right font-mono">{project.budget ? formatHours(project.budget) : '-'}</td>
                        <td className="py-3 px-3 text-right font-mono">{formatHours(project.hoursUsed)}</td>
                        <td className="py-3 px-3 text-right">
                          {budgetPct !== null ? (
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${budgetPct}%` }}
                                />
                              </div>
                              <span className={`text-xs font-medium ${budgetPct >= 90 ? 'text-red-600' : budgetPct >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                {budgetPct}%
                              </span>
                            </div>
                          ) : '-'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          {project.defaultRate ? formatMoney(project.defaultRate) : '-'}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge variant={statusBadgeVariant(project.status)} dot>
                            {statusLabel(project.status)}
                          </StatusBadge>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              title="Supprimer"
                              className="p-1.5 rounded hover:bg-red-50 text-red-500"
                              onClick={() => deleteProject(project.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ================================================================= */}
      {/* TAB: Reports */}
      {/* ================================================================= */}
      {activeTab === 'reports' && (
        <SectionCard title="Rapports de temps" theme={theme}>
          <div className="flex flex-wrap gap-3 mb-6 pb-4 border-b border-slate-100">
            <select
              value={reportGroupBy}
              onChange={(e) => setReportGroupBy(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            >
              <option value="employee">Par employe</option>
              <option value="project">Par projet</option>
              <option value="category">Par categorie</option>
            </select>
            <input
              type="date"
              value={reportDateFrom}
              onChange={(e) => setReportDateFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <input
              type="date"
              value={reportDateTo}
              onChange={(e) => setReportDateTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
            <Button variant="primary" icon={BarChart3} onClick={loadSummary} disabled={reportLoading}>
              {reportLoading ? 'Chargement...' : 'Generer le rapport'}
            </Button>
            {summaryData && (
              <Button variant="secondary" icon={Download} onClick={exportCSV}>
                Exporter CSV
              </Button>
            )}
          </div>

          {reportLoading && (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400 mr-2" />
              <span className="text-slate-500">Chargement du rapport...</span>
            </div>
          )}

          {summaryData && !reportLoading && (
            <div className="space-y-6">
              {/* Summary totals */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Entrees</p>
                  <p className="text-xl font-bold text-slate-900">{summaryData.summary.totalEntries}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Heures totales</p>
                  <p className="text-xl font-bold text-slate-900">{formatHours(summaryData.summary.totalHours)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-600">Heures facturables</p>
                  <p className="text-xl font-bold text-emerald-700">{formatHours(summaryData.summary.billableHours)}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Non facturables</p>
                  <p className="text-xl font-bold text-slate-900">{formatHours(summaryData.summary.nonBillableHours)}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-3">
                  <p className="text-xs text-emerald-600">Montant facturable</p>
                  <p className="text-xl font-bold text-emerald-700">{formatMoney(summaryData.summary.billableAmount)}</p>
                </div>
              </div>

              {/* Group table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-3 font-medium text-slate-600">
                        {reportGroupBy === 'employee' ? 'Employe' : reportGroupBy === 'project' ? 'Projet' : 'Categorie'}
                      </th>
                      <th className="text-right py-3 px-3 font-medium text-slate-600">Entrees</th>
                      <th className="text-right py-3 px-3 font-medium text-slate-600">Heures totales</th>
                      <th className="text-right py-3 px-3 font-medium text-slate-600">Heures facturables</th>
                      <th className="text-right py-3 px-3 font-medium text-slate-600">Montant facturable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.groups.map((g) => (
                      <tr key={g.key} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-3 font-medium">{g.key}</td>
                        <td className="py-3 px-3 text-right">{g.entryCount}</td>
                        <td className="py-3 px-3 text-right font-mono">{formatHours(g.totalHours)}</td>
                        <td className="py-3 px-3 text-right font-mono">{formatHours(g.billableHours)}</td>
                        <td className="py-3 px-3 text-right font-mono font-medium">{formatMoney(g.billableAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!summaryData && !reportLoading && (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Selectionnez vos criteres et generez un rapport</p>
            </div>
          )}
        </SectionCard>
      )}

      {/* ================================================================= */}
      {/* TAB: Approvals */}
      {/* ================================================================= */}
      {activeTab === 'approvals' && (
        <SectionCard title="Approbations en attente" theme={theme}>
          {pendingEntries.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Aucune entree en attente d&apos;approbation</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Date</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Employe</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Description</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Projet</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Heures</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-600">Facturable</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3 font-medium">{entry.date}</td>
                      <td className="py-3 px-3">{entry.userName}</td>
                      <td className="py-3 px-3 max-w-[200px] truncate" title={entry.description || ''}>
                        {entry.description || '-'}
                      </td>
                      <td className="py-3 px-3">{entry.projectName || '-'}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium">{formatHours(entry.hoursWorked)}</td>
                      <td className="py-3 px-3 text-center">
                        {entry.isBillable ? (
                          <span className="text-emerald-600 text-xs font-medium">Oui</span>
                        ) : (
                          <span className="text-slate-400 text-xs">Non</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            title="Approuver"
                            className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                            onClick={() => approveEntry(entry.id)}
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            title="Rejeter"
                            className="p-1.5 rounded hover:bg-red-50 text-red-500"
                            onClick={() => setShowRejectModal(entry.id)}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ================================================================= */}
      {/* MODAL: New / Edit Time Entry */}
      {/* ================================================================= */}
      {(showNewEntryModal || editingEntry) && (
        <Modal
          isOpen={showNewEntryModal || !!editingEntry}
          title={editingEntry ? 'Modifier l\'entree de temps' : 'Nouvelle entree de temps'}
          onClose={() => { setShowNewEntryModal(false); setEditingEntry(null); resetEntryForm(); }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l&apos;employe *</label>
                <input
                  type="text"
                  value={entryForm.userName}
                  onChange={(e) => setEntryForm({ ...entryForm, userName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Jean Dupont"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={entryForm.date}
                  onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Heures travaillees *</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={entryForm.hoursWorked}
                  onChange={(e) => setEntryForm({ ...entryForm, hoursWorked: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="8.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Categorie</label>
                <select
                  value={entryForm.taskCategory}
                  onChange={(e) => setEntryForm({ ...entryForm, taskCategory: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Selectionner...</option>
                  {TASK_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={entryForm.description}
                onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                rows={2}
                placeholder="Description de la tache..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Projet</label>
                <select
                  value={entryForm.projectName}
                  onChange={(e) => setEntryForm({ ...entryForm, projectName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Aucun projet</option>
                  {projects.filter((p) => p.status === 'ACTIVE').map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={entryForm.isBillable}
                    onChange={(e) => setEntryForm({ ...entryForm, isBillable: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm text-slate-700">Facturable</span>
                </label>
                {entryForm.isBillable && (
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={entryForm.billableRate}
                      onChange={(e) => setEntryForm({ ...entryForm, billableRate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                      placeholder="Taux $/h"
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes internes</label>
              <textarea
                value={entryForm.notes}
                onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                rows={2}
                placeholder="Notes internes (non visibles sur rapports)..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setShowNewEntryModal(false); setEditingEntry(null); resetEntryForm(); }}>
                Annuler
              </Button>
              <Button variant="primary" onClick={editingEntry ? updateEntry : createEntry}>
                {editingEntry ? 'Mettre a jour' : 'Creer'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================================================================= */}
      {/* MODAL: New Project */}
      {/* ================================================================= */}
      {showNewProjectModal && (
        <Modal
          isOpen={showNewProjectModal}
          title="Nouveau projet"
          onClose={() => { setShowNewProjectModal(false); resetProjectForm(); }}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom du projet *</label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Site Web BioCycle"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={projectForm.code}
                  onChange={(e) => setProjectForm({ ...projectForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="WEB-001"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                rows={2}
                placeholder="Description du projet..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Client</label>
                <input
                  type="text"
                  value={projectForm.clientName}
                  onChange={(e) => setProjectForm({ ...projectForm, clientName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Nom du client"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Taux par defaut ($/h)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={projectForm.defaultRate}
                  onChange={(e) => setProjectForm({ ...projectForm, defaultRate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="75.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Budget (heures)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Budget ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={projectForm.budgetAmount}
                  onChange={(e) => setProjectForm({ ...projectForm, budgetAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="7500.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date de debut</label>
                <input
                  type="date"
                  value={projectForm.startDate}
                  onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date de fin</label>
                <input
                  type="date"
                  value={projectForm.endDate}
                  onChange={(e) => setProjectForm({ ...projectForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => { setShowNewProjectModal(false); resetProjectForm(); }}>
                Annuler
              </Button>
              <Button variant="primary" onClick={createProject}>
                Creer le projet
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ================================================================= */}
      {/* MODAL: Reject Reason */}
      {/* ================================================================= */}
      {showRejectModal && (
        <Modal
          isOpen={!!showRejectModal}
          title="Rejeter l'entree de temps"
          onClose={() => { setShowRejectModal(null); setRejectReason(''); }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Raison du rejet *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                rows={3}
                placeholder="Indiquez la raison du rejet..."
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setShowRejectModal(null); setRejectReason(''); }}>
                Annuler
              </Button>
              <Button variant="primary" onClick={() => rejectEntry(showRejectModal)}>
                Rejeter
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
