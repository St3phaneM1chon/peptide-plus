'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Repeat,
  Users,
  Pause,
  DollarSign,
  Settings,
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

// ── Types ─────────────────────────────────────────────────────

interface Subscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  productName: string;
  formatName: string;
  quantity: number;
  frequency: 'EVERY_2_MONTHS' | 'EVERY_4_MONTHS' | 'EVERY_6_MONTHS' | 'EVERY_12_MONTHS';
  price: number;
  discount: number;
  nextDelivery: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function statusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'PAUSED': return 'warning';
    case 'CANCELLED': return 'error';
    default: return 'neutral';
  }
}

// ── Main Component ────────────────────────────────────────────

export default function AbonnementsPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const frequencyLabels: Record<string, string> = useMemo(() => ({
    EVERY_2_MONTHS: t('admin.subscriptions.frequencyEvery2Months'),
    EVERY_4_MONTHS: t('admin.subscriptions.frequencyEvery4Months'),
    EVERY_6_MONTHS: t('admin.subscriptions.frequencyEvery6Months'),
    EVERY_12_MONTHS: t('admin.subscriptions.frequencyEvery12Months'),
  }), [t]);

  const statusLabels: Record<string, string> = useMemo(() => ({
    ACTIVE: t('admin.subscriptions.statusActive'),
    PAUSED: t('admin.subscriptions.statusPaused'),
    CANCELLED: t('admin.subscriptions.statusCancelled'),
  }), [t]);

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/admin/subscriptions');
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      toast.error(t('common.error'));
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: 'ACTIVE' | 'PAUSED' | 'CANCELLED') => {
    try {
      const response = await fetch(`/api/admin/subscriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        return;
      }
      setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
      toast.success(t('admin.subscriptions.statusUpdated') || 'Status updated');
    } catch (err) {
      console.error('Error updating subscription status:', err);
      toast.error(t('common.networkError'));
    }
  };

  // ─── Filtering ──────────────────────────────────────────────

  const filteredSubscriptions = useMemo(() => {
    return subscriptions.filter(sub => {
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (!sub.userName.toLowerCase().includes(search) &&
            !sub.userEmail.toLowerCase().includes(search) &&
            !sub.productName.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [subscriptions, statusFilter, searchValue]);

  const stats = useMemo(() => ({
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'ACTIVE').length,
    paused: subscriptions.filter(s => s.status === 'PAUSED').length,
    cancelled: subscriptions.filter(s => s.status === 'CANCELLED').length,
    monthlyRevenue: subscriptions.filter(s => s.status === 'ACTIVE').reduce((sum, s) => {
      const multiplier = s.frequency === 'EVERY_2_MONTHS' ? 0.5 : s.frequency === 'EVERY_4_MONTHS' ? 0.25 : s.frequency === 'EVERY_6_MONTHS' ? (1/6) : (1/12);
      return sum + (s.price * (1 - s.discount / 100) * multiplier);
    }, 0),
  }), [subscriptions]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.subscriptions.allStatuses'), count: stats.total },
    { key: 'ACTIVE', label: t('admin.subscriptions.statusActive'), count: stats.active },
    { key: 'PAUSED', label: t('admin.subscriptions.statusPaused'), count: stats.paused },
    { key: 'CANCELLED', label: t('admin.subscriptions.statusCancelled'), count: stats.cancelled },
  ], [t, stats]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredSubscriptions.map((sub) => ({
      id: sub.id,
      avatar: { text: sub.userName || 'S' },
      title: sub.productName,
      subtitle: sub.userName,
      preview: `${sub.formatName} x${sub.quantity} - ${frequencyLabels[sub.frequency]} - ${formatCurrency(sub.price * (1 - sub.discount / 100))}`,
      timestamp: sub.createdAt,
      badges: [
        { text: statusLabels[sub.status] || sub.status, variant: statusBadgeVariant(sub.status) },
        ...(sub.discount > 0
          ? [{ text: `-${sub.discount}%`, variant: 'success' as const }]
          : []),
      ],
    }));
  }, [filteredSubscriptions, frequencyLabels, statusLabels]);

  // ─── Selected subscription ──────────────────────────────────

  const selectedSub = useMemo(() => {
    if (!selectedSubId) return null;
    return subscriptions.find(s => s.id === selectedSubId) || null;
  }, [subscriptions, selectedSubId]);

  const handleSelectSub = useCallback((id: string) => {
    setSelectedSubId(id);
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
            <h1 className="text-xl font-bold text-slate-900">{t('admin.subscriptions.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.subscriptions.subtitle')}</p>
          </div>
          <Button variant="primary" icon={Settings} onClick={() => {
            // TODO: Create API endpoint /api/admin/subscriptions/config and modal for configuration
            toast.info(t('admin.subscriptions.configureOptions') + ' - Coming soon');
          }}>
            {t('admin.subscriptions.configureOptions')}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard
            label={t('admin.subscriptions.total')}
            value={stats.total}
            icon={Repeat}
          />
          <StatCard
            label={t('admin.subscriptions.active')}
            value={stats.active}
            icon={Users}
            className="bg-green-50 border-green-200"
          />
          <StatCard
            label={t('admin.subscriptions.paused')}
            value={stats.paused}
            icon={Pause}
            className="bg-yellow-50 border-yellow-200"
          />
          <StatCard
            label={t('admin.subscriptions.estimatedMonthlyRevenue')}
            value={formatCurrency(stats.monthlyRevenue)}
            icon={DollarSign}
            className="bg-sky-50 border-sky-200"
          />
        </div>

        {/* Config section */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <h3 className="font-semibold text-slate-900 mb-3">{t('admin.subscriptions.subscriptionConfig')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="font-bold text-lg">15%</p>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.subscriberDiscount')}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="font-bold text-lg">{t('admin.subscriptions.free')}</p>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.subscriberShipping')}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="font-bold text-lg">{t('admin.subscriptions.days', { count: '3' })}</p>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.reminderBeforeDelivery')}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="font-bold text-lg">{t('admin.subscriptions.pausePerYear', { count: '1' })}</p>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.allowedPause')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedSubId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedSubId}
              onSelect={handleSelectSub}
              filterTabs={filterTabs}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.subscriptions.searchPlaceholder')}
              loading={loading}
              emptyIcon={Repeat}
              emptyTitle={t('admin.subscriptions.emptyTitle')}
              emptyDescription={t('admin.subscriptions.emptyDescription')}
            />
          }
          detail={
            selectedSub ? (
              <DetailPane
                header={{
                  title: selectedSub.productName,
                  subtitle: `${selectedSub.userName} - ${selectedSub.userEmail}`,
                  avatar: { text: selectedSub.userName || 'S' },
                  onBack: () => setSelectedSubId(null),
                  backLabel: t('admin.subscriptions.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      {selectedSub.status === 'ACTIVE' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateStatus(selectedSub.id, 'PAUSED')}
                        >
                          {t('admin.subscriptions.pause')}
                        </Button>
                      )}
                      {selectedSub.status === 'PAUSED' && (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => updateStatus(selectedSub.id, 'ACTIVE')}
                        >
                          {t('admin.subscriptions.resume')}
                        </Button>
                      )}
                      {selectedSub.status !== 'CANCELLED' && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => updateStatus(selectedSub.id, 'CANCELLED')}
                        >
                          {t('admin.subscriptions.cancel')}
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" onClick={() => {
                        // TODO: Create API endpoint PATCH /api/admin/subscriptions/:id for modifications (frequency, quantity, etc.)
                        toast.info(t('admin.subscriptions.modify') + ' - Coming soon');
                      }}>
                        {t('admin.subscriptions.modify')}
                      </Button>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
                      selectedSub.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
                      selectedSub.status === 'PAUSED' ? 'bg-amber-50 text-amber-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {statusLabels[selectedSub.status]}
                    </span>
                  </div>

                  {/* Client info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-2">{t('admin.subscriptions.client')}</h4>
                    <p className="font-medium text-slate-700">{selectedSub.userName}</p>
                    <p className="text-sm text-slate-500">{selectedSub.userEmail}</p>
                  </div>

                  {/* Product details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.subscriptions.product')}</p>
                      <p className="font-medium text-slate-900">{selectedSub.productName}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.subscriptions.format')}</p>
                      <p className="font-medium text-slate-900">{selectedSub.formatName} x {selectedSub.quantity}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.subscriptions.frequency')}</p>
                      <p className="font-medium text-slate-900">{frequencyLabels[selectedSub.frequency]}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.subscriptions.price')}</p>
                      <p className="font-medium text-slate-900">{formatCurrency(selectedSub.price * (1 - selectedSub.discount / 100))}</p>
                      {selectedSub.discount > 0 && (
                        <p className="text-xs text-green-600">-{selectedSub.discount}%</p>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.subscriptions.createdAt')}</p>
                      <p className="font-medium text-slate-900">
                        {new Date(selectedSub.createdAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t('admin.subscriptions.nextDelivery')}</p>
                      <p className="font-medium text-slate-900">
                        {selectedSub.status === 'ACTIVE'
                          ? new Date(selectedSub.nextDelivery).toLocaleDateString(locale)
                          : '-'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Repeat}
                emptyTitle={t('admin.subscriptions.emptyTitle')}
                emptyDescription={t('admin.subscriptions.emptyDescription')}
              />
            )
          }
        />
      </div>
    </div>
  );
}
