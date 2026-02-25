// FIXED: F-054 - typeLabels now wrapped in useMemo (see line ~109)
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Percent, Zap, Package } from 'lucide-react';
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
import { fetchWithRetry } from '@/lib/fetch-with-retry';

// ── Types ─────────────────────────────────────────────────────

interface Promotion {
  id: string;
  name: string;
  type: 'PRODUCT_DISCOUNT' | 'CATEGORY_DISCOUNT' | 'BUNDLE' | 'BUY_X_GET_Y' | 'FLASH_SALE';
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  targetProducts?: string[];
  targetCategories?: string[];
  bundleProducts?: string[];
  buyQuantity?: number;
  getQuantity?: number;
  minQuantity?: number;
  startsAt: string;
  endsAt?: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function typeVariant(type: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (type) {
    case 'PRODUCT_DISCOUNT': return 'info';
    case 'CATEGORY_DISCOUNT': return 'info';
    case 'BUNDLE': return 'success';
    case 'BUY_X_GET_Y': return 'warning';
    case 'FLASH_SALE': return 'error';
    default: return 'neutral';
  }
}

function statusBadgeVariant(promo: Promotion): 'success' | 'warning' | 'error' | 'neutral' {
  const isExpired = promo.endsAt && new Date(promo.endsAt) < new Date();
  if (isExpired) return 'error';
  if (promo.isActive) return 'success';
  return 'neutral';
}

function statusLabel(promo: Promotion, t: (key: string) => string): string {
  const isExpired = promo.endsAt && new Date(promo.endsAt) < new Date();
  if (isExpired) return t('admin.promotions.expired');
  if (promo.isActive) return t('admin.promotions.statActive');
  return t('admin.promotions.inactive') || 'Inactive';
}

// ── Main Component ────────────────────────────────────────────

export default function PromotionsPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // UX FIX: ConfirmDialog for delete action
  const [confirmDelete, setConfirmDelete] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({ isOpen: false, id: '', name: '' });

  // Form state
  const [formName, setFormName] = useState('');
  // FIX F-019: Support all 5 promotion types (PRODUCT_DISCOUNT, CATEGORY_DISCOUNT, BUNDLE, BUY_X_GET_Y, FLASH_SALE)
  const [formPromoKind, setFormPromoKind] = useState<Promotion['type']>('PRODUCT_DISCOUNT');
  const [formType, setFormType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT'>('PERCENTAGE');
  const [formValue, setFormValue] = useState(10);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formAppliesToAll, setFormAppliesToAll] = useState(false);
  // FIX F-019: Type-specific fields
  const [formBuyQty, setFormBuyQty] = useState(2);
  const [formGetQty, setFormGetQty] = useState(1);
  const [formMinQuantity, setFormMinQuantity] = useState(1);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // FIX: FLAW-084 - Memoize typeLabels to avoid recreation on every render
  const typeLabels: Record<string, string> = useMemo(() => ({
    PRODUCT_DISCOUNT: t('admin.promotions.typeProductDiscount'),
    CATEGORY_DISCOUNT: t('admin.promotions.typeCategoryDiscount'),
    BUNDLE: t('admin.promotions.typeBundle'),
    BUY_X_GET_Y: t('admin.promotions.typeBuyXGetY'),
    FLASH_SALE: t('admin.promotions.typeFlashSale'),
  }), [t]);

  // ─── Data fetching ──────────────────────────────────────────

  // FIX: FLAW-054/FLAW-055 - Wrap fetchPromotions in useCallback for stable reference
  const fetchPromotions = useCallback(async () => {
    try {
      const res = await fetchWithRetry('/api/admin/promotions');
      const data = await res.json();
      setPromotions(data.promotions || []);
    } catch {
      setPromotions([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  // ─── Form helpers ───────────────────────────────────────────

  const resetForm = () => {
    setFormName('');
    setFormPromoKind('PRODUCT_DISCOUNT');
    setFormType('PERCENTAGE');
    setFormValue(10);
    setFormStartDate('');
    setFormEndDate('');
    setFormAppliesToAll(false);
    setFormBuyQty(2);
    setFormGetQty(1);
    setFormMinQuantity(1);
  };

  const openCreateForm = () => {
    setEditingPromo(null);
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormName(promo.name);
    setFormPromoKind(promo.type);
    setFormType(promo.discountType);
    setFormValue(promo.discountValue);
    setFormStartDate(promo.startsAt ? promo.startsAt.slice(0, 16) : '');
    setFormEndDate(promo.endsAt ? promo.endsAt.slice(0, 16) : '');
    setFormAppliesToAll(promo.type === 'FLASH_SALE');
    setFormBuyQty(promo.buyQuantity ?? 2);
    setFormGetQty(promo.getQuantity ?? 1);
    setFormMinQuantity(promo.minQuantity ?? 1);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPromo(null);
    resetForm();
  };

  const handleSubmitPromotion = async () => {
    // UX FIX: Validate form fields with inline error messages
    const errors: Record<string, string> = {};
    if (!formName.trim()) {
      errors.name = t('admin.promotions.nameRequired') || 'Promotion name is required';
    }
    if (formValue <= 0) {
      errors.value = t('admin.promotions.valueRequired') || 'Discount value must be greater than 0';
    }
    if (formType === 'PERCENTAGE' && formValue > 100) {
      errors.value = t('admin.promotions.percentageMax') || 'Percentage discount cannot exceed 100%';
    }
    if (formEndDate && formStartDate && new Date(formEndDate) <= new Date(formStartDate)) {
      errors.endDate = t('admin.promotions.endDateAfterStart') || 'End date must be after start date';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const isEdit = !!editingPromo;
      const url = isEdit
        ? `/api/admin/promotions/${editingPromo.id}`
        : '/api/admin/promotions';
      const method = isEdit ? 'PATCH' : 'POST';

      // FIX F-019: Send both type (promo kind) and discountType (discount method)
      const body: Record<string, unknown> = {
        name: formName.trim(),
        type: formPromoKind,
        discountType: formType,
        discountValue: formValue,
        appliesToAll: formAppliesToAll || formPromoKind === 'FLASH_SALE',
        isActive: true,
      };

      // Add type-specific fields
      if (formPromoKind === 'BUY_X_GET_Y') {
        body.buyQuantity = formBuyQty;
        body.getQuantity = formGetQty;
      }
      if (formPromoKind === 'BUNDLE' || formPromoKind === 'BUY_X_GET_Y') {
        body.minQuantity = formMinQuantity;
      }

      if (formStartDate) {
        body.startsAt = new Date(formStartDate).toISOString();
      }
      if (formEndDate) {
        body.endsAt = new Date(formEndDate).toISOString();
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t(isEdit ? 'admin.promotions.updateError' : 'admin.promotions.createError'));
        return;
      }

      toast.success(t(isEdit ? 'admin.promotions.updateSuccess' : 'admin.promotions.createSuccess'));
      closeForm();
      fetchPromotions();
    } catch {
      toast.error(t('admin.promotions.createError'));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── CRUD ─────────────────────────────────────────────────

  // FIX F-020: Use functional state updater to correctly capture value for rollback
  const toggleActive = async (id: string, currentIsActive: boolean) => {
    const newIsActive = !currentIsActive;
    setPromotions(prev => prev.map((p) => (p.id === id ? { ...p, isActive: newIsActive } : p)));
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newIsActive }),
      });
      if (!res.ok) {
        // Revert: set back to currentIsActive (the value before this toggle)
        setPromotions(prev => prev.map((p) => (p.id === id ? { ...p, isActive: currentIsActive } : p)));
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
      }
    } catch {
      setPromotions(prev => prev.map((p) => (p.id === id ? { ...p, isActive: currentIsActive } : p)));
      toast.error(t('common.networkError'));
    }
  };

  // UX FIX: Actual delete execution (called after confirmation)
  const executeDeletePromotion = async (id: string) => {
    setDeletingId(id);
    const prev = promotions;
    setPromotions(promotions.filter((p) => p.id !== id));
    if (selectedId === id) setSelectedId(null);
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setPromotions(prev);
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.deleteFailed'));
        return;
      }
      toast.success(t('admin.promotions.deleted') || 'Promotion deleted');
    } catch {
      setPromotions(prev);
      toast.error(t('common.networkError'));
    } finally {
      setDeletingId(null);
    }
  };

  // UX FIX: Replaced native confirm() with ConfirmDialog
  const deletePromotion = (id: string) => {
    const promo = promotions.find(p => p.id === id);
    setConfirmDelete({
      isOpen: true,
      id,
      name: promo?.name || '',
    });
  };

  const handleSelectPromo = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // ─── Filtering ──────────────────────────────────────────────

  // A-031: Advanced filters - filter by all 5 promotion types + active status
  const filteredPromotions = useMemo(() => {
    return promotions.filter(promo => {
      if (statusFilter === 'active' && !promo.isActive) return false;
      if (statusFilter === 'flash' && promo.type !== 'FLASH_SALE') return false;
      if (statusFilter === 'bundle' && promo.type !== 'BUNDLE') return false;
      // A-031: Added filters for PRODUCT_DISCOUNT, CATEGORY_DISCOUNT, BUY_X_GET_Y
      if (statusFilter === 'product' && promo.type !== 'PRODUCT_DISCOUNT') return false;
      if (statusFilter === 'category' && promo.type !== 'CATEGORY_DISCOUNT') return false;
      if (statusFilter === 'buyxgety' && promo.type !== 'BUY_X_GET_Y') return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (!promo.name.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [promotions, statusFilter, searchValue]);

  // A-031: Extended stats to include all 5 promotion types
  const stats = useMemo(() => ({
    total: promotions.length,
    active: promotions.filter((p) => p.isActive).length,
    productDiscount: promotions.filter((p) => p.type === 'PRODUCT_DISCOUNT').length,
    categoryDiscount: promotions.filter((p) => p.type === 'CATEGORY_DISCOUNT').length,
    flashSales: promotions.filter((p) => p.type === 'FLASH_SALE').length,
    bundles: promotions.filter((p) => p.type === 'BUNDLE').length,
    buyXGetY: promotions.filter((p) => p.type === 'BUY_X_GET_Y').length,
  }), [promotions]);

  // ─── ContentList data ────────────────────────────────────────

  // A-031: Filter tabs for all promotion types
  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.promotions.statTotal'), count: stats.total },
    { key: 'active', label: t('admin.promotions.statActive'), count: stats.active },
    { key: 'product', label: t('admin.promotions.typeProductDiscount'), count: stats.productDiscount },
    { key: 'category', label: t('admin.promotions.typeCategoryDiscount'), count: stats.categoryDiscount },
    { key: 'flash', label: t('admin.promotions.statFlashSales'), count: stats.flashSales },
    { key: 'bundle', label: t('admin.promotions.statBundles'), count: stats.bundles },
    { key: 'buyxgety', label: t('admin.promotions.typeBuyXGetY'), count: stats.buyXGetY },
  ], [t, stats]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredPromotions.map((promo) => ({
      id: promo.id,
      avatar: { text: promo.name },
      title: promo.name,
      subtitle: promo.discountType === 'PERCENTAGE'
        ? `${promo.discountValue}%`
        : formatCurrency(promo.discountValue),
      preview: `${typeLabels[promo.type] || promo.type} - ${t('admin.promotions.priority')} ${promo.priority}`,
      timestamp: promo.createdAt,
      badges: [
        { text: typeLabels[promo.type] || promo.type, variant: typeVariant(promo.type) },
        { text: statusLabel(promo, t), variant: statusBadgeVariant(promo) },
      ],
    }));
  }, [filteredPromotions, t, formatCurrency, typeLabels]);

  // ─── Selected promo ──────────────────────────────────────────

  const selectedPromo = useMemo(() => {
    if (!selectedId) return null;
    return promotions.find(p => p.id === selectedId) || null;
  }, [promotions, selectedId]);

  // ─── Ribbon Actions ─────────────────────────────────────────

  const onNewPromotion = useCallback(() => {
    openCreateForm();
  }, []);

  const onDeleteRibbon = useCallback(() => {
    if (!selectedId) return;
    deletePromotion(selectedId);
  }, [selectedId]);

  const onSchedule = useCallback(() => {
    if (!selectedPromo) {
      toast.info(t('admin.promotions.selectFirst') || 'Select a promotion first');
      return;
    }
    // Pre-fill dates and open form for editing schedule
    setEditingPromo(selectedPromo);
    setFormName(selectedPromo.name);
    setFormPromoKind(selectedPromo.type);
    setFormType(selectedPromo.discountType);
    setFormValue(selectedPromo.discountValue);
    setFormStartDate(selectedPromo.startsAt ? selectedPromo.startsAt.slice(0, 16) : '');
    setFormEndDate(selectedPromo.endsAt ? selectedPromo.endsAt.slice(0, 16) : '');
    setFormAppliesToAll(selectedPromo.type === 'FLASH_SALE');
    setFormBuyQty(selectedPromo.buyQuantity ?? 2);
    setFormGetQty(selectedPromo.getQuantity ?? 1);
    setFormMinQuantity(selectedPromo.minQuantity ?? 1);
    setShowForm(true);
    toast.info(t('admin.promotions.editScheduleHint') || 'Modify start/end dates to schedule this promotion');
  }, [selectedPromo, t]);

  const onActivate = useCallback(() => {
    if (!selectedId || !selectedPromo || selectedPromo.isActive) return;
    toggleActive(selectedId, false);
  }, [selectedId, selectedPromo]);

  const onDeactivate = useCallback(() => {
    if (!selectedId || !selectedPromo || !selectedPromo.isActive) return;
    toggleActive(selectedId, true);
  }, [selectedId, selectedPromo]);

  const onDuplicate = useCallback(() => {
    if (!selectedPromo) return;
    setEditingPromo(null);
    setFormName(selectedPromo.name + ' (copy)');
    setFormPromoKind(selectedPromo.type);
    setFormType(selectedPromo.discountType);
    setFormValue(selectedPromo.discountValue);
    setFormStartDate('');
    setFormEndDate('');
    setFormAppliesToAll(selectedPromo.type === 'FLASH_SALE');
    setFormBuyQty(selectedPromo.buyQuantity ?? 2);
    setFormGetQty(selectedPromo.getQuantity ?? 1);
    setFormMinQuantity(selectedPromo.minQuantity ?? 1);
    setShowForm(true);
  }, [selectedPromo]);

  const onPerformanceStats = useCallback(() => {
    const active = promotions.filter(p => p.isActive).length;
    const expired = promotions.filter(p => p.endsAt && new Date(p.endsAt) < new Date()).length;
    const byType = promotions.reduce<Record<string, number>>((acc, p) => {
      acc[typeLabels[p.type] || p.type] = (acc[typeLabels[p.type] || p.type] || 0) + 1;
      return acc;
    }, {});
    const typeBreakdown = Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(', ');
    toast.success(t('admin.promotions.performanceTitle') || 'Promotion Stats', {
      description: `${t('admin.promotions.statTotal') || 'Total'}: ${promotions.length} | ${t('admin.promotions.statActive') || 'Active'}: ${active} | ${t('admin.promotions.expired') || 'Expired'}: ${expired}\n${typeBreakdown}`,
      duration: 8000,
    });
  }, [promotions, typeLabels, t]);

  const onExport = useCallback(() => {
    if (filteredPromotions.length === 0) {
      toast.info(t('admin.promotions.emptyTitle') || 'No promotions to export');
      return;
    }
    const bom = '\uFEFF';
    const headers = [
      t('admin.promotions.formName') || 'Name',
      t('admin.promotions.formType') || 'Type',
      t('admin.promotions.discount') || 'Discount',
      t('admin.promotions.formValue') || 'Value',
      t('admin.promotions.statActive') || 'Active',
      t('admin.promotions.formStartDate') || 'Start',
      t('admin.promotions.formEndDate') || 'End',
      t('admin.promotions.priority') || 'Priority',
    ];
    const rows = filteredPromotions.map(p => [
      p.name,
      typeLabels[p.type] || p.type,
      p.discountType,
      p.discountValue.toString(),
      p.isActive ? 'Yes' : 'No',
      p.startsAt ? new Date(p.startsAt).toLocaleDateString(locale) : '',
      p.endsAt ? new Date(p.endsAt).toLocaleDateString(locale) : '',
      p.priority.toString(),
    ]);
    const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promotions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported');
  }, [filteredPromotions, typeLabels, locale, t]);

  useRibbonAction('newPromotion', onNewPromotion);
  useRibbonAction('delete', onDeleteRibbon);
  useRibbonAction('schedule', onSchedule);
  useRibbonAction('activate', onActivate);
  useRibbonAction('deactivate', onDeactivate);
  useRibbonAction('duplicate', onDuplicate);
  useRibbonAction('performanceStats', onPerformanceStats);
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
            <h1 className="text-xl font-bold text-slate-900">{t('admin.promotions.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.promotions.subtitle')}</p>
          </div>
          <Button variant="primary" icon={Plus} size="sm" onClick={openCreateForm}>
            {t('admin.promotions.newPromotion')}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label={t('admin.promotions.statTotal')} value={stats.total} icon={Percent} />
          <StatCard label={t('admin.promotions.statActive')} value={stats.active} icon={Percent} />
          <StatCard label={t('admin.promotions.statFlashSales')} value={stats.flashSales} icon={Zap} />
          <StatCard label={t('admin.promotions.statBundles')} value={stats.bundles} icon={Package} />
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
              searchPlaceholder={t('admin.promotions.searchPlaceholder') || 'Rechercher une promotion...'}
              loading={loading}
              emptyIcon={Percent}
              emptyTitle={t('admin.promotions.emptyTitle')}
              emptyDescription={t('admin.promotions.emptyDescription')}
            />
          }
          detail={
            selectedPromo ? (
              <DetailPane
                header={{
                  title: selectedPromo.name,
                  subtitle: `${typeLabels[selectedPromo.type] || selectedPromo.type} - ${
                    selectedPromo.discountType === 'PERCENTAGE'
                      ? `${selectedPromo.discountValue}%`
                      : formatCurrency(selectedPromo.discountValue)
                  }`,
                  avatar: { text: selectedPromo.name },
                  onBack: () => setSelectedId(null),
                  backLabel: t('admin.promotions.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => openEditForm(selectedPromo)}
                      >
                        {t('admin.promotions.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        disabled={deletingId === selectedPromo.id}
                        onClick={() => deletePromotion(selectedPromo.id)}
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
                      <h3 className="font-semibold text-slate-900">{t('admin.promotions.statActive')}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {statusLabel(selectedPromo, t)}
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
                      <h3 className="font-semibold text-slate-900 mb-3">{t('admin.promotions.discount')}</h3>
                      <p className="text-2xl font-bold text-sky-600">
                        {selectedPromo.discountType === 'PERCENTAGE'
                          ? `${selectedPromo.discountValue}%`
                          : formatCurrency(selectedPromo.discountValue)}
                      </p>
                      <p className="text-sm text-slate-500 mt-1">
                        {selectedPromo.discountType === 'PERCENTAGE'
                          ? t('admin.promoCodes.typePercentage')
                          : t('admin.promoCodes.typeFixedAmount')}
                      </p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">{t('admin.promotions.priority')}</h3>
                      <p className="text-2xl font-bold text-slate-900">{selectedPromo.priority}</p>
                    </div>
                  </div>

                  {/* Type-specific details */}
                  {selectedPromo.type === 'BUY_X_GET_Y' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h3 className="font-semibold text-amber-800 mb-2">{typeLabels['BUY_X_GET_Y']}</h3>
                      <p className="text-sm text-amber-700">
                        {t('admin.promotions.buyXGetY', {
                          buyQty: selectedPromo.buyQuantity ?? 0,
                          getQty: selectedPromo.getQuantity ?? 0,
                        })}
                      </p>
                    </div>
                  )}

                  {selectedPromo.type === 'BUNDLE' && selectedPromo.bundleProducts && selectedPromo.bundleProducts.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                      <h3 className="font-semibold text-emerald-800 mb-2">{typeLabels['BUNDLE']}</h3>
                      <p className="text-sm text-emerald-700">
                        {selectedPromo.bundleProducts.length} {t('admin.promotions.productsIncluded') || 'products included'}
                      </p>
                    </div>
                  )}

                  {selectedPromo.minQuantity && (
                    <div className="flex justify-between text-sm bg-slate-50 rounded-lg p-4">
                      <span className="text-slate-600">{t('admin.promotions.minQuantity') || 'Minimum quantity'}</span>
                      <span className="font-medium text-slate-900">{selectedPromo.minQuantity}</span>
                    </div>
                  )}

                  {/* Validity dates */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.promotions.validity')}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('admin.promoCodes.fromDate') || 'From'}</span>
                        <span className="font-medium text-slate-900">
                          {new Date(selectedPromo.startsAt).toLocaleDateString(locale)}
                        </span>
                      </div>
                      {selectedPromo.endsAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('admin.promoCodes.toDate') || 'To'}</span>
                          <span className={`font-medium ${
                            new Date(selectedPromo.endsAt) < new Date() ? 'text-red-600' : 'text-slate-900'
                          }`}>
                            {new Date(selectedPromo.endsAt).toLocaleDateString(locale)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Targets */}
                  {selectedPromo.targetProducts && selectedPromo.targetProducts.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h3 className="font-semibold text-slate-900 mb-2">{t('admin.promotions.targetProducts') || 'Target Products'}</h3>
                      <p className="text-sm text-slate-600">{selectedPromo.targetProducts.length} {t('admin.promotions.productsIncluded') || 'products'}</p>
                    </div>
                  )}
                  {selectedPromo.targetCategories && selectedPromo.targetCategories.length > 0 && (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h3 className="font-semibold text-slate-900 mb-2">{t('admin.promotions.targetCategories') || 'Target Categories'}</h3>
                      <p className="text-sm text-slate-600">{selectedPromo.targetCategories.length} {t('admin.promotions.categoriesIncluded') || 'categories'}</p>
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-200">
                    <p>ID: {selectedPromo.id}</p>
                    <p>
                      {t('admin.promoCodes.fromDate')} {new Date(selectedPromo.createdAt).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Percent}
                emptyTitle={t('admin.promotions.emptyTitle')}
                emptyDescription={t('admin.promotions.emptyDescription')}
              />
            )
          }
        />
      </div>

      {/* UX FIX: ConfirmDialog for delete action */}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        title={t('admin.promotions.confirmDeleteTitle') || 'Delete promotion?'}
        message={t('admin.promotions.confirmDeleteMessage') || `Are you sure you want to delete "${confirmDelete.name}"? This action cannot be undone.`}
        variant="danger"
        confirmLabel={t('common.delete') || 'Delete'}
        onConfirm={() => {
          executeDeletePromotion(confirmDelete.id);
          setConfirmDelete({ isOpen: false, id: '', name: '' });
        }}
        onCancel={() => setConfirmDelete({ isOpen: false, id: '', name: '' })}
      />

      {/* ─── FORM MODAL ─────────────────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingPromo ? t('admin.promotions.editTitle') : t('admin.promotions.modalTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              {t('admin.promotions.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmitPromotion}
              disabled={submitting || !formName.trim()}
              loading={submitting}
            >
              {submitting
                ? t('admin.promotions.submitting')
                : editingPromo
                  ? t('admin.promotions.update')
                  : t('admin.promotions.create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.promotions.formName')} required>
            <Input
              type="text"
              value={formName}
              onChange={(e) => { setFormName(e.target.value); setFormErrors(prev => { const n = { ...prev }; delete n.name; return n; }); }}
              placeholder={t('admin.promotions.formNamePlaceholder')}
            />
            {formErrors.name && (
              <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.name}</p>
            )}
          </FormField>

          {/* FIX F-019: Promotion kind selector - supports all 5 types */}
          <FormField label={t('admin.promotions.formPromoKind') || 'Promotion type'} required>
            <select
              value={formPromoKind}
              onChange={(e) => setFormPromoKind(e.target.value as Promotion['type'])}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-sky-700"
            >
              <option value="PRODUCT_DISCOUNT">{typeLabels.PRODUCT_DISCOUNT}</option>
              <option value="CATEGORY_DISCOUNT">{typeLabels.CATEGORY_DISCOUNT}</option>
              <option value="BUNDLE">{typeLabels.BUNDLE}</option>
              <option value="BUY_X_GET_Y">{typeLabels.BUY_X_GET_Y}</option>
              <option value="FLASH_SALE">{typeLabels.FLASH_SALE}</option>
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promotions.formType')} required>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT')}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-700 focus:border-sky-700"
              >
                <option value="PERCENTAGE">{t('admin.promoCodes.typePercentage')}</option>
                <option value="FIXED_AMOUNT">{t('admin.promoCodes.typeFixedAmount')}</option>
              </select>
            </FormField>
            <FormField label={t('admin.promotions.formValue')} required>
              <Input
                type="number"
                min={0}
                max={formType === 'PERCENTAGE' ? 100 : 99999}
                step={formType === 'PERCENTAGE' ? 1 : 0.01}
                value={formValue}
                onChange={(e) => { setFormValue(parseFloat(e.target.value) || 0); setFormErrors(prev => { const n = { ...prev }; delete n.value; return n; }); }}
              />
              {formErrors.value && (
                <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.value}</p>
              )}
            </FormField>
          </div>

          {/* FIX F-019: BUY_X_GET_Y specific fields */}
          {formPromoKind === 'BUY_X_GET_Y' && (
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.promotions.formBuyQty') || 'Buy quantity'} required>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={formBuyQty}
                  onChange={(e) => setFormBuyQty(parseInt(e.target.value) || 1)}
                />
              </FormField>
              <FormField label={t('admin.promotions.formGetQty') || 'Get free quantity'} required>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={formGetQty}
                  onChange={(e) => setFormGetQty(parseInt(e.target.value) || 1)}
                />
              </FormField>
            </div>
          )}

          {/* FIX F-019: Min quantity for BUNDLE and BUY_X_GET_Y */}
          {(formPromoKind === 'BUNDLE' || formPromoKind === 'BUY_X_GET_Y') && (
            <FormField label={t('admin.promotions.minQuantity') || 'Minimum quantity'}>
              <Input
                type="number"
                min={1}
                max={1000}
                value={formMinQuantity}
                onChange={(e) => setFormMinQuantity(parseInt(e.target.value) || 1)}
              />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promotions.formStartDate')}>
              <Input
                type="datetime-local"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
              />
            </FormField>
            <FormField label={t('admin.promotions.formEndDate')}>
              <Input
                type="datetime-local"
                value={formEndDate}
                onChange={(e) => { setFormEndDate(e.target.value); setFormErrors(prev => { const n = { ...prev }; delete n.endDate; return n; }); }}
              />
              {formErrors.endDate && (
                <p className="mt-1 text-sm text-red-600" role="alert">{formErrors.endDate}</p>
              )}
            </FormField>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formAppliesToAll || formPromoKind === 'FLASH_SALE'}
              onChange={(e) => setFormAppliesToAll(e.target.checked)}
              disabled={formPromoKind === 'FLASH_SALE'}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm text-slate-700">{t('admin.promotions.formAppliesToAll')}</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
