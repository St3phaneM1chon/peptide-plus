'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Receipt,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  DollarSign,
  Car,
  Eye,
  Filter,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatusBadge,
  StatCard,
  FilterBar,
  SelectFilter,
  DataTable,
  type Column,
  SectionCard,
  FormField,
  Input,
  Textarea,
  type BadgeVariant,
} from '@/components/admin';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { GST_RATE, QST_RATE } from '@/lib/tax-constants';
import { useRibbonAction } from '@/hooks/useRibbonAction';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpenseData {
  id: string;
  expenseNumber: string;
  date: string;
  description: string;
  subtotal: number;
  taxGst: number;
  taxQst: number;
  taxOther: number;
  total: number;
  category: string;
  accountId: string | null;
  account: { id: string; code: string; name: string } | null;
  deductiblePercent: number;
  vendorName: string | null;
  vendorTaxNumber: string | null;
  receiptUrl: string | null;
  status: ExpenseStatusType;
  submittedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  mileageKm: number | null;
  mileageRate: number | null;
  paymentMethod: string | null;
  reimbursed: boolean;
  reimbursedAt: string | null;
  journalEntryId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

type ExpenseStatusType = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';

interface ExpenseStats {
  totalCount: number;
  totalAmount: number;
  byStatus: Record<string, { count: number; total: number }>;
  topCategories: { category: string; count: number; total: number }[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'meals', 'entertainment', 'travel', 'office', 'professional',
  'advertising', 'insurance', 'rent', 'utilities', 'telephone',
  'vehicle', 'shipping', 'software', 'repairs', 'bank_fees',
  'training', 'fines', 'personal',
] as const;

const CATEGORY_DEDUCTIBILITY: Record<string, number> = {
  meals: 50, entertainment: 50, travel: 100, office: 100, professional: 100,
  advertising: 100, insurance: 100, rent: 100, utilities: 100, telephone: 100,
  vehicle: 100, shipping: 100, software: 100, repairs: 100, bank_fees: 100,
  training: 100, fines: 0, personal: 0,
};

const PAYMENT_METHODS = ['cash', 'credit_card', 'debit', 'company_card', 'reimbursement'] as const;

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function DepensesPage() {
  const { t, locale, formatCurrency } = useI18n();
  const theme = sectionThemes.entry;

  // State
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseData | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseData | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formSubtotal, setFormSubtotal] = useState('');
  const [formTaxGst, setFormTaxGst] = useState('');
  const [formTaxQst, setFormTaxQst] = useState('');
  const [formTaxOther, setFormTaxOther] = useState('');
  const [formTotal, setFormTotal] = useState('');
  const [formVendorName, setFormVendorName] = useState('');
  const [formVendorTaxNumber, setFormVendorTaxNumber] = useState('');
  const [formPaymentMethod, setFormPaymentMethod] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formMileageKm, setFormMileageKm] = useState('');
  const [formMileageRate, setFormMileageRate] = useState('');
  const [showMileage, setShowMileage] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteExpenseId, setConfirmDeleteExpenseId] = useState<string | null>(null);

  const formatCAD = formatCurrency;

  // ---------------------------------------------------------------------------
  // Category label helper
  // ---------------------------------------------------------------------------

  const getCategoryLabel = useCallback((cat: string): string => {
    const catKeyMap: Record<string, string> = {
      meals: 'catMeals', entertainment: 'catEntertainment', travel: 'catTravel',
      office: 'catOffice', professional: 'catProfessional', advertising: 'catAdvertising',
      insurance: 'catInsurance', rent: 'catRent', utilities: 'catUtilities',
      telephone: 'catTelephone', vehicle: 'catVehicle', shipping: 'catShipping',
      software: 'catSoftware', repairs: 'catRepairs', bank_fees: 'catBankFees',
      training: 'catTraining', fines: 'catFines', personal: 'catPersonal',
    };
    const key = catKeyMap[cat];
    return key ? t(`admin.expenses.${key}`) : cat;
  }, [t]);

  // ---------------------------------------------------------------------------
  // Status config
  // ---------------------------------------------------------------------------

  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT: { label: t('admin.expenses.statusDraft'), variant: 'neutral' },
    SUBMITTED: { label: t('admin.expenses.statusSubmitted'), variant: 'warning' },
    APPROVED: { label: t('admin.expenses.statusApproved'), variant: 'info' },
    REJECTED: { label: t('admin.expenses.statusRejected'), variant: 'error' },
    REIMBURSED: { label: t('admin.expenses.statusReimbursed'), variant: 'success' },
  };

  const paymentMethodLabels: Record<string, string> = {
    cash: t('admin.expenses.paymentCash'),
    credit_card: t('admin.expenses.paymentCreditCard'),
    debit: t('admin.expenses.paymentDebit'),
    company_card: t('admin.expenses.paymentCompanyCard'),
    reimbursement: t('admin.expenses.paymentReimbursement'),
  };

  // ---------------------------------------------------------------------------
  // Fetch expenses
  // ---------------------------------------------------------------------------

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (searchTerm) params.set('search', searchTerm);

      const response = await fetch(`/api/accounting/expenses?${params.toString()}`);
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data = await response.json();

      setExpenses(data.expenses ?? []);
      setStats(data.stats ?? null);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      toast.error(t('common.errorOccurred'));
      setError(err instanceof Error ? err.message : t('admin.expenses.fetchError'));
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, dateFrom, dateTo, searchTerm, t]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // ---------------------------------------------------------------------------
  // Auto-calculate taxes/total when subtotal changes
  // ---------------------------------------------------------------------------

  const handleSubtotalChange = (value: string) => {
    setFormSubtotal(value);
    const sub = parseFloat(value) || 0;
    const gst = Math.round(sub * GST_RATE * 100) / 100;
    const qst = Math.round(sub * QST_RATE * 100) / 100;
    const other = parseFloat(formTaxOther) || 0;
    setFormTaxGst(gst.toFixed(2));
    setFormTaxQst(qst.toFixed(2));
    setFormTotal((sub + gst + qst + other).toFixed(2));
  };

  const recalcTotal = (sub: string, gst: string, qst: string, other: string) => {
    const total = (parseFloat(sub) || 0) + (parseFloat(gst) || 0) + (parseFloat(qst) || 0) + (parseFloat(other) || 0);
    setFormTotal(total.toFixed(2));
  };

  // ---------------------------------------------------------------------------
  // Open form modal (create or edit)
  // ---------------------------------------------------------------------------

  const openCreateForm = () => {
    setEditingExpense(null);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormDescription('');
    setFormCategory('');
    setFormSubtotal('');
    setFormTaxGst('');
    setFormTaxQst('');
    setFormTaxOther('');
    setFormTotal('');
    setFormVendorName('');
    setFormVendorTaxNumber('');
    setFormPaymentMethod('');
    setFormNotes('');
    setFormMileageKm('');
    setFormMileageRate('');
    setShowMileage(false);
    setShowFormModal(true);
  };

  const openEditForm = (expense: ExpenseData) => {
    setEditingExpense(expense);
    setFormDate(expense.date ? new Date(expense.date).toISOString().split('T')[0] : '');
    setFormDescription(expense.description);
    setFormCategory(expense.category);
    setFormSubtotal(expense.subtotal.toFixed(2));
    setFormTaxGst(expense.taxGst.toFixed(2));
    setFormTaxQst(expense.taxQst.toFixed(2));
    setFormTaxOther(expense.taxOther.toFixed(2));
    setFormTotal(expense.total.toFixed(2));
    setFormVendorName(expense.vendorName || '');
    setFormVendorTaxNumber(expense.vendorTaxNumber || '');
    setFormPaymentMethod(expense.paymentMethod || '');
    setFormNotes(expense.notes || '');
    setFormMileageKm(expense.mileageKm?.toString() || '');
    setFormMileageRate(expense.mileageRate?.toString() || '');
    setShowMileage(!!expense.mileageKm);
    setShowFormModal(true);
  };

  // ---------------------------------------------------------------------------
  // Save expense (create or update)
  // ---------------------------------------------------------------------------

  const handleSaveExpense = async () => {
    setFormSaving(true);
    try {
      const payload = {
        date: formDate,
        description: formDescription,
        category: formCategory,
        subtotal: parseFloat(formSubtotal) || 0,
        taxGst: parseFloat(formTaxGst) || 0,
        taxQst: parseFloat(formTaxQst) || 0,
        taxOther: parseFloat(formTaxOther) || 0,
        total: parseFloat(formTotal) || 0,
        vendorName: formVendorName || null,
        vendorTaxNumber: formVendorTaxNumber || null,
        paymentMethod: formPaymentMethod || null,
        notes: formNotes || null,
        mileageKm: formMileageKm ? parseFloat(formMileageKm) : null,
        mileageRate: formMileageRate ? parseFloat(formMileageRate) : null,
      };

      let response: Response;
      if (editingExpense) {
        response = await fetch('/api/accounting/expenses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingExpense.id, ...payload }),
        });
      } else {
        response = await fetch('/api/accounting/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }

      setShowFormModal(false);
      await fetchExpenses();
    } catch (err) {
      console.error('Error saving expense:', err);
      toast.error(t('common.errorOccurred'));
      setError(err instanceof Error ? err.message : 'Error saving');
    } finally {
      setFormSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Status transitions
  // ---------------------------------------------------------------------------

  const handleStatusChange = async (expenseId: string, newStatus: ExpenseStatusType, reason?: string) => {
    try {
      const body: Record<string, unknown> = { id: expenseId, status: newStatus };
      if (reason) body.rejectionReason = reason;

      const response = await fetch('/api/accounting/expenses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${response.status}`);
      }

      setShowDetailModal(false);
      setShowRejectModal(false);
      await fetchExpenses();
    } catch (err) {
      console.error('Error changing status:', err);
      toast.error(t('common.errorOccurred'));
      setError(err instanceof Error ? err.message : t('admin.expenses.transitionError'));
    }
  };

  // ---------------------------------------------------------------------------
  // Delete expense
  // ---------------------------------------------------------------------------

  const handleDelete = async (expenseId: string) => {
    setConfirmDeleteExpenseId(null);
    setDeletingId(expenseId);
    try {
      const response = await fetch(`/api/accounting/expenses?id=${expenseId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      await fetchExpenses();
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    } finally {
      setDeletingId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  // -- Ribbon actions --
  const handleNewExpense = useCallback(() => { openCreateForm(); }, []);
  const handleDeleteAction = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleCategorize = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleApprove = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handleExport = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);
  const handlePrint = useCallback(() => { window.print(); }, []);

  useRibbonAction('newExpense', handleNewExpense);
  useRibbonAction('delete', handleDeleteAction);
  useRibbonAction('categorize', handleCategorize);
  useRibbonAction('approve', handleApprove);
  useRibbonAction('export', handleExport);
  useRibbonAction('print', handlePrint);

  if (loading && expenses.length === 0) {
    return (
      <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Derived stats
  // ---------------------------------------------------------------------------

  const pendingApprovalCount = (stats?.byStatus?.SUBMITTED?.count ?? 0);
  const pendingApprovalTotal = stats?.byStatus?.SUBMITTED?.total ?? 0;
  const reimbursementPendingCount = (stats?.byStatus?.APPROVED?.count ?? 0);
  const reimbursementPendingTotal = stats?.byStatus?.APPROVED?.total ?? 0;
  const topCategory = stats?.topCategories?.[0];

  // ---------------------------------------------------------------------------
  // Table columns
  // ---------------------------------------------------------------------------

  const columns: Column<ExpenseData>[] = [
    {
      key: 'date',
      header: t('admin.expenses.colDate'),
      render: (exp) => (
        <span className="text-sm text-slate-600">
          {new Date(exp.date).toLocaleDateString(locale)}
        </span>
      ),
    },
    {
      key: 'expenseNumber',
      header: t('admin.expenses.colNumber'),
      render: (exp) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedExpense(exp); setShowDetailModal(true); }}
          className="font-mono text-sm text-blue-600 hover:underline"
        >
          {exp.expenseNumber}
        </button>
      ),
    },
    {
      key: 'description',
      header: t('admin.expenses.colDescription'),
      render: (exp) => (
        <span className="text-sm text-slate-800 line-clamp-1 max-w-[200px]">
          {exp.description}
        </span>
      ),
    },
    {
      key: 'category',
      header: t('admin.expenses.colCategory'),
      render: (exp) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          {getCategoryLabel(exp.category)}
        </span>
      ),
    },
    {
      key: 'vendorName',
      header: t('admin.expenses.colVendor'),
      render: (exp) => (
        <span className="text-sm text-slate-600">{exp.vendorName || '-'}</span>
      ),
    },
    {
      key: 'total',
      header: t('admin.expenses.colAmount'),
      render: (exp) => (
        <span className="text-sm font-medium text-slate-900 tabular-nums">
          {formatCAD(exp.total)}
        </span>
      ),
    },
    {
      key: 'deductiblePercent',
      header: t('admin.expenses.colDeductible'),
      render: (exp) => {
        const color =
          exp.deductiblePercent === 100 ? 'text-emerald-600' :
          exp.deductiblePercent === 50 ? 'text-amber-600' :
          'text-red-500';
        return <span className={`text-sm font-medium ${color}`}>{exp.deductiblePercent}%</span>;
      },
    },
    {
      key: 'status',
      header: t('admin.expenses.colStatus'),
      render: (exp) => {
        const config = statusConfig[exp.status];
        return config ? <StatusBadge variant={config.variant}>{config.label}</StatusBadge> : <span>{exp.status}</span>;
      },
    },
    {
      key: 'actions',
      header: t('admin.expenses.colActions'),
      render: (exp) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedExpense(exp); setShowDetailModal(true); }}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
            title={t('common.view')}
          >
            <Eye className="w-4 h-4" />
          </button>
          {exp.status === 'DRAFT' && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); openEditForm(exp); }}
                className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                title={t('common.edit')}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteExpenseId(exp.id); }}
                disabled={deletingId === exp.id}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                title={t('common.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Filter options
  // ---------------------------------------------------------------------------

  const statusFilterOptions = [
    { value: 'DRAFT', label: t('admin.expenses.filterDraft') },
    { value: 'SUBMITTED', label: t('admin.expenses.filterSubmitted') },
    { value: 'APPROVED', label: t('admin.expenses.filterApproved') },
    { value: 'REJECTED', label: t('admin.expenses.filterRejected') },
    { value: 'REIMBURSED', label: t('admin.expenses.filterReimbursed') },
  ];

  const categoryFilterOptions = CATEGORIES.map(cat => ({
    value: cat,
    label: getCategoryLabel(cat),
  }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      <PageHeader
        title={t('admin.expenses.title')}
        subtitle={t('admin.expenses.subtitle')}
        theme={theme}
        actions={
          <Button onClick={openCreateForm} className={`${theme.btnPrimary} text-white`}>
            <Plus className="w-4 h-4 mr-1.5" />
            {t('admin.expenses.newExpense')}
          </Button>
        }
      />

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label={t('admin.expenses.statTotalMonth')}
          value={formatCAD(stats?.totalAmount ?? 0)}
          icon={DollarSign}
          theme={theme}
        />
        <StatCard
          label={t('admin.expenses.statPendingApproval')}
          value={`${pendingApprovalCount} (${formatCAD(pendingApprovalTotal)})`}
          icon={Clock}
          theme={theme}
        />
        <StatCard
          label={t('admin.expenses.statReimbursementPending')}
          value={`${reimbursementPendingCount} (${formatCAD(reimbursementPendingTotal)})`}
          icon={Receipt}
          theme={theme}
        />
        <StatCard
          label={t('admin.expenses.statTopCategory')}
          value={topCategory ? getCategoryLabel(topCategory.category) : '-'}
          icon={Filter}
          theme={theme}
        />
      </div>

      {/* Filter Bar */}
      <SectionCard className="mb-6">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t('admin.expenses.searchPlaceholder')}
        >
          <SelectFilter
            label={t('admin.expenses.colStatus')}
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusFilterOptions}
          />
          <SelectFilter
            label={t('admin.expenses.colCategory')}
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categoryFilterOptions}
          />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-slate-400 text-sm">-</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </FilterBar>
      </SectionCard>

      {/* Data Table */}
      <SectionCard>
        <DataTable<ExpenseData>
          columns={columns}
          data={expenses}
          keyExtractor={(exp) => exp.id}
          emptyTitle={t('admin.expenses.noExpenses')}
          emptyDescription={t('admin.expenses.noExpensesDesc')}
          onRowClick={(exp) => { setSelectedExpense(exp); setShowDetailModal(true); }}
        />
      </SectionCard>

      {/* ================================================================== */}
      {/* CREATE / EDIT MODAL                                                */}
      {/* ================================================================== */}

      <Modal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        title={editingExpense ? t('admin.expenses.editExpense') : t('admin.expenses.newExpense')}
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Row 1: Date + Category */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.expenses.date')}>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </FormField>
            <FormField label={t('admin.expenses.category')}>
              <select
                value={formCategory}
                onChange={(e) => {
                  setFormCategory(e.target.value);
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">{t('admin.expenses.category')}...</option>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>
                    {getCategoryLabel(cat)} ({CATEGORY_DEDUCTIBILITY[cat]}%)
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Description */}
          <FormField label={t('admin.expenses.description')}>
            <Input
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder={t('admin.expenses.description')}
            />
          </FormField>

          {/* Row 2: Vendor */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.expenses.vendor')}>
              <Input
                value={formVendorName}
                onChange={(e) => setFormVendorName(e.target.value)}
                placeholder={t('admin.expenses.vendor')}
              />
            </FormField>
            <FormField label={t('admin.expenses.vendorTaxNumber')}>
              <Input
                value={formVendorTaxNumber}
                onChange={(e) => setFormVendorTaxNumber(e.target.value)}
                placeholder="123456789 RT0001"
              />
            </FormField>
          </div>

          {/* Amounts */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.expenses.subtotal')}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formSubtotal}
                  onChange={(e) => handleSubtotalChange(e.target.value)}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label={t('admin.expenses.gst')}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formTaxGst}
                  onChange={(e) => { setFormTaxGst(e.target.value); recalcTotal(formSubtotal, e.target.value, formTaxQst, formTaxOther); }}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label={t('admin.expenses.qst')}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formTaxQst}
                  onChange={(e) => { setFormTaxQst(e.target.value); recalcTotal(formSubtotal, formTaxGst, e.target.value, formTaxOther); }}
                  placeholder="0.00"
                />
              </FormField>
              <FormField label={t('admin.expenses.taxOther')}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formTaxOther}
                  onChange={(e) => { setFormTaxOther(e.target.value); recalcTotal(formSubtotal, formTaxGst, formTaxQst, e.target.value); }}
                  placeholder="0.00"
                />
              </FormField>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">{t('admin.expenses.total')}</span>
              <span className="text-lg font-bold text-slate-900 tabular-nums">{formatCAD(parseFloat(formTotal) || 0)}</span>
            </div>
          </div>

          {/* Payment method */}
          <FormField label={t('admin.expenses.paymentMethod')}>
            <select
              value={formPaymentMethod}
              onChange={(e) => setFormPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">{t('admin.expenses.paymentMethod')}...</option>
              {PAYMENT_METHODS.map(pm => (
                <option key={pm} value={pm}>{paymentMethodLabels[pm] || pm}</option>
              ))}
            </select>
          </FormField>

          {/* Mileage section (collapsible) */}
          <div className="border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setShowMileage(!showMileage)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-slate-400" />
                {t('admin.expenses.mileageSection')}
              </div>
              {showMileage ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showMileage && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label={t('admin.expenses.mileageKm')}>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={formMileageKm}
                      onChange={(e) => setFormMileageKm(e.target.value)}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label={t('admin.expenses.mileageRate')}>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formMileageRate}
                      onChange={(e) => setFormMileageRate(e.target.value)}
                      placeholder="0.72"
                    />
                  </FormField>
                </div>
                <p className="text-xs text-slate-400">{t('admin.expenses.mileageRateHint')}</p>
                {formMileageKm && formMileageRate && (
                  <p className="text-sm font-medium text-slate-700">
                    {t('admin.expenses.mileageTotal')}: {formatCAD((parseFloat(formMileageKm) || 0) * (parseFloat(formMileageRate) || 0))}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <FormField label={t('admin.expenses.notes')}>
            <Textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder={t('admin.expenses.notes')}
              rows={3}
            />
          </FormField>
        </div>

        {/* Form actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={() => setShowFormModal(false)}>
            {t('admin.expenses.cancel')}
          </Button>
          <Button
            onClick={handleSaveExpense}
            disabled={formSaving || !formDescription || !formCategory || !formSubtotal}
            className={`${theme.btnPrimary} text-white`}
          >
            {formSaving ? t('admin.expenses.loading') : t('admin.expenses.save')}
          </Button>
        </div>
      </Modal>

      {/* ================================================================== */}
      {/* DETAIL MODAL                                                       */}
      {/* ================================================================== */}

      <Modal
        isOpen={showDetailModal}
        onClose={() => { setShowDetailModal(false); setSelectedExpense(null); }}
        title={t('admin.expenses.expenseDetail')}
        size="lg"
      >
        {selectedExpense && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-lg font-semibold text-slate-900">{selectedExpense.expenseNumber}</p>
                <p className="text-sm text-slate-500">
                  {new Date(selectedExpense.date).toLocaleDateString(locale)}
                </p>
              </div>
              <StatusBadge variant={statusConfig[selectedExpense.status]?.variant ?? 'neutral'}>
                {statusConfig[selectedExpense.status]?.label ?? selectedExpense.status}
              </StatusBadge>
            </div>

            {/* Description */}
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{t('admin.expenses.description')}</p>
              <p className="text-sm text-slate-800">{selectedExpense.description}</p>
            </div>

            {/* Category + deductibility */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{t('admin.expenses.category')}</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {getCategoryLabel(selectedExpense.category)}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{t('admin.expenses.colDeductible')}</p>
                <span className={`text-sm font-bold ${selectedExpense.deductiblePercent === 100 ? 'text-emerald-600' : selectedExpense.deductiblePercent === 50 ? 'text-amber-600' : 'text-red-500'}`}>
                  {selectedExpense.deductiblePercent}%
                </span>
              </div>
            </div>

            {/* Vendor */}
            {(selectedExpense.vendorName || selectedExpense.vendorTaxNumber) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{t('admin.expenses.vendor')}</p>
                  <p className="text-sm text-slate-800">{selectedExpense.vendorName || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1">{t('admin.expenses.vendorTaxNumber')}</p>
                  <p className="text-sm text-slate-800">{selectedExpense.vendorTaxNumber || '-'}</p>
                </div>
              </div>
            )}

            {/* Amounts */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">{t('admin.expenses.subtotal')}</span><span className="tabular-nums">{formatCAD(selectedExpense.subtotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t('admin.expenses.gst')}</span><span className="tabular-nums">{formatCAD(selectedExpense.taxGst)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t('admin.expenses.qst')}</span><span className="tabular-nums">{formatCAD(selectedExpense.taxQst)}</span></div>
                {selectedExpense.taxOther > 0 && (
                  <div className="flex justify-between"><span className="text-slate-500">{t('admin.expenses.taxOther')}</span><span className="tabular-nums">{formatCAD(selectedExpense.taxOther)}</span></div>
                )}
                <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold">
                  <span>{t('admin.expenses.total')}</span>
                  <span className="tabular-nums">{formatCAD(selectedExpense.total)}</span>
                </div>
              </div>
            </div>

            {/* Payment method */}
            {selectedExpense.paymentMethod && (
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{t('admin.expenses.paymentMethod')}</p>
                <p className="text-sm text-slate-800">{paymentMethodLabels[selectedExpense.paymentMethod] || selectedExpense.paymentMethod}</p>
              </div>
            )}

            {/* Mileage */}
            {selectedExpense.mileageKm && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-700 mb-1 flex items-center gap-1.5">
                  <Car className="w-4 h-4" /> {t('admin.expenses.mileageSection')}
                </p>
                <div className="text-sm text-blue-600 space-y-1">
                  <p>{t('admin.expenses.mileageKm')}: {selectedExpense.mileageKm} km</p>
                  <p>{t('admin.expenses.mileageRate')}: ${selectedExpense.mileageRate}/km</p>
                  <p className="font-medium">{t('admin.expenses.mileageTotal')}: {formatCAD((selectedExpense.mileageKm || 0) * (selectedExpense.mileageRate || 0))}</p>
                </div>
              </div>
            )}

            {/* Receipt */}
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">{t('admin.expenses.receiptUpload')}</p>
              {selectedExpense.receiptUrl ? (
                <a href={selectedExpense.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1.5">
                  <Eye className="w-4 h-4" /> {t('admin.expenses.receiptPreview')}
                </a>
              ) : (
                <p className="text-sm text-slate-400 italic">{t('admin.expenses.noReceipt')}</p>
              )}
            </div>

            {/* Approval info */}
            {selectedExpense.approvedBy && (
              <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                <p className="text-sm text-emerald-700">
                  {t('admin.expenses.approvedBy')}: {selectedExpense.approvedBy}
                </p>
                {selectedExpense.approvedAt && (
                  <p className="text-sm text-emerald-600">
                    {t('admin.expenses.approvedAt')}: {new Date(selectedExpense.approvedAt).toLocaleString(locale)}
                  </p>
                )}
              </div>
            )}

            {/* Rejection info */}
            {selectedExpense.status === 'REJECTED' && selectedExpense.rejectionReason && (
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-700 mb-1">{t('admin.expenses.rejectionReason')}</p>
                <p className="text-sm text-red-600">{selectedExpense.rejectionReason}</p>
              </div>
            )}

            {/* Notes */}
            {selectedExpense.notes && (
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{t('admin.expenses.notes')}</p>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">{selectedExpense.notes}</p>
              </div>
            )}

            {/* Action buttons based on status */}
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-200">
              {selectedExpense.status === 'DRAFT' && (
                <>
                  <Button variant="secondary" onClick={() => { openEditForm(selectedExpense); setShowDetailModal(false); }}>
                    <Pencil className="w-4 h-4 mr-1.5" /> {t('admin.expenses.editExpense')}
                  </Button>
                  <Button onClick={() => handleStatusChange(selectedExpense.id, 'SUBMITTED')} className="bg-amber-500 hover:bg-amber-600 text-white">
                    {t('admin.expenses.submit')}
                  </Button>
                </>
              )}
              {selectedExpense.status === 'SUBMITTED' && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => { setRejectionReason(''); setShowRejectModal(true); }}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> {t('admin.expenses.reject')}
                  </Button>
                  <Button onClick={() => handleStatusChange(selectedExpense.id, 'APPROVED')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <CheckCircle className="w-4 h-4 mr-1.5" /> {t('admin.expenses.approve')}
                  </Button>
                </>
              )}
              {selectedExpense.status === 'APPROVED' && (
                <Button onClick={() => handleStatusChange(selectedExpense.id, 'REIMBURSED')} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <DollarSign className="w-4 h-4 mr-1.5" /> {t('admin.expenses.markReimbursed')}
                </Button>
              )}
              {selectedExpense.status === 'REJECTED' && (
                <Button onClick={() => handleStatusChange(selectedExpense.id, 'DRAFT')} className="bg-slate-600 hover:bg-slate-700 text-white">
                  {t('admin.expenses.resubmit')}
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ================================================================== */}
      {/* REJECTION REASON MODAL                                             */}
      {/* ================================================================== */}

      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title={t('admin.expenses.reject')}
      >
        <div className="space-y-4">
          <FormField label={t('admin.expenses.rejectionReason')}>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t('admin.expenses.rejectionReasonPlaceholder')}
              rows={3}
            />
          </FormField>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
              {t('admin.expenses.cancel')}
            </Button>
            <Button
              onClick={() => selectedExpense && handleStatusChange(selectedExpense.id, 'REJECTED', rejectionReason)}
              disabled={!rejectionReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <XCircle className="w-4 h-4 mr-1.5" /> {t('admin.expenses.reject')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── DELETE EXPENSE CONFIRM DIALOG ──────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmDeleteExpenseId}
        title={t('admin.expenses.deleteTitle') || 'Delete Expense'}
        message={t('admin.expenses.confirmDelete') || 'Are you sure you want to delete this expense? This action cannot be undone.'}
        variant="danger"
        confirmLabel={t('common.delete') || 'Delete'}
        onConfirm={() => confirmDeleteExpenseId && handleDelete(confirmDeleteExpenseId)}
        onCancel={() => setConfirmDeleteExpenseId(null)}
      />
    </div>
  );
}
