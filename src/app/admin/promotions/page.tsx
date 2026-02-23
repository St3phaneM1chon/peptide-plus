// TODO: F-054 - typeLabels recreated every render without useMemo; wrap in useMemo for performance
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
    if (!formName.trim()) return;
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

  const deletePromotion = async (id: string) => {
    if (!confirm(t('admin.promotions.confirmDelete'))) return;
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

  const handleSelectPromo = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // ─── Filtering ──────────────────────────────────────────────

  const filteredPromotions = useMemo(() => {
    return promotions.filter(promo => {
      if (statusFilter === 'active' && !promo.isActive) return false;
      if (statusFilter === 'flash' && promo.type !== 'FLASH_SALE') return false;
      if (statusFilter === 'bundle' && promo.type !== 'BUNDLE') return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (!promo.name.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [promotions, statusFilter, searchValue]);

  const stats = useMemo(() => ({
    total: promotions.length,
    active: promotions.filter((p) => p.isActive).length,
    flashSales: promotions.filter((p) => p.type === 'FLASH_SALE').length,
    bundles: promotions.filter((p) => p.type === 'BUNDLE').length,
  }), [promotions]);

  // ─── ContentList data ────────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.promotions.statTotal'), count: stats.total },
    { key: 'active', label: t('admin.promotions.statActive'), count: stats.active },
    { key: 'flash', label: t('admin.promotions.statFlashSales'), count: stats.flashSales },
    { key: 'bundle', label: t('admin.promotions.statBundles'), count: stats.bundles },
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
    toast.info(t('common.comingSoon'));
  }, [t]);

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
    toast.info(t('common.comingSoon'));
  }, [t]);

  const onExport = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

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
              onChange={(e) => setFormName(e.target.value)}
              placeholder={t('admin.promotions.formNamePlaceholder')}
            />
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
                onChange={(e) => setFormValue(parseFloat(e.target.value) || 0)}
              />
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
                onChange={(e) => setFormEndDate(e.target.value)}
              />
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
