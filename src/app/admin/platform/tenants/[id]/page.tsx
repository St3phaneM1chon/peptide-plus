'use client';

/**
 * Tenant Detail View — Super-admin only
 * URL: /admin/platform/tenants/[id]
 *
 * Shows subscription, modules, employees, stats for a specific tenant.
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface TenantDetail {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  domainKoraline: string | null;
  domainCustom: string | null;
  domainVerified: boolean;
  primaryColor: string;
  modulesEnabled: string[];
  maxEmployees: number;
  createdAt: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  ownerEmail: string | null;
  employeeCount: number;
}

export default function TenantDetailPage() {
  const params = useParams();
  const tenantId = params.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  useEffect(() => {
    fetch(`/api/admin/platform/tenants/${tenantId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setTenant(data?.tenant || null))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      const res = await fetch(`/api/admin/platform/tenants/${tenantId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        // Reload tenant data
        const data = await fetch(`/api/admin/platform/tenants/${tenantId}`).then(r => r.json());
        setTenant(data?.tenant || null);
      }
    } catch {
      alert('Erreur');
    } finally {
      setActionLoading('');
    }
  };

  const handleImpersonate = async () => {
    if (!confirm('Vous allez vous connecter en tant que propriétaire de ce tenant. Session temporaire de 1h.')) return;
    setActionLoading('impersonate');
    try {
      const res = await fetch('/api/admin/platform/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch {
      alert('Erreur d\'impersonation');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-gray-200 rounded-xl" /></div>;
  }

  if (!tenant) {
    return <div className="p-8"><p className="text-gray-500">Tenant introuvable.</p></div>;
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <a href="/admin/platform" className="text-sm text-gray-500 hover:text-gray-700">
          &#8592; Retour aux tenants
        </a>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
            <p className="text-gray-500">{tenant.slug}.koraline.app</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            tenant.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
            tenant.status === 'SUSPENDED' ? 'bg-red-100 text-red-700' :
            tenant.status === 'CANCELLED' ? 'bg-gray-100 text-gray-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {tenant.status}
          </span>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Informations</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Plan</span><span className="font-medium">{tenant.plan}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Propriétaire</span><span className="font-medium">{tenant.ownerEmail || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Employés</span><span className="font-medium">{tenant.employeeCount} / {tenant.maxEmployees}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Créé le</span><span className="font-medium">{new Date(tenant.createdAt).toLocaleDateString('fr-CA')}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Domaine custom</span><span className="font-medium">{tenant.domainCustom || 'Non configuré'}</span></div>
            {tenant.domainCustom && (
              <div className="flex justify-between"><span className="text-gray-500">DNS vérifié</span><span className={`font-medium ${tenant.domainVerified ? 'text-green-600' : 'text-red-600'}`}>{tenant.domainVerified ? 'Oui' : 'Non'}</span></div>
            )}
          </div>
        </div>

        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Stripe</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Customer ID</span><span className="font-mono text-xs">{tenant.stripeCustomerId || '-'}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Subscription ID</span><span className="font-mono text-xs">{tenant.stripeSubscriptionId || '-'}</span></div>
          </div>
        </div>
      </div>

      {/* Modules */}
      <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5 mb-8">
        <h3 className="font-semibold text-gray-900 mb-3">Modules actifs ({tenant.modulesEnabled.length})</h3>
        <div className="flex flex-wrap gap-2">
          {tenant.modulesEnabled.map(mod => (
            <span key={mod} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
              {mod}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Actions</h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleImpersonate}
            disabled={actionLoading === 'impersonate'}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
          >
            {actionLoading === 'impersonate' ? '...' : 'Impersonner'}
          </button>
          {tenant.status === 'ACTIVE' && (
            <button
              onClick={() => handleAction('suspend')}
              disabled={!!actionLoading}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50"
            >
              Suspendre
            </button>
          )}
          {tenant.status === 'SUSPENDED' && (
            <button
              onClick={() => handleAction('reactivate')}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Réactiver
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
