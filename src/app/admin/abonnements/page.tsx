'use client';

import { useState, useEffect } from 'react';

interface Subscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  productName: string;
  formatName: string;
  quantity: number;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY';
  price: number;
  discount: number;
  nextDelivery: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  createdAt: string;
}

const frequencyLabels: Record<string, string> = {
  WEEKLY: 'Hebdomadaire',
  BIWEEKLY: 'Toutes les 2 semaines',
  MONTHLY: 'Mensuel',
  BIMONTHLY: 'Tous les 2 mois',
};

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  PAUSED: 'bg-yellow-100 text-yellow-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export default function AbonnementsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', search: '' });
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/admin/subscriptions');
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setSubscriptions([]);
    }
    setLoading(false);
  };

  const updateStatus = (id: string, status: 'ACTIVE' | 'PAUSED' | 'CANCELLED') => {
    setSubscriptions(subscriptions.map(s => s.id === id ? { ...s, status } : s));
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (filter.status && sub.status !== filter.status) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!sub.userName.toLowerCase().includes(search) &&
          !sub.userEmail.toLowerCase().includes(search) &&
          !sub.productName.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    active: subscriptions.filter(s => s.status === 'ACTIVE').length,
    paused: subscriptions.filter(s => s.status === 'PAUSED').length,
    monthlyRevenue: subscriptions.filter(s => s.status === 'ACTIVE').reduce((sum, s) => {
      const multiplier = s.frequency === 'WEEKLY' ? 4 : s.frequency === 'BIWEEKLY' ? 2 : s.frequency === 'MONTHLY' ? 1 : 0.5;
      return sum + (s.price * (1 - s.discount / 100) * multiplier);
    }, 0),
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
          <h1 className="text-2xl font-bold text-gray-900">Abonnements</h1>
          <p className="text-gray-500">Gérez les abonnements récurrents</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
          Configurer les options
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{subscriptions.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Actifs</p>
          <p className="text-2xl font-bold text-green-700">{stats.active}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">En pause</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.paused}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">Revenu mensuel estimé</p>
          <p className="text-2xl font-bold text-amber-700">{stats.monthlyRevenue.toFixed(0)} $</p>
        </div>
      </div>

      {/* Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Configuration des abonnements</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <p className="font-bold text-lg">15%</p>
            <p className="text-sm text-gray-500">Réduction abonnés</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <p className="font-bold text-lg">GRATUITE</p>
            <p className="text-sm text-gray-500">Livraison abonnés</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <p className="font-bold text-lg">3 jours</p>
            <p className="text-sm text-gray-500">Rappel avant livraison</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <p className="font-bold text-lg">1 pause/an</p>
            <p className="text-sm text-gray-500">Pause autorisée</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Rechercher..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">Tous les statuts</option>
            <option value="ACTIVE">Actif</option>
            <option value="PAUSED">En pause</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produit</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fréquence</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Prix</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Prochaine livraison</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredSubscriptions.map((sub) => (
              <tr key={sub.id} className={`hover:bg-gray-50 ${sub.status !== 'ACTIVE' ? 'opacity-60' : ''}`}>
                <td className="px-4 py-4">
                  <p className="font-medium text-gray-900">{sub.userName}</p>
                  <p className="text-xs text-gray-500">{sub.userEmail}</p>
                </td>
                <td className="px-4 py-4">
                  <p className="font-medium text-gray-900">{sub.productName}</p>
                  <p className="text-xs text-gray-500">{sub.formatName} × {sub.quantity}</p>
                </td>
                <td className="px-4 py-4 text-gray-600">
                  {frequencyLabels[sub.frequency]}
                </td>
                <td className="px-4 py-4 text-right">
                  <p className="font-medium text-gray-900">{(sub.price * (1 - sub.discount / 100)).toFixed(2)} $</p>
                  <p className="text-xs text-green-600">-{sub.discount}%</p>
                </td>
                <td className="px-4 py-4 text-gray-600">
                  {sub.status === 'ACTIVE' 
                    ? new Date(sub.nextDelivery).toLocaleDateString('fr-CA')
                    : '-'
                  }
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[sub.status]}`}>
                    {sub.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {sub.status === 'ACTIVE' && (
                      <button
                        onClick={() => updateStatus(sub.id, 'PAUSED')}
                        className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200"
                      >
                        Pause
                      </button>
                    )}
                    {sub.status === 'PAUSED' && (
                      <button
                        onClick={() => updateStatus(sub.id, 'ACTIVE')}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Reprendre
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedSub(sub)}
                      className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200"
                    >
                      Détails
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredSubscriptions.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Aucun abonnement trouvé
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Détails de l'abonnement</h3>
              <button onClick={() => setSelectedSub(null)} className="p-1 hover:bg-gray-100 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Client</p>
                  <p className="font-medium">{selectedSub.userName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statut</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedSub.status]}`}>
                    {selectedSub.status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Produit</p>
                  <p className="font-medium">{selectedSub.productName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Format</p>
                  <p className="font-medium">{selectedSub.formatName} × {selectedSub.quantity}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fréquence</p>
                  <p className="font-medium">{frequencyLabels[selectedSub.frequency]}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Prix</p>
                  <p className="font-medium">{(selectedSub.price * (1 - selectedSub.discount / 100)).toFixed(2)} $</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Créé le</p>
                  <p className="font-medium">{new Date(selectedSub.createdAt).toLocaleDateString('fr-CA')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Prochaine livraison</p>
                  <p className="font-medium">
                    {selectedSub.status === 'ACTIVE' 
                      ? new Date(selectedSub.nextDelivery).toLocaleDateString('fr-CA')
                      : '-'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {selectedSub.status !== 'CANCELLED' && (
                  <button
                    onClick={() => { updateStatus(selectedSub.id, 'CANCELLED'); setSelectedSub(null); }}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    Annuler
                  </button>
                )}
                <button className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 ml-auto">
                  Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
