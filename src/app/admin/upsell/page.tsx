'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Zap, Package, RefreshCw } from 'lucide-react';
import { PageHeader, Button, Modal, StatCard, EmptyState, FormField, Input } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

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

export default function UpsellAdminPage() {
  const { t } = useI18n();
  const [configs, setConfigs] = useState<UpsellConfigItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState<UpsellConfigItem | null>(null);

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

    try {
      const res = await fetch(`/api/admin/upsell-config?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');

      toast.success(t('admin.upsell.deleteSuccess'));
      fetchConfigs();
    } catch {
      toast.error(t('toast.admin.upsellDeleteError'));
    }
  };

  const globalConfig = configs.find((c) => !c.productId);
  const productConfigs = configs.filter((c) => c.productId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.upsell.title')}
        subtitle={t('admin.upsell.subtitle')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => openForm()}>
            {t('admin.upsell.addOverride')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title={t('admin.upsell.activeConfigs')}
          value={configs.filter((c) => c.isEnabled).length}
          icon={<Zap className="w-5 h-5 text-sky-500" />}
        />
        <StatCard
          title={t('admin.upsell.productOverrideCount')}
          value={productConfigs.length}
          icon={<Package className="w-5 h-5 text-orange-500" />}
        />
        <StatCard
          title={t('admin.upsell.globalStatus')}
          value={globalConfig?.isEnabled ? t('admin.upsell.enabled') : t('admin.upsell.disabled')}
          icon={<RefreshCw className="w-5 h-5 text-green-500" />}
        />
      </div>

      {/* Global Config Card */}
      {globalConfig ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg text-slate-800">{t('admin.upsell.globalConfig')}</h3>
              <p className="text-sm text-slate-500">{t('admin.upsell.globalLabel')}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  globalConfig.isEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {globalConfig.isEnabled ? t('admin.upsell.enabled') : t('admin.upsell.disabled')}
              </span>
              <button
                onClick={() => openForm(globalConfig)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title={t('common.edit')}
              >
                <Pencil className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500">{t('admin.upsell.showQuantityDiscount')}</span>
              <p className="font-medium">{globalConfig.showQuantityDiscount ? '✓' : '✗'}</p>
            </div>
            <div>
              <span className="text-slate-500">{t('admin.upsell.showSubscription')}</span>
              <p className="font-medium">{globalConfig.showSubscription ? '✓' : '✗'}</p>
            </div>
            <div>
              <span className="text-slate-500">{t('admin.upsell.displayRule')}</span>
              <p className="font-medium">{globalConfig.displayRule}</p>
            </div>
            <div>
              <span className="text-slate-500">{t('admin.upsell.suggestedQuantity')}</span>
              <p className="font-medium">{globalConfig.suggestedQuantity || '—'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <EmptyState
            title={t('admin.upsell.noConfig')}
            description={t('admin.upsell.noConfigDesc')}
            action={
              <Button variant="primary" icon={Plus} onClick={() => openForm()}>
                {t('admin.upsell.globalConfig')}
              </Button>
            }
          />
        </div>
      )}

      {/* Product Overrides */}
      {productConfigs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-800">{t('admin.upsell.productOverrides')}</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {productConfigs.map((config) => (
              <div key={config.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {config.productImage && (
                    <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden">
                      <img
                        src={config.productImage}
                        alt={config.productName || ''}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-slate-800">{config.productName || config.productId}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>
                        {t('admin.upsell.showQuantityDiscount')}: {config.showQuantityDiscount ? '✓' : '✗'}
                      </span>
                      <span>
                        {t('admin.upsell.showSubscription')}: {config.showSubscription ? '✓' : '✗'}
                      </span>
                      <span>{config.displayRule}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      config.isEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {config.isEnabled ? t('admin.upsell.enabled') : t('admin.upsell.disabled')}
                  </span>
                  <button
                    onClick={() => openForm(config)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-slate-500" />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
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
                <option value="">—</option>
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
