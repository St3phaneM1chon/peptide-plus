'use client';

import { useState, useEffect } from 'react';

interface Ambassador {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  referralCode: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  commissionRate: number;
  totalReferrals: number;
  totalSales: number;
  totalEarnings: number;
  pendingPayout: number;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  joinedAt: string;
}

const tierConfig: Record<string, { color: string; commission: number; minSales: number }> = {
  BRONZE: { color: 'bg-orange-100 text-orange-800', commission: 5, minSales: 0 },
  SILVER: { color: 'bg-gray-200 text-gray-700', commission: 8, minSales: 1000 },
  GOLD: { color: 'bg-yellow-100 text-yellow-800', commission: 10, minSales: 5000 },
  PLATINUM: { color: 'bg-blue-100 text-blue-800', commission: 15, minSales: 15000 },
};

export default function AmbassadeursPage() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', tier: '', search: '' });
  const [selectedAmbassador, setSelectedAmbassador] = useState<Ambassador | null>(null);
  const [, setShowApplications] = useState(false);

  useEffect(() => {
    fetchAmbassadors();
  }, []);

  const fetchAmbassadors = async () => {
    setAmbassadors([]);
    setLoading(false);
  };

  const updateStatus = (id: string, status: 'ACTIVE' | 'SUSPENDED') => {
    setAmbassadors(ambassadors.map(a => a.id === id ? { ...a, status } : a));
  };

  const processPayout = (id: string) => {
    alert(`Paiement traité pour l'ambassadeur #${id}`);
    setAmbassadors(ambassadors.map(a => a.id === id ? { ...a, pendingPayout: 0 } : a));
  };

  const filteredAmbassadors = ambassadors.filter(amb => {
    if (filter.status && amb.status !== filter.status) return false;
    if (filter.tier && amb.tier !== filter.tier) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!amb.userName.toLowerCase().includes(search) &&
          !amb.userEmail.toLowerCase().includes(search) &&
          !amb.referralCode.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: ambassadors.filter(a => a.status === 'ACTIVE').length,
    totalSales: ambassadors.reduce((sum, a) => sum + a.totalSales, 0),
    totalCommissions: ambassadors.reduce((sum, a) => sum + a.totalEarnings, 0),
    pendingPayouts: ambassadors.reduce((sum, a) => sum + a.pendingPayout, 0),
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
          <h1 className="text-2xl font-bold text-gray-900">Programme Ambassadeur</h1>
          <p className="text-gray-500">Gérez vos ambassadeurs et affiliés</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowApplications(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">1</span>
            Candidatures
          </button>
          <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
            Configurer le programme
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Ambassadeurs actifs</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Ventes générées</p>
          <p className="text-2xl font-bold text-green-700">{stats.totalSales.toLocaleString()} $</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">Commissions versées</p>
          <p className="text-2xl font-bold text-amber-700">{stats.totalCommissions.toLocaleString()} $</p>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
          <p className="text-sm text-purple-600">Paiements en attente</p>
          <p className="text-2xl font-bold text-purple-700">{stats.pendingPayouts.toFixed(2)} $</p>
        </div>
      </div>

      {/* Tiers Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Niveaux de commission</h3>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(tierConfig).map(([tier, config]) => (
            <div key={tier} className={`p-3 rounded-lg ${config.color}`}>
              <p className="font-bold">{tier}</p>
              <p className="text-sm">{config.commission}% commission</p>
              <p className="text-xs opacity-75">{config.minSales > 0 ? `${config.minSales}$+ ventes` : 'Niveau de base'}</p>
            </div>
          ))}
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
            <option value="PENDING">En attente</option>
            <option value="SUSPENDED">Suspendu</option>
          </select>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.tier}
            onChange={(e) => setFilter({ ...filter, tier: e.target.value })}
          >
            <option value="">Tous les niveaux</option>
            <option value="BRONZE">Bronze</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="PLATINUM">Platinum</option>
          </select>
        </div>
      </div>

      {/* Ambassadors List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Ambassadeur</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Niveau</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ventes</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Gains</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">En attente</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredAmbassadors.map((amb) => (
              <tr key={amb.id} className={`hover:bg-gray-50 ${amb.status !== 'ACTIVE' ? 'opacity-60' : ''}`}>
                <td className="px-4 py-4">
                  <p className="font-medium text-gray-900">{amb.userName}</p>
                  <p className="text-xs text-gray-500">{amb.userEmail}</p>
                  <p className="text-xs text-gray-400">{amb.totalReferrals} parrainages</p>
                </td>
                <td className="px-4 py-4">
                  <code className="font-mono font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    {amb.referralCode}
                  </code>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${tierConfig[amb.tier].color}`}>
                    {amb.tier} ({amb.commissionRate}%)
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-medium text-gray-900">
                  {amb.totalSales.toLocaleString()} $
                </td>
                <td className="px-4 py-4 text-right text-gray-600">
                  {amb.totalEarnings.toFixed(2)} $
                </td>
                <td className="px-4 py-4 text-right">
                  {amb.pendingPayout > 0 ? (
                    <span className="text-purple-600 font-medium">{amb.pendingPayout.toFixed(2)} $</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {amb.status === 'PENDING' && (
                      <button
                        onClick={() => updateStatus(amb.id, 'ACTIVE')}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                      >
                        Approuver
                      </button>
                    )}
                    {amb.pendingPayout > 0 && (
                      <button
                        onClick={() => processPayout(amb.id)}
                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                      >
                        Payer
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedAmbassador(amb)}
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
        
        {filteredAmbassadors.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Aucun ambassadeur trouvé
          </div>
        )}
      </div>

      {/* Ambassador Detail Modal */}
      {selectedAmbassador && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{selectedAmbassador.userName}</h3>
              <button onClick={() => setSelectedAmbassador(null)} className="p-1 hover:bg-gray-100 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Code de parrainage</p>
                  <code className="font-mono font-bold text-lg">{selectedAmbassador.referralCode}</code>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Niveau</p>
                  <span className={`px-2 py-1 rounded-full text-sm font-medium ${tierConfig[selectedAmbassador.tier].color}`}>
                    {selectedAmbassador.tier}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Commission</p>
                  <p className="font-bold">{selectedAmbassador.commissionRate}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Parrainages</p>
                  <p className="font-bold">{selectedAmbassador.totalReferrals}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ventes générées</p>
                  <p className="font-bold">{selectedAmbassador.totalSales.toLocaleString()} $</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Gains totaux</p>
                  <p className="font-bold">{selectedAmbassador.totalEarnings.toFixed(2)} $</p>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {selectedAmbassador.status === 'ACTIVE' ? (
                  <button
                    onClick={() => updateStatus(selectedAmbassador.id, 'SUSPENDED')}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    Suspendre
                  </button>
                ) : (
                  <button
                    onClick={() => updateStatus(selectedAmbassador.id, 'ACTIVE')}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                  >
                    Activer
                  </button>
                )}
                <button className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 ml-auto">
                  Modifier la commission
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
