'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Percent, Zap, Package } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const typeLabels: Record<string, string> = {
    PRODUCT_DISCOUNT: t('admin.promotions.typeProductDiscount'),
    CATEGORY_DISCOUNT: t('admin.promotions.typeCategoryDiscount'),
    BUNDLE: t('admin.promotions.typeBundle'),
    BUY_X_GET_Y: t('admin.promotions.typeBuyXGetY'),
    FLASH_SALE: t('admin.promotions.typeFlashSale'),
  };

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const res = await fetchWithRetry('/api/admin/promotions');
      const data = await res.json();
      setPromotions(data.promotions || []);
    } catch {
      setPromotions([]);
    }
    setLoading(false);
  };

  // ─── CRUD ─────────────────────────────────────────────────

  const toggleActive = async (id: string, isActive: boolean) => {
    setPromotions(prev => prev.map((p) => (p.id === id ? { ...p, isActive: !isActive } : p)));
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) {
        setPromotions(prev => prev.map((p) => (p.id === id ? { ...p, isActive } : p)));
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
      }
    } catch {
      setPromotions(prev => prev.map((p) => (p.id === id ? { ...p, isActive } : p)));
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
          <Button variant="primary" icon={Plus} size="sm" onClick={() => setShowForm(true)}>
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
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={t('admin.promotions.modalTitle')}>
        <p className="text-slate-500 mb-4">{t('admin.promotions.featureInDevelopment')}</p>
        <Button variant="secondary" onClick={() => setShowForm(false)}>
          {t('admin.promotions.close')}
        </Button>
      </Modal>
    </div>
  );
}
