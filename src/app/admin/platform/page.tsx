'use client';

/**
 * Super-Admin Platform Dashboard
 * Visible only to Attitudes OWNER users.
 * Manages all Koraline tenants: list, create, configure, monitor.
 */

import { useState, useEffect, useCallback } from 'react';

interface TenantStats {
  users: number;
  orders: number;
  products: number;
}

interface Tenant {
  id: string;
  slug: string;
  name: string;
  domainCustom: string | null;
  domainKoraline: string | null;
  domainVerified: boolean;
  plan: string;
  status: string;
  primaryColor: string;
  logoUrl: string | null;
  createdAt: string;
  stats: TenantStats;
}

export default function PlatformDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTenant, setNewTenant] = useState({ slug: '', name: '', plan: 'essential', domainCustom: '' });
  const [creating, setCreating] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platform/tenants');
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch('/api/admin/platform/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTenant),
      });
      if (res.ok) {
        setShowCreateForm(false);
        setNewTenant({ slug: '', name: '', plan: 'essential', domainCustom: '' });
        fetchTenants();
      }
    } catch {
      // Error handled silently
    } finally {
      setCreating(false);
    }
  };

  const planColors: Record<string, string> = {
    essential: 'bg-blue-100 text-blue-800',
    pro: 'bg-purple-100 text-purple-800',
    enterprise: 'bg-amber-100 text-amber-800',
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plateforme Koraline</h1>
          <p className="text-gray-500 mt-1">
            {tenants.length} tenant{tenants.length > 1 ? 's' : ''} actif{tenants.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Nouveau Client
        </button>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-4">
          <p className="text-sm text-gray-500">Tenants</p>
          <p className="text-2xl font-bold">{tenants.length}</p>
        </div>
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-4">
          <p className="text-sm text-gray-500">Utilisateurs</p>
          <p className="text-2xl font-bold">
            {tenants.reduce((acc, t) => acc + t.stats.users, 0)}
          </p>
        </div>
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-4">
          <p className="text-sm text-gray-500">Produits</p>
          <p className="text-2xl font-bold">
            {tenants.reduce((acc, t) => acc + t.stats.products, 0)}
          </p>
        </div>
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-4">
          <p className="text-sm text-gray-500">Commandes</p>
          <p className="text-2xl font-bold">
            {tenants.reduce((acc, t) => acc + t.stats.orders, 0)}
          </p>
        </div>
      </div>

      {/* Liste des tenants */}
      <div className="bg-[var(--k-glass-thin)] rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Client</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Domaine</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Plan</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Statut</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Utilisateurs</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Produits</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-500">Commandes</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-500">Créé le</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: tenant.primaryColor }}
                    >
                      {tenant.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{tenant.name}</p>
                      <p className="text-xs text-gray-400">{tenant.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <span>{tenant.domainCustom || tenant.domainKoraline || '-'}</span>
                  {tenant.domainCustom && !tenant.domainVerified && (
                    <span className="ml-1 text-xs text-amber-600">(non vérifié)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${planColors[tenant.plan] || 'bg-gray-100'}`}>
                    {tenant.plan}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[tenant.status] || 'bg-gray-100'}`}>
                    {tenant.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-sm">{tenant.stats.users}</td>
                <td className="px-4 py-3 text-right text-sm">{tenant.stats.products}</td>
                <td className="px-4 py-3 text-right text-sm">{tenant.stats.orders}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(tenant.createdAt).toLocaleDateString('fr-CA')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Formulaire création tenant */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[var(--k-glass-thin)] rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Nouveau Client Koraline</h2>
            <form onSubmit={handleCreateTenant} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (identifiant unique)</label>
                <input
                  type="text"
                  value={newTenant.slug}
                  onChange={(e) => setNewTenant({ ...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  placeholder="mon-client"
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
                <p className="text-xs text-gray-400 mt-1">{newTenant.slug || 'slug'}.koraline.app</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;entreprise</label>
                <input
                  type="text"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  placeholder="Mon Entreprise Inc."
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={newTenant.plan}
                  onChange={(e) => setNewTenant({ ...newTenant, plan: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="essential">Essentiel (149$/mois)</option>
                  <option value="pro">Pro (299$/mois)</option>
                  <option value="enterprise">Enterprise (599$/mois)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Domaine custom (optionnel)</label>
                <input
                  type="text"
                  value={newTenant.domainCustom}
                  onChange={(e) => setNewTenant({ ...newTenant, domainCustom: e.target.value })}
                  placeholder="monsite.com"
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
