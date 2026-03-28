'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Loader2, Trash2, Users, Crown, DollarSign,
  Pause, Play, Ban, Search, Edit2, Shield,
} from 'lucide-react';
import { PageHeader, Button, Modal, FormField, Input, EmptyState, StatusBadge } from '@/components/admin';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { addCSRFHeader } from '@/lib/csrf';

// ─── Types ──────────────────────────────────────────────

interface MembershipPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  currency: string;
  interval: string;
  features: string[];
  contentAccess: string[];
  maxMembers: number | null;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
  stripePriceId: string | null;
  createdAt: string;
  _count: { members: number };
}

interface MembershipMember {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  cancelledAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string; image: string | null };
  plan: { id: string; name: string; slug: string; interval: string; price: number | string; currency: string };
}

// ─── Component ──────────────────────────────────────────

export default function MembershipPage() {
  const { t } = useI18n();

  // Tab state
  const [activeTab, setActiveTab] = useState<'plans' | 'members'>('plans');

  // Plans state
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Members state
  const [members, setMembers] = useState<MembershipMember[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersSearch, setMembersSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState('');
  const [memberPlanFilter, setMemberPlanFilter] = useState('');

  // Plan form state
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [planForm, setPlanForm] = useState({
    name: '', slug: '', description: '', price: 0, currency: 'CAD',
    interval: 'monthly', features: '', contentAccess: '', maxMembers: '',
    trialDays: 0, isActive: true, sortOrder: 0, stripePriceId: '',
  });
  const [planSaving, setPlanSaving] = useState(false);

  // Confirm dialog
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; planId: string; planName: string }>({
    isOpen: false, planId: '', planName: '',
  });

  // ─── Load Plans ──────────────────────────────────────────

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const res = await fetchWithRetry('/api/admin/membership/plans?limit=100');
      if (res.ok) {
        const json = await res.json();
        setPlans(json.data || []);
      }
    } catch {
      toast.error(t('admin.membership.errorLoadingPlans'));
    } finally {
      setPlansLoading(false);
    }
  }, [t]);

  // ─── Load Members ──────────────────────────────────────────

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (membersSearch) params.set('search', membersSearch);
      if (memberStatusFilter) params.set('status', memberStatusFilter);
      if (memberPlanFilter) params.set('planId', memberPlanFilter);

      const res = await fetchWithRetry(`/api/admin/membership/members?${params}`);
      if (res.ok) {
        const json = await res.json();
        setMembers(json.data || []);
        setMembersTotal(json.total || 0);
      }
    } catch {
      toast.error(t('admin.membership.errorLoadingMembers'));
    } finally {
      setMembersLoading(false);
    }
  }, [t, membersSearch, memberStatusFilter, memberPlanFilter]);

  useEffect(() => { loadPlans(); }, [loadPlans]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ─── Plan CRUD ──────────────────────────────────────────

  const openPlanForm = (plan?: MembershipPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || '',
        price: Number(plan.price),
        currency: plan.currency,
        interval: plan.interval,
        features: (plan.features || []).join('\n'),
        contentAccess: (plan.contentAccess || []).join('\n'),
        maxMembers: plan.maxMembers?.toString() || '',
        trialDays: plan.trialDays,
        isActive: plan.isActive,
        sortOrder: plan.sortOrder,
        stripePriceId: plan.stripePriceId || '',
      });
    } else {
      setEditingPlan(null);
      setPlanForm({
        name: '', slug: '', description: '', price: 0, currency: 'CAD',
        interval: 'monthly', features: '', contentAccess: '', maxMembers: '',
        trialDays: 0, isActive: true, sortOrder: 0, stripePriceId: '',
      });
    }
    setShowPlanModal(true);
  };

  const savePlan = async () => {
    setPlanSaving(true);
    try {
      const payload = {
        name: planForm.name,
        slug: planForm.slug || planForm.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: planForm.description || null,
        price: planForm.price,
        currency: planForm.currency,
        interval: planForm.interval,
        features: planForm.features.split('\n').map((s) => s.trim()).filter(Boolean),
        contentAccess: planForm.contentAccess.split('\n').map((s) => s.trim()).filter(Boolean),
        maxMembers: planForm.maxMembers ? parseInt(planForm.maxMembers, 10) : null,
        trialDays: planForm.trialDays,
        isActive: planForm.isActive,
        sortOrder: planForm.sortOrder,
        stripePriceId: planForm.stripePriceId || null,
      };

      const url = editingPlan
        ? `/api/admin/membership/plans/${editingPlan.id}`
        : '/api/admin/membership/plans';
      const method = editingPlan ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingPlan ? t('admin.membership.planUpdated') : t('admin.membership.planCreated'));
        setShowPlanModal(false);
        loadPlans();
      } else {
        const err = await res.json();
        toast.error(err.error || t('admin.membership.errorSavingPlan'));
      }
    } catch {
      toast.error(t('admin.membership.errorSavingPlan'));
    } finally {
      setPlanSaving(false);
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      const res = await fetch(`/api/admin/membership/plans/${planId}`, {
        method: 'DELETE',
        headers: addCSRFHeader(),
      });
      if (res.ok) {
        toast.success(t('admin.membership.planDeleted'));
        loadPlans();
      } else {
        const err = await res.json();
        toast.error(err.error || t('admin.membership.errorDeletingPlan'));
      }
    } catch {
      toast.error(t('admin.membership.errorDeletingPlan'));
    }
  };

  // ─── Member Actions ──────────────────────────────────────

  const updateMemberStatus = async (memberId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/membership/members/${memberId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(t('admin.membership.memberUpdated'));
        loadMembers();
      } else {
        const err = await res.json();
        toast.error(err.error || t('admin.membership.errorUpdatingMember'));
      }
    } catch {
      toast.error(t('admin.membership.errorUpdatingMember'));
    }
  };

  // ─── Stats ──────────────────────────────────────────

  const totalPlans = plans.length;
  const activePlans = plans.filter((p) => p.isActive).length;
  const totalMembers = plans.reduce((sum, p) => sum + (p._count?.members || 0), 0);
  const totalRevenue = plans.reduce((sum, p) => {
    if (p.interval === 'free' || Number(p.price) === 0) return sum;
    return sum + Number(p.price) * (p._count?.members || 0);
  }, 0);

  // ─── Status badge helper ──────────────────────────────────

  const statusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success' as const;
      case 'trialing': return 'info' as const;
      case 'paused': return 'warning' as const;
      case 'cancelled': return 'error' as const;
      case 'expired': return 'neutral' as const;
      default: return 'neutral' as const;
    }
  };

  const intervalLabel = (interval: string) => {
    switch (interval) {
      case 'monthly': return t('admin.membership.monthly');
      case 'yearly': return t('admin.membership.yearly');
      case 'one_time': return t('admin.membership.oneTime');
      case 'free': return t('admin.membership.free');
      default: return interval;
    }
  };

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.membership.title')}
        subtitle={t('admin.membership.description')}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <Crown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.membership.totalPlans')}</p>
              <p className="text-2xl font-bold">{totalPlans}</p>
              <p className="text-xs text-gray-400">{activePlans} {t('admin.membership.active')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
              <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.membership.totalMembers')}</p>
              <p className="text-2xl font-bold">{totalMembers}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.membership.monthlyRevenue')}</p>
              <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.membership.gatedContent')}</p>
              <p className="text-2xl font-bold">
                {new Set(plans.flatMap((p) => p.contentAccess || [])).size}
              </p>
              <p className="text-xs text-gray-400">{t('admin.membership.contentRules')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('plans')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'plans'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Crown className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            {t('admin.membership.plans')} ({totalPlans})
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'members'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
            {t('admin.membership.members')} ({membersTotal})
          </button>
        </nav>
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => openPlanForm()} variant="primary">
              <Plus className="w-4 h-4 mr-1.5" />
              {t('admin.membership.newPlan')}
            </Button>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : plans.length === 0 ? (
            <EmptyState
              title={t('admin.membership.noPlans')}
              description={t('admin.membership.noPlansDesc')}
              icon={Crown}
              action={<button onClick={() => openPlanForm()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">{t('admin.membership.newPlan')}</button>}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl border p-5 relative ${
                    plan.isActive
                      ? 'border-gray-200 dark:border-gray-700'
                      : 'border-gray-100 dark:border-gray-800 opacity-60'
                  }`}
                >
                  {!plan.isActive && (
                    <span className="absolute top-3 right-3 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded">
                      {t('admin.membership.inactive')}
                    </span>
                  )}
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{plan.description}</p>
                  )}
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-3xl font-bold">
                      {plan.interval === 'free' ? t('admin.membership.free') : `$${Number(plan.price).toFixed(2)}`}
                    </span>
                    {plan.interval !== 'free' && plan.interval !== 'one_time' && (
                      <span className="text-sm text-gray-400">/{intervalLabel(plan.interval)}</span>
                    )}
                    {plan.interval === 'one_time' && (
                      <span className="text-sm text-gray-400">{t('admin.membership.oneTime')}</span>
                    )}
                  </div>

                  {/* Features list */}
                  {(plan.features as string[])?.length > 0 && (
                    <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mb-3">
                      {(plan.features as string[]).slice(0, 4).map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="text-green-500 text-xs">&#10003;</span> {f}
                        </li>
                      ))}
                      {(plan.features as string[]).length > 4 && (
                        <li className="text-gray-400 text-xs">+{(plan.features as string[]).length - 4} {t('common.more')}</li>
                      )}
                    </ul>
                  )}

                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
                    <span className="text-sm text-gray-500">
                      <Users className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                      {plan._count.members} {t('admin.membership.members')}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openPlanForm(plan)}
                        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ isOpen: true, planId: plan.id, planName: plan.name })}
                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('admin.membership.searchMembers')}
                value={membersSearch}
                onChange={(e) => setMembersSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <select
              value={memberStatusFilter}
              onChange={(e) => setMemberStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">{t('admin.membership.allStatuses')}</option>
              <option value="active">{t('admin.membership.statusActive')}</option>
              <option value="trialing">{t('admin.membership.statusTrialing')}</option>
              <option value="paused">{t('admin.membership.statusPaused')}</option>
              <option value="cancelled">{t('admin.membership.statusCancelled')}</option>
              <option value="expired">{t('admin.membership.statusExpired')}</option>
            </select>
            <select
              value={memberPlanFilter}
              onChange={(e) => setMemberPlanFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">{t('admin.membership.allPlans')}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {membersLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              title={t('admin.membership.noMembers')}
              description={t('admin.membership.noMembersDesc')}
              icon={Users}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">{t('admin.membership.member')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">{t('admin.membership.plan')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">{t('admin.membership.status')}</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">{t('admin.membership.since')}</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-500">{t('admin.membership.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {m.user.image ? (
                            <img src={m.user.image} alt="" className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                              {(m.user.name || m.user.email)?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{m.user.name || m.user.email}</p>
                            <p className="text-xs text-gray-400">{m.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{m.plan.name}</span>
                        <p className="text-xs text-gray-400">
                          {Number(m.plan.price) > 0 ? `$${Number(m.plan.price).toFixed(2)}/${m.plan.interval}` : t('admin.membership.free')}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge variant={statusVariant(m.status)}>
                          {t(`admin.membership.status${m.status.charAt(0).toUpperCase() + m.status.slice(1)}`)}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(m.startDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {m.status === 'active' && (
                            <>
                              <button
                                onClick={() => updateMemberStatus(m.id, 'paused')}
                                className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600"
                                title={t('admin.membership.pause')}
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => updateMemberStatus(m.id, 'cancelled')}
                                className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                                title={t('admin.membership.cancel')}
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          {m.status === 'paused' && (
                            <button
                              onClick={() => updateMemberStatus(m.id, 'active')}
                              className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600"
                              title={t('admin.membership.reactivate')}
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {m.status === 'cancelled' && (
                            <button
                              onClick={() => updateMemberStatus(m.id, 'active')}
                              className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600"
                              title={t('admin.membership.reactivate')}
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Plan Create/Edit Modal */}
      {showPlanModal && (
        <Modal
          isOpen={showPlanModal}
          onClose={() => setShowPlanModal(false)}
          title={editingPlan ? t('admin.membership.editPlan') : t('admin.membership.newPlan')}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
            <FormField label={t('admin.membership.planName')} required>
              <Input
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                placeholder="Premium"
              />
            </FormField>
            <FormField label={t('admin.membership.slug')} hint={t('admin.membership.slugHint')}>
              <Input
                value={planForm.slug}
                onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="premium"
              />
            </FormField>
            <FormField label={t('admin.membership.planDescription')}>
              <textarea
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                rows={2}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.membership.price')}>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: parseFloat(e.target.value) || 0 })}
                />
              </FormField>
              <FormField label={t('admin.membership.interval')}>
                <select
                  value={planForm.interval}
                  onChange={(e) => setPlanForm({ ...planForm, interval: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                >
                  <option value="free">{t('admin.membership.free')}</option>
                  <option value="monthly">{t('admin.membership.monthly')}</option>
                  <option value="yearly">{t('admin.membership.yearly')}</option>
                  <option value="one_time">{t('admin.membership.oneTime')}</option>
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('admin.membership.trialDays')}>
                <Input
                  type="number"
                  min="0"
                  value={planForm.trialDays}
                  onChange={(e) => setPlanForm({ ...planForm, trialDays: parseInt(e.target.value) || 0 })}
                />
              </FormField>
              <FormField label={t('admin.membership.maxMembers')} hint={t('admin.membership.maxMembersHint')}>
                <Input
                  type="number"
                  min="0"
                  value={planForm.maxMembers}
                  onChange={(e) => setPlanForm({ ...planForm, maxMembers: e.target.value })}
                  placeholder={t('admin.membership.unlimited')}
                />
              </FormField>
            </div>
            <FormField label={t('admin.membership.features')} hint={t('admin.membership.featuresHint')}>
              <textarea
                value={planForm.features}
                onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono"
                rows={3}
                placeholder="Access to premium articles&#10;Early access to new products&#10;VIP support"
              />
            </FormField>
            <FormField label={t('admin.membership.contentAccess')} hint={t('admin.membership.contentAccessHint')}>
              <textarea
                value={planForm.contentAccess}
                onChange={(e) => setPlanForm({ ...planForm, contentAccess: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono"
                rows={3}
                placeholder="blog:premium&#10;article:*&#10;page:vip-lounge"
              />
            </FormField>
            <FormField label={t('admin.membership.stripePriceId')} hint={t('admin.membership.stripePriceIdHint')}>
              <Input
                value={planForm.stripePriceId}
                onChange={(e) => setPlanForm({ ...planForm, stripePriceId: e.target.value })}
                placeholder="price_..."
              />
            </FormField>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="planActive"
                checked={planForm.isActive}
                onChange={(e) => setPlanForm({ ...planForm, isActive: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="planActive" className="text-sm">{t('admin.membership.planActive')}</label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="ghost" onClick={() => setShowPlanModal(false)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" onClick={savePlan} disabled={planSaving || !planForm.name}>
                {planSaving && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                {editingPlan ? t('common.save') : t('common.create')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        onCancel={() => setConfirmDelete({ isOpen: false, planId: '', planName: '' })}
        onConfirm={() => {
          deletePlan(confirmDelete.planId);
          setConfirmDelete({ isOpen: false, planId: '', planName: '' });
        }}
        title={t('admin.membership.deletePlanTitle')}
        message={`${t('admin.membership.deletePlanConfirm')} "${confirmDelete.planName}"?`}
        confirmLabel={t('common.delete')}
        variant="danger"
      />
    </div>
  );
}
