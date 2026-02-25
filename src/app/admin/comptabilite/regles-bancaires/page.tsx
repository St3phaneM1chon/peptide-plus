'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  Play,
  ToggleLeft,
  ToggleRight,
  ArrowUp,
  ArrowDown,
  Loader2,
  ListChecks,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { PageHeader, SectionCard, StatCard, Button, Modal, FormField, Input, FilterBar } from '@/components/admin';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChartAccount {
  id: string;
  code: string;
  name: string;
}

interface BankRule {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  descriptionContains: string | null;
  descriptionStartsWith: string | null;
  descriptionExact: string | null;
  amountMin: number | null;
  amountMax: number | null;
  amountExact: number | null;
  transactionType: string | null;
  accountId: string | null;
  account: ChartAccount | null;
  categoryTag: string | null;
  taxCode: string | null;
  description: string | null;
  timesApplied: number;
  lastAppliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RuleFormData {
  name: string;
  priority: number;
  isActive: boolean;
  descriptionContains: string;
  descriptionStartsWith: string;
  descriptionExact: string;
  amountMin: string;
  amountMax: string;
  amountExact: string;
  transactionType: string;
  accountId: string;
  categoryTag: string;
  taxCode: string;
  description: string;
}

const emptyForm: RuleFormData = {
  name: '',
  priority: 0,
  isActive: true,
  descriptionContains: '',
  descriptionStartsWith: '',
  descriptionExact: '',
  amountMin: '',
  amountMax: '',
  amountExact: '',
  transactionType: '',
  accountId: '',
  categoryTag: '',
  taxCode: '',
  description: '',
};

const TAX_CODES = [
  { value: '', label: '-- None --' },
  { value: 'GST', label: 'GST (5%)' },
  { value: 'QST', label: 'QST (9.975%)' },
  { value: 'HST', label: 'HST (13%)' },
  { value: 'EXEMPT', label: 'Exempt' },
  { value: 'ZERO_RATED', label: 'Zero-rated' },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ReglesBancairesPage() {
  const { t } = useI18n();
  const theme = sectionThemes.bank;

  // State
  const [rules, setRules] = useState<BankRule[]>([]);
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, totalApplied: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BankRule | null>(null);
  const [form, setForm] = useState<RuleFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteRule, setConfirmDeleteRule] = useState<BankRule | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/bank-rules');
      if (!res.ok) throw new Error('Failed to fetch rules');
      const json = await res.json();
      setRules(json.rules || []);
      setStats(json.stats || { total: 0, active: 0, inactive: 0, totalApplied: 0 });
    } catch (err) {
      console.error('Error fetching bank rules:', err);
      toast.error(t('admin.bankRules.errorLoading') || 'Error loading rules');
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/chart-of-accounts');
      if (!res.ok) return;
      const json = await res.json();
      const list = (json.accounts || []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        code: a.code as string,
        name: a.name as string,
      }));
      setAccounts(list);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchAccounts();
  }, [fetchRules, fetchAccounts]);

  // ---------------------------------------------------------------------------
  // Modal helpers
  // ---------------------------------------------------------------------------

  const openCreateModal = () => {
    setEditingRule(null);
    setForm(emptyForm);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEditModal = (rule: BankRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      priority: rule.priority,
      isActive: rule.isActive,
      descriptionContains: rule.descriptionContains || '',
      descriptionStartsWith: rule.descriptionStartsWith || '',
      descriptionExact: rule.descriptionExact || '',
      amountMin: rule.amountMin !== null ? String(rule.amountMin) : '',
      amountMax: rule.amountMax !== null ? String(rule.amountMax) : '',
      amountExact: rule.amountExact !== null ? String(rule.amountExact) : '',
      transactionType: rule.transactionType || '',
      accountId: rule.accountId || '',
      categoryTag: rule.categoryTag || '',
      taxCode: rule.taxCode || '',
      description: rule.description || '',
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRule(null);
    setForm(emptyForm);
    setFormErrors({});
  };

  // ---------------------------------------------------------------------------
  // Form change handler
  // ---------------------------------------------------------------------------

  const updateForm = (field: keyof RuleFormData, value: string | number | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear specific error when user edits
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Save (create or update)
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    const errors: Record<string, string> = {};

    if (!form.name.trim()) {
      errors.name = t('admin.bankRules.errorNameRequired') || 'Name is required';
    }

    // Check at least one condition
    const hasCondition = !!(
      form.descriptionContains ||
      form.descriptionStartsWith ||
      form.descriptionExact ||
      form.amountMin ||
      form.amountMax ||
      form.amountExact ||
      form.transactionType
    );
    if (!hasCondition) {
      errors.conditions = t('admin.bankRules.errorNoCondition') || 'At least one condition is required';
    }

    // Check at least one action
    const hasAction = !!(form.accountId || form.categoryTag);
    if (!hasAction) {
      errors.actions = t('admin.bankRules.errorNoAction') || 'At least one action is required (account or category tag)';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        priority: form.priority,
        isActive: form.isActive,
        descriptionContains: form.descriptionContains || null,
        descriptionStartsWith: form.descriptionStartsWith || null,
        descriptionExact: form.descriptionExact || null,
        amountMin: form.amountMin ? parseFloat(form.amountMin) : null,
        amountMax: form.amountMax ? parseFloat(form.amountMax) : null,
        amountExact: form.amountExact ? parseFloat(form.amountExact) : null,
        transactionType: form.transactionType || null,
        accountId: form.accountId || null,
        categoryTag: form.categoryTag || null,
        taxCode: form.taxCode || null,
        description: form.description || null,
      };

      if (editingRule) {
        payload.id = editingRule.id;
      }

      const res = await fetch('/api/accounting/bank-rules', {
        method: editingRule ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save rule');
      }

      toast.success(
        editingRule
          ? t('admin.bankRules.ruleUpdated') || 'Rule updated'
          : t('admin.bankRules.ruleCreated') || 'Rule created'
      );
      closeModal();
      fetchRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving rule');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Toggle active
  // ---------------------------------------------------------------------------

  const toggleActive = async (rule: BankRule) => {
    try {
      const res = await fetch('/api/accounting/bank-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle rule');
      fetchRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error toggling rule');
    }
  };

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const handleDelete = async (rule: BankRule) => {
    setConfirmDeleteRule(null);
    setDeletingId(rule.id);
    try {
      const res = await fetch(`/api/accounting/bank-rules?id=${rule.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete rule');
      toast.success(t('admin.bankRules.ruleDeleted') || 'Rule deleted');
      fetchRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error deleting rule');
    } finally {
      setDeletingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Priority reorder
  // ---------------------------------------------------------------------------

  const changePriority = async (rule: BankRule, direction: 'up' | 'down') => {
    const newPriority = direction === 'up' ? rule.priority + 1 : Math.max(0, rule.priority - 1);
    try {
      await fetch('/api/accounting/bank-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, priority: newPriority }),
      });
      fetchRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error updating priority');
    }
  };

  // ---------------------------------------------------------------------------
  // Apply rules
  // ---------------------------------------------------------------------------

  const handleApplyRules = async () => {
    setApplying(true);
    try {
      const res = await fetch('/api/accounting/bank-rules/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applyAll: true }),
      });
      if (!res.ok) throw new Error('Failed to apply rules');
      const json = await res.json();
      toast.success(
        `${json.matched} ${t('admin.bankRules.transactionsMatched') || 'transactions matched'}, ${json.unmatched} ${t('admin.bankRules.unmatched') || 'unmatched'}`
      );
      fetchRules(); // refresh stats
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error applying rules');
    } finally {
      setApplying(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Filter
  // ---------------------------------------------------------------------------

  const filtered = rules.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.descriptionContains && r.descriptionContains.toLowerCase().includes(search.toLowerCase())) ||
    (r.categoryTag && r.categoryTag.toLowerCase().includes(search.toLowerCase()))
  );

  // ---------------------------------------------------------------------------
  // Condition badges
  // ---------------------------------------------------------------------------

  const conditionBadges = (rule: BankRule) => {
    const badges: Array<{ label: string; color: string }> = [];
    if (rule.descriptionContains) badges.push({ label: `"...${rule.descriptionContains}..."`, color: 'bg-sky-100 text-sky-700' });
    if (rule.descriptionStartsWith) badges.push({ label: `"${rule.descriptionStartsWith}..."`, color: 'bg-sky-100 text-sky-700' });
    if (rule.descriptionExact) badges.push({ label: `="${rule.descriptionExact}"`, color: 'bg-sky-100 text-sky-700' });
    if (rule.amountMin !== null) badges.push({ label: `>= $${rule.amountMin}`, color: 'bg-emerald-100 text-emerald-700' });
    if (rule.amountMax !== null) badges.push({ label: `<= $${rule.amountMax}`, color: 'bg-emerald-100 text-emerald-700' });
    if (rule.amountExact !== null) badges.push({ label: `= $${rule.amountExact}`, color: 'bg-emerald-100 text-emerald-700' });
    if (rule.transactionType) badges.push({ label: rule.transactionType, color: rule.transactionType === 'DEBIT' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700' });
    return badges;
  };

  // ---------------------------------------------------------------------------
  // Ribbon actions
  // ---------------------------------------------------------------------------

  const handleRibbonSynchronize = useCallback(() => {
    window.location.href = '/admin/comptabilite/banques';
  }, []);
  const handleRibbonImportStatement = useCallback(() => {
    window.location.href = '/admin/comptabilite/import-bancaire';
  }, []);
  const handleRibbonReconcile = useCallback(() => {
    window.location.href = '/admin/comptabilite/rapprochement';
  }, []);
  const handleRibbonAutoMatch = useCallback(() => { handleApplyRules(); }, [handleApplyRules]);
  const handleRibbonBankRules = useCallback(() => {
    fetchRules();
    toast.success(t('admin.bankRules.refreshed') || 'Regles bancaires actualisees');
  }, [fetchRules, t]);
  const handleRibbonExport = useCallback(() => {
    if (rules.length === 0) { toast.error(t('admin.bankRules.noRulesToExport') || 'Aucune regle a exporter'); return; }
    const bom = '\uFEFF';
    const headers = [t('admin.bankRules.colName') || 'Nom', t('admin.bankRules.colCondition') || 'Condition', t('admin.bankRules.colAccount') || 'Compte', t('admin.bankRules.colPriority') || 'Priorite', t('admin.bankRules.colActive') || 'Active', t('admin.bankRules.colTimesApplied') || 'Applications'];
    const rows = rules.map(r => {
      const conditions = [r.descriptionContains ? `contient:${r.descriptionContains}` : '', r.amountMin ? `min:${r.amountMin}` : '', r.amountMax ? `max:${r.amountMax}` : ''].filter(Boolean).join('; ') || '-';
      return [r.name, conditions, r.account?.name || r.accountId || '-', String(r.priority || 0), r.isActive ? 'Oui' : 'Non', String(r.timesApplied || 0)];
    });
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `regles-bancaires-${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.bankRules.exportSuccess') || `${rules.length} regles exportees`);
  }, [rules, t]);

  useRibbonAction('synchronize', handleRibbonSynchronize);
  useRibbonAction('importStatement', handleRibbonImportStatement);
  useRibbonAction('reconcile', handleRibbonReconcile);
  useRibbonAction('autoMatch', handleRibbonAutoMatch);
  useRibbonAction('bankRules', handleRibbonBankRules);
  useRibbonAction('export', handleRibbonExport);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" role="status" aria-label="Loading">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('admin.bankRules.title') || 'Bank Rules'}
        subtitle={t('admin.bankRules.subtitle') || 'Auto-categorize bank transactions with rules'}
        theme={theme}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={Play}
              onClick={handleApplyRules}
              loading={applying}
              disabled={stats.active === 0}
            >
              {t('admin.bankRules.applyRules') || 'Apply Rules'}
            </Button>
            <Button variant="primary" icon={Plus} onClick={openCreateModal}>
              {t('admin.bankRules.addRule') || 'Add Rule'}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label={t('admin.bankRules.totalRules') || 'Total Rules'}
          value={stats.total}
          icon={ListChecks}
          theme={theme}
        />
        <StatCard
          label={t('admin.bankRules.activeRules') || 'Active Rules'}
          value={stats.active}
          icon={CheckCircle2}
          theme={theme}
        />
        <StatCard
          label={t('admin.bankRules.transactionsMatched') || 'Transactions Matched'}
          value={stats.totalApplied}
          icon={Zap}
          theme={theme}
        />
      </div>

      {/* Filter */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('admin.bankRules.searchPlaceholder') || 'Search rules...'}
      />

      {/* Rules table */}
      <SectionCard theme={theme} noPadding>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Zap className="w-12 h-12 mb-3" />
            <p className="text-sm font-medium">{t('admin.bankRules.noRules') || 'No bank rules yet'}</p>
            <p className="text-xs mt-1">{t('admin.bankRules.noRulesHint') || 'Create a rule to start auto-categorizing transactions'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-4 py-3 font-medium text-slate-500 w-16">{t('admin.bankRules.priority') || 'Priority'}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t('admin.bankRules.ruleName') || 'Name'}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t('admin.bankRules.conditions') || 'Conditions'}</th>
                  <th className="px-4 py-3 font-medium text-slate-500">{t('admin.bankRules.actionCol') || 'Actions'}</th>
                  <th className="px-4 py-3 font-medium text-slate-500 text-center w-24">{t('admin.bankRules.applied') || 'Applied'}</th>
                  <th className="px-4 py-3 font-medium text-slate-500 text-center w-20">{t('admin.bankRules.status') || 'Status'}</th>
                  <th className="px-4 py-3 font-medium text-slate-500 text-right w-32"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((rule) => (
                  <tr key={rule.id} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${!rule.isActive ? 'opacity-50' : ''}`}>
                    {/* Priority */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">
                          {rule.priority}
                        </span>
                        <div className="flex flex-col">
                          <button
                            onClick={() => changePriority(rule, 'up')}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                            title={t('admin.bankRules.increasePriority')}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => changePriority(rule, 'down')}
                            className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
                            title={t('admin.bankRules.decreasePriority')}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{rule.name}</span>
                    </td>

                    {/* Conditions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {conditionBadges(rule).map((b, i) => (
                          <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.color}`}>
                            {b.label}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {rule.account && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                            {rule.account.code} - {rule.account.name}
                          </span>
                        )}
                        {rule.categoryTag && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                            {rule.categoryTag}
                          </span>
                        )}
                        {rule.taxCode && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            {rule.taxCode}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Times applied */}
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono text-xs text-slate-600">{rule.timesApplied}</span>
                    </td>

                    {/* Status toggle */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(rule)}
                        className={`p-1 rounded-lg transition-colors ${
                          rule.isActive
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={rule.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {rule.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    </td>

                    {/* Edit / Delete */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1.5 rounded-lg hover:bg-sky-50 text-slate-400 hover:text-sky-600 transition-colors"
                          title={t('admin.bankRules.edit') || 'Edit'}
                          aria-label="Modifier la regle"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteRule(rule)}
                          disabled={deletingId === rule.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-50"
                          title={t('admin.bankRules.delete') || 'Delete'}
                          aria-label="Supprimer la regle"
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

      {/* ------------------------------------------------------------------- */}
      {/* Add/Edit Modal                                                       */}
      {/* ------------------------------------------------------------------- */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingRule ? (t('admin.bankRules.editRule') || 'Edit Rule') : (t('admin.bankRules.addRule') || 'Add Rule')}
        subtitle={t('admin.bankRules.modalSubtitle') || 'Define conditions and actions for auto-categorization'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editingRule ? (t('common.save') || 'Save') : (t('common.create') || 'Create')}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('admin.bankRules.ruleName') || 'Name'} required error={formErrors.name}>
              <Input
                value={form.name}
                onChange={e => updateForm('name', e.target.value)}
                placeholder={t('admin.bankRules.ruleNamePlaceholder') || 'e.g. Desjardins bank fees'}
                error={!!formErrors.name}
              />
            </FormField>
            <FormField label={t('admin.bankRules.priority') || 'Priority'} hint={t('admin.bankRules.priorityHint') || 'Higher = evaluated first'}>
              <Input
                type="number"
                value={form.priority}
                onChange={e => updateForm('priority', parseInt(e.target.value) || 0)}
                min={0}
              />
            </FormField>
          </div>

          {/* Conditions */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-500" />
              {t('admin.bankRules.conditionsSection') || 'Conditions'} <span className="text-xs font-normal text-slate-400">({t('admin.bankRules.andLogic') || 'AND logic'})</span>
            </h3>
            {formErrors.conditions && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {formErrors.conditions}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('admin.bankRules.descContains') || 'Description contains'}>
                <Input
                  value={form.descriptionContains}
                  onChange={e => updateForm('descriptionContains', e.target.value)}
                  placeholder={t('admin.bankRules.descContainsPlaceholder') || 'e.g. FRAIS MENSUELS'}
                />
              </FormField>
              <FormField label={t('admin.bankRules.descStartsWith') || 'Description starts with'}>
                <Input
                  value={form.descriptionStartsWith}
                  onChange={e => updateForm('descriptionStartsWith', e.target.value)}
                  placeholder={t('admin.bankRules.descStartsWithPlaceholder') || 'e.g. VIREMENT'}
                />
              </FormField>
              <FormField label={t('admin.bankRules.descExact') || 'Description exact match'}>
                <Input
                  value={form.descriptionExact}
                  onChange={e => updateForm('descriptionExact', e.target.value)}
                  placeholder={t('admin.bankRules.descExactPlaceholder') || 'e.g. FRAIS MENSUELS DESJARDINS'}
                />
              </FormField>
              <FormField label={t('admin.bankRules.transactionType') || 'Transaction type'}>
                <select
                  value={form.transactionType}
                  onChange={e => updateForm('transactionType', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="">{t('admin.bankRules.anyType') || '-- Any type --'}</option>
                  <option value="DEBIT">{t('admin.bankRules.debit') || 'Debit'}</option>
                  <option value="CREDIT">{t('admin.bankRules.credit') || 'Credit'}</option>
                </select>
              </FormField>
              <FormField label={t('admin.bankRules.amountMin') || 'Amount minimum'}>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amountMin}
                  onChange={e => updateForm('amountMin', e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label={t('admin.bankRules.amountMax') || 'Amount maximum'}>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amountMax}
                  onChange={e => updateForm('amountMax', e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label={t('admin.bankRules.amountExact') || 'Amount exact'}>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amountExact}
                  onChange={e => updateForm('amountExact', e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              {t('admin.bankRules.actionsSection') || 'Actions'}
            </h3>
            {formErrors.actions && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                {formErrors.actions}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('admin.bankRules.account') || 'Account'}>
                <select
                  value={form.accountId}
                  onChange={e => updateForm('accountId', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="">{t('admin.bankRules.selectAccount') || '-- Select account --'}</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label={t('admin.bankRules.categoryTag') || 'Category tag'}>
                <Input
                  value={form.categoryTag}
                  onChange={e => updateForm('categoryTag', e.target.value)}
                  placeholder={t('admin.bankRules.categoryTagPlaceholder') || 'e.g. bank-fees'}
                />
              </FormField>
              <FormField label={t('admin.bankRules.taxCode') || 'Tax code'}>
                <select
                  value={form.taxCode}
                  onChange={e => updateForm('taxCode', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  {TAX_CODES.map(tc => (
                    <option key={tc.value} value={tc.value}>{tc.label}</option>
                  ))}
                </select>
              </FormField>
              <FormField label={t('admin.bankRules.descriptionOverride') || 'Description override'}>
                <Input
                  value={form.description}
                  onChange={e => updateForm('description', e.target.value)}
                  placeholder={t('admin.bankRules.descriptionOverridePlaceholder') || 'Override transaction description'}
                />
              </FormField>
            </div>
          </div>
        </div>
      </Modal>

      {/* ─── DELETE RULE CONFIRM DIALOG ─────────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmDeleteRule}
        title={t('admin.bankRules.deleteTitle') || 'Delete Bank Rule'}
        message={t('admin.bankRules.confirmDelete') || `Are you sure you want to delete the rule "${confirmDeleteRule?.name}"?`}
        variant="danger"
        confirmLabel={t('common.delete') || 'Delete'}
        onConfirm={() => confirmDeleteRule && handleDelete(confirmDeleteRule)}
        onCancel={() => setConfirmDeleteRule(null)}
      />
    </div>
  );
}
