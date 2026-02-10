'use client';

import { useState, useEffect } from 'react';

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

const typeLabels: Record<string, { label: string; color: string }> = {
  PRODUCT_DISCOUNT: { label: 'Réduction produit', color: 'bg-blue-100 text-blue-800' },
  CATEGORY_DISCOUNT: { label: 'Réduction catégorie', color: 'bg-purple-100 text-purple-800' },
  BUNDLE: { label: 'Bundle', color: 'bg-green-100 text-green-800' },
  BUY_X_GET_Y: { label: 'X acheté = Y offert', color: 'bg-amber-100 text-amber-800' },
  FLASH_SALE: { label: 'Vente flash', color: 'bg-red-100 text-red-800' },
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
    setPromotions(promotions.map(p => p.id === id ? { ...p, isActive: !isActive } : p));
  };

  const deletePromotion = async (id: string) => {
    if (!confirm('Supprimer cette promotion ?')) return;
    setPromotions(promotions.filter(p => p.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promotions</h1>
          <p className="text-gray-500">Créez des offres spéciales et promotions automatiques</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle promotion
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{promotions.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Actives</p>
          <p className="text-2xl font-bold text-green-700">{promotions.filter(p => p.isActive).length}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-600">Ventes flash</p>
          <p className="text-2xl font-bold text-red-700">{promotions.filter(p => p.type === 'FLASH_SALE').length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">Bundles</p>
          <p className="text-2xl font-bold text-amber-700">{promotions.filter(p => p.type === 'BUNDLE').length}</p>
        </div>
      </div>

      {/* Promotions List */}
      <div className="space-y-4">
        {promotions.map((promo) => {
          const isExpired = promo.endsAt && new Date(promo.endsAt) < new Date();
          return (
            <div 
              key={promo.id} 
              className={`bg-white rounded-xl border border-gray-200 p-6 ${!promo.isActive || isExpired ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-gray-900 text-lg">{promo.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeLabels[promo.type].color}`}>
                      {typeLabels[promo.type].label}
                    </span>
                    {isExpired && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Expirée
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Réduction: </span>
                      <span className="text-amber-600 font-bold">
                        {promo.discountType === 'PERCENTAGE' 
                          ? `${promo.discountValue}%` 
                          : `${promo.discountValue} $`
                        }
                      </span>
                    </div>
                    
                    {promo.type === 'BUY_X_GET_Y' && (
                      <div>
                        <span className="font-medium">Achetez {promo.buyQuantity}, obtenez {promo.getQuantity} gratuit</span>
                      </div>
                    )}
                    
                    <div>
                      <span className="font-medium">Priorité: </span>
                      <span>{promo.priority}</span>
                    </div>
                    
                    <div>
                      <span className="font-medium">Validité: </span>
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
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      promo.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      promo.isActive ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                  <button
                    onClick={() => setEditingPromo(promo)}
                    className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => deletePromotion(promo.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {promotions.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            Aucune promotion. Créez votre première promotion.
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Nouvelle promotion</h2>
            <p className="text-gray-500 mb-4">Fonctionnalité en cours de développement...</p>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
