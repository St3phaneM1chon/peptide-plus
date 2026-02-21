'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Trash2, Zap, Package, RefreshCw } from 'lucide-react';
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

// ── Types ─────────────────────────────────────────────────────

interface UpsellConfigItem {
  id: string;
  productId: string | null;
  productName: string | null;
  productSlug: string | null;
  productImage: string | null;
  isEnabled: boolean;
  showQuantityDiscount: boolean;
  showSubscription: boolean;
  displayRule: string;
  quantityTitle: string | null;
  quantitySubtitle: string | null;
  subscriptionTitle: string | null;
  subscriptionSubtitle: string | null;
  suggestedQuantity: number | null;
  suggestedFrequency: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductOption {
  id: string;
  name: string;
  slug: string;
}

const DISPLAY_RULES = ['ALWAYS', 'ONCE_PER_SESSION', 'ONCE_PER_PRODUCT'];
const FREQUENCIES = ['EVERY_2_MONTHS', 'EVERY_4_MONTHS', 'EVERY_6_MONTHS', 'EVERY_12_MONTHS'];

// ── Helpers ───────────────────────────────────────────────────

function configBadgeVariant(config: UpsellConfigItem): 'success' | 'error' | 'neutral' {
  return config.isEnabled ? 'success' : 'error';
}

function configStatusLabel(config: UpsellConfigItem, t: (key: string) => string): string {
  return config.isEnabled ? t('admin.upsell.enabled') : t('admin.upsell.disabled');
}

// ── Main Component ────────────────────────────────────────────

export default function UpsellAdminPage() {
  const { t, locale } = useI18n();
  const [configs, setConfigs] = useState<UpsellConfigItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<UpsellConfigItem | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Form state
  const [formProductId, setFormProductId] = useState<string>('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formShowQty, setFormShowQty] = useState(true);
  const [formShowSub, setFormShowSub] = useState(true);
  const [formDisplayRule, setFormDisplayRule] = useState('ALWAYS');
  const [formQtyTitle, setFormQtyTitle] = useState('');
  const [formQtySubtitle, setFormQtySubtitle] = useState('');
  const [formSubTitle, setFormSubTitle] = useState('');
  const [formSubSubtitle, setFormSubSubtitle] = useState('');
  const [formSuggestedQty, setFormSuggestedQty] = useState('');
  const [formSuggestedFreq, setFormSuggestedFreq] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchConfigs();
    fetchProducts();
  }, []);

  const fetchConfigs = async () => {
    try {
      const res = await fetch('/api/admin/upsell-config');
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch {
      toast.error(t('toast.admin.upsellLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?limit=500&fields=id,name,slug');
      const data = await res.json();
      setProducts(
        (data.products || []).map((p: { id: string; name: string; slug: string }) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
        }))
      );
    } catch {
      // silently fail - products dropdown won't work
    }
  };

  // ─── Form helpers ─────────────────────────────────────────────

  const resetForm = () => {
    setFormProductId('');
    setFormEnabled(true);
    setFormShowQty(true);
    setFormShowSub(true);
    setFormDisplayRule('ALWAYS');
    setFormQtyTitle('');
    setFormQtySubtitle('');
    setFormSubTitle('');
    setFormSubSubtitle('');
    setFormSuggestedQty('');
    setFormSuggestedFreq('');
    setEditingConfig(null);
  };

  const openForm = (config?: UpsellConfigItem) => {
    if (config) {
      setEditingConfig(config);
      setFormProductId(config.productId || '');
      setFormEnabled(config.isEnabled);
      setFormShowQty(config.showQuantityDiscount);
      setFormShowSub(config.showSubscription);
      setFormDisplayRule(config.displayRule);
      setFormQtyTitle(config.quantityTitle || '');
      setFormQtySubtitle(config.quantitySubtitle || '');
      setFormSubTitle(config.subscriptionTitle || '');
      setFormSubSubtitle(config.subscriptionSubtitle || '');
      setFormSuggestedQty(config.suggestedQuantity?.toString() || '');
      setFormSuggestedFreq(config.suggestedFrequency || '');
    } else {
      resetForm();
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/upsell-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: formProductId || null,
          isEnabled: formEnabled,
          showQuantityDiscount: formShowQty,
          showSubscription: formShowSub,
          displayRule: formDisplayRule,
          quantityTitle: formQtyTitle || null,
          quantitySubtitle: formQtySubtitle || null,
          subscriptionTitle: formSubTitle || null,
          subscriptionSubtitle: formSubSubtitle || null,
          suggestedQuantity: formSuggestedQty ? Number(formSuggestedQty) : null,
          suggestedFrequency: formSuggestedFreq || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success(t('admin.upsell.saveSuccess'));
      setShowForm(false);
      resetForm();
      fetchConfigs();
    } catch {
      toast.error(t('toast.admin.upsellSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.upsell.confirmDelete'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/upsell-config?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      toast.success(t('admin.upsell.deleteSuccess'));
      if (selectedId === id) setSelectedId(null);
      fetchConfigs();
    } catch {
      toast.error(t('toast.admin.upsellDeleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // ─── Derived data ──────────────────────────────────────────────

  const globalConfig = useMemo(() => configs.find((c) => !c.productId), [configs]);
  const productConfigs = useMemo(() => configs.filter((c) => c.productId), [configs]);

  const stats = useMemo(() => ({
    activeConfigs: configs.filter((c) => c.isEnabled).length,
    productOverrides: productConfigs.length,
    globalEnabled: globalConfig?.isEnabled || false,
  }), [configs, productConfigs, globalConfig]);

  // ─── Filtering ──────────────────────────────────────────────

  const filteredConfigs = useMemo(() => {
    return configs.filter(config => {
      if (statusFilter === 'enabled' && !config.isEnabled) return false;
      if (statusFilter === 'disabled' && config.isEnabled) return false;
      if (statusFilter === 'global' && config.productId) return false;
      if (statusFilter === 'product' && !config.productId) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        const name = config.productName || t('admin.upsell.globalLabel');
        if (!name.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [configs, statusFilter, searchValue, t]);

  // ─── ContentList data ─────────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.upsell.filterAll') || 'All', count: configs.length },
    { key: 'enabled', label: t('admin.upsell.enabled'), count: stats.activeConfigs },
    { key: 'global', label: t('admin.upsell.globalConfig'), count: globalConfig ? 1 : 0 },
    { key: 'product', label: t('admin.upsell.productOverrides'), count: stats.productOverrides },
  ], [t, configs.length, stats, globalConfig]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredConfigs.map((config) => ({
      id: config.id,
      avatar: { text: config.productName || 'G' },
      title: config.productName || t('admin.upsell.globalLabel'),
      subtitle: config.displayRule,
      preview: [
        config.showQuantityDiscount ? t('admin.upsell.showQuantityDiscount') : null,
        config.showSubscription ? t('admin.upsell.showSubscription') : null,
      ].filter(Boolean).join(' + ') || '---',
      timestamp: config.updatedAt,
      badges: [
        {
          text: configStatusLabel(config, t),
          variant: configBadgeVariant(config),
        },
        ...(!config.productId
          ? [{ text: t('admin.upsell.globalConfig'), variant: 'info' as const }]
          : []),
      ],
    }));
  }, [filteredConfigs, t]);

  // ─── Selected config ──────────────────────────────────────────

  const selectedConfig = useMemo(() => {
    if (!selectedId) return null;
    return configs.find(c => c.id === selectedId) || null;
  }, [configs, selectedId]);

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
      {/* Header + Stats */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.upsell.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.upsell.subtitle')}</p>
          </div>
          <Button variant="primary" icon={Plus} size="sm" onClick={() => openForm()}>
            {t('admin.upsell.addOverride')}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <StatCard label={t('admin.upsell.activeConfigs')} value={stats.activeConfigs} icon={Zap} />
          <StatCard label={t('admin.upsell.productOverrideCount')} value={stats.productOverrides} icon={Package} />
          <StatCard
            label={t('admin.upsell.globalStatus')}
            value={stats.globalEnabled ? t('admin.upsell.enabled') : t('admin.upsell.disabled')}
            icon={RefreshCw}
          />
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
              onSelect={handleSelect}
              filterTabs={filterTabs}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.upsell.searchPlaceholder') || 'Rechercher...'}
              loading={loading}
              emptyIcon={Zap}
              emptyTitle={t('admin.upsell.noConfig')}
              emptyDescription={t('admin.upsell.noConfigDesc')}
            />
          }
          detail={
            selectedConfig ? (
              <DetailPane
                header={{
                  title: selectedConfig.productName || t('admin.upsell.globalLabel'),
                  subtitle: selectedConfig.productId
                    ? t('admin.upsell.productOverrides')
                    : t('admin.upsell.globalConfig'),
                  avatar: { text: selectedConfig.productName || 'G' },
                  onBack: () => setSelectedId(null),
                  backLabel: t('admin.upsell.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openForm(selectedConfig)}>
                        {t('common.edit') || 'Edit'}
                      </Button>
                      {selectedConfig.productId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          disabled={deletingId === selectedConfig.id}
                          onClick={() => handleDelete(selectedConfig.id)}
                          className="text-red-600 hover:text-red-700"
                        />
                      )}
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Status */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-lg p-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">{t('admin.upsell.enabled')}</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {configStatusLabel(selectedConfig, t)}
                      </p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        selectedConfig.isEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {selectedConfig.isEnabled ? t('admin.upsell.enabled') : t('admin.upsell.disabled')}
                    </span>
                  </div>

                  {/* Section toggles */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-1">{t('admin.upsell.showQuantityDiscount')}</h4>
                      <p className={`text-lg font-bold ${selectedConfig.showQuantityDiscount ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {selectedConfig.showQuantityDiscount ? t('admin.upsell.on') : t('admin.upsell.off')}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-1">{t('admin.upsell.showSubscription')}</h4>
                      <p className={`text-lg font-bold ${selectedConfig.showSubscription ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {selectedConfig.showSubscription ? t('admin.upsell.on') : t('admin.upsell.off')}
                      </p>
                    </div>
                  </div>

                  {/* Display rule */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.upsell.displayRule')}</h3>
                    <p className="text-sm font-medium text-sky-700 bg-sky-50 inline-block px-3 py-1 rounded-full">
                      {selectedConfig.displayRule}
                    </p>
                  </div>

                  {/* Custom titles */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-slate-900">{t('admin.upsell.customTitles') || 'Custom Titles'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.upsell.quantityTitle')}</p>
                        <p className="text-sm font-medium text-slate-900">{selectedConfig.quantityTitle || '---'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.upsell.quantitySubtitle')}</p>
                        <p className="text-sm font-medium text-slate-900">{selectedConfig.quantitySubtitle || '---'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.upsell.subscriptionTitle')}</p>
                        <p className="text-sm font-medium text-slate-900">{selectedConfig.subscriptionTitle || '---'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.upsell.subscriptionSubtitle')}</p>
                        <p className="text-sm font-medium text-slate-900">{selectedConfig.subscriptionSubtitle || '---'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Suggested values */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.upsell.suggestedValues') || 'Suggested Values'}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.upsell.suggestedQuantity')}</p>
                        <p className="text-lg font-bold text-slate-900">{selectedConfig.suggestedQuantity || '---'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.upsell.suggestedFrequency')}</p>
                        <p className="text-sm font-medium text-slate-900">{selectedConfig.suggestedFrequency || '---'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Product image if available */}
                  {selectedConfig.productImage && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">{t('admin.upsell.productImage') || 'Product Image'}</h3>
                      <div className="w-24 h-24 bg-slate-100 rounded-lg overflow-hidden">
                        <img
                          src={selectedConfig.productImage}
                          alt={selectedConfig.productName || ''}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="text-xs text-slate-400 pt-2 border-t border-slate-200">
                    <p>ID: {selectedConfig.id}</p>
                    {selectedConfig.productId && <p>{t('admin.upsell.productId')}: {selectedConfig.productId}</p>}
                    {selectedConfig.productSlug && <p>Slug: {selectedConfig.productSlug}</p>}
                    <p>{t('admin.upsell.updated')}: {new Date(selectedConfig.updatedAt).toLocaleString(locale)}</p>
                    <p>{t('admin.upsell.created')}: {new Date(selectedConfig.createdAt).toLocaleString(locale)}</p>
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Zap}
                emptyTitle={t('admin.upsell.noConfig')}
                emptyDescription={t('admin.upsell.noConfigDesc')}
              />
            )
          }
        />
      </div>

      {/* ─── ADD/EDIT MODAL ─────────────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          resetForm();
        }}
        title={editingConfig ? `Edit: ${editingConfig.productName || t('admin.upsell.globalLabel')}` : t('admin.upsell.addOverride')}
        size="lg"
      >
        <div className="space-y-4 p-6">
          {/* Product selector (only for new configs) */}
          {!editingConfig && (
            <FormField label={t('admin.upsell.selectProduct')}>
              <select
                value={formProductId}
                onChange={(e) => setFormProductId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="">{t('admin.upsell.globalLabel')}</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          {/* Enabled toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formEnabled}
                onChange={(e) => setFormEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sky-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500" />
            </label>
            <span className="text-sm font-medium text-slate-700">{t('admin.upsell.enabled')}</span>
          </div>

          {/* Section toggles */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formShowQty}
                  onChange={(e) => setFormShowQty(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sky-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500" />
              </label>
              <span className="text-sm text-slate-700">{t('admin.upsell.showQuantityDiscount')}</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formShowSub}
                  onChange={(e) => setFormShowSub(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sky-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-500" />
              </label>
              <span className="text-sm text-slate-700">{t('admin.upsell.showSubscription')}</span>
            </div>
          </div>

          {/* Display Rule */}
          <FormField label={t('admin.upsell.displayRule')}>
            <select
              value={formDisplayRule}
              onChange={(e) => setFormDisplayRule(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {DISPLAY_RULES.map((rule) => (
                <option key={rule} value={rule}>
                  {t(`admin.upsell.displayRule${rule === 'ALWAYS' ? 'Always' : rule === 'ONCE_PER_SESSION' ? 'OnceSession' : 'OnceProduct'}`)}
                </option>
              ))}
            </select>
          </FormField>

          {/* Custom titles */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.upsell.quantityTitle')}>
              <Input
                value={formQtyTitle}
                onChange={(e) => setFormQtyTitle(e.target.value)}
                placeholder={t('admin.upsell.placeholderBundleTitle')}
              />
            </FormField>
            <FormField label={t('admin.upsell.quantitySubtitle')}>
              <Input
                value={formQtySubtitle}
                onChange={(e) => setFormQtySubtitle(e.target.value)}
                placeholder={t('admin.upsell.placeholderBundleSubtitle')}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.upsell.subscriptionTitle')}>
              <Input
                value={formSubTitle}
                onChange={(e) => setFormSubTitle(e.target.value)}
                placeholder={t('admin.upsell.placeholderSubscriptionTitle')}
              />
            </FormField>
            <FormField label={t('admin.upsell.subscriptionSubtitle')}>
              <Input
                value={formSubSubtitle}
                onChange={(e) => setFormSubSubtitle(e.target.value)}
                placeholder={t('admin.upsell.placeholderSubscriptionSubtitle')}
              />
            </FormField>
          </div>

          {/* Suggested values */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.upsell.suggestedQuantity')}>
              <Input
                type="number"
                value={formSuggestedQty}
                onChange={(e) => setFormSuggestedQty(e.target.value)}
                placeholder="3"
                min={2}
              />
            </FormField>
            <FormField label={t('admin.upsell.suggestedFrequency')}>
              <select
                value={formSuggestedFreq}
                onChange={(e) => setFormSuggestedFreq(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="">---</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <Button
            variant="ghost"
            onClick={() => {
              setShowForm(false);
              resetForm();
            }}
          >
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? (t('common.saving') || 'Saving...') : (t('common.save') || 'Save')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
