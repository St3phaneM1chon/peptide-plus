'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Calendar, FileText, BarChart3, Plus, Calculator,
  CheckCircle, Trash2, Eye, Download, RefreshCw, DollarSign,
  Briefcase, Clock, AlertCircle,
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

interface PayrollRun {
  id: string;
  runDate: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  status: string;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  totalEmployerCost: number;
  employeeCount: number;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  hireDate: string;
  terminationDate: string | null;
  employmentType: string;
  province: string;
  country: string;
  annualSalary: number | null;
  hourlyRate: number | null;
  payFrequency: string;
  vacationPayRate: number;
  status: string;
  createdAt: string;
}

interface PayStub {
  id: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string; email: string };
  periodStart: string;
  periodEnd: string;
  payDate: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  ytdGross: number;
  ytdDeductions: number;
  ytdNet: number;
  deductionDetails: Record<string, unknown>;
  createdAt: string;
}

// =============================================================================
// Helper functions
// =============================================================================

function statusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'DRAFT': return 'neutral';
    case 'CALCULATED': return 'info';
    case 'APPROVED': return 'warning';
    case 'PAID': return 'success';
    case 'VOID': return 'error';
    case 'ACTIVE': return 'success';
    case 'ON_LEAVE': return 'warning';
    case 'TERMINATED': return 'error';
    default: return 'neutral';
  }
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Brouillon',
    CALCULATED: 'Calcule',
    APPROVED: 'Approuve',
    PAID: 'Paye',
    VOID: 'Annule',
    ACTIVE: 'Actif',
    ON_LEAVE: 'En conge',
    TERMINATED: 'Termine',
    FULL_TIME: 'Temps plein',
    PART_TIME: 'Temps partiel',
    CONTRACT: 'Contractuel',
    SEASONAL: 'Saisonnier',
    WEEKLY: 'Hebdomadaire',
    BIWEEKLY: 'Aux 2 semaines',
    SEMI_MONTHLY: 'Bi-mensuel',
    MONTHLY: 'Mensuel',
  };
  return labels[status] || status;
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n);
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function PayrollPage() {
  useI18n(); // Ensure locale context is available
  const theme = sectionThemes.compliance;

  const [activeTab, setActiveTab] = useState<'runs' | 'employees' | 'stubs' | 'reports'>('runs');
  const [loading, setLoading] = useState(true);

  // Payroll Runs state
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [showNewRunModal, setShowNewRunModal] = useState(false);
  const [newRunForm, setNewRunForm] = useState({ periodStart: '', periodEnd: '', payDate: '', notes: '' });
  const [runActionLoading, setRunActionLoading] = useState<string | null>(null);

  // Employees state
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showNewEmployeeModal, setShowNewEmployeeModal] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    firstName: '', lastName: '', email: '', hireDate: '',
    employmentType: 'FULL_TIME', province: 'QC', country: 'CA',
    annualSalary: '', hourlyRate: '', payFrequency: 'BIWEEKLY',
    vacationPayRate: '4', notes: '',
  });

  // Pay Stubs state
  const [payStubs, setPayStubs] = useState<PayStub[]>([]);

  // Reports state
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const tabs = [
    { id: 'runs' as const, label: 'Cycles de paie', icon: Calendar },
    { id: 'employees' as const, label: 'Employes', icon: Users },
    { id: 'stubs' as const, label: 'Bulletins de paie', icon: FileText },
    { id: 'reports' as const, label: 'Rapports', icon: BarChart3 },
  ];

  // =========================================================================
  // Data Fetching
  // =========================================================================

  const fetchRuns = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/payroll?limit=50');
      const json = await res.json();
      if (json.runs) setRuns(json.runs);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement des cycles de paie');
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/payroll/employees?limit=100');
      const json = await res.json();
      if (json.employees) setEmployees(json.employees);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement des employes');
    }
  }, []);

  const fetchPayStubs = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/payroll/pay-stubs?limit=50');
      const json = await res.json();
      if (json.payStubs) setPayStubs(json.payStubs);
    } catch (err) {
      console.error(err);
      toast.error('Erreur de chargement des bulletins');
    }
  }, []);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchRuns(), fetchEmployees(), fetchPayStubs()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchRuns, fetchEmployees, fetchPayStubs]);

  // =========================================================================
  // Payroll Run Actions
  // =========================================================================

  const createPayrollRun = async () => {
    if (!newRunForm.periodStart || !newRunForm.periodEnd || !newRunForm.payDate) {
      toast.error('Tous les champs de date sont requis');
      return;
    }
    try {
      const res = await fetch('/api/accounting/payroll', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(newRunForm),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Cycle de paie cree');
      setShowNewRunModal(false);
      setNewRunForm({ periodStart: '', periodEnd: '', payDate: '', notes: '' });
      fetchRuns();
    } catch {
      toast.error('Erreur de creation');
    }
  };

  const calculateRun = async (runId: string) => {
    setRunActionLoading(runId);
    try {
      const res = await fetch(`/api/accounting/payroll/${runId}/calculate`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur de calcul');
        return;
      }
      toast.success(`Paie calculee: ${json.run.employeeCount} employe(s), net total: ${formatMoney(json.run.totalNet)}`);
      fetchRuns();
    } catch {
      toast.error('Erreur de calcul');
    } finally {
      setRunActionLoading(null);
    }
  };

  const approveRun = async (runId: string) => {
    setRunActionLoading(runId);
    try {
      const res = await fetch(`/api/accounting/payroll/${runId}/approve`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur d\'approbation');
        return;
      }
      toast.success(`Cycle approuve. ${json.payStubsGenerated} bulletins generes.`);
      fetchRuns();
      fetchPayStubs();
    } catch {
      toast.error('Erreur d\'approbation');
    } finally {
      setRunActionLoading(null);
    }
  };

  const deleteRun = async (runId: string) => {
    if (!confirm('Supprimer ce cycle de paie brouillon?')) return;
    try {
      const res = await fetch(`/api/accounting/payroll/${runId}`, {
        method: 'DELETE',
        headers: addCSRFHeader({}),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Cycle supprime');
      fetchRuns();
    } catch {
      toast.error('Erreur de suppression');
    }
  };

  // =========================================================================
  // Employee Actions
  // =========================================================================

  const createEmployee = async () => {
    if (!employeeForm.firstName || !employeeForm.lastName || !employeeForm.email || !employeeForm.hireDate) {
      toast.error('Remplissez les champs obligatoires');
      return;
    }
    if (!employeeForm.annualSalary && !employeeForm.hourlyRate) {
      toast.error('Salaire annuel ou taux horaire requis');
      return;
    }
    try {
      const payload = {
        ...employeeForm,
        annualSalary: employeeForm.annualSalary ? parseFloat(employeeForm.annualSalary) : null,
        hourlyRate: employeeForm.hourlyRate ? parseFloat(employeeForm.hourlyRate) : null,
        vacationPayRate: parseFloat(employeeForm.vacationPayRate) || 4,
      };
      const res = await fetch('/api/accounting/payroll/employees', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success(`Employe ${json.employee.firstName} ${json.employee.lastName} cree`);
      setShowNewEmployeeModal(false);
      setEmployeeForm({
        firstName: '', lastName: '', email: '', hireDate: '',
        employmentType: 'FULL_TIME', province: 'QC', country: 'CA',
        annualSalary: '', hourlyRate: '', payFrequency: 'BIWEEKLY',
        vacationPayRate: '4', notes: '',
      });
      fetchEmployees();
    } catch {
      toast.error('Erreur de creation');
    }
  };

  const deleteEmployee = async (empId: string) => {
    if (!confirm('Supprimer cet employe?')) return;
    try {
      const res = await fetch(`/api/accounting/payroll/employees/${empId}`, {
        method: 'DELETE',
        headers: addCSRFHeader({}),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error || 'Erreur');
        return;
      }
      toast.success('Employe supprime');
      fetchEmployees();
    } catch {
      toast.error('Erreur de suppression');
    }
  };

  // =========================================================================
  // Reports
  // =========================================================================

  const loadReport = async (type: 'summary' | 't4' | 'rl1') => {
    setReportLoading(true);
    setReportData(null);
    try {
      const res = await fetch(`/api/accounting/payroll/reports/t4?year=${reportYear}&type=${type}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Erreur');
        return;
      }
      setReportData(json);
    } catch {
      toast.error('Erreur de chargement du rapport');
    } finally {
      setReportLoading(false);
    }
  };

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
        <span className="ml-3 text-slate-500">Chargement de la paie...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paie"
        subtitle="Gestion de la paie canadienne - BioCycle Peptides (Quebec)"
        theme={theme}
        actions={
          <div className="flex gap-2">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => activeTab === 'employees' ? setShowNewEmployeeModal(true) : setShowNewRunModal(true)}
            >
              {activeTab === 'employees' ? 'Nouvel employe' : 'Nouveau cycle'}
            </Button>
          </div>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-50 rounded-lg">
              <Users className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{employees.filter(e => e.status === 'ACTIVE').length}</p>
              <p className="text-xs text-slate-500">Employes actifs</p>
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
                {formatMoney(runs.filter(r => r.status === 'PAID').reduce((s, r) => s + r.totalNet, 0))}
              </p>
              <p className="text-xs text-slate-500">Net paye (total)</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Calendar className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{runs.length}</p>
              <p className="text-xs text-slate-500">Cycles de paie</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-50 rounded-lg">
              <FileText className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{payStubs.length}</p>
              <p className="text-xs text-slate-500">Bulletins generes</p>
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
            </button>
          );
        })}
      </div>

      {/* ============================================================= */}
      {/* TAB: Payroll Runs */}
      {/* ============================================================= */}
      {activeTab === 'runs' && (
        <SectionCard title="Cycles de paie" theme={theme}>
          {runs.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Aucun cycle de paie</p>
              <Button variant="primary" icon={Plus} className="mt-4" onClick={() => setShowNewRunModal(true)}>
                Creer le premier cycle
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Periode</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Date de paie</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Statut</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Employes</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Brut total</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Net total</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Cout employeur</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <span className="font-medium">{run.periodStart}</span>
                        <span className="text-slate-400 mx-1">-</span>
                        <span>{run.periodEnd}</span>
                      </td>
                      <td className="py-3 px-3">{run.payDate}</td>
                      <td className="py-3 px-3">
                        <StatusBadge variant={statusBadgeVariant(run.status)} dot>
                          {statusLabel(run.status)}
                        </StatusBadge>
                      </td>
                      <td className="py-3 px-3 text-right">{run.employeeCount}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatMoney(run.totalGross)}</td>
                      <td className="py-3 px-3 text-right font-mono font-medium">{formatMoney(run.totalNet)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">{formatMoney(run.totalEmployerCost)}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {run.status === 'DRAFT' && (
                            <>
                              <button
                                title="Calculer"
                                className="p-1.5 rounded hover:bg-sky-50 text-sky-600"
                                onClick={() => calculateRun(run.id)}
                                disabled={runActionLoading === run.id}
                              >
                                <Calculator className="w-4 h-4" />
                              </button>
                              <button
                                title="Supprimer"
                                className="p-1.5 rounded hover:bg-red-50 text-red-500"
                                onClick={() => deleteRun(run.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {run.status === 'CALCULATED' && (
                            <>
                              <button
                                title="Recalculer"
                                className="p-1.5 rounded hover:bg-sky-50 text-sky-600"
                                onClick={() => calculateRun(run.id)}
                                disabled={runActionLoading === run.id}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                title="Approuver"
                                className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600"
                                onClick={() => approveRun(run.id)}
                                disabled={runActionLoading === run.id}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {(run.status === 'APPROVED' || run.status === 'PAID') && (
                            <button
                              title="Voir details"
                              className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                              onClick={() => toast.info(`Details du cycle ${run.id.slice(0, 8)}...`)}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          {runActionLoading === run.id && (
                            <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
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

      {/* ============================================================= */}
      {/* TAB: Employees */}
      {/* ============================================================= */}
      {activeTab === 'employees' && (
        <SectionCard
          title="Employes"
          theme={theme}
          headerAction={
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowNewEmployeeModal(true)}>
              Ajouter
            </Button>
          }
        >
          {employees.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Aucun employe enregistre</p>
              <Button variant="primary" icon={Plus} className="mt-4" onClick={() => setShowNewEmployeeModal(true)}>
                Ajouter le premier employe
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Nom</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Email</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Type</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Province</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Frequence</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Salaire/Taux</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Statut</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Embauche</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3 font-medium">
                        {emp.firstName} {emp.lastName}
                      </td>
                      <td className="py-3 px-3 text-slate-500">{emp.email}</td>
                      <td className="py-3 px-3">
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          {statusLabel(emp.employmentType)}
                        </span>
                      </td>
                      <td className="py-3 px-3">{emp.province}</td>
                      <td className="py-3 px-3">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {statusLabel(emp.payFrequency)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        {emp.annualSalary
                          ? formatMoney(emp.annualSalary) + '/an'
                          : emp.hourlyRate
                          ? formatMoney(emp.hourlyRate) + '/h'
                          : '-'}
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge variant={statusBadgeVariant(emp.status)} dot>
                          {statusLabel(emp.status)}
                        </StatusBadge>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{emp.hireDate}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            title="Voir"
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                            onClick={() => toast.info(`Employe: ${emp.firstName} ${emp.lastName}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Supprimer"
                            className="p-1.5 rounded hover:bg-red-50 text-red-500"
                            onClick={() => deleteEmployee(emp.id)}
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* ============================================================= */}
      {/* TAB: Pay Stubs */}
      {/* ============================================================= */}
      {activeTab === 'stubs' && (
        <SectionCard title="Bulletins de paie" theme={theme}>
          {payStubs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Aucun bulletin de paie genere</p>
              <p className="text-xs text-slate-400 mt-1">
                Les bulletins sont generes automatiquement lors de l&apos;approbation d&apos;un cycle de paie
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Employe</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Periode</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-600">Date de paie</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Brut</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Deductions</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">Net</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">YTD Brut</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-600">YTD Net</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payStubs.map((stub) => (
                    <tr key={stub.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3 font-medium">
                        {stub.employee.firstName} {stub.employee.lastName}
                      </td>
                      <td className="py-3 px-3">
                        {stub.periodStart} - {stub.periodEnd}
                      </td>
                      <td className="py-3 px-3">{stub.payDate}</td>
                      <td className="py-3 px-3 text-right font-mono">{formatMoney(stub.grossPay)}</td>
                      <td className="py-3 px-3 text-right font-mono text-red-600">
                        -{formatMoney(stub.totalDeductions)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium text-emerald-700">
                        {formatMoney(stub.netPay)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">{formatMoney(stub.ytdGross)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">{formatMoney(stub.ytdNet)}</td>
                      <td className="py-3 px-3 text-center">
                        <button
                          title="Telecharger"
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-600"
                          onClick={() => toast.info('Generation PDF en cours de developpement')}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ============================================================= */}
      {/* TAB: Reports */}
      {/* ============================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <SectionCard title="Rapports de paie" theme={theme}>
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Annee fiscale</label>
                <input
                  type="number"
                  value={reportYear}
                  onChange={(e) => setReportYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  min={2020}
                  max={2030}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="primary" icon={BarChart3} onClick={() => loadReport('summary')} loading={reportLoading}>
                  Sommaire paie
                </Button>
                <Button variant="secondary" icon={FileText} onClick={() => loadReport('t4')} loading={reportLoading}>
                  T4 (federal)
                </Button>
                <Button variant="secondary" icon={FileText} onClick={() => loadReport('rl1')} loading={reportLoading}>
                  RL-1 (Quebec)
                </Button>
              </div>
            </div>

            {reportData && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h4 className="font-medium text-slate-900 mb-3">
                  {(reportData as Record<string, unknown>).type === 'summary' && 'Sommaire de la paie'}
                  {(reportData as Record<string, unknown>).type === 't4' && 'Donnees T4 (federal)'}
                  {(reportData as Record<string, unknown>).type === 'rl1' && 'Donnees RL-1 (Quebec)'}
                  {' - '}{(reportData as Record<string, unknown>).year as number}
                </h4>

                {(reportData as Record<string, unknown>).type === 'summary' && !!(reportData as Record<string, unknown>).summary && (
                  <div className="space-y-4">
                    {(() => {
                      const summary = (reportData as Record<string, unknown>).summary as Record<string, unknown>;
                      const totals = summary.totals as Record<string, number>;
                      return (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white rounded-lg p-3 border">
                              <p className="text-xs text-slate-500">Cycles</p>
                              <p className="text-lg font-bold">{summary.runsCount as number}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border">
                              <p className="text-xs text-slate-500">Employes</p>
                              <p className="text-lg font-bold">{summary.employeeCount as number}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border">
                              <p className="text-xs text-slate-500">Brut total</p>
                              <p className="text-lg font-bold font-mono">{formatMoney(totals.grossPay)}</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border">
                              <p className="text-xs text-slate-500">Net total</p>
                              <p className="text-lg font-bold font-mono text-emerald-700">{formatMoney(totals.netPay)}</p>
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-4 border">
                            <h5 className="text-sm font-medium text-slate-700 mb-3">Ventilation des deductions et cotisations</h5>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                              <div><span className="text-slate-500">RRQ/RPC:</span> <span className="font-mono">{formatMoney(totals.cppContribution)}</span></div>
                              <div><span className="text-slate-500">AE:</span> <span className="font-mono">{formatMoney(totals.eiPremium)}</span></div>
                              <div><span className="text-slate-500">RQAP:</span> <span className="font-mono">{formatMoney(totals.qpipPremium)}</span></div>
                              <div><span className="text-slate-500">Impot federal:</span> <span className="font-mono">{formatMoney(totals.federalTax)}</span></div>
                              <div><span className="text-slate-500">Impot provincial:</span> <span className="font-mono">{formatMoney(totals.provincialTax)}</span></div>
                              <div><span className="text-slate-500">Vacances:</span> <span className="font-mono">{formatMoney(totals.vacationPay)}</span></div>
                              <div><span className="text-slate-500">RRQ employeur:</span> <span className="font-mono">{formatMoney(totals.employerCpp)}</span></div>
                              <div><span className="text-slate-500">AE employeur:</span> <span className="font-mono">{formatMoney(totals.employerEi)}</span></div>
                              <div><span className="text-slate-500">RQAP employeur:</span> <span className="font-mono">{formatMoney(totals.employerQpip)}</span></div>
                              <div><span className="text-slate-500">FSS:</span> <span className="font-mono">{formatMoney(totals.employerHst)}</span></div>
                              <div><span className="text-slate-500">CNESST/CNT:</span> <span className="font-mono">{formatMoney(totals.employerWcb)}</span></div>
                              <div className="font-medium"><span className="text-slate-700">Cout employeur total:</span> <span className="font-mono">{formatMoney(totals.totalEmployerCost)}</span></div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {((reportData as Record<string, unknown>).type === 't4' || (reportData as Record<string, unknown>).type === 'rl1') && (
                  <div>
                    <p className="text-sm text-slate-600 mb-2">
                      {(reportData as Record<string, unknown>).count as number} feuillet(s) genere(s)
                    </p>
                    {((reportData as Record<string, unknown>).errors as Array<Record<string, string>>)?.length > 0 && (
                      <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg p-3 mb-3">
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">
                          {((reportData as Record<string, unknown>).errors as Array<Record<string, string>>).length} erreur(s) lors de la generation
                        </span>
                      </div>
                    )}
                    <pre className="text-xs bg-white p-3 rounded-lg border overflow-auto max-h-96">
                      {JSON.stringify((reportData as Record<string, unknown>).data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: New Payroll Run */}
      {/* ============================================================= */}
      {showNewRunModal && (
        <Modal
          isOpen={showNewRunModal}
          title="Nouveau cycle de paie"
          onClose={() => setShowNewRunModal(false)}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Debut de periode *</label>
                <input
                  type="date"
                  value={newRunForm.periodStart}
                  onChange={(e) => setNewRunForm({ ...newRunForm, periodStart: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fin de periode *</label>
                <input
                  type="date"
                  value={newRunForm.periodEnd}
                  onChange={(e) => setNewRunForm({ ...newRunForm, periodEnd: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date de paiement *</label>
              <input
                type="date"
                value={newRunForm.payDate}
                onChange={(e) => setNewRunForm({ ...newRunForm, payDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={newRunForm.notes}
                onChange={(e) => setNewRunForm({ ...newRunForm, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="Notes optionnelles..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowNewRunModal(false)}>Annuler</Button>
              <Button variant="primary" icon={Plus} onClick={createPayrollRun}>Creer</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================= */}
      {/* MODAL: New Employee */}
      {/* ============================================================= */}
      {showNewEmployeeModal && (
        <Modal
          isOpen={showNewEmployeeModal}
          title="Nouvel employe"
          onClose={() => setShowNewEmployeeModal(false)}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prenom *</label>
                <input
                  type="text"
                  value={employeeForm.firstName}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={employeeForm.lastName}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                value={employeeForm.email}
                onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date d&apos;embauche *</label>
                <input
                  type="date"
                  value={employeeForm.hireDate}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, hireDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type d&apos;emploi</label>
                <select
                  value={employeeForm.employmentType}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, employmentType: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="FULL_TIME">Temps plein</option>
                  <option value="PART_TIME">Temps partiel</option>
                  <option value="CONTRACT">Contractuel</option>
                  <option value="SEASONAL">Saisonnier</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Province</label>
                <select
                  value={employeeForm.province}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, province: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="QC">Quebec</option>
                  <option value="ON">Ontario</option>
                  <option value="BC">Colombie-Britannique</option>
                  <option value="AB">Alberta</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pays</label>
                <select
                  value={employeeForm.country}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, country: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="CA">Canada</option>
                  <option value="US">Etats-Unis</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Frequence paie</label>
                <select
                  value={employeeForm.payFrequency}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, payFrequency: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="WEEKLY">Hebdomadaire</option>
                  <option value="BIWEEKLY">Aux 2 semaines</option>
                  <option value="SEMI_MONTHLY">Bi-mensuel</option>
                  <option value="MONTHLY">Mensuel</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Salaire annuel ($)</label>
                <input
                  type="number"
                  value={employeeForm.annualSalary}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, annualSalary: e.target.value, hourlyRate: '' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Ex: 65000"
                  min={0}
                  step={1000}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Taux horaire ($/h)</label>
                <input
                  type="number"
                  value={employeeForm.hourlyRate}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, hourlyRate: e.target.value, annualSalary: '' })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="Ex: 25.00"
                  min={0}
                  step={0.25}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Taux vacances (%)</label>
              <input
                type="number"
                value={employeeForm.vacationPayRate}
                onChange={(e) => setEmployeeForm({ ...employeeForm, vacationPayRate: e.target.value })}
                className="w-32 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                min={4}
                max={100}
                step={0.5}
              />
              <p className="text-xs text-slate-400 mt-1">Minimum 4% au Quebec/Canada</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                value={employeeForm.notes}
                onChange={(e) => setEmployeeForm({ ...employeeForm, notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder="Notes optionnelles..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowNewEmployeeModal(false)}>Annuler</Button>
              <Button variant="primary" icon={Plus} onClick={createEmployee}>Creer</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
