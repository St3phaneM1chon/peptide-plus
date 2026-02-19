'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Percent, Zap, Package } from 'lucide-react';
import { PageHeader, Button, Modal, EmptyState, StatusBadge } from '@/components/admin';
import { useI18n } from '@/i18n/client';

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

export default function PromotionsPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [, setEditingPromo] = useState<Promotion | null>(null);

  const typeLabels: Record<string, { label: string; variant: 'info' | 'primary' | 'success' | 'warning' | 'error' }> = {
    PRODUCT_DISCOUNT: { label: t('admin.promotions.typeProductDiscount'), variant: 'info' },
    CATEGORY_DISCOUNT: { label: t('admin.promotions.typeCategoryDiscount'), variant: 'primary' },
    BUNDLE: { label: t('admin.promotions.typeBundle'), variant: 'success' },
    BUY_X_GET_Y: { label: t('admin.promotions.typeBuyXGetY'), variant: 'warning' },
    FLASH_SALE: { label: t('admin.promotions.typeFlashSale'), variant: 'error' },
  };

  useEffect(() => {
    fetchPromotions();
  }, []);

  const fetchPromotions = async () => {
    try {
      const res = await fetch('/api/admin/promotions');
      const data = await res.json();
      setPromotions(data.promotions || []);
    } catch (err) {
      setPromotions([]);
    }
    setLoading(false);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    setPromotions(promotions.map((p) => (p.id === id ? { ...p, isActive: !isActive } : p)));
    try {
      await fetch(`/api/admin/promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
    } catch {
      // Revert on failure
      setPromotions(promotions.map((p) => (p.id === id ? { ...p, isActive } : p)));
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm(t('admin.promotions.confirmDelete'))) return;
    const prev = promotions;
    setPromotions(promotions.filter((p) => p.id !== id));
    try {
      await fetch(`/api/admin/promotions/${id}`, { method: 'DELETE' });
    } catch {
      // Revert on failure
      setPromotions(prev);
    }
  };

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
        title={t('admin.promotions.title')}
        subtitle={t('admin.promotions.subtitle')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
            {t('admin.promotions.newPromotion')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat icon={Percent} label={t('admin.promotions.statTotal')} value={promotions.length} bg="bg-slate-100 text-slate-600" />
        <MiniStat icon={Percent} label={t('admin.promotions.statActive')} value={promotions.filter((p) => p.isActive).length} bg="bg-emerald-100 text-emerald-600" />
        <MiniStat icon={Zap} label={t('admin.promotions.statFlashSales')} value={promotions.filter((p) => p.type === 'FLASH_SALE').length} bg="bg-red-100 text-red-600" />
        <MiniStat icon={Package} label={t('admin.promotions.statBundles')} value={promotions.filter((p) => p.type === 'BUNDLE').length} bg="bg-sky-100 text-sky-600" />
      </div>

      {/* Promotions List */}
      <div className="space-y-4">
        {promotions.map((promo) => {
          const isExpired = promo.endsAt && new Date(promo.endsAt) < new Date();
          return (
            <div
              key={promo.id}
              className={`bg-white rounded-xl border border-slate-200 p-6 ${!promo.isActive || isExpired ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-slate-900 text-lg">{promo.name}</h3>
                    <StatusBadge variant={typeLabels[promo.type].variant}>
                      {typeLabels[promo.type].label}
                    </StatusBadge>
                    {isExpired && <StatusBadge variant="neutral">{t('admin.promotions.expired')}</StatusBadge>}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <div>
                      <span className="font-medium">{t('admin.promotions.discount')} </span>
                      <span className="text-sky-600 font-bold">
                        {promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}%` : formatCurrency(promo.discountValue)}
                      </span>
                    </div>

                    {promo.type === 'BUY_X_GET_Y' && (
                      <div>
                        <span className="font-medium">
                          {t('admin.promotions.buyXGetY', { buyQty: promo.buyQuantity ?? 0, getQty: promo.getQuantity ?? 0 })}
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="font-medium">{t('admin.promotions.priority')} </span>
                      <span>{promo.priority}</span>
                    </div>

                    <div>
                      <span className="font-medium">{t('admin.promotions.validity')} </span>
                      <span>
                        {new Date(promo.startsAt).toLocaleDateString(locale)}
                        {promo.endsAt && ` - ${new Date(promo.endsAt).toLocaleDateString(locale)}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(promo.id, promo.isActive)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${promo.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${promo.isActive ? 'right-1' : 'left-1'}`} />
                  </button>
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditingPromo(promo)}>
                    {t('admin.promotions.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" icon={Trash2} onClick={() => deletePromotion(promo.id)} className="text-slate-400 hover:text-red-600" />
                </div>
              </div>
            </div>
          );
        })}

        {promotions.length === 0 && (
          <EmptyState
            icon={Percent}
            title={t('admin.promotions.emptyTitle')}
            description={t('admin.promotions.emptyDescription')}
            action={
              <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
                {t('admin.promotions.newPromotion')}
              </Button>
            }
          />
        )}
      </div>

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={t('admin.promotions.modalTitle')}>
        <p className="text-slate-500 mb-4">{t('admin.promotions.featureInDevelopment')}</p>
        <Button variant="secondary" onClick={() => setShowForm(false)}>
          {t('admin.promotions.close')}
        </Button>
      </Modal>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; bg: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
