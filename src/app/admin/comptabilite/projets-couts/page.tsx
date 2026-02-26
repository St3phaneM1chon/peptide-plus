'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban, Plus, BarChart3, DollarSign, Clock, Target,
  Edit3, Trash2, RefreshCw, FileText, ChevronRight,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, XCircle,
  Search,
} from 'lucide-react';
import { PageHeader, Button, SectionCard, StatusBadge, Modal, StatCard } from '@/components/admin';
import type { BadgeVariant } from '@/components/admin';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// =============================================================================
// Types
// =============================================================================

interface ProjectSummary {
  totalCost: number;
  totalBillable: number;
  totalBilled: number;
  budgetUsedPct: number;
  revenue: number;
  profitability: number;
  completedMilestones: number;
  totalMilestones: number;
}

interface CostProject {
  id: string;
  name: string;
  code: string;
  description: string | null;
  clientName: string | null;
  clientEmail: string | null;
  projectManager: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  budgetHours: number | null;
  budgetAmount: number | null;
  billingMethod: string;
  fixedPrice: number | null;
  retainerAmount: number | null;
  retainerPeriod: string | null;
  defaultRate: number | null;
  notes: string | null;
  createdAt: string;
  summary: ProjectSummary;
}

interface CostEntry {
  id: string;
  projectId: string;
  type: string;
  description: string;
  date: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  billableAmount: number;
  isBillable: boolean;
  employeeId: string | null;
  employeeName: string | null;
  timeEntryId: string | null;
  expenseId: string | null;
  invoiceId: string | null;
  notes: string | null;
  createdAt: string;
}

interface MilestoneData {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  dueDate: string | null;
  completedAt: string | null;
  amount: number | null;
  status: string;
  sortOrder: number;
}

interface BudgetAnalysis {
  totalCost: number;
  totalBillable: number;
  totalBilled: number;
  unbilledAmount: number;
  budgetAmount: number;
  budgetUsedPct: number;
  budgetHours: number;
  totalHours: number;
  hoursUsedPct: number;
  revenue: number;
  profitability: number;
  costsByType: Record<string, number>;
}

interface ProfitabilityData {
  financial: {
    revenue: number;
    actualCost: number;
    grossMargin: number;
    grossMarginPct: number;
    totalBillable: number;
    totalBilled: number;
    unbilledAmount: number;
  };
  labor: {
    totalHoursWorked: number;
    budgetHours: number;
    hoursRemainingPct: number;
    laborCost: number;
    avgHourlyRate: number;
  };
  burnRate: {
    weekly: number;
    monthly: number;
  };
  earnedValue: {
    bac: number;
    earnedValue: number;
    plannedValue: number;
    actualCost: number;
    scheduleVariance: number;
    costVariance: number;
    cpi: number;
    spi: number;
    eac: number;
    etc: number;
    vac: number;
    pctComplete: number;
  };
  costsByType: Record<string, { cost: number; count: number; pct: number }>;
  monthlyTrend: Record<string, { cost: number; billable: number; entries: number }>;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'COMPLETED', label: 'Termine' },
  { value: 'ON_HOLD', label: 'En pause' },
  { value: 'CANCELLED', label: 'Annule' },
];

const BILLING_METHODS = [
  { value: 'FIXED', label: 'Prix fixe' },
  { value: 'TIME_AND_MATERIALS', label: 'Temps et materiaux' },
  { value: 'RETAINER', label: 'Provision' },
];

const COST_TYPES = [
  { value: 'LABOR', label: 'Main-d\'oeuvre' },
  { value: 'EXPENSE', label: 'Depense' },
  { value: 'MATERIAL', label: 'Materiel' },
  { value: 'SUBCONTRACTOR', label: 'Sous-traitant' },
  { value: 'OVERHEAD', label: 'Frais generaux' },
];

const MILESTONE_STATUSES = [
  { value: 'PENDING', label: 'En attente' },
  { value: 'IN_PROGRESS', label: 'En cours' },
  { value: 'COMPLETED', label: 'Termine' },
  { value: 'CANCELLED', label: 'Annule' },
];

// =============================================================================
// Helpers
// =============================================================================

function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'COMPLETED': return 'info';
    case 'ON_HOLD': return 'warning';
    case 'CANCELLED': return 'error';
    case 'PENDING': return 'neutral';
    case 'IN_PROGRESS': return 'info';
    default: return 'neutral';
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    ACTIVE: 'Actif',
    COMPLETED: 'Termine',
    ON_HOLD: 'En pause',
    CANCELLED: 'Annule',
    PENDING: 'En attente',
    IN_PROGRESS: 'En cours',
  };
  return labels[status] || status;
}

function billingMethodLabel(method: string): string {
  const found = BILLING_METHODS.find((m) => m.value === method);
  return found ? found.label : method;
}

function costTypeLabel(type: string): string {
  const found = COST_TYPES.find((t) => t.value === type);
  return found ? found.label : type;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

function formatDate(d: string | null): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('fr-CA');
}

function profitabilityColor(pct: number): string {
  if (pct >= 30) return 'text-emerald-600';
  if (pct >= 15) return 'text-blue-600';
  if (pct >= 0) return 'text-amber-600';
  return 'text-red-600';
}

function budgetBarColor(pct: number): string {
  if (pct <= 70) return 'bg-emerald-500';
  if (pct <= 90) return 'bg-amber-500';
  return 'bg-red-500';
}

// =============================================================================
// Main Component
// =============================================================================

type ActiveTab = 'projects' | 'detail' | 'profitability';

export default function ProjetsCoutsPage() {
  const theme = sectionThemes.reports;

  // -- State --
  const [activeTab, setActiveTab] = useState<ActiveTab>('projects');
  const [projects, setProjects] = useState<CostProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });

  // Detail state
  const [selectedProject, setSelectedProject] = useState<CostProject | null>(null);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [budgetAnalysis, setBudgetAnalysis] = useState<BudgetAnalysis | null>(null);
  const [profitability, setProfitability] = useState<ProfitabilityData | null>(null);

  // Modals
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showAddCost, setShowAddCost] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [showGenerateInvoice, setShowGenerateInvoice] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '', code: '', description: '', clientName: '', clientEmail: '',
    projectManager: '', status: 'ACTIVE', startDate: '', endDate: '',
    budgetHours: '', budgetAmount: '', billingMethod: 'FIXED',
    fixedPrice: '', retainerAmount: '', retainerPeriod: '', defaultRate: '', notes: '',
  });

  const [costFormData, setCostFormData] = useState({
    type: 'LABOR', description: '', date: new Date().toISOString().split('T')[0],
    quantity: '1', unitCost: '0', billableAmount: '0', isBillable: true,
    employeeName: '', notes: '',
  });

  const [milestoneFormData, setMilestoneFormData] = useState({
    name: '', description: '', dueDate: '', amount: '', status: 'PENDING', sortOrder: '0',
  });

  const [invoiceFormData, setInvoiceFormData] = useState({
    dueDate: '', notes: '', milestoneId: '',
    selectedCostEntryIds: [] as string[],
  });

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pagination.page), limit: String(pagination.limit) });
      if (statusFilter) params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/accounting/project-costing?${params}`);
      const json = await res.json();
      if (res.ok) {
        setProjects(json.projects);
        setPagination(json.pagination);
      }
    } catch {
      toast.error('Erreur lors du chargement des projets');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, statusFilter, searchQuery]);

  const fetchProjectDetail = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/accounting/project-costing/${projectId}`);
      const json = await res.json();
      if (res.ok) {
        setSelectedProject(json.project);
        setCostEntries(json.costEntries);
        setMilestones(json.milestones);
        setBudgetAnalysis(json.budgetAnalysis);
      }
    } catch {
      toast.error('Erreur lors du chargement du projet');
    }
  }, []);

  const fetchProfitability = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/accounting/project-costing/${projectId}/profitability`);
      const json = await res.json();
      if (res.ok) {
        setProfitability(json);
      }
    } catch {
      toast.error('Erreur lors du calcul de la rentabilite');
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // =============================================================================
  // Actions
  // =============================================================================

  const handleCreateProject = async () => {
    try {
      const res = await fetch('/api/accounting/project-costing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          description: formData.description || null,
          clientName: formData.clientName || null,
          clientEmail: formData.clientEmail || null,
          projectManager: formData.projectManager || null,
          status: formData.status,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          budgetHours: formData.budgetHours ? parseFloat(formData.budgetHours) : null,
          budgetAmount: formData.budgetAmount ? parseFloat(formData.budgetAmount) : null,
          billingMethod: formData.billingMethod,
          fixedPrice: formData.fixedPrice ? parseFloat(formData.fixedPrice) : null,
          retainerAmount: formData.retainerAmount ? parseFloat(formData.retainerAmount) : null,
          retainerPeriod: formData.retainerPeriod || null,
          defaultRate: formData.defaultRate ? parseFloat(formData.defaultRate) : null,
          notes: formData.notes || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Projet cree avec succes');
        setShowCreateProject(false);
        resetForm();
        fetchProjects();
      } else {
        toast.error(json.error || 'Erreur lors de la creation');
      }
    } catch {
      toast.error('Erreur reseau');
    }
  };

  const handleUpdateProject = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/accounting/project-costing/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          clientName: formData.clientName || null,
          clientEmail: formData.clientEmail || null,
          projectManager: formData.projectManager || null,
          status: formData.status,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          budgetHours: formData.budgetHours ? parseFloat(formData.budgetHours) : null,
          budgetAmount: formData.budgetAmount ? parseFloat(formData.budgetAmount) : null,
          billingMethod: formData.billingMethod,
          fixedPrice: formData.fixedPrice ? parseFloat(formData.fixedPrice) : null,
          retainerAmount: formData.retainerAmount ? parseFloat(formData.retainerAmount) : null,
          retainerPeriod: formData.retainerPeriod || null,
          defaultRate: formData.defaultRate ? parseFloat(formData.defaultRate) : null,
          notes: formData.notes || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Projet mis a jour');
        setShowEditProject(false);
        fetchProjectDetail(selectedProject.id);
        fetchProjects();
      } else {
        toast.error(json.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur reseau');
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Supprimer ce projet ?')) return;
    try {
      const res = await fetch(`/api/accounting/project-costing/${id}`, {
        method: 'DELETE',
        headers: addCSRFHeader(),
      });
      if (res.ok) {
        toast.success('Projet supprime');
        if (selectedProject?.id === id) {
          setActiveTab('projects');
          setSelectedProject(null);
        }
        fetchProjects();
      }
    } catch {
      toast.error('Erreur');
    }
  };

  const handleAddCost = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/accounting/project-costing/${selectedProject.id}/costs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          type: costFormData.type,
          description: costFormData.description,
          date: costFormData.date,
          quantity: parseFloat(costFormData.quantity),
          unitCost: parseFloat(costFormData.unitCost),
          billableAmount: parseFloat(costFormData.billableAmount),
          isBillable: costFormData.isBillable,
          employeeName: costFormData.employeeName || null,
          notes: costFormData.notes || null,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Cout ajoute');
        setShowAddCost(false);
        fetchProjectDetail(selectedProject.id);
      } else {
        toast.error(json.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur reseau');
    }
  };

  const handleAddMilestone = async () => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/accounting/project-costing/${selectedProject.id}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          name: milestoneFormData.name,
          description: milestoneFormData.description || null,
          dueDate: milestoneFormData.dueDate || null,
          amount: milestoneFormData.amount ? parseFloat(milestoneFormData.amount) : null,
          status: milestoneFormData.status,
          sortOrder: parseInt(milestoneFormData.sortOrder) || 0,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success('Jalon ajoute');
        setShowAddMilestone(false);
        fetchProjectDetail(selectedProject.id);
      } else {
        toast.error(json.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur reseau');
    }
  };

  const handleUpdateMilestoneStatus = async (milestoneId: string, newStatus: string) => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/accounting/project-costing/${selectedProject.id}/milestones`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({ milestoneId, status: newStatus }),
      });
      if (res.ok) {
        toast.success('Statut mis a jour');
        fetchProjectDetail(selectedProject.id);
      }
    } catch {
      toast.error('Erreur');
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedProject) return;
    try {
      const body: Record<string, unknown> = {
        dueDate: invoiceFormData.dueDate,
        notes: invoiceFormData.notes || null,
      };
      if (selectedProject.billingMethod === 'TIME_AND_MATERIALS') {
        body.costEntryIds = invoiceFormData.selectedCostEntryIds;
      } else {
        body.milestoneId = invoiceFormData.milestoneId;
      }

      const res = await fetch(`/api/accounting/project-costing/${selectedProject.id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`Facture ${json.invoice.invoiceNumber} generee`);
        setShowGenerateInvoice(false);
        fetchProjectDetail(selectedProject.id);
      } else {
        toast.error(json.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur reseau');
    }
  };

  // -- Form helpers --
  const resetForm = () => {
    setFormData({
      name: '', code: '', description: '', clientName: '', clientEmail: '',
      projectManager: '', status: 'ACTIVE', startDate: '', endDate: '',
      budgetHours: '', budgetAmount: '', billingMethod: 'FIXED',
      fixedPrice: '', retainerAmount: '', retainerPeriod: '', defaultRate: '', notes: '',
    });
  };

  const openEditProject = (p: CostProject) => {
    setFormData({
      name: p.name, code: p.code, description: p.description || '',
      clientName: p.clientName || '', clientEmail: p.clientEmail || '',
      projectManager: p.projectManager || '', status: p.status,
      startDate: p.startDate ? p.startDate.split('T')[0] : '',
      endDate: p.endDate ? p.endDate.split('T')[0] : '',
      budgetHours: p.budgetHours ? String(p.budgetHours) : '',
      budgetAmount: p.budgetAmount ? String(p.budgetAmount) : '',
      billingMethod: p.billingMethod,
      fixedPrice: p.fixedPrice ? String(p.fixedPrice) : '',
      retainerAmount: p.retainerAmount ? String(p.retainerAmount) : '',
      retainerPeriod: p.retainerPeriod || '',
      defaultRate: p.defaultRate ? String(p.defaultRate) : '',
      notes: p.notes || '',
    });
    setShowEditProject(true);
  };

  const openProjectDetail = (p: CostProject) => {
    setSelectedProject(p);
    setActiveTab('detail');
    fetchProjectDetail(p.id);
  };

  const openProfitability = (p: CostProject) => {
    setSelectedProject(p);
    setActiveTab('profitability');
    fetchProfitability(p.id);
  };

  // =============================================================================
  // Render: Projects List Tab
  // =============================================================================

  const renderProjectsList = () => (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Projets actifs" value={projects.filter((p) => p.status === 'ACTIVE').length} icon={FolderKanban} theme={theme} />
        <StatCard label="Couts totaux" value={formatMoney(projects.reduce((sum, p) => sum + p.summary.totalCost, 0))} icon={DollarSign} theme={theme} />
        <StatCard label="Revenus totaux" value={formatMoney(projects.reduce((sum, p) => sum + p.summary.revenue, 0))} icon={TrendingUp} theme={theme} />
        <StatCard label="Non facture" value={formatMoney(projects.reduce((sum, p) => sum + (p.summary.totalBillable - p.summary.totalBilled), 0))} icon={FileText} theme={theme} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, code ou client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" onClick={() => fetchProjects()}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Actualiser
        </Button>
        <Button variant="primary" size="sm" onClick={() => { resetForm(); setShowCreateProject(true); }}>
          <Plus className="h-4 w-4 mr-1" />
          Nouveau projet
        </Button>
      </div>

      {/* Projects Table */}
      <SectionCard theme={theme}>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Chargement...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Aucun projet trouve</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Code</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Projet</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Client</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Methode</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Budget</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Couts</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Rentabilite</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-500">Statut</th>
                  <th className="text-right py-3 px-3 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer" onClick={() => openProjectDetail(p)}>
                    <td className="py-3 px-3 font-mono text-xs text-blue-600">{p.code}</td>
                    <td className="py-3 px-3">
                      <div className="font-medium">{p.name}</div>
                      {p.description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{p.description}</div>}
                    </td>
                    <td className="py-3 px-3 text-gray-600">{p.clientName || '-'}</td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs">
                        {billingMethodLabel(p.billingMethod)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {p.budgetAmount ? (
                        <div>
                          <div className="text-xs text-gray-500">{formatMoney(p.budgetAmount)}</div>
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-1">
                            <div
                              className={`h-full rounded-full ${budgetBarColor(p.summary.budgetUsedPct)}`}
                              style={{ width: `${Math.min(p.summary.budgetUsedPct, 100)}%` }}
                            />
                          </div>
                          <div className="text-xs text-gray-400">{p.summary.budgetUsedPct}%</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-medium">{formatMoney(p.summary.totalCost)}</td>
                    <td className="py-3 px-3">
                      <span className={`font-semibold ${profitabilityColor(p.summary.profitability)}`}>
                        {p.summary.profitability}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge variant={statusBadgeVariant(p.status)} dot>{statusLabel(p.status)}</StatusBadge>
                    </td>
                    <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openProfitability(p)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" aria-label="Rentabilite">
                          <BarChart3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setSelectedProject(p); openEditProject(p); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" aria-label="Modifier">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeleteProject(p.id)} className="p-1.5 hover:bg-red-50 rounded text-red-600" aria-label="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-sm text-gray-500">
              Page {pagination.page} / {pagination.pages} ({pagination.total} projets)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>
                Precedent
              </Button>
              <Button variant="outline" size="sm" disabled={pagination.page >= pagination.pages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>
                Suivant
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );

  // =============================================================================
  // Render: Project Detail Tab
  // =============================================================================

  const renderProjectDetail = () => {
    if (!selectedProject || !budgetAnalysis) {
      return <div className="text-center py-8 text-gray-400">Chargement...</div>;
    }

    const ba = budgetAnalysis;

    return (
      <div className="space-y-4">
        {/* Back link */}
        <button onClick={() => setActiveTab('projects')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Retour a la liste
        </button>

        {/* Project header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">{selectedProject.name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-sm text-blue-600">{selectedProject.code}</span>
              <StatusBadge variant={statusBadgeVariant(selectedProject.status)} dot>{statusLabel(selectedProject.status)}</StatusBadge>
              <span className="text-sm text-gray-500">{billingMethodLabel(selectedProject.billingMethod)}</span>
            </div>
            {selectedProject.clientName && <div className="text-sm text-gray-500 mt-1">Client: {selectedProject.clientName}</div>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowGenerateInvoice(true); setInvoiceFormData({ dueDate: '', notes: '', milestoneId: '', selectedCostEntryIds: [] }); }}>
              <FileText className="h-4 w-4 mr-1" />
              Facturer
            </Button>
            <Button variant="outline" size="sm" onClick={() => openEditProject(selectedProject)}>
              <Edit3 className="h-4 w-4 mr-1" />
              Modifier
            </Button>
            <Button variant="primary" size="sm" onClick={() => openProfitability(selectedProject)}>
              <BarChart3 className="h-4 w-4 mr-1" />
              Rentabilite
            </Button>
          </div>
        </div>

        {/* Budget KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard label="Cout total" value={formatMoney(ba.totalCost)} icon={DollarSign} theme={theme} />
          <StatCard label="Revenus" value={formatMoney(ba.revenue)} icon={TrendingUp} theme={theme} />
          <StatCard label="Rentabilite" value={`${ba.profitability}%`} icon={ba.profitability >= 0 ? TrendingUp : TrendingDown} theme={theme} />
          <StatCard label="Budget utilise" value={`${ba.budgetUsedPct}%`} icon={Target} theme={theme} />
          <StatCard label="Non facture" value={formatMoney(ba.unbilledAmount)} icon={FileText} theme={theme} />
        </div>

        {/* Budget bars */}
        {ba.budgetAmount > 0 && (
          <SectionCard title="Budget" theme={theme}>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Budget montant</span>
                  <span>{formatMoney(ba.totalCost)} / {formatMoney(ba.budgetAmount)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full">
                  <div className={`h-full rounded-full ${budgetBarColor(ba.budgetUsedPct)}`} style={{ width: `${Math.min(ba.budgetUsedPct, 100)}%` }} />
                </div>
              </div>
              {ba.budgetHours > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Budget heures</span>
                    <span>{ba.totalHours}h / {ba.budgetHours}h</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full">
                    <div className={`h-full rounded-full ${budgetBarColor(ba.hoursUsedPct)}`} style={{ width: `${Math.min(ba.hoursUsedPct, 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Cost breakdown by type */}
        <SectionCard title="Repartition des couts" theme={theme}>
          {Object.keys(ba.costsByType).length === 0 ? (
            <div className="text-center py-4 text-gray-400">Aucun cout enregistre</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(ba.costsByType).map(([type, amount]) => (
                <div key={type} className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 uppercase">{costTypeLabel(type)}</div>
                  <div className="text-lg font-bold mt-1">{formatMoney(amount)}</div>
                  <div className="text-xs text-gray-400">{ba.totalCost > 0 ? Math.round((amount / ba.totalCost) * 100) : 0}%</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Milestones */}
        <SectionCard
          title="Jalons"
          theme={theme}
          headerAction={
            <Button variant="outline" size="sm" onClick={() => {
              setMilestoneFormData({ name: '', description: '', dueDate: '', amount: '', status: 'PENDING', sortOrder: String(milestones.length) });
              setShowAddMilestone(true);
            }}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          }
        >
          {milestones.length === 0 ? (
            <div className="text-center py-4 text-gray-400">Aucun jalon</div>
          ) : (
            <div className="space-y-2">
              {milestones.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {m.status === 'COMPLETED' ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : m.status === 'IN_PROGRESS' ? (
                      <Clock className="h-5 w-5 text-blue-500" />
                    ) : m.status === 'CANCELLED' ? (
                      <XCircle className="h-5 w-5 text-red-400" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                    )}
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-gray-500">
                        {m.dueDate ? `Echeance: ${formatDate(m.dueDate)}` : ''}
                        {m.amount ? ` | ${formatMoney(m.amount)}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={statusBadgeVariant(m.status)} dot>{statusLabel(m.status)}</StatusBadge>
                    {m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && (
                      <select
                        value=""
                        onChange={(e) => { if (e.target.value) handleUpdateMilestoneStatus(m.id, e.target.value); }}
                        className="text-xs border rounded px-2 py-1"
                      >
                        <option value="">Changer...</option>
                        {MILESTONE_STATUSES.filter((s) => s.value !== m.status).map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Cost Entries */}
        <SectionCard
          title="Entrees de couts"
          theme={theme}
          headerAction={
            <Button variant="outline" size="sm" onClick={() => {
              setCostFormData({ type: 'LABOR', description: '', date: new Date().toISOString().split('T')[0], quantity: '1', unitCost: '0', billableAmount: '0', isBillable: true, employeeName: '', notes: '' });
              setShowAddCost(true);
            }}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter
            </Button>
          }
        >
          {costEntries.length === 0 ? (
            <div className="text-center py-4 text-gray-400">Aucune entree de cout</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Date</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Type</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Description</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-500">Employe</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500">Qte</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500">Cout unit.</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500">Total</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-500">Facturable</th>
                    <th className="text-center py-2 px-2 font-medium text-gray-500">Facture</th>
                  </tr>
                </thead>
                <tbody>
                  {costEntries.slice(0, 50).map((e) => (
                    <tr key={e.id} className="border-b border-gray-50">
                      <td className="py-2 px-2 text-gray-600">{formatDate(e.date)}</td>
                      <td className="py-2 px-2">
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">{costTypeLabel(e.type)}</span>
                      </td>
                      <td className="py-2 px-2 max-w-[200px] truncate">{e.description}</td>
                      <td className="py-2 px-2 text-gray-500">{e.employeeName || '-'}</td>
                      <td className="py-2 px-2 text-right">{e.quantity}</td>
                      <td className="py-2 px-2 text-right">{formatMoney(e.unitCost)}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatMoney(e.totalCost)}</td>
                      <td className="py-2 px-2 text-right">
                        {e.isBillable ? formatMoney(e.billableAmount) : <span className="text-gray-400">N/A</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {e.invoiceId ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : e.isBillable ? (
                          <AlertTriangle className="h-4 w-4 text-amber-400 mx-auto" />
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  // =============================================================================
  // Render: Profitability Tab
  // =============================================================================

  const renderProfitability = () => {
    if (!profitability || !selectedProject) {
      return <div className="text-center py-8 text-gray-400">Chargement...</div>;
    }

    const p = profitability;

    return (
      <div className="space-y-4">
        <button onClick={() => setActiveTab('projects')} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ChevronRight className="h-4 w-4 rotate-180" />
          Retour a la liste
        </button>

        <h2 className="text-xl font-bold">Rentabilite: {selectedProject.name} ({selectedProject.code})</h2>

        {/* Financial KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Revenus" value={formatMoney(p.financial.revenue)} icon={TrendingUp} theme={theme} />
          <StatCard label="Couts reels" value={formatMoney(p.financial.actualCost)} icon={DollarSign} theme={theme} />
          <StatCard label="Marge brute" value={formatMoney(p.financial.grossMargin)} icon={p.financial.grossMargin >= 0 ? TrendingUp : TrendingDown} theme={theme} />
          <StatCard label="Marge %" value={`${p.financial.grossMarginPct}%`} icon={BarChart3} theme={theme} />
        </div>

        {/* Billing */}
        <SectionCard title="Facturation" theme={theme}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600">Total facturable</div>
              <div className="text-xl font-bold">{formatMoney(p.financial.totalBillable)}</div>
            </div>
            <div className="p-4 bg-emerald-50 rounded-lg">
              <div className="text-sm text-emerald-600">Deja facture</div>
              <div className="text-xl font-bold">{formatMoney(p.financial.totalBilled)}</div>
            </div>
            <div className="p-4 bg-amber-50 rounded-lg">
              <div className="text-sm text-amber-600">Non facture</div>
              <div className="text-xl font-bold">{formatMoney(p.financial.unbilledAmount)}</div>
            </div>
          </div>
        </SectionCard>

        {/* Labor */}
        <SectionCard title="Main-d'oeuvre" theme={theme}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Heures travaillees</div>
              <div className="text-lg font-bold">{p.labor.totalHoursWorked}h</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Budget heures</div>
              <div className="text-lg font-bold">{p.labor.budgetHours}h</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Heures restantes</div>
              <div className="text-lg font-bold">{p.labor.hoursRemainingPct}%</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Cout M-O</div>
              <div className="text-lg font-bold">{formatMoney(p.labor.laborCost)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Taux horaire moy.</div>
              <div className="text-lg font-bold">{formatMoney(p.labor.avgHourlyRate)}</div>
            </div>
          </div>
        </SectionCard>

        {/* Earned Value */}
        <SectionCard title="Valeur acquise (EVM)" theme={theme}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">BAC (Budget)</div>
              <div className="text-lg font-bold">{formatMoney(p.earnedValue.bac)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">EV (Valeur acquise)</div>
              <div className="text-lg font-bold">{formatMoney(p.earnedValue.earnedValue)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">PV (Valeur planifiee)</div>
              <div className="text-lg font-bold">{formatMoney(p.earnedValue.plannedValue)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">Completion</div>
              <div className="text-lg font-bold">{p.earnedValue.pctComplete}%</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">CPI (Perf. cout)</div>
              <div className={`text-lg font-bold ${p.earnedValue.cpi >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>{p.earnedValue.cpi}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">SPI (Perf. calendrier)</div>
              <div className={`text-lg font-bold ${p.earnedValue.spi >= 1 ? 'text-emerald-600' : 'text-red-600'}`}>{p.earnedValue.spi}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">EAC (Est. completion)</div>
              <div className="text-lg font-bold">{formatMoney(p.earnedValue.eac)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-xs text-gray-500">ETC (Est. restant)</div>
              <div className="text-lg font-bold">{formatMoney(p.earnedValue.etc)}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div className={`p-3 rounded-lg ${p.earnedValue.costVariance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div className="text-xs text-gray-500">Ecart cout (CV)</div>
              <div className={`text-lg font-bold ${p.earnedValue.costVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(p.earnedValue.costVariance)}</div>
            </div>
            <div className={`p-3 rounded-lg ${p.earnedValue.scheduleVariance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div className="text-xs text-gray-500">Ecart calendrier (SV)</div>
              <div className={`text-lg font-bold ${p.earnedValue.scheduleVariance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(p.earnedValue.scheduleVariance)}</div>
            </div>
            <div className={`p-3 rounded-lg ${p.earnedValue.vac >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
              <div className="text-xs text-gray-500">VAC (Ecart fin)</div>
              <div className={`text-lg font-bold ${p.earnedValue.vac >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(p.earnedValue.vac)}</div>
            </div>
          </div>
        </SectionCard>

        {/* Burn Rate */}
        <SectionCard title="Taux de consommation" theme={theme}>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Hebdomadaire</div>
              <div className="text-xl font-bold">{formatMoney(p.burnRate.weekly)}</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Mensuel</div>
              <div className="text-xl font-bold">{formatMoney(p.burnRate.monthly)}</div>
            </div>
          </div>
        </SectionCard>

        {/* Cost breakdown by type */}
        <SectionCard title="Repartition par type" theme={theme}>
          {Object.keys(p.costsByType).length === 0 ? (
            <div className="text-center py-4 text-gray-400">Aucune donnee</div>
          ) : (
            <div className="space-y-2">
              {Object.entries(p.costsByType).map(([type, data]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className="w-32 text-sm font-medium">{costTypeLabel(type)}</div>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${data.pct}%` }} />
                  </div>
                  <div className="w-24 text-sm text-right font-medium">{formatMoney(data.cost)}</div>
                  <div className="w-12 text-xs text-gray-400 text-right">{data.pct}%</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Monthly Trend */}
        <SectionCard title="Tendance mensuelle" theme={theme}>
          {Object.keys(p.monthlyTrend).length === 0 ? (
            <div className="text-center py-4 text-gray-400">Aucune donnee</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-gray-500">Mois</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500">Couts</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500">Facturable</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-500">Entrees</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(p.monthlyTrend).sort().map(([month, data]) => (
                    <tr key={month} className="border-b border-gray-50">
                      <td className="py-2 px-3 font-medium">{month}</td>
                      <td className="py-2 px-3 text-right">{formatMoney(data.cost)}</td>
                      <td className="py-2 px-3 text-right">{formatMoney(data.billable)}</td>
                      <td className="py-2 px-3 text-right">{data.entries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    );
  };

  // =============================================================================
  // Render: Project Form Fields (shared by Create/Edit modals)
  // =============================================================================

  const renderProjectFormFields = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nom *</label>
          <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Nom du projet" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Code *</label>
          <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
            className="w-full px-3 py-2 border rounded-lg text-sm font-mono" placeholder="PROJ-001" disabled={showEditProject} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Client</label>
          <input type="text" value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email client</label>
          <input type="email" value={formData.clientEmail} onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Statut</label>
          <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm">
            {STATUS_OPTIONS.filter((s) => s.value).map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date debut</label>
          <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date fin</label>
          <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Methode de facturation</label>
          <select value={formData.billingMethod} onChange={(e) => setFormData({ ...formData, billingMethod: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm">
            {BILLING_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Budget heures</label>
          <input type="number" value={formData.budgetHours} onChange={(e) => setFormData({ ...formData, budgetHours: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" step="0.5" min="0" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Budget montant ($)</label>
          <input type="number" value={formData.budgetAmount} onChange={(e) => setFormData({ ...formData, budgetAmount: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" step="0.01" min="0" />
        </div>
      </div>
      {formData.billingMethod === 'FIXED' && (
        <div>
          <label className="block text-sm font-medium mb-1">Prix fixe ($)</label>
          <input type="number" value={formData.fixedPrice} onChange={(e) => setFormData({ ...formData, fixedPrice: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" step="0.01" min="0" />
        </div>
      )}
      {formData.billingMethod === 'RETAINER' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Montant provision ($)</label>
            <input type="number" value={formData.retainerAmount} onChange={(e) => setFormData({ ...formData, retainerAmount: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" step="0.01" min="0" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Periode</label>
            <select value={formData.retainerPeriod} onChange={(e) => setFormData({ ...formData, retainerPeriod: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm">
              <option value="">-</option>
              <option value="MONTHLY">Mensuel</option>
              <option value="QUARTERLY">Trimestriel</option>
            </select>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Taux horaire par defaut ($)</label>
          <input type="number" value={formData.defaultRate} onChange={(e) => setFormData({ ...formData, defaultRate: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" step="0.01" min="0" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Chef de projet</label>
          <input type="text" value={formData.projectManager} onChange={(e) => setFormData({ ...formData, projectManager: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Notes</label>
        <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
      </div>
    </div>
  );

  // =============================================================================
  // Main Render
  // =============================================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projets et couts"
        subtitle="Gestion des projets, suivi des couts et analyse de rentabilite"
        theme={theme}
      />

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 text-sm rounded-t-lg transition ${activeTab === 'projects' ? 'bg-white border border-b-0 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FolderKanban className="h-4 w-4 inline mr-1" />
          Projets
        </button>
        {selectedProject && (
          <>
            <button
              onClick={() => { setActiveTab('detail'); fetchProjectDetail(selectedProject.id); }}
              className={`px-4 py-2 text-sm rounded-t-lg transition ${activeTab === 'detail' ? 'bg-white border border-b-0 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileText className="h-4 w-4 inline mr-1" />
              Detail: {selectedProject.code}
            </button>
            <button
              onClick={() => { setActiveTab('profitability'); fetchProfitability(selectedProject.id); }}
              className={`px-4 py-2 text-sm rounded-t-lg transition ${activeTab === 'profitability' ? 'bg-white border border-b-0 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BarChart3 className="h-4 w-4 inline mr-1" />
              Rentabilite
            </button>
          </>
        )}
      </div>

      {/* Tab content */}
      {activeTab === 'projects' && renderProjectsList()}
      {activeTab === 'detail' && renderProjectDetail()}
      {activeTab === 'profitability' && renderProfitability()}

      {/* Create Project Modal */}
      <Modal isOpen={showCreateProject} onClose={() => setShowCreateProject(false)} title="Nouveau projet">
        {renderProjectFormFields()}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowCreateProject(false)}>Annuler</Button>
          <Button variant="primary" onClick={handleCreateProject} disabled={!formData.name || !formData.code}>
            Creer le projet
          </Button>
        </div>
      </Modal>

      {/* Edit Project Modal */}
      <Modal isOpen={showEditProject} onClose={() => setShowEditProject(false)} title="Modifier le projet">
        {renderProjectFormFields()}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowEditProject(false)}>Annuler</Button>
          <Button variant="primary" onClick={handleUpdateProject}>Enregistrer</Button>
        </div>
      </Modal>

      {/* Add Cost Entry Modal */}
      <Modal isOpen={showAddCost} onClose={() => setShowAddCost(false)} title="Ajouter un cout">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type *</label>
              <select value={costFormData.type} onChange={(e) => setCostFormData({ ...costFormData, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                {COST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input type="date" value={costFormData.date} onChange={(e) => setCostFormData({ ...costFormData, date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description *</label>
            <input type="text" value={costFormData.description} onChange={(e) => setCostFormData({ ...costFormData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Quantite</label>
              <input type="number" value={costFormData.quantity} onChange={(e) => setCostFormData({ ...costFormData, quantity: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" step="0.5" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cout unitaire ($)</label>
              <input type="number" value={costFormData.unitCost} onChange={(e) => setCostFormData({ ...costFormData, unitCost: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" step="0.01" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Montant facturable ($)</label>
              <input type="number" value={costFormData.billableAmount} onChange={(e) => setCostFormData({ ...costFormData, billableAmount: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" step="0.01" min="0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Employe</label>
              <input type="text" value={costFormData.employeeName} onChange={(e) => setCostFormData({ ...costFormData, employeeName: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={costFormData.isBillable} onChange={(e) => setCostFormData({ ...costFormData, isBillable: e.target.checked })}
                  className="rounded" />
                <span className="text-sm">Facturable</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={costFormData.notes} onChange={(e) => setCostFormData({ ...costFormData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-right">
            <span className="text-sm text-gray-500 mr-2">Total:</span>
            <span className="text-lg font-bold">
              {formatMoney(parseFloat(costFormData.quantity || '0') * parseFloat(costFormData.unitCost || '0'))}
            </span>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowAddCost(false)}>Annuler</Button>
          <Button variant="primary" onClick={handleAddCost} disabled={!costFormData.description}>
            Ajouter le cout
          </Button>
        </div>
      </Modal>

      {/* Add Milestone Modal */}
      <Modal isOpen={showAddMilestone} onClose={() => setShowAddMilestone(false)} title="Ajouter un jalon">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom *</label>
            <input type="text" value={milestoneFormData.name} onChange={(e) => setMilestoneFormData({ ...milestoneFormData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={milestoneFormData.description} onChange={(e) => setMilestoneFormData({ ...milestoneFormData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date echeance</label>
              <input type="date" value={milestoneFormData.dueDate} onChange={(e) => setMilestoneFormData({ ...milestoneFormData, dueDate: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Montant ($)</label>
              <input type="number" value={milestoneFormData.amount} onChange={(e) => setMilestoneFormData({ ...milestoneFormData, amount: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm" step="0.01" min="0" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Statut</label>
              <select value={milestoneFormData.status} onChange={(e) => setMilestoneFormData({ ...milestoneFormData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                {MILESTONE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowAddMilestone(false)}>Annuler</Button>
          <Button variant="primary" onClick={handleAddMilestone} disabled={!milestoneFormData.name}>
            Ajouter le jalon
          </Button>
        </div>
      </Modal>

      {/* Generate Invoice Modal */}
      <Modal isOpen={showGenerateInvoice} onClose={() => setShowGenerateInvoice(false)} title="Generer une facture">
        <div className="space-y-4">
          {selectedProject?.billingMethod === 'TIME_AND_MATERIALS' ? (
            <div>
              <label className="block text-sm font-medium mb-2">Selectionner les couts a facturer</label>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {costEntries.filter((e) => e.isBillable && !e.invoiceId).length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-2">Aucun cout non facture</div>
                ) : (
                  costEntries.filter((e) => e.isBillable && !e.invoiceId).map((e) => (
                    <label key={e.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={invoiceFormData.selectedCostEntryIds.includes(e.id)}
                        onChange={(ev) => {
                          setInvoiceFormData((prev) => ({
                            ...prev,
                            selectedCostEntryIds: ev.target.checked
                              ? [...prev.selectedCostEntryIds, e.id]
                              : prev.selectedCostEntryIds.filter((cid) => cid !== e.id),
                          }));
                        }}
                        className="rounded"
                      />
                      <div className="flex-1 text-sm">
                        <div>{e.description}</div>
                        <div className="text-xs text-gray-400">{formatDate(e.date)} | {costTypeLabel(e.type)}</div>
                      </div>
                      <div className="text-sm font-medium">{formatMoney(e.billableAmount)}</div>
                    </label>
                  ))
                )}
              </div>
              {invoiceFormData.selectedCostEntryIds.length > 0 && (
                <div className="bg-blue-50 p-2 rounded mt-2 text-right">
                  <span className="text-sm text-blue-600 mr-2">Total selectionne:</span>
                  <span className="font-bold text-blue-800">
                    {formatMoney(
                      costEntries
                        .filter((e) => invoiceFormData.selectedCostEntryIds.includes(e.id))
                        .reduce((sum, e) => sum + e.billableAmount, 0)
                    )}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Jalon a facturer</label>
              <select
                value={invoiceFormData.milestoneId}
                onChange={(e) => setInvoiceFormData({ ...invoiceFormData, milestoneId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                <option value="">Selectionner un jalon...</option>
                {milestones.filter((m) => m.status === 'COMPLETED' && m.amount).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} - {formatMoney(m.amount || 0)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Date echeance *</label>
            <input type="date" value={invoiceFormData.dueDate} onChange={(e) => setInvoiceFormData({ ...invoiceFormData, dueDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea value={invoiceFormData.notes} onChange={(e) => setInvoiceFormData({ ...invoiceFormData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowGenerateInvoice(false)}>Annuler</Button>
          <Button variant="primary" onClick={handleGenerateInvoice}
            disabled={
              !invoiceFormData.dueDate ||
              (selectedProject?.billingMethod === 'TIME_AND_MATERIALS' ? invoiceFormData.selectedCostEntryIds.length === 0 : !invoiceFormData.milestoneId)
            }>
            Generer la facture
          </Button>
        </div>
      </Modal>
    </div>
  );
}
