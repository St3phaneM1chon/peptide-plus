'use client';

/**
 * Client Detail — Super-admin only
 * URL: /admin/platform/clients/[id]
 *
 * Full client management with tabs: Apercu, Details, Abonnement, Configuration, Activite, Communication.
 * Dark Glass Premium styling.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, Building2, Users, Package, ShoppingCart,
  ExternalLink, UserX, UserCheck, Eye, Save, Send,
  Clock, ChevronDown, AlertCircle, Check, X, ToggleLeft, ToggleRight,
  Bell, Info, AlertTriangle, Zap, GraduationCap,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { addCSRFHeader } from '@/lib/csrf';
import { KORALINE_PLANS, KORALINE_MODULES, type KoralinePlan, type KoralineModule } from '@/lib/stripe-constants';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantDetail {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  industry: string | null;
  logoUrl: string | null;
  notes: string | null;
  domainCustom: string | null;
  domainKoraline: string | null;
  domainVerified: boolean;
  domainVerificationToken: string | null;
  plan: string;
  status: string;
  primaryColor: string;
  secondaryColor: string;
  font: string;
  modulesEnabled: string[];
  featuresFlags: Record<string, boolean>;
  locale: string;
  currency: string;
  maxEmployees: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  // Contacts
  contactFinanceName: string | null;
  contactFinanceEmail: string | null;
  contactFinancePhone: string | null;
  contactSupportName: string | null;
  contactSupportEmail: string | null;
  contactSupportPhone: string | null;
  contactTechName: string | null;
  contactTechEmail: string | null;
  contactTechPhone: string | null;
  contactMarketingName: string | null;
  contactMarketingEmail: string | null;
  contactMarketingPhone: string | null;
  // Address
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  country: string | null;
  // Fiscal
  taxProvince: string;
  taxGstNumber: string | null;
  taxQstNumber: string | null;
  taxHstNumber: string | null;
  taxPstNumber: string | null;
}

interface TenantOwner {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  createdAt: string;
}

interface TenantEvent {
  id: string;
  type: string;
  actor: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface TenantNotification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdBy: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type TabKey = 'overview' | 'details' | 'subscription' | 'config' | 'activity' | 'communication';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Apercu', icon: Eye },
  { key: 'details', label: 'Details', icon: Building2 },
  { key: 'subscription', label: 'Abonnement', icon: ShoppingCart },
  { key: 'config', label: 'Configuration', icon: ToggleLeft },
  { key: 'activity', label: 'Activite', icon: Clock },
  { key: 'communication', label: 'Communication', icon: Bell },
];

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

const EVENT_ICONS: Record<string, React.ElementType> = {
  CREATED: Building2, STATUS_CHANGED: AlertTriangle, PLAN_CHANGED: ShoppingCart,
  MODULE_ENABLED: ToggleRight, MODULE_DISABLED: ToggleLeft,
  NOTIFICATION_SENT: Bell, LOGIN: Users, PAYMENT_SUCCESS: Check,
};

const NOTIFICATION_TYPE_CONFIG: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  info: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', icon: Info },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', icon: AlertTriangle },
  urgent: { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', icon: Zap },
};

const PROVINCES = [
  { value: 'QC', label: 'Quebec' }, { value: 'ON', label: 'Ontario' },
  { value: 'BC', label: 'Colombie-Britannique' }, { value: 'AB', label: 'Alberta' },
  { value: 'SK', label: 'Saskatchewan' }, { value: 'MB', label: 'Manitoba' },
  { value: 'NB', label: 'Nouveau-Brunswick' }, { value: 'NS', label: 'Nouvelle-Ecosse' },
  { value: 'PE', label: 'Ile-du-Prince-Edouard' }, { value: 'NL', label: 'Terre-Neuve-et-Labrador' },
  { value: 'YT', label: 'Yukon' }, { value: 'NT', label: 'Territoires du Nord-Ouest' },
  { value: 'NU', label: 'Nunavut' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
}

const inputClasses = `w-full h-9 px-3 rounded-lg bg-[var(--k-bg-raised)] border border-[var(--k-border-subtle)]
  text-sm text-[var(--k-text-primary)] placeholder:text-[var(--k-text-muted)]
  focus:outline-none focus:ring-2 focus:ring-[var(--k-border-focus)] transition-shadow`;

const selectClasses = `${inputClasses} appearance-none cursor-pointer`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ClientDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const tenantId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [owner, setOwner] = useState<TenantOwner | null>(null);
  const [stats, setStats] = useState({ users: 0, products: 0, orders: 0 });
  const [mrr, setMrr] = useState(0);
  const [events, setEvents] = useState<TenantEvent[]>([]);
  const [notifications, setNotifications] = useState<TenantNotification[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [actionLoading, setActionLoading] = useState('');

  // Editable form state (for Details tab)
  const [editForm, setEditForm] = useState<Partial<TenantDetail>>({});
  const [saving, setSaving] = useState(false);

  // Notification form
  const [notifForm, setNotifForm] = useState({ title: '', message: '', type: 'info' });
  const [sendingNotif, setSendingNotif] = useState(false);

  // Event filter
  const [eventFilter, setEventFilter] = useState('all');

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchTenant = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/platform/clients/${tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setTenant(data.tenant);
        setOwner(data.owner);
        setStats(data.stats);
        setMrr(data.mrr);
        setEvents(data.tenant.events || []);
        setNotifications(data.tenant.notifications || []);
        setEditForm(data.tenant);
      }
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const handleAction = async (action: string) => {
    const confirmMsg = action === 'suspend'
      ? 'Suspendre ce client ? Il ne pourra plus acceder a son espace.'
      : action === 'reactivate'
      ? 'Reactiver ce client ?'
      : 'Annuler ce client definitivement ?';

    if (!confirm(confirmMsg)) return;

    setActionLoading(action);
    try {
      const res = await fetch(`/api/admin/platform/clients/${tenantId}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(action === 'suspend' ? 'Client suspendu' : action === 'reactivate' ? 'Client reactive' : 'Client annule');
        fetchTenant();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setActionLoading('');
    }
  };

  const handleImpersonate = async () => {
    if (!confirm('Vous allez vous connecter en tant que proprietaire de ce tenant. Session temporaire de 1h.')) return;
    setActionLoading('impersonate');
    try {
      const res = await fetch('/api/admin/platform/impersonate', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch {
      toast.error('Erreur d\'impersonation');
    } finally {
      setActionLoading('');
    }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/platform/clients/${tenantId}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        toast.success('Modifications enregistrees');
        fetchTenant();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleModule = async (moduleKey: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/platform/clients/${tenantId}/modules`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ moduleKey, enabled }),
      });
      if (res.ok) {
        toast.success(`Module ${moduleKey} ${enabled ? 'active' : 'desactive'}`);
        fetchTenant();
      }
    } catch {
      toast.error('Erreur');
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingNotif(true);
    try {
      const res = await fetch(`/api/admin/platform/clients/${tenantId}/notifications`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(notifForm),
      });
      if (res.ok) {
        toast.success('Notification envoyee');
        setNotifForm({ title: '', message: '', type: 'info' });
        fetchTenant();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Erreur');
      }
    } catch {
      toast.error('Erreur');
    } finally {
      setSendingNotif(false);
    }
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

  if (!tenant) {
    return (
      <div className="p-8 text-center">
        <Building2 className="w-12 h-12 text-[var(--k-text-muted)] mx-auto mb-3" />
        <p className="text-[var(--k-text-secondary)]">{t('admin.platformClients.notFound') || 'Client introuvable'}</p>
      </div>
    );
  }

  const plan = PLAN_BADGES[tenant.plan] || PLAN_BADGES.essential;
  const status = STATUS_BADGES[tenant.status] || STATUS_BADGES.ACTIVE;

  const filteredEvents = eventFilter === 'all' ? events : events.filter(e => e.type === eventFilter);

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/admin/platform/clients')}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--k-text-secondary)] hover:text-[var(--k-text-primary)] mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('admin.platformClients.backToList') || 'Retour aux clients'}
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="w-12 h-12 rounded-xl object-cover border border-[var(--k-border-subtle)]" />
            ) : (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                style={{ backgroundColor: tenant.primaryColor }}
              >
                {tenant.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-[var(--k-text-primary)]">{tenant.name}</h1>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: plan.bg, color: plan.text }}>{plan.label}</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: status.bg, color: status.text }}>{status.label}</span>
              </div>
              <p className="text-sm text-[var(--k-text-secondary)] mt-0.5">{tenant.slug}.koraline.app</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleImpersonate}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-colors disabled:opacity-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Impersonner
            </button>
            {tenant.domainCustom && (
              <a
                href={`https://${tenant.domainCustom}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                  bg-[var(--k-glass-regular)] text-[var(--k-text-secondary)] hover:text-[var(--k-text-primary)] transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Voir le site
              </a>
            )}
            {tenant.status === 'ACTIVE' && (
              <button
                onClick={() => handleAction('suspend')}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                  bg-[var(--k-accent-rose-10)] text-[var(--k-accent-rose)] hover:bg-rose-500/20 transition-colors disabled:opacity-50"
              >
                <UserX className="w-3.5 h-3.5" />
                Suspendre
              </button>
            )}
            {tenant.status === 'SUSPENDED' && (
              <button
                onClick={() => handleAction('reactivate')}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium
                  bg-[var(--k-accent-emerald-10)] text-[var(--k-accent-emerald)] hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                <UserCheck className="w-3.5 h-3.5" />
                Reactiver
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--k-border-subtle)] pb-px">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors
              ${activeTab === tab.key
                ? 'text-[var(--k-accent-indigo)] border-b-2 border-[var(--k-accent-indigo)] bg-[var(--k-accent-indigo-10)]'
                : 'text-[var(--k-text-secondary)] hover:text-[var(--k-text-primary)] hover:bg-[var(--k-glass-thin)]'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {t(`admin.platformClients.tab${tab.key.charAt(0).toUpperCase() + tab.key.slice(1)}`) || tab.label}
          </button>
        ))}
      </div>

      {/* ================================================================= */}
      {/* TAB: Apercu */}
      {/* ================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary card */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] backdrop-blur-md p-6">
            <div className="grid md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-[var(--k-text-muted)] mb-1">MRR</p>
                <p className="text-2xl font-bold text-[var(--k-accent-emerald)]">{formatCurrency(mrr)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--k-text-muted)] mb-1">Plan</p>
                <p className="text-lg font-semibold text-[var(--k-text-primary)]">{KORALINE_PLANS[tenant.plan as KoralinePlan]?.name || tenant.plan}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--k-text-muted)] mb-1">Cree le</p>
                <p className="text-sm text-[var(--k-text-primary)]">{formatDate(tenant.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--k-text-muted)] mb-1">Proprietaire</p>
                <p className="text-sm text-[var(--k-text-primary)]">{owner?.name || owner?.email || '-'}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Utilisateurs', value: stats.users, icon: Users, color: 'var(--k-accent-indigo)' },
              { label: 'Produits', value: stats.products, icon: Package, color: 'var(--k-accent-cyan)' },
              { label: 'Commandes', value: stats.orders, icon: ShoppingCart, color: 'var(--k-accent-emerald)' },
              { label: 'Modules', value: tenant.modulesEnabled.length, icon: GraduationCap, color: 'var(--k-accent-amber)' },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-4">
                <stat.icon className="w-5 h-5 mb-2" style={{ color: stat.color }} />
                <p className="text-2xl font-bold text-[var(--k-text-primary)]">{stat.value}</p>
                <p className="text-xs text-[var(--k-text-secondary)]">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Quick info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
              <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-3">Informations</h3>
              <dl className="space-y-2 text-sm">
                {[
                  ['Industrie', tenant.industry || '-'],
                  ['Domaine', tenant.domainCustom || tenant.domainKoraline || '-'],
                  ['Province', tenant.province || tenant.taxProvince],
                  ['Pays', tenant.country || 'CA'],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-[var(--k-text-secondary)]">{label}</span>
                    <span className="text-[var(--k-text-primary)] font-medium">{val}</span>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
              <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-3">Stripe</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--k-text-secondary)]">Customer ID</span>
                  <span className="text-[var(--k-text-primary)] font-mono text-xs">{tenant.stripeCustomerId || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--k-text-secondary)]">Subscription ID</span>
                  <span className="text-[var(--k-text-primary)] font-mono text-xs">{tenant.stripeSubscriptionId || '-'}</span>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Details (editable) */}
      {/* ================================================================= */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {/* Company info */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Entreprise</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">Nom</label>
                <input type="text" value={editForm.name || ''} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">Raison sociale</label>
                <input type="text" value={editForm.legalName || ''} onChange={(e) => setEditForm(prev => ({ ...prev, legalName: e.target.value }))} className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">Industrie</label>
                <input type="text" value={editForm.industry || ''} onChange={(e) => setEditForm(prev => ({ ...prev, industry: e.target.value }))} className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">URL Logo</label>
                <input type="url" value={editForm.logoUrl || ''} onChange={(e) => setEditForm(prev => ({ ...prev, logoUrl: e.target.value }))} className={inputClasses} />
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              <label className="text-xs font-medium text-[var(--k-text-secondary)]">Description courte</label>
              <input type="text" value={editForm.shortDescription || ''} onChange={(e) => setEditForm(prev => ({ ...prev, shortDescription: e.target.value }))} className={inputClasses} maxLength={200} />
            </div>
          </div>

          {/* Contacts */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Contacts</h3>
            {(['Finance', 'Support', 'Tech', 'Marketing'] as const).map((dept) => {
              const nameKey = `contact${dept}Name` as keyof TenantDetail;
              const emailKey = `contact${dept}Email` as keyof TenantDetail;
              const phoneKey = `contact${dept}Phone` as keyof TenantDetail;
              return (
                <div key={dept} className="mb-4 last:mb-0">
                  <p className="text-xs font-semibold text-[var(--k-text-muted)] mb-2 uppercase tracking-wider">{dept}</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input type="text" placeholder="Nom" value={(editForm[nameKey] as string) || ''} onChange={(e) => setEditForm(prev => ({ ...prev, [nameKey]: e.target.value }))} className={inputClasses} />
                    <input type="email" placeholder="Email" value={(editForm[emailKey] as string) || ''} onChange={(e) => setEditForm(prev => ({ ...prev, [emailKey]: e.target.value }))} className={inputClasses} />
                    <input type="tel" placeholder="Telephone" value={(editForm[phoneKey] as string) || ''} onChange={(e) => setEditForm(prev => ({ ...prev, [phoneKey]: e.target.value }))} className={inputClasses} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Address */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Adresse</h3>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">Adresse</label>
                <input type="text" value={editForm.address || ''} onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))} className={inputClasses} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--k-text-secondary)]">Ville</label>
                  <input type="text" value={editForm.city || ''} onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))} className={inputClasses} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--k-text-secondary)]">Province</label>
                  <div className="relative">
                    <select value={editForm.province || 'QC'} onChange={(e) => setEditForm(prev => ({ ...prev, province: e.target.value }))} className={selectClasses}>
                      {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--k-text-secondary)]">Code postal</label>
                  <input type="text" value={editForm.postalCode || ''} onChange={(e) => setEditForm(prev => ({ ...prev, postalCode: e.target.value.toUpperCase() }))} className={inputClasses} />
                </div>
              </div>
            </div>
          </div>

          {/* Fiscal */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Fiscalite</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">Province fiscale</label>
                <div className="relative">
                  <select value={editForm.taxProvince || 'QC'} onChange={(e) => setEditForm(prev => ({ ...prev, taxProvince: e.target.value }))} className={selectClasses}>
                    {PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">TPS</label>
                <input type="text" value={editForm.taxGstNumber || ''} onChange={(e) => setEditForm(prev => ({ ...prev, taxGstNumber: e.target.value }))} className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">TVQ</label>
                <input type="text" value={editForm.taxQstNumber || ''} onChange={(e) => setEditForm(prev => ({ ...prev, taxQstNumber: e.target.value }))} className={inputClasses} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">TVH</label>
                <input type="text" value={editForm.taxHstNumber || ''} onChange={(e) => setEditForm(prev => ({ ...prev, taxHstNumber: e.target.value }))} className={inputClasses} />
              </div>
            </div>
          </div>

          {/* Internal notes */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Notes internes</h3>
            <textarea
              value={editForm.notes || ''}
              onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notes internes sur ce client..."
              rows={4}
              className={`w-full px-3 py-2 rounded-lg bg-[var(--k-bg-raised)] border border-[var(--k-border-subtle)]
                text-sm text-[var(--k-text-primary)] placeholder:text-[var(--k-text-muted)] resize-y
                focus:outline-none focus:ring-2 focus:ring-[var(--k-border-focus)] transition-shadow`}
            />
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveDetails}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white
                bg-gradient-to-r from-[#6366f1] to-[#818cf8] hover:from-[#5558e6] hover:to-[#7580f2]
                disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Abonnement */}
      {/* ================================================================= */}
      {activeTab === 'subscription' && (
        <div className="space-y-6">
          {/* Current plan */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Plan actuel</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-[var(--k-text-primary)]">{KORALINE_PLANS[tenant.plan as KoralinePlan]?.name || tenant.plan}</p>
                <p className="text-sm text-[var(--k-text-secondary)]">{KORALINE_PLANS[tenant.plan as KoralinePlan]?.description || ''}</p>
              </div>
              <p className="text-2xl font-bold text-[var(--k-accent-emerald)]">{formatCurrency(KORALINE_PLANS[tenant.plan as KoralinePlan]?.monthlyPrice || 0)}<span className="text-xs font-normal text-[var(--k-text-muted)]">/mo</span></p>
            </div>

            {/* Plan change */}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {(Object.entries(KORALINE_PLANS) as [KoralinePlan, typeof KORALINE_PLANS[KoralinePlan]][]).map(([key, p]) => (
                <button
                  key={key}
                  onClick={async () => {
                    if (key === tenant.plan) return;
                    if (!confirm(`Changer le plan vers ${p.name} ?`)) return;
                    const res = await fetch(`/api/admin/platform/clients/${tenantId}`, {
                      method: 'PUT',
                      headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
                      body: JSON.stringify({ plan: key }),
                    });
                    if (res.ok) { toast.success('Plan mis a jour'); fetchTenant(); }
                  }}
                  className={`p-3 rounded-lg text-left text-sm border transition-all ${
                    tenant.plan === key
                      ? 'border-[var(--k-accent-indigo)] bg-[var(--k-accent-indigo-10)]'
                      : 'border-[var(--k-border-subtle)] hover:bg-[var(--k-glass-thin)]'
                  }`}
                >
                  <p className="font-medium text-[var(--k-text-primary)]">{p.name.replace('Koraline ', '')}</p>
                  <p className="text-xs text-[var(--k-text-secondary)]">{formatCurrency(p.monthlyPrice)}/mo</p>
                </button>
              ))}
            </div>
          </div>

          {/* Modules matrix */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Modules</h3>
            <div className="space-y-2">
              {(Object.entries(KORALINE_MODULES) as [KoralineModule, typeof KORALINE_MODULES[KoralineModule]][]).map(([key, mod]) => {
                const isEnabled = tenant.modulesEnabled.includes(key);
                return (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-[var(--k-border-subtle)] bg-[var(--k-glass-ultra-thin)]">
                    <div>
                      <p className="text-sm font-medium text-[var(--k-text-primary)]">{mod.name}</p>
                      <p className="text-xs text-[var(--k-text-tertiary)]">{mod.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--k-text-secondary)]">{formatCurrency(mod.monthlyPrice)}/mo</span>
                      <button
                        onClick={() => handleToggleModule(key, !isEnabled)}
                        className="transition-colors"
                      >
                        {isEnabled ? (
                          <ToggleRight className="w-8 h-8 text-[var(--k-accent-emerald)]" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-[var(--k-text-muted)]" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MRR Summary */}
          <div className="rounded-xl border border-[var(--k-border-default)] bg-[var(--k-glass-regular)] p-5 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--k-text-primary)]">MRR total</span>
            <span className="text-2xl font-bold text-[var(--k-accent-emerald)]">{formatCurrency(mrr)}</span>
          </div>

          {/* Employee licenses */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-3">Licences employes</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-[var(--k-text-primary)]">{stats.users} <span className="text-sm font-normal text-[var(--k-text-secondary)]">/ {tenant.maxEmployees} max</span></p>
                <div className="w-48 h-2 rounded-full bg-[var(--k-glass-thick)] mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--k-accent-indigo)]"
                    style={{ width: `${Math.min(100, (stats.users / Math.max(1, tenant.maxEmployees)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Configuration */}
      {/* ================================================================= */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Domain */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Domaine</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--k-text-secondary)]">Domaine Koraline</span>
                <span className="text-[var(--k-text-primary)] font-mono text-xs">{tenant.domainKoraline || `${tenant.slug}.koraline.app`}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--k-text-secondary)]">Domaine personnalise</span>
                <span className="text-[var(--k-text-primary)]">{tenant.domainCustom || 'Non configure'}</span>
              </div>
              {tenant.domainCustom && (
                <div className="flex justify-between items-center">
                  <span className="text-[var(--k-text-secondary)]">Verification DNS</span>
                  {tenant.domainVerified ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--k-accent-emerald)]"><Check className="w-3 h-3" /> Verifie</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-[var(--k-accent-amber)]"><AlertCircle className="w-3 h-3" /> Non verifie</span>
                  )}
                </div>
              )}
            </dl>
          </div>

          {/* Branding */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Branding</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">Couleur primaire</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editForm.primaryColor || '#0066CC'} onChange={(e) => setEditForm(prev => ({ ...prev, primaryColor: e.target.value }))} className="w-9 h-9 rounded-lg border border-[var(--k-border-subtle)] cursor-pointer bg-transparent" />
                  <span className="text-sm text-[var(--k-text-primary)] font-mono">{editForm.primaryColor || tenant.primaryColor}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">Couleur secondaire</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editForm.secondaryColor || '#003366'} onChange={(e) => setEditForm(prev => ({ ...prev, secondaryColor: e.target.value }))} className="w-9 h-9 rounded-lg border border-[var(--k-border-subtle)] cursor-pointer bg-transparent" />
                  <span className="text-sm text-[var(--k-text-primary)] font-mono">{editForm.secondaryColor || tenant.secondaryColor}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">Police</label>
                <p className="text-sm text-[var(--k-text-primary)]">{tenant.font}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={handleSaveDetails} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--k-glass-regular)] text-[var(--k-text-primary)] hover:bg-[var(--k-glass-thick)] transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Enregistrer
              </button>
            </div>
          </div>

          {/* Feature flags */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Feature flags</h3>
            {(() => {
              const flags = typeof tenant.featuresFlags === 'string' ? JSON.parse(tenant.featuresFlags) : (tenant.featuresFlags || {});
              const entries = Object.entries(flags) as [string, boolean][];
              if (entries.length === 0) {
                return <p className="text-sm text-[var(--k-text-muted)]">Aucun feature flag configure.</p>;
              }
              return (
                <div className="space-y-2">
                  {entries.map(([key, val]) => (
                    <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-[var(--k-glass-ultra-thin)]">
                      <span className="text-sm text-[var(--k-text-primary)] font-mono">{key}</span>
                      {val ? (
                        <ToggleRight className="w-6 h-6 text-[var(--k-accent-emerald)]" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-[var(--k-text-muted)]" />
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Activite */}
      {/* ================================================================= */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--k-text-secondary)]">Filtrer:</span>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="h-8 px-2 rounded-lg bg-[var(--k-glass-thin)] border border-[var(--k-border-subtle)] text-xs text-[var(--k-text-primary)] appearance-none cursor-pointer"
            >
              <option value="all">Tous</option>
              <option value="CREATED">Cree</option>
              <option value="STATUS_CHANGED">Statut</option>
              <option value="PLAN_CHANGED">Plan</option>
              <option value="MODULE_ENABLED">Module active</option>
              <option value="MODULE_DISABLED">Module desactive</option>
              <option value="NOTIFICATION_SENT">Notification</option>
            </select>
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            {filteredEvents.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-8 h-8 text-[var(--k-text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--k-text-secondary)]">Aucun evenement</p>
              </div>
            ) : (
              <div className="space-y-0">
                {filteredEvents.map((event, idx) => {
                  const EventIcon = EVENT_ICONS[event.type] || Clock;
                  return (
                    <div key={event.id} className="flex gap-4">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-[var(--k-glass-regular)] flex items-center justify-center shrink-0">
                          <EventIcon className="w-4 h-4 text-[var(--k-accent-indigo)]" />
                        </div>
                        {idx < filteredEvents.length - 1 && (
                          <div className="w-px flex-1 bg-[var(--k-border-subtle)] my-1" />
                        )}
                      </div>
                      {/* Content */}
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--k-text-primary)]">{event.type.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-[var(--k-text-muted)]">{formatDateTime(event.createdAt)}</span>
                        </div>
                        {event.actor && (
                          <p className="text-xs text-[var(--k-text-tertiary)]">par {event.actor}</p>
                        )}
                        {event.details && (
                          <p className="text-xs text-[var(--k-text-muted)] mt-1 font-mono">
                            {JSON.stringify(event.details)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB: Communication */}
      {/* ================================================================= */}
      {activeTab === 'communication' && (
        <div className="space-y-6">
          {/* Send notification form */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Envoyer une notification</h3>
            <form onSubmit={handleSendNotification} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--k-text-secondary)]">Titre</label>
                  <input
                    type="text"
                    value={notifForm.title}
                    onChange={(e) => setNotifForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Titre de la notification"
                    className={inputClasses}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[var(--k-text-secondary)]">Type</label>
                  <div className="relative">
                    <select
                      value={notifForm.type}
                      onChange={(e) => setNotifForm(prev => ({ ...prev, type: e.target.value }))}
                      className={selectClasses}
                    >
                      <option value="info">Information</option>
                      <option value="warning">Avertissement</option>
                      <option value="urgent">Urgent</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--k-text-secondary)]">Message</label>
                <textarea
                  value={notifForm.message}
                  onChange={(e) => setNotifForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Contenu de la notification..."
                  rows={3}
                  className={`w-full px-3 py-2 rounded-lg bg-[var(--k-bg-raised)] border border-[var(--k-border-subtle)]
                    text-sm text-[var(--k-text-primary)] placeholder:text-[var(--k-text-muted)] resize-y
                    focus:outline-none focus:ring-2 focus:ring-[var(--k-border-focus)] transition-shadow`}
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sendingNotif || !notifForm.title || !notifForm.message}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white
                    bg-gradient-to-r from-[#6366f1] to-[#818cf8] hover:from-[#5558e6] hover:to-[#7580f2]
                    disabled:opacity-50 transition-all"
                >
                  {sendingNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Envoyer
                </button>
              </div>
            </form>
          </div>

          {/* Notifications list */}
          <div className="rounded-xl border border-[var(--k-border-subtle)] bg-[var(--k-glass-thin)] p-5">
            <h3 className="text-sm font-semibold text-[var(--k-text-primary)] mb-4">Historique des notifications ({notifications.length})</h3>
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="w-8 h-8 text-[var(--k-text-muted)] mx-auto mb-2" />
                <p className="text-sm text-[var(--k-text-secondary)]">Aucune notification envoyee</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notif) => {
                  const typeConfig = NOTIFICATION_TYPE_CONFIG[notif.type] || NOTIFICATION_TYPE_CONFIG.info;
                  const TypeIcon = typeConfig.icon;
                  return (
                    <div key={notif.id} className="p-3 rounded-lg border border-[var(--k-border-subtle)] bg-[var(--k-glass-ultra-thin)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                            style={{ backgroundColor: typeConfig.bg }}
                          >
                            <TypeIcon className="w-4 h-4" style={{ color: typeConfig.text }} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[var(--k-text-primary)]">{notif.title}</p>
                            <p className="text-xs text-[var(--k-text-secondary)] mt-0.5">{notif.message}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[10px] text-[var(--k-text-muted)]">{formatDateTime(notif.createdAt)}</span>
                              {notif.createdBy && (
                                <span className="text-[10px] text-[var(--k-text-muted)]">par {notif.createdBy}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ backgroundColor: typeConfig.bg, color: typeConfig.text }}
                          >
                            {notif.type}
                          </span>
                          {notif.read ? (
                            <span aria-label="Lu"><Check className="w-3.5 h-3.5 text-[var(--k-accent-emerald)]" /></span>
                          ) : (
                            <span aria-label="Non lu"><X className="w-3.5 h-3.5 text-[var(--k-text-muted)]" /></span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
