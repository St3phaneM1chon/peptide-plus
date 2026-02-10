'use client';

import { useState, useEffect } from 'react';

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  linkUrl?: string;
  buttonText?: string;
  position: 'HERO' | 'PROMO_BAR' | 'CATEGORY' | 'FOOTER';
  startDate?: string;
  endDate?: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
}

const positionLabels: Record<string, { label: string; color: string }> = {
  HERO: { label: 'Hero Banner', color: 'bg-purple-100 text-purple-800' },
  PROMO_BAR: { label: 'Barre promo', color: 'bg-red-100 text-red-800' },
  CATEGORY: { label: 'Catégorie', color: 'bg-blue-100 text-blue-800' },
  FOOTER: { label: 'Footer', color: 'bg-gray-100 text-gray-800' },
};

export default function BannieresPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await fetch('/api/admin/banners');
      const data = await res.json();
      setBanners(data.banners || []);
    } catch (err) {
      console.error('Error fetching banners:', err);
      setBanners([]);
    }
    setLoading(false);
  };

  const toggleActive = (id: string) => {
    setBanners(banners.map(b => b.id === id ? { ...b, isActive: !b.isActive } : b));
  };

  const deleteBanner = (id: string) => {
    if (!confirm('Supprimer cette bannière?')) return;
    setBanners(banners.filter(b => b.id !== id));
  };

  const groupedBanners = {
    HERO: banners.filter(b => b.position === 'HERO'),
    PROMO_BAR: banners.filter(b => b.position === 'PROMO_BAR'),
    CATEGORY: banners.filter(b => b.position === 'CATEGORY'),
    FOOTER: banners.filter(b => b.position === 'FOOTER'),
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
          <h1 className="text-2xl font-bold text-gray-900">Bannières</h1>
          <p className="text-gray-500">Gérez les bannières et promotions du site</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle bannière
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{banners.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Actives</p>
          <p className="text-2xl font-bold text-green-700">{banners.filter(b => b.isActive).length}</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <p className="text-sm text-purple-600">Hero</p>
          <p className="text-2xl font-bold text-purple-700">{groupedBanners.HERO.length}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-600">Promo bars</p>
          <p className="text-2xl font-bold text-red-700">{groupedBanners.PROMO_BAR.length}</p>
        </div>
      </div>

      {/* Banners by Position */}
      {Object.entries(groupedBanners).map(([position, positionBanners]) => (
        <div key={position} className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${positionLabels[position].color}`}>
                {positionLabels[position].label}
              </span>
              <span className="text-gray-500 text-sm">{positionBanners.length} bannière(s)</span>
            </div>
          </div>

          {positionBanners.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {positionBanners.map((banner) => {
                const isScheduled = banner.startDate && new Date(banner.startDate) > new Date();
                const isExpired = banner.endDate && new Date(banner.endDate) < new Date();
                return (
                  <div 
                    key={banner.id} 
                    className={`p-4 flex items-center justify-between ${
                      !banner.isActive || isExpired ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      {banner.imageUrl && (
                        <div className="w-24 h-16 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={banner.imageUrl} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{banner.title}</p>
                        {banner.subtitle && (
                          <p className="text-sm text-gray-500 truncate">{banner.subtitle}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                          {banner.linkUrl && <span>→ {banner.linkUrl}</span>}
                          {isScheduled && <span className="text-blue-500">Programmé</span>}
                          {isExpired && <span className="text-red-500">Expiré</span>}
                          <span>Priorité: {banner.priority}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleActive(banner.id)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${
                          banner.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          banner.isActive ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                      <button
                        onClick={() => setEditingBanner(banner)}
                        className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => deleteBanner(banner.id)}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              Aucune bannière dans cette position
            </div>
          )}
        </div>
      ))}

      {/* Form Modal */}
      {(showForm || editingBanner) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingBanner ? 'Modifier la bannière' : 'Nouvelle bannière'}
            </h2>
            <p className="text-gray-500 mb-4">Fonctionnalité en cours de développement...</p>
            <button
              onClick={() => { setShowForm(false); setEditingBanner(null); }}
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
