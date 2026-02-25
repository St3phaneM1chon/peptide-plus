// TODO: F-061 - catch (err) in fetchSubscriptions: use _err or omit variable name
// TODO: F-074 - Monthly revenue uses 1/6 for EVERY_6_MONTHS; round result to 2 decimal places
// TODO: F-087 - Config section hardcodes "15%" instead of displaying actual configurable value
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Repeat,
  Users,
  Pause,
  DollarSign,
  Settings,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

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

  // Modal states
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showModifyModal, setShowModifyModal] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingModify, setSavingModify] = useState(false);

  // Config form state
  const [cfgDiscount, setCfgDiscount] = useState('15');
  const [cfgFreeShipping, setCfgFreeShipping] = useState(true);
  const [cfgReminderDays, setCfgReminderDays] = useState('3');
  const [cfgMaxPauses, setCfgMaxPauses] = useState('1');

  // Cancel confirmation state
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // Modify form state
  const [modFrequency, setModFrequency] = useState('');
  const [modQuantity, setModQuantity] = useState('');
  const [modDiscount, setModDiscount] = useState('');
  const [modNextDelivery, setModNextDelivery] = useState('');

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

  // FIX F-030: Load subscription config from API instead of hardcoding "15%"
  useEffect(() => {
    fetchSubscriptions();
    fetchSubscriptionConfig();
  }, []);

  const fetchSubscriptionConfig = async () => {
    try {
      const res = await fetch('/api/admin/settings?key=subscription_config');
      if (res.ok) {
        const data = await res.json();
        if (data.value) {
          const config = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (config.defaultDiscount !== undefined) setCfgDiscount(String(config.defaultDiscount));
          if (config.freeShipping !== undefined) setCfgFreeShipping(config.freeShipping);
          if (config.reminderDays !== undefined) setCfgReminderDays(String(config.reminderDays));
          if (config.maxPausesPerYear !== undefined) setCfgMaxPauses(String(config.maxPausesPerYear));
        }
      }
    } catch (err) {
      console.error('Error fetching subscription config:', err);
    }
  };

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

  // ─── Save Config ───────────────────────────────────────────

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'subscription_config',
          value: JSON.stringify({
            defaultDiscount: parseFloat(cfgDiscount) || 15,
            freeShipping: cfgFreeShipping,
            reminderDays: parseInt(cfgReminderDays) || 3,
            maxPausesPerYear: parseInt(cfgMaxPauses) || 1,
          }),
        }),
      });
      if (res.ok) {
        toast.success(t('admin.subscriptions.configSaved'));
        setShowConfigModal(false);
      } else {
        toast.error(t('admin.subscriptions.configError'));
      }
    } catch {
      toast.error(t('admin.subscriptions.configError'));
    } finally {
      setSavingConfig(false);
    }
  };

  // ─── Open Modify Modal ────────────────────────────────────

  const openModifyModal = (sub: Subscription) => {
    setModFrequency(sub.frequency);
    setModQuantity(String(sub.quantity));
    setModDiscount(String(sub.discount));
    setModNextDelivery(sub.nextDelivery ? sub.nextDelivery.split('T')[0] : '');
    setShowModifyModal(true);
  };

  const handleSaveModify = async () => {
    if (!selectedSub) return;
    setSavingModify(true);
    try {
      const body: Record<string, unknown> = {};
      if (modFrequency !== selectedSub.frequency) body.frequency = modFrequency;
      if (parseInt(modQuantity) !== selectedSub.quantity) body.quantity = parseInt(modQuantity);
      if (parseFloat(modDiscount) !== selectedSub.discount) body.discountPercent = parseFloat(modDiscount);
      if (modNextDelivery) body.nextDelivery = modNextDelivery;

      if (Object.keys(body).length === 0) {
        setShowModifyModal(false);
        return;
      }

      const res = await fetch(`/api/admin/subscriptions/${selectedSub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.subscriptions.modifyError'));
        return;
      }
      toast.success(t('admin.subscriptions.modifySaved'));
      setShowModifyModal(false);
      await fetchSubscriptions();
    } catch {
      toast.error(t('admin.subscriptions.modifyError'));
    } finally {
      setSavingModify(false);
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
    // F-074 FIX: Round to 2 decimals to avoid floating point display issues
    monthlyRevenue: Math.round(subscriptions.filter(s => s.status === 'ACTIVE').reduce((sum, s) => {
      const multiplier = s.frequency === 'EVERY_2_MONTHS' ? 0.5 : s.frequency === 'EVERY_4_MONTHS' ? 0.25 : s.frequency === 'EVERY_6_MONTHS' ? (1/6) : (1/12);
      return sum + (s.price * (1 - s.discount / 100) * multiplier);
    }, 0) * 100) / 100,
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

  // ─── Auto-select first item ────────────────────────────────

  useEffect(() => {
    if (!loading && filteredSubscriptions.length > 0) {
      const currentStillVisible = selectedSubId &&
        filteredSubscriptions.some(s => s.id === selectedSubId);
      if (!currentStillVisible) {
        handleSelectSub(filteredSubscriptions[0].id);
      }
    }
  }, [filteredSubscriptions, loading, selectedSubId, handleSelectSub]);

  // ─── Ribbon action handlers ────────────────────────────────
  const handleRibbonNewSubscription = useCallback(() => {
    toast.info(t('admin.subscriptions.newSubFromShop') || 'Subscriptions are created by customers from the shop. Use the product page to set up subscription options.');
  }, [t]);

  const handleRibbonDelete = useCallback(() => {
    if (!selectedSub) { toast.info(t('admin.subscriptions.selectSubFirst') || 'Select a subscription first'); return; }
    if (selectedSub.status === 'CANCELLED') {
      toast.info(t('admin.subscriptions.alreadyCancelled') || 'This subscription is already cancelled');
      return;
    }
    setConfirmCancelId(selectedSub.id);
  }, [selectedSub, t]);

  const handleRibbonSuspend = useCallback(() => {
    if (!selectedSub) { toast.info(t('admin.subscriptions.selectSubFirst') || 'Select a subscription first'); return; }
    if (selectedSub.status !== 'ACTIVE') {
      toast.info(t('admin.subscriptions.canOnlyPauseActive') || 'Only active subscriptions can be paused');
      return;
    }
    updateStatus(selectedSub.id, 'PAUSED');
  }, [selectedSub, t]);

  const handleRibbonReactivate = useCallback(() => {
    if (!selectedSub) { toast.info(t('admin.subscriptions.selectSubFirst') || 'Select a subscription first'); return; }
    if (selectedSub.status === 'ACTIVE') {
      toast.info(t('admin.subscriptions.alreadyActive') || 'This subscription is already active');
      return;
    }
    if (selectedSub.status === 'CANCELLED') {
      toast.info(t('admin.subscriptions.cannotReactivateCancelled') || 'Cancelled subscriptions cannot be reactivated. The customer must create a new subscription.');
      return;
    }
    updateStatus(selectedSub.id, 'ACTIVE');
  }, [selectedSub, t]);

  const handleRibbonRefund = useCallback(() => {
    if (!selectedSub) {
      toast.info(t('admin.subscriptions.selectSubFirst') || 'Select a subscription first');
      return;
    }
    toast.info(t('admin.subscriptions.refundViaStripe') || 'Process refunds through the Stripe dashboard for subscription payments');
  }, [selectedSub, t]);

  const handleRibbonMrrStats = useCallback(() => {
    const activeSubs = subscriptions.filter(s => s.status === 'ACTIVE');
    const mrr = stats.monthlyRevenue;
    const arr = mrr * 12;
    toast.info(
      `MRR: ${formatCurrency(mrr)} | ARR: ${formatCurrency(arr)} | ${activeSubs.length} ${t('admin.subscriptions.activeSubscriptions') || 'active subscriptions'}`
    );
  }, [subscriptions, stats, formatCurrency, t]);

  const handleRibbonExport = useCallback(() => {
    if (subscriptions.length === 0) {
      toast.info(t('admin.subscriptions.noSubscriptions') || 'No subscriptions to export');
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['Customer', 'Email', 'Product', 'Format', 'Quantity', 'Frequency', 'Price', 'Discount', 'Status', 'Next Delivery', 'Created'];
    const rows = subscriptions.map(s => [
      s.userName,
      s.userEmail,
      s.productName,
      s.formatName,
      String(s.quantity),
      frequencyLabels[s.frequency] || s.frequency,
      String(s.price),
      `${s.discount}%`,
      statusLabels[s.status] || s.status,
      s.nextDelivery ? new Date(s.nextDelivery).toLocaleDateString(locale) : '',
      new Date(s.createdAt).toLocaleDateString(locale),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported successfully');
  }, [subscriptions, frequencyLabels, statusLabels, locale, t]);

  useRibbonAction('newSubscription', handleRibbonNewSubscription);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('suspend', handleRibbonSuspend);
  useRibbonAction('reactivate', handleRibbonReactivate);
  useRibbonAction('refund', handleRibbonRefund);
  useRibbonAction('mrrStats', handleRibbonMrrStats);
  useRibbonAction('export', handleRibbonExport);

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
          <Button variant="primary" icon={Settings} onClick={() => setShowConfigModal(true)}>
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
              <p className="font-bold text-lg">{cfgDiscount}%</p>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.subscriberDiscount')}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="font-bold text-lg">{cfgFreeShipping ? t('admin.subscriptions.free') : t('admin.subscriptions.paid') || 'Paid'}</p>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.subscriberShipping')}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="font-bold text-lg">{t('admin.subscriptions.days', { count: cfgReminderDays })}</p>
              <p className="text-sm text-slate-500">{t('admin.subscriptions.reminderBeforeDelivery')}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg text-center">
              <p className="font-bold text-lg">{t('admin.subscriptions.pausePerYear', { count: cfgMaxPauses })}</p>
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
                          onClick={() => setConfirmCancelId(selectedSub.id)}
                        >
                          {t('admin.subscriptions.cancel')}
                        </Button>
                      )}
                      <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openModifyModal(selectedSub)}>
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

      {/* ─── CONFIGURE OPTIONS MODAL ────────────────────────────── */}
      <Modal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
        title={t('admin.subscriptions.configureTitle')}
        subtitle={t('admin.subscriptions.configureSubtitle')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowConfigModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleSaveConfig} loading={savingConfig}>
              {t('common.save') || 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.subscriptions.defaultDiscount')}>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={cfgDiscount}
              onChange={(e) => setCfgDiscount(e.target.value)}
            />
          </FormField>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-700">{t('admin.subscriptions.freeShipping')}</span>
            <button
              onClick={() => setCfgFreeShipping(!cfgFreeShipping)}
              className={`w-11 h-6 rounded-full transition-colors relative ${cfgFreeShipping ? 'bg-green-500' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${cfgFreeShipping ? 'right-1' : 'left-1'}`} />
            </button>
          </div>
          <FormField label={t('admin.subscriptions.reminderDays')}>
            <Input
              type="number"
              min="1"
              max="30"
              value={cfgReminderDays}
              onChange={(e) => setCfgReminderDays(e.target.value)}
            />
          </FormField>
          <FormField label={t('admin.subscriptions.maxPausesPerYear')}>
            <Input
              type="number"
              min="0"
              max="12"
              value={cfgMaxPauses}
              onChange={(e) => setCfgMaxPauses(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* ─── MODIFY SUBSCRIPTION MODAL ──────────────────────────── */}
      <Modal
        isOpen={showModifyModal}
        onClose={() => setShowModifyModal(false)}
        title={t('admin.subscriptions.modifyTitle')}
        subtitle={t('admin.subscriptions.modifySubtitle', { name: selectedSub?.userName || '' })}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModifyModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" onClick={handleSaveModify} loading={savingModify}>
              {t('common.save') || 'Save'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {selectedSub && (
            <div className="bg-slate-50 rounded-lg p-3 mb-2">
              <p className="font-medium text-slate-900">{selectedSub.productName}</p>
              <p className="text-sm text-slate-500">{selectedSub.formatName}</p>
            </div>
          )}
          <FormField label={t('admin.subscriptions.modifyFrequency')}>
            <select
              value={modFrequency}
              onChange={(e) => setModFrequency(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="EVERY_2_MONTHS">{frequencyLabels.EVERY_2_MONTHS}</option>
              <option value="EVERY_4_MONTHS">{frequencyLabels.EVERY_4_MONTHS}</option>
              <option value="EVERY_6_MONTHS">{frequencyLabels.EVERY_6_MONTHS}</option>
              <option value="EVERY_12_MONTHS">{frequencyLabels.EVERY_12_MONTHS}</option>
            </select>
          </FormField>
          <FormField label={t('admin.subscriptions.modifyQuantity')}>
            <Input
              type="number"
              min="1"
              max="99"
              value={modQuantity}
              onChange={(e) => setModQuantity(e.target.value)}
            />
          </FormField>
          <FormField label={t('admin.subscriptions.modifyDiscount')}>
            <Input
              type="number"
              min="0"
              max="100"
              step="1"
              value={modDiscount}
              onChange={(e) => setModDiscount(e.target.value)}
            />
          </FormField>
          <FormField label={t('admin.subscriptions.modifyNextDelivery')}>
            <Input
              type="date"
              value={modNextDelivery}
              onChange={(e) => setModNextDelivery(e.target.value)}
            />
          </FormField>
        </div>
      </Modal>

      {/* ─── CANCEL CONFIRM DIALOG ─────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmCancelId}
        title={t('admin.subscriptions.cancelConfirmTitle') || 'Cancel Subscription'}
        message={t('admin.subscriptions.cancelConfirmMessage') || 'Are you sure you want to cancel this subscription? The customer will no longer receive deliveries.'}
        variant="danger"
        confirmLabel={t('admin.subscriptions.cancel') || 'Cancel Subscription'}
        onConfirm={() => {
          if (confirmCancelId) {
            updateStatus(confirmCancelId, 'CANCELLED');
          }
          setConfirmCancelId(null);
        }}
        onCancel={() => setConfirmCancelId(null)}
      />
    </div>
  );
}
