'use client';

/**
 * Client List — Super-admin only
 * URL: /admin/platform/clients
 *
 * Lists all Koraline tenants with search, filters, stats.
 * Dark Glass Premium styling with var(--k-*) tokens.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Plus, Building2, Users, ShoppingCart, Package,
  Globe, ChevronDown, Loader2,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantStats {
  users: number;
  orders: number;
  products: number;
}

interface ClientTenant {
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
  modulesEnabled: string[] | string;
  createdAt: string;
  stats: TenantStats;
  mrr: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAN_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  essential: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', label: 'Essentiel' },
  pro: { bg: 'rgba(139, 92, 246, 0.15)', text: '#a78bfa', label: 'Pro' },
  enterprise: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', label: 'Enterprise' },
};

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', label: 'Actif' },
  SUSPENDED: { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', label: 'Suspendu' },
  PENDING: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', label: 'En attente' },
  CANCELLED: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af', label: 'Annule' },
};

const MODULE_ICONS: Record<string, string> = {
  commerce: 'cart', catalogue: 'pkg', marketing: 'mega', emails: 'mail',
  comptabilite: 'calc', systeme: 'gear', crm: 'brief', communaute: 'chat',
  media: 'vid', loyalty: 'star', formation: 'grad',
  crm_advanced: 'target', marketplace_starter: 'shop', marketplace_pro: 'shop',
  chat: 'msg', email_marketing: 'send', subscriptions: 'repeat',
  ambassadors: 'handshake', monitoring: 'chart', accounting_advanced: 'ledger',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientListPage() {
  const { t } = useI18n();
  const router = useRouter();

  const [tenants, setTenants] = useState<ClientTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/platform/clients');
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants || []);
      }
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  // Filtered list
  const filtered = useMemo(() => {
    return tenants.filter(t => {
      const q = search.toLowerCase();
      const matchesSearch = !q ||
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        (t.domainCustom || '').toLowerCase().includes(q);
      const matchesPlan = planFilter === 'all' || t.plan === planFilter;
      const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
      return matchesSearch && matchesPlan && matchesStatus;
    });
  }, [tenants, search, planFilter, statusFilter]);

  // Aggregate stats
  const totalMRR = useMemo(() => tenants.reduce((s, t) => s + (t.mrr || 0), 0), [tenants]);
  const totalUsers = useMemo(() => tenants.reduce((s, t) => s + t.stats.users, 0), [tenants]);
  const totalOrders = useMemo(() => tenants.reduce((s, t) => s + t.stats.orders, 0), [tenants]);
  const totalProducts = useMemo(() => tenants.reduce((s, t) => s + t.stats.products, 0), [tenants]);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
  };

  const parseModules = (raw: string[] | string): string[] => {
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--k-text-muted)]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--k-text-primary)]">
            {t('admin.platformClients.title') || 'Gestion des clients'}
          </h1>
          <p className="text-sm text-[var(--k-text-secondary)] mt-1">
            {tenants.length} {t('admin.platformClients.tenantsCount') || 'clients Koraline'}
          </p>
        </div>
        <button
          onClick={() => router.push('/admin/platform/clients/nouveau')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white
            bg-gradient-to-r from-[#6366f1] to-[#818cf8] hover:from-[#5558e6] hover:to-[#7580f2]
            transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('admin.platformClients.newClient') || 'Nouveau client'}
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('admin.platformClients.totalClients') || 'Clients', value: tenants.length, icon: Building2, color: 'var(--k-accent-indigo)' },
          { label: t('admin.platformClients.totalUsers') || 'Utilisateurs', value: totalUsers, icon: Users, color: 'var(--k-accent-cyan)' },
          { label: 'MRR', value: formatCurrency(totalMRR), icon: ShoppingCart, color: 'var(--k-accent-emerald)' },
          { label: t('admin.platformClients.totalProducts') || 'Produits', value: totalProducts, icon: Package, color: 'var(--k-accent-amber)' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)]
              backdrop-blur-md p-4 flex items-center gap-4"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 15%, transparent)` }}
            >
              <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xs text-[var(--k-text-secondary)]">{stat.label}</p>
              <p className="text-lg font-semibold text-[var(--k-text-primary)]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)]" />
          <input
            type="text"
            placeholder={t('admin.platformClients.searchPlaceholder') || 'Rechercher par nom, slug ou domaine...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-[var(--k-glass-thin)] border border-[var(--k-border-subtle)]
              text-sm text-[var(--k-text-primary)] placeholder:text-[var(--k-text-muted)]
              focus:outline-none focus:ring-2 focus:ring-[var(--k-border-focus)] focus:border-[var(--k-border-focus)]
              transition-shadow"
          />
        </div>

        {/* Plan filter */}
        <div className="relative">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="h-10 pl-3 pr-8 rounded-xl bg-[var(--k-glass-thin)] border border-[var(--k-border-subtle)]
              text-sm text-[var(--k-text-primary)] appearance-none cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-[var(--k-border-focus)]"
          >
            <option value="all">{t('admin.platformClients.allPlans') || 'Tous les plans'}</option>
            <option value="essential">Essentiel</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
        </div>

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 pl-3 pr-8 rounded-xl bg-[var(--k-glass-thin)] border border-[var(--k-border-subtle)]
              text-sm text-[var(--k-text-primary)] appearance-none cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-[var(--k-border-focus)]"
          >
            <option value="all">{t('admin.platformClients.allStatuses') || 'Tous les statuts'}</option>
            <option value="ACTIVE">{t('admin.platformClients.statusActive') || 'Actif'}</option>
            <option value="SUSPENDED">{t('admin.platformClients.statusSuspended') || 'Suspendu'}</option>
            <option value="PENDING">{t('admin.platformClients.statusPending') || 'En attente'}</option>
            <option value="CANCELLED">{t('admin.platformClients.statusCancelled') || 'Annule'}</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--k-border-subtle)]">
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--k-text-secondary)] uppercase tracking-wider">
                  {t('admin.platformClients.colClient') || 'Client'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--k-text-secondary)] uppercase tracking-wider">
                  {t('admin.platformClients.colDomain') || 'Domaine'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--k-text-secondary)] uppercase tracking-wider">
                  {t('admin.platformClients.colPlan') || 'Plan'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--k-text-secondary)] uppercase tracking-wider">
                  {t('admin.platformClients.colStatus') || 'Statut'}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--k-text-secondary)] uppercase tracking-wider">
                  {t('admin.platformClients.colModules') || 'Modules'}
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-[var(--k-text-secondary)] uppercase tracking-wider">
                  MRR
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-[var(--k-text-secondary)] uppercase tracking-wider">
                  {t('admin.platformClients.colCreated') || 'Cree le'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--k-border-subtle)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Building2 className="w-8 h-8 text-[var(--k-text-muted)] mx-auto mb-2" />
                    <p className="text-sm text-[var(--k-text-secondary)]">
                      {t('admin.platformClients.noResults') || 'Aucun client trouve'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((tenant) => {
                  const plan = PLAN_BADGES[tenant.plan] || PLAN_BADGES.essential;
                  const status = STATUS_BADGES[tenant.status] || STATUS_BADGES.ACTIVE;
                  const modules = parseModules(tenant.modulesEnabled);

                  return (
                    <tr
                      key={tenant.id}
                      onClick={() => router.push(`/admin/platform/clients/${tenant.id}`)}
                      className="hover:bg-[var(--k-glass-regular)] cursor-pointer transition-colors"
                    >
                      {/* Logo + Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {tenant.logoUrl ? (
                            <img
                              src={tenant.logoUrl}
                              alt={tenant.name}
                              className="w-9 h-9 rounded-lg object-cover border border-[var(--k-border-subtle)]"
                            />
                          ) : (
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                              style={{ backgroundColor: tenant.primaryColor }}
                            >
                              {tenant.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-[var(--k-text-primary)]">{tenant.name}</p>
                            <p className="text-xs text-[var(--k-text-tertiary)]">{tenant.slug}</p>
                          </div>
                        </div>
                      </td>

                      {/* Domain */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-[var(--k-text-muted)]" />
                          <span className="text-sm text-[var(--k-text-secondary)]">
                            {tenant.domainCustom || tenant.domainKoraline || '-'}
                          </span>
                          {tenant.domainCustom && !tenant.domainVerified && (
                            <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                              DNS
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Plan badge */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: plan.bg, color: plan.text }}
                        >
                          {plan.label}
                        </span>
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3">
                        <span
                          className="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: status.bg, color: status.text }}
                        >
                          {status.label}
                        </span>
                      </td>

                      {/* Modules */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap max-w-[180px]">
                          {modules.slice(0, 5).map((mod) => (
                            <span
                              key={mod}
                              title={mod}
                              className="w-6 h-6 rounded flex items-center justify-center text-[10px] bg-[var(--k-glass-regular)] text-[var(--k-text-secondary)]"
                            >
                              {MODULE_ICONS[mod] ? MODULE_ICONS[mod].slice(0, 2) : mod.slice(0, 2)}
                            </span>
                          ))}
                          {modules.length > 5 && (
                            <span className="text-[10px] text-[var(--k-text-muted)]">
                              +{modules.length - 5}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* MRR */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-medium text-[var(--k-accent-emerald)]">
                          {formatCurrency(tenant.mrr)}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-[var(--k-text-secondary)]">
                          {new Date(tenant.createdAt).toLocaleDateString('fr-CA')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-[var(--k-text-tertiary)]">
        <span>
          {filtered.length} {t('admin.platformClients.of') || 'sur'} {tenants.length} {t('admin.platformClients.clients') || 'clients'}
        </span>
        <span>
          {t('admin.platformClients.totalOrders') || 'Commandes totales'}: {totalOrders}
        </span>
      </div>
    </div>
  );
}
