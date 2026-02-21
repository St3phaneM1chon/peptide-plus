'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Settings,
  Inbox,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetch-with-retry';

// ── Types ─────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────

const tierConfig: Record<string, { color: string; commission: number; minSales: number }> = {
  BRONZE: { color: 'bg-amber-100 text-amber-800', commission: 5, minSales: 0 },
  SILVER: { color: 'bg-slate-200 text-slate-700', commission: 8, minSales: 1000 },
  GOLD: { color: 'bg-yellow-100 text-yellow-800', commission: 10, minSales: 5000 },
  PLATINUM: { color: 'bg-blue-100 text-blue-800', commission: 15, minSales: 15000 },
};

function tierBadgeVariant(tier: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (tier) {
    case 'PLATINUM': return 'info';
    case 'GOLD': return 'success';
    case 'SILVER': return 'neutral';
    case 'BRONZE': return 'warning';
    default: return 'neutral';
  }
}

function statusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'PENDING': return 'warning';
    case 'SUSPENDED': return 'error';
    default: return 'neutral';
  }
}

// ── Main Component ────────────────────────────────────────────

export default function AmbassadeursPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAmbassadorId, setSelectedAmbassadorId] = useState<string | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchAmbassadors();
  }, []);

  const fetchAmbassadors = async () => {
    try {
      setLoading(true);
      const res = await fetchWithRetry('/api/ambassadors');
      if (res.ok) {
        const data = await res.json();
        setAmbassadors(data.ambassadors || []);
      } else {
        toast.error(t('common.error'));
      }
    } catch (error) {
      console.error('Failed to fetch ambassadors:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: 'ACTIVE' | 'SUSPENDED') => {
    const previous = ambassadors.find(a => a.id === id);
    if (!previous) return;

    // Optimistic update
    setAmbassadors(prev => prev.map(a => a.id === id ? { ...a, status } : a));

    try {
      const res = await fetch(`/api/ambassadors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        // Revert on failure
        setAmbassadors(prev => prev.map(a => a.id === id ? { ...a, status: previous.status } : a));
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.ambassadors.updateError') || 'Failed to update status');
        return;
      }
      toast.success(status === 'ACTIVE'
        ? (t('admin.ambassadors.activated') || 'Ambassador activated')
        : (t('admin.ambassadors.suspended') || 'Ambassador suspended'));
    } catch {
      // Revert on failure
      setAmbassadors(prev => prev.map(a => a.id === id ? { ...a, status: previous.status } : a));
      toast.error(t('admin.ambassadors.updateError') || 'Network error');
    }
  };

  const processPayout = async (id: string) => {
    try {
      const res = await fetch('/api/ambassadors/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ambassadorId: id }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t('admin.ambassadors.payoutError'));
        return;
      }

      const data = await res.json();
      toast.success(
        t('admin.ambassadors.payoutProcessed', {
          amount: data.payout.amount.toFixed(2),
          count: data.payout.commissionsCount,
        })
      );

      // Refresh the ambassador list to get updated figures
      await fetchAmbassadors();
    } catch (error) {
      console.error('Payout error:', error);
      toast.error(t('admin.ambassadors.payoutError'));
    }
  };

  // ─── Filtering ──────────────────────────────────────────────

  const filteredAmbassadors = useMemo(() => {
    return ambassadors.filter(amb => {
      if (statusFilter !== 'all' && amb.status !== statusFilter) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (!amb.userName.toLowerCase().includes(search) &&
            !amb.userEmail.toLowerCase().includes(search) &&
            !amb.referralCode.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [ambassadors, statusFilter, searchValue]);

  const stats = useMemo(() => ({
    total: ambassadors.filter(a => a.status === 'ACTIVE').length,
    totalSales: ambassadors.reduce((sum, a) => sum + a.totalSales, 0),
    totalCommissions: ambassadors.reduce((sum, a) => sum + a.totalEarnings, 0),
    pendingPayouts: ambassadors.reduce((sum, a) => sum + a.pendingPayout, 0),
    pending: ambassadors.filter(a => a.status === 'PENDING').length,
    suspended: ambassadors.filter(a => a.status === 'SUSPENDED').length,
  }), [ambassadors]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.ambassadors.allStatuses'), count: ambassadors.length },
    { key: 'ACTIVE', label: t('admin.ambassadors.statusActive'), count: stats.total },
    { key: 'PENDING', label: t('admin.ambassadors.statusPending'), count: stats.pending },
    { key: 'SUSPENDED', label: t('admin.ambassadors.statusSuspended'), count: stats.suspended },
  ], [t, ambassadors.length, stats]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredAmbassadors.map((amb) => ({
      id: amb.id,
      avatar: { text: amb.userName || 'A' },
      title: amb.userName,
      subtitle: amb.userEmail,
      preview: `${amb.referralCode} - ${formatCurrency(amb.totalSales)} ventes`,
      timestamp: amb.joinedAt,
      badges: [
        { text: amb.tier, variant: tierBadgeVariant(amb.tier) },
        { text: amb.status === 'ACTIVE' ? t('admin.ambassadors.statusActive') : amb.status === 'PENDING' ? t('admin.ambassadors.statusPending') : t('admin.ambassadors.statusSuspended'), variant: statusBadgeVariant(amb.status) },
        ...(amb.pendingPayout > 0
          ? [{ text: formatCurrency(amb.pendingPayout), variant: 'info' as const }]
          : []),
      ],
    }));
  }, [filteredAmbassadors, locale, t]);

  // ─── Selected ambassador ────────────────────────────────────

  const selectedAmbassador = useMemo(() => {
    if (!selectedAmbassadorId) return null;
    return ambassadors.find(a => a.id === selectedAmbassadorId) || null;
  }, [ambassadors, selectedAmbassadorId]);

  const handleSelectAmbassador = useCallback((id: string) => {
    setSelectedAmbassadorId(id);
  }, []);

  // ─── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.ambassadors.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.ambassadors.subtitle')}</p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" icon={Inbox} onClick={() => {
              // TODO: Create API endpoint /api/ambassadors/applications and dedicated page/modal
              toast.info(t('admin.ambassadors.applications') + ' - Coming soon');
            }}>
              {t('admin.ambassadors.applications')}
            </Button>
            <Button variant="primary" icon={Settings} onClick={() => {
              // TODO: Create API endpoint /api/ambassadors/config and modal for program configuration
              toast.info(t('admin.ambassadors.configureProgram') + ' - Coming soon');
            }}>
              {t('admin.ambassadors.configureProgram')}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard
            label={t('admin.ambassadors.activeAmbassadors')}
            value={stats.total}
            icon={Users}
          />
          <StatCard
            label={t('admin.ambassadors.generatedSales')}
            value={formatCurrency(stats.totalSales)}
            icon={TrendingUp}
            className="bg-green-50 border-green-200"
          />
          <StatCard
            label={t('admin.ambassadors.commissionsPaid')}
            value={formatCurrency(stats.totalCommissions)}
            icon={DollarSign}
            className="bg-sky-50 border-sky-200"
          />
          <StatCard
            label={t('admin.ambassadors.pendingPayouts')}
            value={formatCurrency(stats.pendingPayouts)}
            icon={Clock}
            className="bg-purple-50 border-purple-200"
          />
        </div>

        {/* Tiers Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <h3 className="font-semibold text-slate-900 mb-3">{t('admin.ambassadors.commissionLevels')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(tierConfig).map(([tier, config]) => (
              <div key={tier} className={`p-3 rounded-lg ${config.color}`}>
                <p className="font-bold">{tier}</p>
                <p className="text-sm">{t('admin.ambassadors.commissionPercent', { rate: config.commission })}</p>
                <p className="text-xs opacity-75">{config.minSales > 0 ? t('admin.ambassadors.minSales', { amount: config.minSales }) : t('admin.ambassadors.baseLevel')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedAmbassadorId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedAmbassadorId}
              onSelect={handleSelectAmbassador}
              filterTabs={filterTabs}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.ambassadors.searchPlaceholder')}
              loading={loading}
              emptyIcon={Users}
              emptyTitle={t('admin.ambassadors.emptyTitle')}
              emptyDescription={t('admin.ambassadors.emptyDescription')}
            />
          }
          detail={
            selectedAmbassador ? (
              <DetailPane
                header={{
                  title: selectedAmbassador.userName,
                  subtitle: selectedAmbassador.userEmail,
                  avatar: { text: selectedAmbassador.userName || 'A' },
                  onBack: () => setSelectedAmbassadorId(null),
                  backLabel: t('admin.ambassadors.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      {selectedAmbassador.status === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => updateStatus(selectedAmbassador.id, 'ACTIVE')}
                        >
                          {t('admin.ambassadors.approve')}
                        </Button>
                      )}
                      {selectedAmbassador.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => updateStatus(selectedAmbassador.id, 'SUSPENDED')}
                        >
                          {t('admin.ambassadors.suspend')}
                        </Button>
                      )}
                      {selectedAmbassador.status === 'SUSPENDED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => updateStatus(selectedAmbassador.id, 'ACTIVE')}
                        >
                          {t('admin.ambassadors.activate')}
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => {
                        // TODO: Create API endpoint PATCH /api/ambassadors/:id/commission and modal for editing commission rate
                        toast.info(t('admin.ambassadors.editCommission') + ' - Coming soon');
                      }}>
                        {t('admin.ambassadors.editCommission')}
                      </Button>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      selectedAmbassador.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
                      selectedAmbassador.status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {selectedAmbassador.status === 'ACTIVE' ? t('admin.ambassadors.statusActive') :
                       selectedAmbassador.status === 'PENDING' ? t('admin.ambassadors.statusPending') :
                       t('admin.ambassadors.statusSuspended')}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierConfig[selectedAmbassador.tier].color}`}>
                      {selectedAmbassador.tier}
                    </span>
                  </div>

                  {/* Key stats grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.ambassadors.referralCode')}</p>
                      <code className="font-mono font-bold text-lg text-sky-600">{selectedAmbassador.referralCode}</code>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.ambassadors.commissionLabel')}</p>
                      <p className="font-bold text-lg">{selectedAmbassador.commissionRate}%</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.ambassadors.referralsLabel')}</p>
                      <p className="font-bold text-lg">{selectedAmbassador.totalReferrals}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.ambassadors.generatedSalesLabel')}</p>
                      <p className="font-bold text-lg">{formatCurrency(selectedAmbassador.totalSales)}</p>
                    </div>
                  </div>

                  {/* Earnings */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-3">{t('admin.ambassadors.totalEarningsLabel')}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-500">{t('admin.ambassadors.totalEarningsLabel')}</p>
                        <p className="font-bold text-lg">{formatCurrency(selectedAmbassador.totalEarnings)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500">{t('admin.ambassadors.pendingPayoutLabel')}</p>
                        {selectedAmbassador.pendingPayout > 0 ? (
                          <div className="flex items-center gap-3">
                            <p className="font-bold text-lg text-purple-600">{formatCurrency(selectedAmbassador.pendingPayout)}</p>
                            <button
                              onClick={() => processPayout(selectedAmbassador.id)}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                            >
                              {t('admin.ambassadors.processPayoutNow')}
                            </button>
                          </div>
                        ) : (
                          <p className="text-slate-400">{t('admin.ambassadors.noPendingPayout')}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Tier info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-2">{t('admin.ambassadors.tierLabel')}</h4>
                    <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${tierConfig[selectedAmbassador.tier].color}`}>
                      {selectedAmbassador.tier} ({selectedAmbassador.commissionRate}%)
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {t('admin.ambassadors.referralsCount', { count: selectedAmbassador.totalReferrals })}
                    </p>
                  </div>

                  {/* Joined date */}
                  <div className="text-sm text-slate-500">
                    {t('admin.ambassadors.joinedAt') || 'Membre depuis'}: {new Date(selectedAmbassador.joinedAt).toLocaleDateString(locale)}
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Users}
                emptyTitle={t('admin.ambassadors.emptyTitle')}
                emptyDescription={t('admin.ambassadors.emptyDescription')}
              />
            )
          }
        />
      </div>
    </div>
  );
}
