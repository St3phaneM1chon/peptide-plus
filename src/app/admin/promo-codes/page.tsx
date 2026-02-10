'use client';

import { useState, useEffect } from 'react';

interface PromoCode {
  id: string;
  code: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  usageCount: number;
  startsAt?: string;
  endsAt?: string;
  firstOrderOnly: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function PromoCodesPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    value: 10,
    minOrderAmount: '',
    maxDiscount: '',
    usageLimit: '',
    usageLimitPerUser: '1',
    startsAt: '',
    endsAt: '',
    firstOrderOnly: false,
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      const res = await fetch('/api/admin/promo-codes');
      const data = await res.json();
      setPromoCodes(data.promoCodes || []);
    } catch (err) {
      console.error('Error fetching promo codes:', err);
      setPromoCodes([]);
    }
    setLoading(false);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const url = editingCode 
        ? `/api/admin/promo-codes/${editingCode.id}` 
        : '/api/admin/promo-codes';
      const method = editingCode ? 'PUT' : 'POST';
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
          maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
          usageLimitPerUser: formData.usageLimitPerUser ? parseInt(formData.usageLimitPerUser) : null,
        }),
      });
      
      await fetchPromoCodes();
      resetForm();
    } catch (err) {
      console.error('Error saving promo code:', err);
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/promo-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      setPromoCodes(promoCodes.map(p => p.id === id ? { ...p, isActive: !isActive } : p));
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const deletePromoCode = async (id: string) => {
    if (!confirm('Supprimer ce code promo ?')) return;
    try {
      await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
      setPromoCodes(promoCodes.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      type: 'PERCENTAGE',
      value: 10,
      minOrderAmount: '',
      maxDiscount: '',
      usageLimit: '',
      usageLimitPerUser: '1',
      startsAt: '',
      endsAt: '',
      firstOrderOnly: false,
    });
    setEditingCode(null);
    setShowForm(false);
  };

  const startEdit = (promo: PromoCode) => {
    setFormData({
      code: promo.code,
      description: promo.description || '',
      type: promo.type,
      value: promo.value,
      minOrderAmount: promo.minOrderAmount?.toString() || '',
      maxDiscount: promo.maxDiscount?.toString() || '',
      usageLimit: promo.usageLimit?.toString() || '',
      usageLimitPerUser: promo.usageLimitPerUser?.toString() || '',
      startsAt: promo.startsAt ? promo.startsAt.slice(0, 16) : '',
      endsAt: promo.endsAt ? promo.endsAt.slice(0, 16) : '',
      firstOrderOnly: promo.firstOrderOnly,
    });
    setEditingCode(promo);
    setShowForm(true);
  };

  const stats = {
    total: promoCodes.length,
    active: promoCodes.filter(p => p.isActive).length,
    totalUsage: promoCodes.reduce((sum, p) => sum + p.usageCount, 0),
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
          <h1 className="text-2xl font-bold text-gray-900">Codes Promo</h1>
          <p className="text-gray-500">Gérez vos codes promotionnels</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouveau code
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total codes</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Actifs</p>
          <p className="text-2xl font-bold text-green-700">{stats.active}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">Utilisations totales</p>
          <p className="text-2xl font-bold text-amber-700">{stats.totalUsage}</p>
        </div>
      </div>

      {/* Promo Codes List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Réduction</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Conditions</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Utilisations</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Validité</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {promoCodes.map((promo) => {
              const isExpired = promo.endsAt && new Date(promo.endsAt) < new Date();
              const usageFull = promo.usageLimit && promo.usageCount >= promo.usageLimit;
              return (
                <tr key={promo.id} className={`hover:bg-gray-50 ${!promo.isActive || isExpired || usageFull ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-gray-900">{promo.code}</p>
                    {promo.description && (
                      <p className="text-xs text-gray-500">{promo.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-amber-600">
                      {promo.type === 'PERCENTAGE' ? `${promo.value}%` : `${promo.value} $`}
                    </span>
                    {promo.maxDiscount && (
                      <p className="text-xs text-gray-500">Max: {promo.maxDiscount} $</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {promo.minOrderAmount && (
                      <p>Min: {promo.minOrderAmount} $</p>
                    )}
                    {promo.firstOrderOnly && (
                      <p className="text-blue-600">1ère commande</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-gray-900">{promo.usageCount}</span>
                    {promo.usageLimit && (
                      <span className="text-gray-400"> / {promo.usageLimit}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {promo.startsAt || promo.endsAt ? (
                      <>
                        {promo.startsAt && <p className="text-gray-500">Du: {new Date(promo.startsAt).toLocaleDateString('fr-CA')}</p>}
                        {promo.endsAt && <p className={isExpired ? 'text-red-500' : 'text-gray-500'}>Au: {new Date(promo.endsAt).toLocaleDateString('fr-CA')}</p>}
                      </>
                    ) : (
                      <span className="text-gray-400">Illimité</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
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
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => startEdit(promo)}
                        className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => deletePromoCode(promo.id)}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {promoCodes.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Aucun code promo. Créez votre premier code.
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCode ? 'Modifier le code' : 'Nouveau code promo'}
              </h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: SUMMER25"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg uppercase"
                  />
                  <button
                    type="button"
                    onClick={generateCode}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Générer
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description interne"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="PERCENTAGE">Pourcentage (%)</option>
                    <option value="FIXED_AMOUNT">Montant fixe ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valeur *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum commande ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    placeholder="Ex: 100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Réduction max ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                    placeholder="Pour les %"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limite totale</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    placeholder="Illimité"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limite par client</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.usageLimitPerUser}
                    onChange={(e) => setFormData({ ...formData, usageLimitPerUser: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date début</label>
                  <input
                    type="datetime-local"
                    value={formData.startsAt}
                    onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input
                    type="datetime-local"
                    value={formData.endsAt}
                    onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.firstOrderOnly}
                  onChange={(e) => setFormData({ ...formData, firstOrderOnly: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-amber-500"
                />
                <span className="text-sm text-gray-700">Première commande uniquement</span>
              </label>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : editingCode ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
