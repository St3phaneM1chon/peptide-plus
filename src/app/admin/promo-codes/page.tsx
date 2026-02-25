// TODO: F-053 - formatCurrency is constant; remove from useMemo dependency array or memoize at higher level
// TODO: F-067 - Replace native confirm() for delete with custom Modal component
// TODO: F-070 - updatePromoCodeSchema is alias of createPromoCodeSchema; make fields optional with .partial()
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Shuffle, Tag, CheckCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

// ── Types ─────────────────────────────────────────────────────

interface PromoCode {
  id: string;
  code: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  usageCount: number;
  startsAt?: string;
  endsAt?: string;
  firstOrderOnly: boolean;
  isActive: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function promoStatusBadgeVariant(
  promo: PromoCode
): 'success' | 'warning' | 'error' | 'neutral' {
  const isExpired = promo.endsAt && new Date(promo.endsAt) < new Date();
  const usageFull = promo.usageLimit && promo.usageCount >= promo.usageLimit;
  if (isExpired) return 'error';
  if (usageFull) return 'warning';
  if (promo.isActive) return 'success';
  return 'neutral';
}

function promoStatusLabel(promo: PromoCode, t: (key: string) => string): string {
  const isExpired = promo.endsAt && new Date(promo.endsAt) < new Date();
  const usageFull = promo.usageLimit && promo.usageCount >= promo.usageLimit;
  if (isExpired) return t('admin.promoCodes.expired') || 'Expired';
  if (usageFull) return t('admin.promoCodes.usageFull') || 'Full';
  if (promo.isActive) return t('admin.promoCodes.active');
  return t('admin.promoCodes.inactive') || 'Inactive';
}

// ── Main Component ────────────────────────────────────────────

export default function PromoCodesPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // UX FIX: ConfirmDialog for delete action
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    id: string;
    code: string;
  }>({ isOpen: false, id: '', code: '' });

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    value: 10,
    minOrderAmount: '',
    maxDiscount: '',
    usageLimit: '',
    usageLimitPerUser: '1',
    startsAt: '',
    endsAt: '',
    firstOrderOnly: false,
  });

  // ─── Data fetching ──────────────────────────────────────────

  // FIX: FLAW-055 - Wrap fetchPromoCodes in useCallback for stable reference
  const fetchPromoCodes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/promo-codes');
      const data = await res.json();
      setPromoCodes(data.promoCodes || []);
    } catch (err) {
      console.error('Error fetching promo codes:', err);
      setPromoCodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromoCodes();
  }, [fetchPromoCodes]);

  // ─── CRUD ─────────────────────────────────────────────────

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomBytes = crypto.getRandomValues(new Uint8Array(8));
    const code = Array.from(randomBytes).map(b => chars.charAt(b % chars.length)).join('');
    setFormData({ ...formData, code });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // UX FIX: Validate form fields with inline error messages
    const errors: Record<string, string> = {};
    if (!formData.code.trim()) {
      errors.code = t('admin.promoCodes.codeRequired') || 'Promo code is required';
    }
    if (formData.value <= 0) {
      errors.value = t('admin.promoCodes.valueRequired') || 'Discount value must be greater than 0';
    }
    if (formData.type === 'PERCENTAGE' && formData.value > 100) {
      errors.value = t('admin.promoCodes.percentageMax') || 'Percentage discount cannot exceed 100%';
    }
    if (formData.endsAt && formData.startsAt && new Date(formData.endsAt) <= new Date(formData.startsAt)) {
      errors.endsAt = t('admin.promoCodes.endDateAfterStart') || 'End date must be after start date';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);

    try {
      const url = editingCode
        ? `/api/admin/promo-codes/${editingCode.id}`
        : '/api/admin/promo-codes';
      const method = editingCode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
          maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
          usageLimitPerUser: formData.usageLimitPerUser ? parseInt(formData.usageLimitPerUser) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.saveFailed'));
        return;
      }

      toast.success(editingCode
        ? (t('admin.promoCodes.updated') || 'Promo code updated')
        : (t('admin.promoCodes.created') || 'Promo code created'));
      await fetchPromoCodes();
      resetForm();
    } catch (err) {
      console.error('Error saving promo code:', err);
      toast.error(t('common.networkError'));
    } finally {
      setSaving(false);
    }
  };

  // FLAW-052 FIX: Optimistic update for toggleActive
  const toggleActive = async (id: string, isActive: boolean) => {
    // Optimistic: update immediately
    setPromoCodes(prev => prev.map((p) => (p.id === id ? { ...p, isActive: !isActive } : p)));
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        // Revert on failure
        setPromoCodes(prev => prev.map((p) => (p.id === id ? { ...p, isActive } : p)));
      }
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error(t('common.networkError'));
      // Revert on failure
      setPromoCodes(prev => prev.map((p) => (p.id === id ? { ...p, isActive } : p)));
    }
  };

  // UX FIX: Actual delete execution (called after confirmation)
  const executeDeletePromoCode = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.deleteFailed'));
        return;
      }
      setPromoCodes(prev => prev.filter((p) => p.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
      toast.success(t('admin.promoCodes.deleted') || 'Promo code deleted');
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error(t('common.networkError'));
    } finally {
      setDeletingId(null);
    }
  };

  // UX FIX: Replaced native confirm() with ConfirmDialog
  const deletePromoCode = (id: string) => {
    const promo = promoCodes.find(p => p.id === id);
    setConfirmDelete({
      isOpen: true,
      id,
      code: promo?.code || '',
    });
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      type: 'PERCENTAGE',
      value: 10,
      minOrderAmount: '',
      maxDiscount: '',
      usageLimit: '',
      usageLimitPerUser: '1',
      startsAt: '',
      endsAt: '',
      firstOrderOnly: false,
    });
    setEditingCode(null);
    setShowForm(false);
  };

  const startEdit = (promo: PromoCode) => {
    setFormData({
      code: promo.code,
      description: promo.description || '',
      type: promo.type,
      value: promo.value,
      minOrderAmount: promo.minOrderAmount?.toString() || '',
      maxDiscount: promo.maxDiscount?.toString() || '',
      usageLimit: promo.usageLimit?.toString() || '',
      usageLimitPerUser: promo.usageLimitPerUser?.toString() || '',
      startsAt: promo.startsAt ? promo.startsAt.slice(0, 16) : '',
      endsAt: promo.endsAt ? promo.endsAt.slice(0, 16) : '',
      firstOrderOnly: promo.firstOrderOnly,
    });
    setEditingCode(promo);
    setShowForm(true);
  };

  const handleSelectPromo = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // ─── Filtering ──────────────────────────────────────────────

  const filteredPromoCodes = useMemo(() => {
    return promoCodes.filter(promo => {
      // Status filter
      if (statusFilter === 'active' && !promo.isActive) return false;
      if (statusFilter === 'inactive' && promo.isActive) return false;
      if (statusFilter === 'expired') {
        const isExpired = promo.endsAt && new Date(promo.endsAt) < new Date();
        if (!isExpired) return false;
      }
      // Search filter
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (
          !promo.code.toLowerCase().includes(search) &&
          !promo.description?.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [promoCodes, statusFilter, searchValue]);

  const stats = useMemo(() => ({
    total: promoCodes.length,
    active: promoCodes.filter((p) => p.isActive).length,
    inactive: promoCodes.filter((p) => !p.isActive).length,
    totalUsage: promoCodes.reduce((sum, p) => sum + p.usageCount, 0),
    expired: promoCodes.filter((p) => p.endsAt && new Date(p.endsAt) < new Date()).length,
  }), [promoCodes]);

  // ─── ContentList data ────────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.promoCodes.filterAll') || 'All', count: stats.total },
    { key: 'active', label: t('admin.promoCodes.active'), count: stats.active },
    { key: 'inactive', label: t('admin.promoCodes.inactive') || 'Inactive', count: stats.inactive },
    { key: 'expired', label: t('admin.promoCodes.expired') || 'Expired', count: stats.expired },
  ], [t, stats]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredPromoCodes.map((promo) => ({
      id: promo.id,
      avatar: { text: promo.code.slice(0, 2) },
      title: promo.code,
      subtitle: promo.type === 'PERCENTAGE'
        ? `${promo.value}%`
        : formatCurrency(promo.value),
      preview: promo.description || (
        promo.usageLimit
          ? `${promo.usageCount} / ${promo.usageLimit} ${t('admin.promoCodes.colUsage').toLowerCase()}`
          : `${promo.usageCount} ${t('admin.promoCodes.colUsage').toLowerCase()}`
      ),
      timestamp: promo.createdAt,
      badges: [
        {
          text: promoStatusLabel(promo, t),
          variant: promoStatusBadgeVariant(promo),
        },
        ...(promo.firstOrderOnly
          ? [{ text: t('admin.promoCodes.firstOrderOnly'), variant: 'info' as const }]
          : []),
      ],
    }));
  }, [filteredPromoCodes, t, formatCurrency]);

  // ─── Selected promo ──────────────────────────────────────────

  const selectedPromo = useMemo(() => {
    if (!selectedId) return null;
    return promoCodes.find(p => p.id === selectedId) || null;
  }, [promoCodes, selectedId]);

  // ─── Ribbon Actions ─────────────────────────────────────────

  const onNewPromo = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, []);

  const onDelete = useCallback(() => {
    if (!selectedId) return;
    deletePromoCode(selectedId);
  }, [selectedId]);

  const onDuplicate = useCallback(() => {
    if (!selectedPromo) return;
    setFormData({
      code: '',
      description: selectedPromo.description || '',
      type: selectedPromo.type,
      value: selectedPromo.value,
      minOrderAmount: selectedPromo.minOrderAmount?.toString() || '',
      maxDiscount: selectedPromo.maxDiscount?.toString() || '',
      usageLimit: selectedPromo.usageLimit?.toString() || '',
      usageLimitPerUser: selectedPromo.usageLimitPerUser?.toString() || '',
      startsAt: selectedPromo.startsAt ? selectedPromo.startsAt.slice(0, 16) : '',
      endsAt: selectedPromo.endsAt ? selectedPromo.endsAt.slice(0, 16) : '',
      firstOrderOnly: selectedPromo.firstOrderOnly,
    });
    setEditingCode(null);
    setShowForm(true);
  }, [selectedPromo]);

  const onActivate = useCallback(() => {
    if (!selectedId || !selectedPromo || selectedPromo.isActive) return;
    toggleActive(selectedId, false);
  }, [selectedId, selectedPromo]);

  const onDeactivate = useCallback(() => {
    if (!selectedId || !selectedPromo || !selectedPromo.isActive) return;
    toggleActive(selectedId, true);
  }, [selectedId, selectedPromo]);

  const onUsageStats = useCallback(() => {
    const totalUsage = promoCodes.reduce((sum, p) => sum + p.usageCount, 0);
    const mostUsed = [...promoCodes].sort((a, b) => b.usageCount - a.usageCount).slice(0, 3);
    const expired = promoCodes.filter(p => p.endsAt && new Date(p.endsAt) < new Date()).length;
    const firstOrderCodes = promoCodes.filter(p => p.firstOrderOnly).length;
    toast.success(t('admin.promoCodes.usageStatsTitle') || 'Promo Code Usage Stats', {
      description: [
        `${t('admin.promoCodes.totalUsage') || 'Total usage'}: ${totalUsage}`,
        `${t('admin.promoCodes.active') || 'Active'}: ${stats.active} | ${t('admin.promoCodes.expired') || 'Expired'}: ${expired}`,
        `${t('admin.promoCodes.firstOrderOnly') || '1st order only'}: ${firstOrderCodes}`,
        mostUsed.length > 0 ? `${t('admin.promoCodes.topUsed') || 'Top used'}: ${mostUsed.map(p => `${p.code} (${p.usageCount})`).join(', ')}` : '',
      ].filter(Boolean).join('\n'),
      duration: 8000,
    });
  }, [promoCodes, stats, t]);

  const onExport = useCallback(() => {
    if (filteredPromoCodes.length === 0) {
      toast.info(t('admin.promoCodes.emptyTitle') || 'No promo codes to export');
      return;
    }
    const bom = '\uFEFF';
    const headers = [
      t('admin.promoCodes.colCode') || 'Code',
      t('admin.promoCodes.labelDescription') || 'Description',
      t('admin.promoCodes.labelType') || 'Type',
      t('admin.promoCodes.labelValue') || 'Value',
      t('admin.promoCodes.colUsage') || 'Usage',
      t('admin.promoCodes.labelTotalLimit') || 'Limit',
      t('admin.promoCodes.colStatus') || 'Status',
      t('admin.promoCodes.labelStartDate') || 'Start',
      t('admin.promoCodes.labelEndDate') || 'End',
      t('admin.promoCodes.firstOrderOnlyCheckbox') || 'First Order Only',
    ];
    const rows = filteredPromoCodes.map(p => [
      p.code,
      p.description || '',
      p.type === 'PERCENTAGE' ? t('admin.promoCodes.typePercentage') : t('admin.promoCodes.typeFixedAmount'),
      p.value.toString(),
      p.usageCount.toString(),
      p.usageLimit?.toString() || t('admin.promoCodes.unlimited') || 'Unlimited',
      promoStatusLabel(p, t),
      p.startsAt ? new Date(p.startsAt).toLocaleDateString(locale) : '',
      p.endsAt ? new Date(p.endsAt).toLocaleDateString(locale) : '',
      p.firstOrderOnly ? 'Yes' : 'No',
    ]);
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promo-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported');
  }, [filteredPromoCodes, locale, t]);

  useRibbonAction('newPromo', onNewPromo);
  useRibbonAction('delete', onDelete);
  useRibbonAction('duplicate', onDuplicate);
  useRibbonAction('activate', onActivate);
  useRibbonAction('deactivate', onDeactivate);
  useRibbonAction('usageStats', onUsageStats);
  useRibbonAction('export', onExport);

  // ─── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.promoCodes.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.promoCodes.subtitle')}</p>
          </div>
          <Button
            variant="primary"
            icon={Plus}
            size="sm"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            {t('admin.promoCodes.newCode')}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <StatCard label={t('admin.promoCodes.totalCodes')} value={stats.total} icon={Tag} />
          <StatCard label={t('admin.promoCodes.active')} value={stats.active} icon={CheckCircle} />
          <StatCard label={t('admin.promoCodes.totalUsage')} value={stats.totalUsage} icon={BarChart3} />
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={380}
          showDetail={!!selectedId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedId}
              onSelect={handleSelectPromo}
              filterTabs={filterTabs}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.promoCodes.searchPlaceholder') || 'Rechercher un code...'}
              loading={loading}
              emptyIcon={Tag}
              emptyTitle={t('admin.promoCodes.emptyTitle')}
              emptyDescription={t('admin.promoCodes.emptyDescription')}
            />
          }
          detail={
            selectedPromo ? (
              <DetailPane
                header={{
                  title: selectedPromo.code,
                  subtitle: selectedPromo.description || (
                    selectedPromo.type === 'PERCENTAGE'
                      ? `${t('admin.promoCodes.typePercentage')} - ${selectedPromo.value}%`
                      : `${t('admin.promoCodes.typeFixedAmount')} - ${formatCurrency(selectedPromo.value)}`
                  ),
                  avatar: { text: selectedPromo.code.slice(0, 2) },
                  onBack: () => setSelectedId(null),
                  backLabel: t('admin.promoCodes.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => startEdit(selectedPromo)}>
                        {t('admin.promoCodes.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        disabled={deletingId === selectedPromo.id}
                        onClick={() => deletePromoCode(selectedPromo.id)}
                        className="text-red-600 hover:text-red-700"
                      />
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Status toggle */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{t('admin.promoCodes.colStatus')}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {promoStatusLabel(selectedPromo, t)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleActive(selectedPromo.id, selectedPromo.isActive)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        selectedPromo.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          selectedPromo.isActive ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Discount Info */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">{t('admin.promoCodes.colDiscount')}</h3>
                      <p className="text-2xl font-bold text-sky-600">
                        {selectedPromo.type === 'PERCENTAGE'
                          ? `${selectedPromo.value}%`
                          : formatCurrency(selectedPromo.value)}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {selectedPromo.type === 'PERCENTAGE'
                          ? t('admin.promoCodes.typePercentage')
                          : t('admin.promoCodes.typeFixedAmount')}
                      </p>
                      {selectedPromo.maxDiscount && (
                        <p className="text-sm text-slate-500 mt-1">
                          {t('admin.promoCodes.maxPrefix')} {formatCurrency(selectedPromo.maxDiscount)}
                        </p>
                      )}
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">{t('admin.promoCodes.colUsage')}</h3>
                      <p className="text-2xl font-bold text-slate-900">
                        {selectedPromo.usageCount}
                        {selectedPromo.usageLimit && (
                          <span className="text-slate-400 text-lg font-normal"> / {selectedPromo.usageLimit}</span>
                        )}
                      </p>
                      {selectedPromo.usageLimitPerUser && (
                        <p className="text-sm text-slate-500 mt-1">
                          {t('admin.promoCodes.labelPerCustomerLimit')}: {selectedPromo.usageLimitPerUser}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Conditions */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.promoCodes.colConditions')}</h3>
                    <div className="space-y-2">
                      {selectedPromo.minOrderAmount && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('admin.promoCodes.labelMinOrder')}</span>
                          <span className="font-medium text-slate-900">{formatCurrency(selectedPromo.minOrderAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('admin.promoCodes.firstOrderOnlyCheckbox')}</span>
                        <span className="font-medium text-slate-900">
                          {selectedPromo.firstOrderOnly ? t('admin.promoCodes.active') : '---'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Validity dates */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.promoCodes.colValidity')}</h3>
                    <div className="space-y-2">
                      {selectedPromo.startsAt ? (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('admin.promoCodes.fromDate')}</span>
                          <span className="font-medium text-slate-900">
                            {new Date(selectedPromo.startsAt).toLocaleDateString(locale)}
                          </span>
                        </div>
                      ) : null}
                      {selectedPromo.endsAt ? (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('admin.promoCodes.toDate')}</span>
                          <span className={`font-medium ${
                            new Date(selectedPromo.endsAt) < new Date() ? 'text-red-600' : 'text-slate-900'
                          }`}>
                            {new Date(selectedPromo.endsAt).toLocaleDateString(locale)}
                          </span>
                        </div>
                      ) : null}
                      {!selectedPromo.startsAt && !selectedPromo.endsAt && (
                        <p className="text-sm text-slate-400">{t('admin.promoCodes.unlimited')}</p>
                      )}
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-200">
                    <p>ID: {selectedPromo.id}</p>
                    <p>{t('admin.promoCodes.colCode')}: {selectedPromo.code}</p>
                    <p>
                      {t('admin.promoCodes.fromDate')} {new Date(selectedPromo.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Tag}
                emptyTitle={t('admin.promoCodes.emptyTitle')}
                emptyDescription={t('admin.promoCodes.emptyDescription')}
              />
            )
          }
        />
      </div>

      {/* UX FIX: ConfirmDialog for delete action */}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        title={t('admin.promoCodes.confirmDeleteTitle') || 'Delete promo code?'}
        message={t('admin.promoCodes.confirmDeleteMessage') || `Are you sure you want to delete "${confirmDelete.code}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel={t('common.delete') || 'Delete'}
        onConfirm={() => {
          executeDeletePromoCode(confirmDelete.id);
          setConfirmDelete({ isOpen: false, id: '', code: '' });
        }}
        onCancel={() => setConfirmDelete({ isOpen: false, id: '', code: '' })}
      />

      {/* ─── CREATE/EDIT FORM MODAL ─────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingCode ? t('admin.promoCodes.editModalTitle') : t('admin.promoCodes.newModalTitle')}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FormField label={t('admin.promoCodes.labelCode')} required>
              <div className="flex gap-2">
                <Input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => { setFormData({ ...formData, code: e.target.value.toUpperCase() }); setFormErrors(prev => { const n = { ...prev }; delete n.code; return n; }); }}
                  placeholder={t('admin.promoCodes.codePlaceholder')}
                  className="uppercase"
                />
                <Button type="button" variant="secondary" icon={Shuffle} onClick={generateCode}>
                  {t('admin.promoCodes.generate')}
                </Button>
              </div>
              {formErrors.code && (
                <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.code}</p>
              )}
            </FormField>
          </div>

          <FormField label={t('admin.promoCodes.labelDescription')}>
            <Input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('admin.promoCodes.descriptionPlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promoCodes.labelType')} required>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT' })}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="PERCENTAGE">{t('admin.promoCodes.typePercentage')}</option>
                <option value="FIXED_AMOUNT">{t('admin.promoCodes.typeFixedAmount')}</option>
              </select>
            </FormField>
            <FormField label={t('admin.promoCodes.labelValue')} required>
              <Input
                type="number"
                required
                min={1}
                value={formData.value}
                onChange={(e) => { setFormData({ ...formData, value: parseInt(e.target.value) || 0 }); setFormErrors(prev => { const n = { ...prev }; delete n.value; return n; }); }}
              />
              {formErrors.value && (
                <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.value}</p>
              )}
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promoCodes.labelMinOrder')}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formData.minOrderAmount}
                onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                placeholder={t('admin.promoCodes.minOrderPlaceholder')}
              />
            </FormField>
            <FormField label={t('admin.promoCodes.labelMaxDiscount')}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formData.maxDiscount}
                onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                placeholder={t('admin.promoCodes.maxDiscountPlaceholder')}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promoCodes.labelTotalLimit')}>
              <Input
                type="number"
                min={1}
                value={formData.usageLimit}
                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                placeholder={t('admin.promoCodes.totalLimitPlaceholder')}
              />
            </FormField>
            <FormField label={t('admin.promoCodes.labelPerCustomerLimit')}>
              <Input
                type="number"
                min={1}
                value={formData.usageLimitPerUser}
                onChange={(e) => setFormData({ ...formData, usageLimitPerUser: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promoCodes.labelStartDate')}>
              <Input
                type="datetime-local"
                value={formData.startsAt}
                onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
              />
            </FormField>
            <FormField label={t('admin.promoCodes.labelEndDate')}>
              <Input
                type="datetime-local"
                value={formData.endsAt}
                onChange={(e) => { setFormData({ ...formData, endsAt: e.target.value }); setFormErrors(prev => { const n = { ...prev }; delete n.endsAt; return n; }); }}
              />
              {formErrors.endsAt && (
                <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.endsAt}</p>
              )}
            </FormField>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.firstOrderOnly}
              onChange={(e) => setFormData({ ...formData, firstOrderOnly: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-sky-500"
            />
            <span className="text-sm text-slate-700">{t('admin.promoCodes.firstOrderOnlyCheckbox')}</span>
          </label>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">
              {t('admin.promoCodes.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving} className="flex-1">
              {editingCode ? t('admin.promoCodes.save') : t('admin.promoCodes.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
