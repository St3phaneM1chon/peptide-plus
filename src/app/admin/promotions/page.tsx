'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Percent, Zap, Package } from 'lucide-react';
import { PageHeader, Button, Modal, EmptyState, StatusBadge } from '@/components/admin';

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

const typeLabels: Record<string, { label: string; variant: 'info' | 'primary' | 'success' | 'warning' | 'error' }> = {
  PRODUCT_DISCOUNT: { label: 'Reduction produit', variant: 'info' },
  CATEGORY_DISCOUNT: { label: 'Reduction categorie', variant: 'primary' },
  BUNDLE: { label: 'Bundle', variant: 'success' },
  BUY_X_GET_Y: { label: 'X achete = Y offert', variant: 'warning' },
  FLASH_SALE: { label: 'Vente flash', variant: 'error' },
};

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [, setEditingPromo] = useState<Promotion | null>(null);

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
  };

  const deletePromotion = async (id: string) => {
    if (!confirm('Supprimer cette promotion ?')) return;
    setPromotions(promotions.filter((p) => p.id !== id));
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
        title="Promotions"
        subtitle="Creez des offres speciales et promotions automatiques"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
            Nouvelle promotion
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <MiniStat icon={Percent} label="Total" value={promotions.length} bg="bg-slate-100 text-slate-600" />
        <MiniStat icon={Percent} label="Actives" value={promotions.filter((p) => p.isActive).length} bg="bg-emerald-100 text-emerald-600" />
        <MiniStat icon={Zap} label="Ventes flash" value={promotions.filter((p) => p.type === 'FLASH_SALE').length} bg="bg-red-100 text-red-600" />
        <MiniStat icon={Package} label="Bundles" value={promotions.filter((p) => p.type === 'BUNDLE').length} bg="bg-sky-100 text-sky-600" />
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
                    {isExpired && <StatusBadge variant="neutral">Expiree</StatusBadge>}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    <div>
                      <span className="font-medium">Reduction: </span>
                      <span className="text-sky-600 font-bold">
                        {promo.discountType === 'PERCENTAGE' ? `${promo.discountValue}%` : `${promo.discountValue} $`}
                      </span>
                    </div>

                    {promo.type === 'BUY_X_GET_Y' && (
                      <div>
                        <span className="font-medium">
                          Achetez {promo.buyQuantity}, obtenez {promo.getQuantity} gratuit
                        </span>
                      </div>
                    )}

                    <div>
                      <span className="font-medium">Priorite: </span>
                      <span>{promo.priority}</span>
                    </div>

                    <div>
                      <span className="font-medium">Validite: </span>
                      <span>
                        {new Date(promo.startsAt).toLocaleDateString('fr-CA')}
                        {promo.endsAt && ` - ${new Date(promo.endsAt).toLocaleDateString('fr-CA')}`}
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
                    Modifier
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
            title="Aucune promotion"
            description="Creez votre premiere promotion."
            action={
              <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>
                Nouvelle promotion
              </Button>
            }
          />
        )}
      </div>

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nouvelle promotion">
        <p className="text-slate-500 mb-4">Fonctionnalite en cours de developpement...</p>
        <Button variant="secondary" onClick={() => setShowForm(false)}>
          Fermer
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
