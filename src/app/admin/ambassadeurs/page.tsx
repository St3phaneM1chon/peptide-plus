'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Settings,
  Inbox,
  Eye,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  Button,
  Modal,
  DataTable,
  FilterBar,
  SelectFilter,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

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
  BRONZE: { color: 'bg-amber-100 text-amber-800', commission: 5, minSales: 0 },
  SILVER: { color: 'bg-slate-200 text-slate-700', commission: 8, minSales: 1000 },
  GOLD: { color: 'bg-yellow-100 text-yellow-800', commission: 10, minSales: 5000 },
  PLATINUM: { color: 'bg-blue-100 text-blue-800', commission: 15, minSales: 15000 },
};

export default function AmbassadeursPage() {
  const { t, locale } = useI18n();
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', tier: '', search: '' });
  const [selectedAmbassador, setSelectedAmbassador] = useState<Ambassador | null>(null);
  const [, setShowApplications] = useState(false);

  useEffect(() => {
    fetchAmbassadors();
  }, []);

  const fetchAmbassadors = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ambassadors');
      if (res.ok) {
        const data = await res.json();
        setAmbassadors(data.ambassadors || []);
      }
    } catch (error) {
      console.error('Failed to fetch ambassadors:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = (id: string, status: 'ACTIVE' | 'SUSPENDED') => {
    setAmbassadors(ambassadors.map(a => a.id === id ? { ...a, status } : a));
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

  const columns: Column<Ambassador>[] = [
    {
      key: 'ambassador',
      header: t('admin.ambassadors.colAmbassador'),
      render: (amb) => (
        <div>
          <p className="font-medium text-slate-900">{amb.userName}</p>
          <p className="text-xs text-slate-500">{amb.userEmail}</p>
          <p className="text-xs text-slate-400">{t('admin.ambassadors.referralsCount', { count: amb.totalReferrals })}</p>
        </div>
      ),
    },
    {
      key: 'code',
      header: t('admin.ambassadors.colCode'),
      render: (amb) => (
        <code className="font-mono font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded">
          {amb.referralCode}
        </code>
      ),
    },
    {
      key: 'tier',
      header: t('admin.ambassadors.colTier'),
      align: 'center',
      render: (amb) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tierConfig[amb.tier].color}`}>
          {amb.tier} ({amb.commissionRate}%)
        </span>
      ),
    },
    {
      key: 'sales',
      header: t('admin.ambassadors.colSales'),
      align: 'right',
      render: (amb) => (
        <span className="font-medium text-slate-900">
          {amb.totalSales.toLocaleString(locale)} $
        </span>
      ),
    },
    {
      key: 'earnings',
      header: t('admin.ambassadors.colEarnings'),
      align: 'right',
      render: (amb) => (
        <span className="text-slate-600">{amb.totalEarnings.toFixed(2)} $</span>
      ),
    },
    {
      key: 'pending',
      header: t('admin.ambassadors.colPending'),
      align: 'right',
      render: (amb) => (
        amb.pendingPayout > 0 ? (
          <span className="text-purple-600 font-medium">{amb.pendingPayout.toFixed(2)} $</span>
        ) : (
          <span className="text-slate-400">-</span>
        )
      ),
    },
    {
      key: 'actions',
      header: t('admin.ambassadors.colActions'),
      align: 'center',
      render: (amb) => (
        <div className="flex items-center justify-center gap-2">
          {amb.status === 'PENDING' && (
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus(amb.id, 'ACTIVE'); }}
              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
            >
              {t('admin.ambassadors.approve')}
            </button>
          )}
          {amb.pendingPayout > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); processPayout(amb.id); }}
              className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
            >
              {t('admin.ambassadors.pay')}
            </button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={(e) => { e.stopPropagation(); setSelectedAmbassador(amb); }}
          >
            {t('admin.ambassadors.details')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.ambassadors.title')}
        subtitle={t('admin.ambassadors.subtitle')}
        actions={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              icon={Inbox}
              onClick={() => setShowApplications(true)}
            >
              <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">1</span>
              {t('admin.ambassadors.applications')}
            </Button>
            <Button variant="primary" icon={Settings}>
              {t('admin.ambassadors.configureProgram')}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label={t('admin.ambassadors.activeAmbassadors')}
          value={stats.total}
          icon={Users}
        />
        <StatCard
          label={t('admin.ambassadors.generatedSales')}
          value={`${stats.totalSales.toLocaleString(locale)} $`}
          icon={TrendingUp}
          className="bg-green-50 border-green-200"
        />
        <StatCard
          label={t('admin.ambassadors.commissionsPaid')}
          value={`${stats.totalCommissions.toLocaleString(locale)} $`}
          icon={DollarSign}
          className="bg-sky-50 border-sky-200"
        />
        <StatCard
          label={t('admin.ambassadors.pendingPayouts')}
          value={`${stats.pendingPayouts.toFixed(2)} $`}
          icon={Clock}
          className="bg-purple-50 border-purple-200"
        />
      </div>

      {/* Tiers Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-3">{t('admin.ambassadors.commissionLevels')}</h3>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(tierConfig).map(([tier, config]) => (
            <div key={tier} className={`p-3 rounded-lg ${config.color}`}>
              <p className="font-bold">{tier}</p>
              <p className="text-sm">{t('admin.ambassadors.commissionPercent', { rate: config.commission })}</p>
              <p className="text-xs opacity-75">{config.minSales > 0 ? t('admin.ambassadors.minSales', { amount: config.minSales }) : t('admin.ambassadors.baseLevel')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(v) => setFilter({ ...filter, search: v })}
        searchPlaceholder={t('admin.ambassadors.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.ambassadors.allStatuses')}
          value={filter.status}
          onChange={(v) => setFilter({ ...filter, status: v })}
          options={[
            { value: 'ACTIVE', label: t('admin.ambassadors.statusActive') },
            { value: 'PENDING', label: t('admin.ambassadors.statusPending') },
            { value: 'SUSPENDED', label: t('admin.ambassadors.statusSuspended') },
          ]}
        />
        <SelectFilter
          label={t('admin.ambassadors.allTiers')}
          value={filter.tier}
          onChange={(v) => setFilter({ ...filter, tier: v })}
          options={[
            { value: 'BRONZE', label: 'Bronze' },
            { value: 'SILVER', label: 'Silver' },
            { value: 'GOLD', label: 'Gold' },
            { value: 'PLATINUM', label: 'Platinum' },
          ]}
        />
      </FilterBar>

      {/* Ambassadors List */}
      <DataTable
        columns={columns}
        data={filteredAmbassadors}
        keyExtractor={(amb) => amb.id}
        loading={loading}
        emptyTitle={t('admin.ambassadors.emptyTitle')}
        emptyDescription={t('admin.ambassadors.emptyDescription')}
      />

      {/* Ambassador Detail Modal */}
      <Modal
        isOpen={!!selectedAmbassador}
        onClose={() => setSelectedAmbassador(null)}
        title={selectedAmbassador?.userName || ''}
        footer={
          selectedAmbassador && (
            <>
              {selectedAmbassador.status === 'ACTIVE' ? (
                <Button
                  variant="danger"
                  onClick={() => { updateStatus(selectedAmbassador.id, 'SUSPENDED'); setSelectedAmbassador(null); }}
                >
                  {t('admin.ambassadors.suspend')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => { updateStatus(selectedAmbassador.id, 'ACTIVE'); setSelectedAmbassador(null); }}
                >
                  {t('admin.ambassadors.activate')}
                </Button>
              )}
              <Button variant="primary">
                {t('admin.ambassadors.editCommission')}
              </Button>
            </>
          )
        }
      >
        {selectedAmbassador && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">{t('admin.ambassadors.referralCode')}</p>
              <code className="font-mono font-bold text-lg">{selectedAmbassador.referralCode}</code>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.ambassadors.tierLabel')}</p>
              <span className={`px-2 py-1 rounded-full text-sm font-medium ${tierConfig[selectedAmbassador.tier].color}`}>
                {selectedAmbassador.tier}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.ambassadors.commissionLabel')}</p>
              <p className="font-bold">{selectedAmbassador.commissionRate}%</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.ambassadors.referralsLabel')}</p>
              <p className="font-bold">{selectedAmbassador.totalReferrals}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.ambassadors.generatedSalesLabel')}</p>
              <p className="font-bold">{selectedAmbassador.totalSales.toLocaleString(locale)} $</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.ambassadors.totalEarningsLabel')}</p>
              <p className="font-bold">{selectedAmbassador.totalEarnings.toFixed(2)} $</p>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-200">
              <p className="text-sm text-slate-500">{t('admin.ambassadors.pendingPayoutLabel')}</p>
              {selectedAmbassador.pendingPayout > 0 ? (
                <div className="flex items-center gap-3 mt-1">
                  <p className="font-bold text-purple-600 text-lg">{selectedAmbassador.pendingPayout.toFixed(2)} $</p>
                  <button
                    onClick={() => { processPayout(selectedAmbassador.id); setSelectedAmbassador(null); }}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
                  >
                    {t('admin.ambassadors.processPayoutNow')}
                  </button>
                </div>
              ) : (
                <p className="text-slate-400 mt-1">{t('admin.ambassadors.noPendingPayout')}</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
