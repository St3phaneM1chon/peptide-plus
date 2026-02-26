'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, Plus, Calculator, FileText, BarChart3,
  Edit3, Trash2, RefreshCw, Check, X, AlertTriangle,
  DollarSign, TrendingUp, Search, ChevronRight,
} from 'lucide-react';
import { PageHeader, Button, SectionCard, StatusBadge, Modal, StatCard } from '@/components/admin';
import type { BadgeVariant } from '@/components/admin';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// =============================================================================
// Types
// =============================================================================

interface RSDeProject {
  id: string; name: string; description: string | null; fiscalYear: number;
  startDate: string | null; endDate: string | null; status: string;
  technologicalUncertainty: string | null; technologicalAdvancement: string | null;
  systematicInvestigation: string | null; isSpcc: boolean; createdAt: string;
  totalExpenses: number; eligibleExpenses: number;
  lastCalculation: { totalCredit: number; federalCredit: number; provincialCredit: number } | null;
}

interface RSDeExpense {
  id: string; projectId: string; category: string; description: string;
  amount: number; date: string; employeeName: string | null;
  hoursWorked: number | null; hourlyRate: number | null;
  isEligible: boolean; eligibilityNotes: string | null;
}

interface CreditCalc {
  totalEligible: number; federalRate: number; federalCredit: number;
  provincialRate: number; provincialCredit: number; totalCredit: number;
  spccLimit: number; isRefundable: boolean;
  byCategory: Record<string, number>;
}

// =============================================================================
// Helpers
// =============================================================================

const theme = sectionThemes.compliance;
const fmt = (n: number) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: 'Brouillon', variant: 'default' },
  ACTIVE: { label: 'Actif', variant: 'info' },
  SUBMITTED: { label: 'Soumis', variant: 'warning' },
  APPROVED: { label: 'Approuvé', variant: 'success' },
  REJECTED: { label: 'Rejeté', variant: 'destructive' },
};

const CATEGORY_LABELS: Record<string, string> = {
  SALARY: 'Salaires', MATERIALS: 'Matériaux', SUBCONTRACTOR: 'Sous-traitance',
  CAPITAL: 'Capital', OVERHEAD: 'Frais généraux',
};

type Tab = 'projects' | 'expenses' | 'calculator' | 't661' | 'dashboard';

// =============================================================================
// Component
// =============================================================================

export default function RSDeAdminPage() {
  const [tab, setTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<RSDeProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<RSDeProject | null>(null);
  const [expenses, setExpenses] = useState<RSDeExpense[]>([]);
  const [calculation, setCalculation] = useState<CreditCalc | null>(null);
  const [t661Data, setT661Data] = useState<Record<string, unknown> | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: '', description: '', fiscalYear: new Date().getFullYear(), startDate: '', endDate: '', technologicalUncertainty: '', technologicalAdvancement: '', systematicInvestigation: '', isSpcc: true });

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/accounting/rsde');
      if (res.ok) { const d = await res.json(); setProjects(d.data); }
    } catch { toast.error('Erreur chargement projets'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const loadExpenses = async (projectId: string) => {
    const res = await fetch(`/api/accounting/rsde/${projectId}/expenses`);
    if (res.ok) { const d = await res.json(); setExpenses(d.data.map((e: RSDeExpense) => ({ ...e, amount: Number(e.amount) }))); }
  };

  const calculateCredits = async (projectId: string) => {
    const res = await fetch('/api/accounting/rsde/calculate', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
      body: JSON.stringify({ projectId }),
    });
    if (res.ok) { const d = await res.json(); setCalculation(d); toast.success('Crédits calculés'); }
  };

  const generateT661 = async (projectId: string) => {
    const res = await fetch('/api/accounting/rsde/t661', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
      body: JSON.stringify({ projectId }),
    });
    if (res.ok) { setT661Data(await res.json()); toast.success('Formulaire T661 généré'); }
  };

  const loadSummary = async () => {
    const res = await fetch('/api/accounting/rsde/summary');
    if (res.ok) setSummary(await res.json());
  };

  const handleCreateProject = async () => {
    const res = await fetch('/api/accounting/rsde', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
      body: JSON.stringify(form),
    });
    if (res.ok) { toast.success('Projet créé'); setShowModal(false); loadProjects(); setForm({ name: '', description: '', fiscalYear: new Date().getFullYear(), startDate: '', endDate: '', technologicalUncertainty: '', technologicalAdvancement: '', systematicInvestigation: '', isSpcc: true }); }
    else toast.error('Erreur création');
  };

  const selectProject = (p: RSDeProject) => { setSelectedProject(p); loadExpenses(p.id); };

  const TABS: Array<{ id: Tab; label: string; icon: typeof FlaskConical }> = [
    { id: 'projects', label: 'Projets', icon: FlaskConical },
    { id: 'expenses', label: 'Dépenses', icon: DollarSign },
    { id: 'calculator', label: 'Calculateur', icon: Calculator },
    { id: 't661', label: 'T661', icon: FileText },
    { id: 'dashboard', label: 'Tableau', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="RS&DE — Crédits R&D" description="Suivi des dépenses éligibles, calcul crédits fédéraux et provinciaux (CRIC Québec)" accentBarClass={theme.accentBar} accentBgClass={theme.accentBg}>
        <Button onClick={() => setShowModal(true)} className={theme.btnPrimary}><Plus className="w-4 h-4 mr-1" />Nouveau projet</Button>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setTab(id); if (id === 'dashboard') loadSummary(); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === id ? `${theme.pillBg} ${theme.pillText}` : 'text-gray-600 hover:bg-gray-200'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Projects Tab */}
      {tab === 'projects' && (
        <SectionCard>
          {loading ? <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin" /></div> : (
            <div className="divide-y">
              {projects.map(p => (
                <div key={p.id} onClick={() => selectProject(p)} className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedProject?.id === p.id ? 'bg-amber-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{p.name}</h4>
                      <p className="text-sm text-gray-500">Année fiscale {p.fiscalYear} • {p.isSpcc ? 'SPCC' : 'Non-SPCC'}</p>
                    </div>
                    <div className="text-right">
                      <StatusBadge variant={STATUS_MAP[p.status]?.variant || 'default'}>{STATUS_MAP[p.status]?.label || p.status}</StatusBadge>
                      {p.lastCalculation && <p className="text-sm font-bold text-green-600 mt-1">{fmt(Number(p.lastCalculation.totalCredit))}</p>}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    <span>Dépenses: {fmt(p.totalExpenses)}</span>
                    <span>Éligibles: {fmt(p.eligibleExpenses)}</span>
                  </div>
                </div>
              ))}
              {projects.length === 0 && <p className="py-8 text-center text-gray-400">Aucun projet RS&DE. Créez-en un!</p>}
            </div>
          )}
        </SectionCard>
      )}

      {/* Expenses Tab */}
      {tab === 'expenses' && (
        <SectionCard>
          {!selectedProject ? <p className="py-8 text-center text-gray-400">Sélectionnez un projet dans l&apos;onglet Projets</p> : (
            <>
              <h3 className="text-lg font-semibold mb-4">Dépenses — {selectedProject.name}</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-gray-500"><th className="pb-2">Date</th><th className="pb-2">Description</th><th className="pb-2">Catégorie</th><th className="pb-2 text-right">Montant</th><th className="pb-2">Éligible</th></tr></thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id} className="border-b border-gray-50">
                      <td className="py-2 text-gray-600">{new Date(e.date).toLocaleDateString('fr-CA')}</td>
                      <td className="py-2">{e.description}</td>
                      <td className="py-2"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{CATEGORY_LABELS[e.category] || e.category}</span></td>
                      <td className="py-2 text-right font-medium">{fmt(e.amount)}</td>
                      <td className="py-2">{e.isEligible ? <Check className="w-4 h-4 text-green-500" /> : <X className="w-4 h-4 text-red-400" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {expenses.length === 0 && <p className="py-6 text-center text-gray-400">Aucune dépense pour ce projet</p>}
            </>
          )}
        </SectionCard>
      )}

      {/* Calculator Tab */}
      {tab === 'calculator' && (
        <SectionCard>
          {!selectedProject ? <p className="py-8 text-center text-gray-400">Sélectionnez un projet d&apos;abord</p> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Calcul — {selectedProject.name}</h3>
                <Button onClick={() => calculateCredits(selectedProject.id)} className={theme.btnPrimary}><Calculator className="w-4 h-4 mr-1" />Calculer</Button>
              </div>
              {calculation && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Total éligible" value={fmt(calculation.totalEligible)} icon={<DollarSign />} iconBg={theme.statIconBg} iconColor={theme.statIconColor} />
                  <StatCard title="Crédit fédéral" value={fmt(calculation.federalCredit)} subtitle={`Taux: ${pct(calculation.federalRate)}`} icon={<TrendingUp />} iconBg="bg-blue-50" iconColor="text-blue-600" />
                  <StatCard title="Crédit provincial" value={fmt(calculation.provincialCredit)} subtitle={`CRIC: ${pct(calculation.provincialRate)}`} icon={<TrendingUp />} iconBg="bg-green-50" iconColor="text-green-600" />
                  <StatCard title="TOTAL CRÉDITS" value={fmt(calculation.totalCredit)} subtitle={calculation.isRefundable ? 'Remboursable' : 'Non-remboursable'} icon={<Calculator />} iconBg="bg-purple-50" iconColor="text-purple-600" />
                </div>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* T661 Tab */}
      {tab === 't661' && (
        <SectionCard>
          {!selectedProject ? <p className="py-8 text-center text-gray-400">Sélectionnez un projet d&apos;abord</p> : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Formulaire T661 — {selectedProject.name}</h3>
                <Button onClick={() => generateT661(selectedProject.id)} className={theme.btnPrimary}><FileText className="w-4 h-4 mr-1" />Générer</Button>
              </div>
              {t661Data && (
                <pre className="bg-gray-50 border rounded-lg p-4 text-xs overflow-auto max-h-96">{JSON.stringify(t661Data, null, 2)}</pre>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {/* Dashboard Tab */}
      {tab === 'dashboard' && (
        <SectionCard>
          {!summary ? <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin" /></div> : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Projets actifs" value={String((summary as { activeProjects: number }).activeProjects)} icon={<FlaskConical />} iconBg={theme.statIconBg} iconColor={theme.statIconColor} />
                <StatCard title="Dépenses éligibles" value={fmt((summary as { totalEligibleExpenses: number }).totalEligibleExpenses)} icon={<DollarSign />} iconBg="bg-blue-50" iconColor="text-blue-600" />
                <StatCard title="Crédits totaux" value={fmt((summary as { totalCreditsEarned: number }).totalCreditsEarned)} icon={<TrendingUp />} iconBg="bg-green-50" iconColor="text-green-600" />
                <StatCard title="Total projets" value={String((summary as { totalProjects: number }).totalProjects)} icon={<BarChart3 />} iconBg="bg-purple-50" iconColor="text-purple-600" />
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Create Project Modal */}
      {showModal && (
        <Modal title="Nouveau Projet RS&DE" onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nom du projet *" className="w-full border rounded-lg px-3 py-2 text-sm" />
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
            <div className="grid grid-cols-3 gap-3">
              <input type="number" value={form.fiscalYear} onChange={e => setForm({ ...form, fiscalYear: parseInt(e.target.value) })} className="border rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="border rounded-lg px-3 py-2 text-sm" />
            </div>
            <textarea value={form.technologicalUncertainty} onChange={e => setForm({ ...form, technologicalUncertainty: e.target.value })} placeholder="Incertitudes technologiques" className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            <textarea value={form.technologicalAdvancement} onChange={e => setForm({ ...form, technologicalAdvancement: e.target.value })} placeholder="Avancements technologiques visés" className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            <textarea value={form.systematicInvestigation} onChange={e => setForm({ ...form, systematicInvestigation: e.target.value })} placeholder="Investigation systématique" className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} />
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.isSpcc} onChange={e => setForm({ ...form, isSpcc: e.target.checked })} className="accent-amber-600" /><span className="text-sm">SPCC (Société privée sous contrôle canadien)</span></label>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreateProject} className={theme.btnPrimary}>Créer</Button>
              <Button onClick={() => setShowModal(false)} variant="outline">Annuler</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
