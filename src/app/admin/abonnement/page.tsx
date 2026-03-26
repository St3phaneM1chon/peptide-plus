'use client';

/**
 * Dashboard Abonnement — Vue d'ensemble du plan, modules, licences, factures
 * URL: /admin/abonnement
 */

import { useState, useEffect } from 'react';

interface SubscriptionData {
  tenant: {
    id: string;
    slug: string;
    name: string;
    plan: string;
    status: string;
  };
  plan: {
    name: string;
    monthlyPrice: number;
    features: string[];
    key: string;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: number;
    cancelAtPeriodEnd: boolean;
  } | null;
  modules: string[];
}

interface LicenseData {
  totalEmployees: number;
  includedEmployees: number;
  billedEmployees: number;
  roles: Array<{
    role: string;
    count: number;
    monthlyPricePerSeat: number;
    licenseName: string;
  }>;
}

interface Invoice {
  id: string;
  number: string;
  date: number;
  status: string;
  total: number;
  currency: string;
  pdfUrl: string | null;
  hostedUrl: string | null;
}

export default function SubscriptionDashboardPage() {
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [licenses, setLicenses] = useState<LicenseData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/platform/subscription').then(r => r.ok ? r.json() : null),
      fetch('/api/platform/licenses').then(r => r.ok ? r.json() : null),
      fetch('/api/platform/invoices').then(r => r.ok ? r.json() : null),
    ]).then(([subData, licData, invData]) => {
      setSub(subData);
      setLicenses(licData);
      setInvoices(invData?.invoices || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleBillingPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/platform/billing-portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      alert('Erreur lors de l\'ouverture du portail de facturation');
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Aucun abonnement trouvé.</p>
      </div>
    );
  }

  // Calculate totals
  const planPrice = sub.plan.monthlyPrice;
  const moduleCount = sub.modules.length;
  const licenseCost = licenses
    ? licenses.roles.reduce((sum, r) => {
        const billed = Math.max(0, r.count - (licenses.includedEmployees > 0 ? 1 : 0));
        return sum + (billed * r.monthlyPricePerSeat);
      }, 0)
    : 0;
  const totalMonthly = planPrice + licenseCost;

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abonnement</h1>
          <p className="text-gray-500 mt-1">Gérez votre plan, modules, licences et facturation.</p>
        </div>
        <button
          onClick={handleBillingPortal}
          disabled={portalLoading}
          className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {portalLoading ? '...' : 'Gérer le paiement'}
        </button>
      </div>

      {/* Plan actuel */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5">
          <p className="text-sm text-gray-500 mb-1">Plan actuel</p>
          <p className="text-xl font-bold text-gray-900">{sub.plan.name}</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {(planPrice / 100).toFixed(0)} $ <span className="text-sm font-normal text-gray-500">/ mois</span>
          </p>
          <a href="/admin/abonnement/plan" className="text-sm text-blue-600 hover:underline mt-3 block">
            Changer de plan &#8594;
          </a>
        </div>

        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5">
          <p className="text-sm text-gray-500 mb-1">Modules actifs</p>
          <p className="text-xl font-bold text-gray-900">{moduleCount}</p>
          <p className="text-sm text-gray-500 mt-2">{sub.modules.join(', ')}</p>
          <a href="/admin/abonnement/modules" className="text-sm text-blue-600 hover:underline mt-3 block">
            Gérer les modules &#8594;
          </a>
        </div>

        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5">
          <p className="text-sm text-gray-500 mb-1">Total mensuel</p>
          <p className="text-2xl font-bold text-gray-900">
            {(totalMonthly / 100).toFixed(2)} $
          </p>
          {sub.subscription?.currentPeriodEnd && (
            <p className="text-sm text-gray-500 mt-2">
              Prochaine facture :{' '}
              {new Date(sub.subscription.currentPeriodEnd * 1000).toLocaleDateString('fr-CA')}
            </p>
          )}
          {sub.subscription?.cancelAtPeriodEnd && (
            <p className="text-sm text-red-500 mt-1 font-medium">
              Annulation programmée
            </p>
          )}
        </div>
      </div>

      {/* Licences employés */}
      {licenses && (
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Licences employés</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Rôle</th>
                  <th className="pb-2 font-medium">Nombre</th>
                  <th className="pb-2 font-medium">Prix/siège</th>
                  <th className="pb-2 font-medium text-right">Sous-total</th>
                </tr>
              </thead>
              <tbody>
                {licenses.roles.map((r) => (
                  <tr key={r.role} className="border-b last:border-0">
                    <td className="py-3">{r.licenseName}</td>
                    <td className="py-3">{r.count}</td>
                    <td className="py-3">{(r.monthlyPricePerSeat / 100).toFixed(2)} $</td>
                    <td className="py-3 text-right font-medium">
                      {((r.count * r.monthlyPricePerSeat) / 100).toFixed(2)} $
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td colSpan={2} className="pt-3 font-medium text-gray-900">
                    {licenses.totalEmployees} employé(s) ({licenses.includedEmployees} inclus, {licenses.billedEmployees} facturé(s))
                  </td>
                  <td />
                  <td className="pt-3 text-right font-bold text-gray-900">
                    {(licenseCost / 100).toFixed(2)} $/mois
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Historique factures */}
      <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Historique des factures</h2>
        {invoices.length === 0 ? (
          <p className="text-gray-500 text-sm">Aucune facture pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {invoices.slice(0, 12).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.number || inv.id}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(inv.date * 1000).toLocaleDateString('fr-CA')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                    inv.status === 'open' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {inv.status === 'paid' ? 'Payée' : inv.status === 'open' ? 'En attente' : inv.status}
                  </span>
                  <span className="font-medium text-gray-900 text-sm">
                    {(inv.total / 100).toFixed(2)} $
                  </span>
                  {inv.pdfUrl && (
                    <a
                      href={inv.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Domain config link */}
      <div className="mt-8 bg-[var(--k-glass-thin)] rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Domaine personnalisé</h2>
            <p className="text-sm text-gray-500">Configurez un domaine custom pour votre boutique.</p>
          </div>
          <a href="/admin/abonnement/domaine" className="text-sm text-blue-600 hover:underline">
            Configurer &#8594;
          </a>
        </div>
      </div>
    </div>
  );
}
