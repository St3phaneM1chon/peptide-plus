'use client';

import { useState, useEffect } from 'react';
import {
  Repeat,
  Users,
  Pause,
  DollarSign,
  Settings,
  Eye,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  Button,
  Modal,
  DataTable,
  FilterBar,
  SelectFilter,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';

interface Subscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  productName: string;
  formatName: string;
  quantity: number;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY';
  price: number;
  discount: number;
  nextDelivery: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  createdAt: string;
}

const statusVariant: Record<string, 'success' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  CANCELLED: 'error',
};

export default function AbonnementsPage() {
  const { t, locale } = useI18n();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', search: '' });
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  const frequencyLabels: Record<string, string> = {
    WEEKLY: t('admin.subscriptions.frequencyWeekly'),
    BIWEEKLY: t('admin.subscriptions.frequencyBiweekly'),
    MONTHLY: t('admin.subscriptions.frequencyMonthly'),
    BIMONTHLY: t('admin.subscriptions.frequencyBimonthly'),
  };

  const statusLabels: Record<string, string> = {
    ACTIVE: t('admin.subscriptions.statusActive'),
    PAUSED: t('admin.subscriptions.statusPaused'),
    CANCELLED: t('admin.subscriptions.statusCancelled'),
  };

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
      setSubscriptions([]);
    }
    setLoading(false);
  };

  const updateStatus = (id: string, status: 'ACTIVE' | 'PAUSED' | 'CANCELLED') => {
    setSubscriptions(subscriptions.map(s => s.id === id ? { ...s, status } : s));
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (filter.status && sub.status !== filter.status) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!sub.userName.toLowerCase().includes(search) &&
          !sub.userEmail.toLowerCase().includes(search) &&
          !sub.productName.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    active: subscriptions.filter(s => s.status === 'ACTIVE').length,
    paused: subscriptions.filter(s => s.status === 'PAUSED').length,
    monthlyRevenue: subscriptions.filter(s => s.status === 'ACTIVE').reduce((sum, s) => {
      const multiplier = s.frequency === 'WEEKLY' ? 4 : s.frequency === 'BIWEEKLY' ? 2 : s.frequency === 'MONTHLY' ? 1 : 0.5;
      return sum + (s.price * (1 - s.discount / 100) * multiplier);
    }, 0),
  };

  const columns: Column<Subscription>[] = [
    {
      key: 'client',
      header: t('admin.subscriptions.colClient'),
      render: (sub) => (
        <div>
          <p className="font-medium text-slate-900">{sub.userName}</p>
          <p className="text-xs text-slate-500">{sub.userEmail}</p>
        </div>
      ),
    },
    {
      key: 'product',
      header: t('admin.subscriptions.colProduct'),
      render: (sub) => (
        <div>
          <p className="font-medium text-slate-900">{sub.productName}</p>
          <p className="text-xs text-slate-500">{sub.formatName} x {sub.quantity}</p>
        </div>
      ),
    },
    {
      key: 'frequency',
      header: t('admin.subscriptions.colFrequency'),
      render: (sub) => (
        <span className="text-slate-600">{frequencyLabels[sub.frequency]}</span>
      ),
    },
    {
      key: 'price',
      header: t('admin.subscriptions.colPrice'),
      align: 'right',
      render: (sub) => (
        <div>
          <p className="font-medium text-slate-900">{(sub.price * (1 - sub.discount / 100)).toFixed(2)} $</p>
          <p className="text-xs text-green-600">-{sub.discount}%</p>
        </div>
      ),
    },
    {
      key: 'nextDelivery',
      header: t('admin.subscriptions.colNextDelivery'),
      render: (sub) => (
        <span className="text-slate-600">
          {sub.status === 'ACTIVE'
            ? new Date(sub.nextDelivery).toLocaleDateString(locale)
            : '-'
          }
        </span>
      ),
    },
    {
      key: 'status',
      header: t('admin.subscriptions.colStatus'),
      align: 'center',
      render: (sub) => (
        <StatusBadge variant={statusVariant[sub.status]} dot>
          {statusLabels[sub.status]}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: t('admin.subscriptions.colActions'),
      align: 'center',
      render: (sub) => (
        <div className="flex items-center justify-center gap-2">
          {sub.status === 'ACTIVE' && (
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus(sub.id, 'PAUSED'); }}
              className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200"
            >
              {t('admin.subscriptions.pause')}
            </button>
          )}
          {sub.status === 'PAUSED' && (
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus(sub.id, 'ACTIVE'); }}
              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
            >
              {t('admin.subscriptions.resume')}
            </button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={(e) => { e.stopPropagation(); setSelectedSub(sub); }}
          >
            {t('admin.subscriptions.details')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.subscriptions.title')}
        subtitle={t('admin.subscriptions.subtitle')}
        actions={
          <Button variant="primary" icon={Settings}>
            {t('admin.subscriptions.configureOptions')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label={t('admin.subscriptions.total')}
          value={subscriptions.length}
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
          value={`${stats.monthlyRevenue.toFixed(0)} $`}
          icon={DollarSign}
          className="bg-sky-50 border-sky-200"
        />
      </div>

      {/* Config */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-3">{t('admin.subscriptions.subscriptionConfig')}</h3>
        <div className="grid grid-cols-4 gap-4">
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

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(v) => setFilter({ ...filter, search: v })}
        searchPlaceholder={t('admin.subscriptions.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.subscriptions.allStatuses')}
          value={filter.status}
          onChange={(v) => setFilter({ ...filter, status: v })}
          options={[
            { value: 'ACTIVE', label: t('admin.subscriptions.statusActive') },
            { value: 'PAUSED', label: t('admin.subscriptions.statusPaused') },
            { value: 'CANCELLED', label: t('admin.subscriptions.statusCancelled') },
          ]}
        />
      </FilterBar>

      {/* Subscriptions List */}
      <DataTable
        columns={columns}
        data={filteredSubscriptions}
        keyExtractor={(sub) => sub.id}
        loading={loading}
        emptyTitle={t('admin.subscriptions.emptyTitle')}
        emptyDescription={t('admin.subscriptions.emptyDescription')}
      />

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedSub}
        onClose={() => setSelectedSub(null)}
        title={t('admin.subscriptions.subscriptionDetails')}
        footer={
          selectedSub && (
            <>
              {selectedSub.status !== 'CANCELLED' && (
                <Button
                  variant="danger"
                  onClick={() => { updateStatus(selectedSub.id, 'CANCELLED'); setSelectedSub(null); }}
                >
                  {t('admin.subscriptions.cancel')}
                </Button>
              )}
              <Button variant="primary">
                {t('admin.subscriptions.modify')}
              </Button>
            </>
          )
        }
      >
        {selectedSub && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.client')}</p>
              <p className="font-medium">{selectedSub.userName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.status')}</p>
              <StatusBadge variant={statusVariant[selectedSub.status]} dot>
                {statusLabels[selectedSub.status]}
              </StatusBadge>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.product')}</p>
              <p className="font-medium">{selectedSub.productName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.format')}</p>
              <p className="font-medium">{selectedSub.formatName} x {selectedSub.quantity}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.frequency')}</p>
              <p className="font-medium">{frequencyLabels[selectedSub.frequency]}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.price')}</p>
              <p className="font-medium">{(selectedSub.price * (1 - selectedSub.discount / 100)).toFixed(2)} $</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.createdAt')}</p>
              <p className="font-medium">{new Date(selectedSub.createdAt).toLocaleDateString(locale)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.nextDelivery')}</p>
              <p className="font-medium">
                {selectedSub.status === 'ACTIVE'
                  ? new Date(selectedSub.nextDelivery).toLocaleDateString(locale)
                  : '-'
                }
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
