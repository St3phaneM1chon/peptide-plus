'use client';

import { useState, useEffect } from 'react';

interface LoyaltyTier {
  name: string;
  minPoints: number;
  multiplier: number;
  perks: string[];
  color: string;
}

interface LoyaltyConfig {
  pointsPerDollar: number;
  pointsValue: number;
  minRedemption: number;
  referralBonus: number;
  birthdayBonus: number;
  tiers: LoyaltyTier[];
}

export default function FidelitePage() {
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTier, setEditingTier] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/loyalty/config');
      const data = await res.json();
      setConfig(data.config || null);
    } catch (err) {
      console.error('Error fetching loyalty config:', err);
      setConfig(null);
    }
    setLoading(false);
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/loyalty/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      alert('Configuration sauvegardée!');
    } catch (err) {
      console.error('Error saving config:', err);
    }
    setSaving(false);
  };

  const tierColors: Record<string, string> = {
    orange: 'bg-orange-100 text-orange-800 border-orange-300',
    gray: 'bg-gray-200 text-gray-700 border-gray-400',
    yellow: 'bg-yellow-100 text-yellow-800 border-yellow-400',
    blue: 'bg-blue-100 text-blue-800 border-blue-400',
    purple: 'bg-purple-100 text-purple-800 border-purple-400',
  };

  if (loading || !config) {
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
          <h1 className="text-2xl font-bold text-gray-900">Programme de fidélité</h1>
          <p className="text-gray-500">Configurez les règles du programme de récompenses</p>
        </div>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Basic Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Paramètres de base</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Points par dollar</label>
            <input
              type="number"
              value={config.pointsPerDollar}
              onChange={(e) => setConfig({ ...config, pointsPerDollar: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Niveau Bronze</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valeur du point ($)</label>
            <input
              type="number"
              step="0.001"
              value={config.pointsValue}
              onChange={(e) => setConfig({ ...config, pointsValue: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">1 point = {config.pointsValue} $</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min. échange (pts)</label>
            <input
              type="number"
              value={config.minRedemption}
              onChange={(e) => setConfig({ ...config, minRedemption: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">= {(config.minRedemption * config.pointsValue).toFixed(2)} $</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bonus parrainage</label>
            <input
              type="number"
              value={config.referralBonus}
              onChange={(e) => setConfig({ ...config, referralBonus: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Pour parrain et filleul</p>
          </div>
        </div>
      </div>

      {/* Special Bonuses */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Bonus spéciaux</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bonus anniversaire</label>
            <input
              type="number"
              value={config.birthdayBonus}
              onChange={(e) => setConfig({ ...config, birthdayBonus: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Points offerts</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bonus 1ère commande</label>
            <input
              type="number"
              defaultValue={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Points offerts</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bonus avis produit</label>
            <input
              type="number"
              defaultValue={50}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Par avis laissé</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bonus inscription</label>
            <input
              type="number"
              defaultValue={200}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Points de bienvenue</p>
          </div>
        </div>
      </div>

      {/* Tiers */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Niveaux de fidélité</h3>
          <button className="text-sm text-amber-600 hover:text-amber-700">
            + Ajouter un niveau
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {config.tiers.map((tier) => (
            <div 
              key={tier.name}
              className={`rounded-xl border-2 p-4 ${tierColors[tier.color]}`}
            >
              <div className="text-center mb-3">
                <h4 className="font-bold text-lg">{tier.name}</h4>
                <p className="text-sm opacity-75">{tier.minPoints.toLocaleString()}+ pts</p>
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                  <span>Multiplicateur:</span>
                  <span className="font-bold">{tier.multiplier}x</span>
                </div>
                <div className="text-sm">
                  <span>{config.pointsPerDollar * tier.multiplier} pts/$</span>
                </div>
              </div>
              
              <div className="pt-3 border-t border-current/20">
                <p className="text-xs font-semibold mb-1">Avantages:</p>
                <ul className="text-xs space-y-1">
                  {tier.perks.map((perk, i) => (
                    <li key={i} className="flex items-start gap-1">
                      <span>✓</span>
                      <span>{perk}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <button 
                onClick={() => setEditingTier(tier.name)}
                className="w-full mt-3 text-xs py-1 bg-white/50 rounded hover:bg-white/70"
              >
                Modifier
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Simulation */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
        <h3 className="font-semibold text-amber-900 mb-4">Simulation</h3>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-amber-800 mb-1">Montant d'achat</label>
            <input
              type="number"
              defaultValue={100}
              className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-amber-800 mb-1">Niveau client</label>
            <select className="w-full px-3 py-2 border border-amber-300 rounded-lg bg-white">
              {config.tiers.map(t => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="bg-white rounded-lg p-4 text-center">
            <p className="text-sm text-amber-600">Points gagnés</p>
            <p className="text-3xl font-bold text-amber-900">1,000</p>
            <p className="text-xs text-amber-600">= 10.00 $ de réduction</p>
          </div>
        </div>
      </div>

      {/* Edit Tier Modal */}
      {editingTier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Modifier {editingTier}</h2>
            <p className="text-gray-500 mb-4">Fonctionnalité en cours de développement...</p>
            <button
              onClick={() => setEditingTier(null)}
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
