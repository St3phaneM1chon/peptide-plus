'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  Users,
  UserMinus,
  Mail,
  BarChart3,
  Download,
  Pencil,
  Clock,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input, Textarea } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────

interface Subscriber {
  id: string;
  email: string;
  locale: string;
  source: string;
  status: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED';
  subscribedAt: string;
  unsubscribedAt?: string;
}

interface Campaign {
  id: string;
  subject: string;
  content: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT';
  scheduledFor?: string;
  sentAt?: string;
  recipientCount: number;
  openRate?: number;
  clickRate?: number;
}

// ── Helpers ───────────────────────────────────────────────────

function subscriberBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'UNSUBSCRIBED': return 'neutral';
    case 'BOUNCED': return 'error';
    default: return 'neutral';
  }
}

function campaignBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (status) {
    case 'DRAFT': return 'neutral';
    case 'SCHEDULED': return 'info';
    case 'SENT': return 'success';
    default: return 'neutral';
  }
}

function sourceBadgeVariant(source: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (source) {
    case 'popup': return 'info';
    case 'footer': return 'neutral';
    case 'checkout': return 'warning';
    default: return 'neutral';
  }
}

// ── Main Component ────────────────────────────────────────────

export default function NewsletterPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'subscribers' | 'campaigns'>('subscribers');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ subject: '', content: '' });
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsData, setStatsData] = useState<{
    campaignId: string;
    subject: string;
    sentAt: string;
    stats: {
      sentCount: number;
      openRate: number;
      clickRate: number;
      bounceRate: number;
      unsubscribeRate: number;
      openCount: number;
      clickCount: number;
      bounceCount: number;
      unsubscribeCount: number;
    };
    subscriberContext: { totalActive: number; totalUnsubscribed: number };
  } | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ─── Data fetching ──────────────────────────────────────────

  // Reset selection when switching tabs
  useEffect(() => {
    setSelectedId(null);
    setSearchValue('');
    setStatusFilter('all');
  }, [activeTab]);

  const createCampaign = async (status: 'DRAFT' | 'SCHEDULED' | 'SENT') => {
    if (!newCampaign.subject.trim() || !newCampaign.content.trim()) {
      toast.error(t('admin.newsletter.subjectAndContentRequired') || 'Subject and content are required');
      return;
    }

    setSavingCampaign(true);
    try {
      const res = await fetch('/api/admin/newsletter/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newCampaign.subject,
          content: newCampaign.content,
          status,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t('common.saveFailed'));
        return;
      }

      const statusMessages: Record<string, string> = {
        DRAFT: t('admin.newsletter.draftSaved') || 'Draft saved',
        SCHEDULED: t('admin.newsletter.campaignScheduled') || 'Campaign scheduled',
        SENT: t('admin.newsletter.campaignSent') || 'Campaign sent',
      };
      toast.success(statusMessages[status]);
      setShowComposer(false);
      setNewCampaign({ subject: '', content: '' });
      await fetchData();
    } catch (err) {
      console.error('Error creating campaign:', err);
      toast.error(t('common.error'));
    } finally {
      setSavingCampaign(false);
    }
  };

  // FIX: FLAW-055 - Wrap fetchData in useCallback for stable reference
  const fetchData = useCallback(async () => {
    try {
      const [subsRes, campRes] = await Promise.all([
        fetch('/api/admin/newsletter/subscribers'),
        fetch('/api/admin/newsletter/campaigns'),
      ]);
      const subsData = await subsRes.json();
      const campData = await campRes.json();
      setSubscribers(subsData.subscribers || []);
      setCampaigns(campData.campaigns || []);
    } catch (err) {
      console.error('Error fetching newsletter data:', err);
      toast.error(t('common.error'));
      setSubscribers([]);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale);
  };

  // ─── Stats ──────────────────────────────────────────────────

  const stats = useMemo(() => ({
    totalSubscribers: subscribers.filter((s) => s.status === 'ACTIVE').length,
    unsubscribed: subscribers.filter((s) => s.status === 'UNSUBSCRIBED').length,
    bounced: subscribers.filter((s) => s.status === 'BOUNCED').length,
    totalCampaigns: campaigns.length,
    avgOpenRate:
      campaigns.filter((c) => c.openRate).reduce((sum, c) => sum + (c.openRate || 0), 0) /
        campaigns.filter((c) => c.openRate).length || 0,
    fromPopup: subscribers.filter((s) => s.source === 'popup' && s.status === 'ACTIVE').length,
    fromFooter: subscribers.filter((s) => s.source === 'footer' && s.status === 'ACTIVE').length,
    fromCheckout: subscribers.filter((s) => s.source === 'checkout' && s.status === 'ACTIVE').length,
    draftCampaigns: campaigns.filter((c) => c.status === 'DRAFT').length,
    sentCampaigns: campaigns.filter((c) => c.status === 'SENT').length,
  }), [subscribers, campaigns]);

  // ─── ContentList data for Subscribers ─────────────────────────

  const subscriberFilterTabs = useMemo(() => [
    { key: 'all', label: t('admin.newsletter.filterAll') || 'All', count: subscribers.length },
    { key: 'ACTIVE', label: t('admin.newsletter.activeSubscribers'), count: stats.totalSubscribers },
    { key: 'UNSUBSCRIBED', label: t('admin.newsletter.unsubscribed'), count: stats.unsubscribed },
    { key: 'BOUNCED', label: t('admin.newsletter.bounced') || 'Bounced', count: stats.bounced },
  ], [t, subscribers.length, stats]);

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter(sub => {
      if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (!sub.email.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [subscribers, statusFilter, searchValue]);

  const subscriberListItems: ContentListItem[] = useMemo(() => {
    return filteredSubscribers.map((sub) => ({
      id: sub.id,
      avatar: { text: sub.email },
      title: sub.email,
      subtitle: `${sub.locale.toUpperCase()} - ${sub.source || 'N/A'}`,
      preview: formatDate(sub.subscribedAt),
      timestamp: sub.subscribedAt,
      badges: [
        { text: sub.status, variant: subscriberBadgeVariant(sub.status) },
        { text: sub.source || 'N/A', variant: sourceBadgeVariant(sub.source) },
      ],
    }));
  }, [filteredSubscribers, locale]);

  // ─── ContentList data for Campaigns ──────────────────────────

  const campaignFilterTabs = useMemo(() => [
    { key: 'all', label: t('admin.newsletter.filterAll') || 'All', count: campaigns.length },
    { key: 'DRAFT', label: t('admin.newsletter.statusDraft') || 'Draft', count: stats.draftCampaigns },
    { key: 'SENT', label: t('admin.newsletter.statusSent') || 'Sent', count: stats.sentCampaigns },
  ], [t, campaigns.length, stats]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
      if (statusFilter !== 'all' && campaign.status !== statusFilter) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (!campaign.subject.toLowerCase().includes(search)) return false;
      }
      return true;
    });
  }, [campaigns, statusFilter, searchValue]);

  const campaignListItems: ContentListItem[] = useMemo(() => {
    return filteredCampaigns.map((campaign) => ({
      id: campaign.id,
      avatar: { text: campaign.subject },
      title: campaign.subject,
      subtitle: campaign.recipientCount > 0
        ? t('admin.newsletter.recipients', { count: campaign.recipientCount })
        : undefined,
      preview: campaign.content.slice(0, 100),
      timestamp: campaign.sentAt || campaign.scheduledFor || undefined,
      badges: [
        { text: campaign.status, variant: campaignBadgeVariant(campaign.status) },
        ...(campaign.openRate
          ? [{ text: `${campaign.openRate}% open`, variant: 'success' as const }]
          : []),
      ],
    }));
  }, [filteredCampaigns, t]);

  // ─── Selected items ──────────────────────────────────────────

  const selectedSubscriber = useMemo(() => {
    if (!selectedId || activeTab !== 'subscribers') return null;
    return subscribers.find(s => s.id === selectedId) || null;
  }, [subscribers, selectedId, activeTab]);

  const selectedCampaign = useMemo(() => {
    if (!selectedId || activeTab !== 'campaigns') return null;
    return campaigns.find(c => c.id === selectedId) || null;
  }, [campaigns, selectedId, activeTab]);

  // ─── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header + Stats */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.newsletter.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.newsletter.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={Download} size="sm" onClick={() => {
              if (subscribers.length === 0) return;
              const headers = ['Email', 'Locale', 'Source', 'Status', 'Subscribed At'];
              const rows = subscribers.map(sub => [
                sub.email,
                sub.locale,
                sub.source,
                sub.status,
                new Date(sub.subscribedAt).toLocaleDateString(locale),
              ]);
              const BOM = '\uFEFF';
              const csv = BOM + [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success(t('admin.newsletter.exportSuccess') || 'Subscribers exported');
            }}>
              {t('admin.newsletter.exportCSV')}
            </Button>
            <Button variant="primary" icon={Send} size="sm" onClick={() => setShowComposer(true)}>
              {t('admin.newsletter.newCampaign')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label={t('admin.newsletter.activeSubscribers')} value={stats.totalSubscribers} icon={Users} />
          <StatCard label={t('admin.newsletter.unsubscribed')} value={stats.unsubscribed} icon={UserMinus} />
          <StatCard label={t('admin.newsletter.campaigns')} value={stats.totalCampaigns} icon={Mail} />
          <StatCard label={t('admin.newsletter.avgOpenRate')} value={`${stats.avgOpenRate.toFixed(1)}%`} icon={BarChart3} />
        </div>

        {/* Source breakdown */}
        <div className="bg-white rounded-lg p-4 border border-slate-200 mb-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">{t('admin.newsletter.subscriptionsBySource')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <SourceCard
              label={t('admin.newsletter.welcomePopup')}
              value={stats.fromPopup}
              total={stats.totalSubscribers}
              color="violet"
              tOfTotal={t}
            />
            <SourceCard
              label={t('admin.newsletter.footer')}
              value={stats.fromFooter}
              total={stats.totalSubscribers}
              color="sky"
              tOfTotal={t}
            />
            <SourceCard
              label={t('admin.newsletter.checkout')}
              value={stats.fromCheckout}
              total={stats.totalSubscribers}
              color="amber"
              tOfTotal={t}
            />
          </div>
        </div>

        {/* Tab switcher: Subscribers vs Campaigns */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-8">
            {(['subscribers', 'campaigns'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'subscribers'
                  ? t('admin.newsletter.tabSubscribers', { count: subscribers.length })
                  : t('admin.newsletter.tabCampaigns', { count: campaigns.length })}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        {activeTab === 'subscribers' ? (
          <MobileSplitLayout
            listWidth={400}
            showDetail={!!selectedId}
            list={
              <ContentList
                items={subscriberListItems}
                selectedId={selectedId}
                onSelect={handleSelect}
                filterTabs={subscriberFilterTabs}
                activeFilter={statusFilter}
                onFilterChange={setStatusFilter}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                searchPlaceholder={t('admin.newsletter.searchEmail')}
                loading={loading}
                emptyIcon={Users}
                emptyTitle={t('admin.newsletter.emptySubscribers') || 'No subscribers'}
                emptyDescription={t('admin.newsletter.emptySubscribersDesc') || 'No subscribers yet.'}
              />
            }
            detail={
              selectedSubscriber ? (
                <DetailPane
                  header={{
                    title: selectedSubscriber.email,
                    subtitle: `${selectedSubscriber.locale.toUpperCase()} - ${selectedSubscriber.source || 'N/A'}`,
                    avatar: { text: selectedSubscriber.email },
                    onBack: () => setSelectedId(null),
                    backLabel: t('admin.newsletter.tabSubscribers', { count: subscribers.length }),
                    actions: (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        className="text-red-600 hover:text-red-700"
                        disabled={deletingId === selectedSubscriber.id}
                        onClick={async () => {
                          if (!confirm(t('admin.newsletter.deleteSubscriberConfirm') || `Remove ${selectedSubscriber.email}?`)) return;
                          setDeletingId(selectedSubscriber.id);
                          try {
                            const res = await fetch(`/api/admin/newsletter/subscribers/${selectedSubscriber.id}`, {
                              method: 'DELETE',
                            });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              toast.error(data.error || t('common.deleteFailed'));
                              return;
                            }
                            setSubscribers(prev => prev.filter(s => s.id !== selectedSubscriber.id));
                            setSelectedId(null);
                            toast.success(t('admin.newsletter.subscriberDeleted') || 'Subscriber removed');
                          } catch {
                            toast.error(t('common.networkError'));
                          } finally {
                            setDeletingId(null);
                          }
                        }}
                      />
                    ),
                  }}
                >
                  <div className="space-y-6">
                    {/* Status */}
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h3 className="font-semibold text-slate-900 mb-3">{t('admin.newsletter.colStatus')}</h3>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          selectedSubscriber.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : selectedSubscriber.status === 'BOUNCED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {selectedSubscriber.status}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('admin.newsletter.colEmail')}</span>
                        <span className="font-medium text-slate-900">{selectedSubscriber.email}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('admin.newsletter.colLanguage')}</span>
                        <span className="font-medium text-slate-900">{selectedSubscriber.locale.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('admin.newsletter.colSource')}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          selectedSubscriber.source === 'popup' ? 'bg-sky-50 text-sky-700'
                          : selectedSubscriber.source === 'footer' ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-50 text-amber-700'
                        }`}>
                          {selectedSubscriber.source || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{t('admin.newsletter.colSubscribedAt')}</span>
                        <span className="font-medium text-slate-900">{formatDate(selectedSubscriber.subscribedAt)}</span>
                      </div>
                      {selectedSubscriber.unsubscribedAt && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600">{t('admin.newsletter.unsubscribedAt') || 'Unsubscribed at'}</span>
                          <span className="font-medium text-red-600">{formatDate(selectedSubscriber.unsubscribedAt)}</span>
                        </div>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="text-xs text-slate-400 pt-2 border-t border-slate-200">
                      <p>ID: {selectedSubscriber.id}</p>
                    </div>
                  </div>
                </DetailPane>
              ) : (
                <DetailPane
                  isEmpty
                  emptyIcon={Users}
                  emptyTitle={t('admin.newsletter.selectSubscriber') || 'Select a subscriber'}
                  emptyDescription={t('admin.newsletter.selectSubscriberDesc') || 'Select a subscriber to see details.'}
                />
              )
            }
          />
        ) : (
          <MobileSplitLayout
            listWidth={400}
            showDetail={!!selectedId}
            list={
              <ContentList
                items={campaignListItems}
                selectedId={selectedId}
                onSelect={handleSelect}
                filterTabs={campaignFilterTabs}
                activeFilter={statusFilter}
                onFilterChange={setStatusFilter}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                searchPlaceholder={t('admin.newsletter.searchCampaign') || 'Search campaigns...'}
                loading={loading}
                emptyIcon={Mail}
                emptyTitle={t('admin.newsletter.emptyCampaigns') || 'No campaigns'}
                emptyDescription={t('admin.newsletter.emptyCampaignsDesc') || 'No campaigns yet.'}
              />
            }
            detail={
              selectedCampaign ? (
                <DetailPane
                  header={{
                    title: selectedCampaign.subject,
                    subtitle: selectedCampaign.sentAt
                      ? t('admin.newsletter.sentOn', { date: formatDate(selectedCampaign.sentAt) })
                      : selectedCampaign.scheduledFor
                        ? t('admin.newsletter.scheduledFor', { date: formatDate(selectedCampaign.scheduledFor) })
                        : 'DRAFT',
                    avatar: { text: selectedCampaign.subject },
                    onBack: () => setSelectedId(null),
                    backLabel: t('admin.newsletter.tabCampaigns', { count: campaigns.length }),
                    actions: (
                      <div className="flex items-center gap-2">
                        {selectedCampaign.status === 'DRAFT' && (
                          <>
                            <Button variant="ghost" size="sm" icon={Pencil} onClick={() => {
                              setNewCampaign({ subject: selectedCampaign.subject, content: selectedCampaign.content });
                              setShowComposer(true);
                            }}>
                              {t('admin.newsletter.edit')}
                            </Button>
                            <Button variant="primary" size="sm" icon={Send} onClick={async () => {
                              if (!confirm(t('admin.newsletter.sendConfirm') || `Send "${selectedCampaign.subject}" to all active subscribers?`)) return;
                              try {
                                const res = await fetch(`/api/admin/newsletter/campaigns/${selectedCampaign.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'SENT' }),
                                });
                                if (!res.ok) {
                                  const data = await res.json().catch(() => ({}));
                                  toast.error(data.error || t('common.saveFailed'));
                                  return;
                                }
                                toast.success(t('admin.newsletter.campaignSent') || 'Campaign sent');
                                await fetchData();
                              } catch {
                                toast.error(t('common.networkError'));
                              }
                            }}>
                              {t('admin.newsletter.send')}
                            </Button>
                          </>
                        )}
                        {selectedCampaign.status === 'SCHEDULED' && (
                          <Button variant="ghost" size="sm" icon={XCircle} className="text-red-600" onClick={async () => {
                            if (!confirm(t('admin.newsletter.cancelConfirm') || 'Cancel this scheduled campaign?')) return;
                            try {
                              const res = await fetch(`/api/admin/newsletter/campaigns/${selectedCampaign.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ status: 'DRAFT' }),
                              });
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                toast.error(data.error || t('common.updateFailed'));
                                return;
                              }
                              toast.success(t('admin.newsletter.campaignCancelled') || 'Campaign cancelled');
                              await fetchData();
                            } catch {
                              toast.error(t('common.networkError'));
                            }
                          }}>
                            {t('admin.newsletter.cancel')}
                          </Button>
                        )}
                        {selectedCampaign.status === 'SENT' && (
                          <Button variant="ghost" size="sm" icon={BarChart3} onClick={async () => {
                            setStatsLoading(true);
                            setShowStatsModal(true);
                            try {
                              const res = await fetch(`/api/admin/newsletter/campaigns/${selectedCampaign.id}/stats`);
                              if (!res.ok) {
                                const data = await res.json().catch(() => ({}));
                                toast.error(data.error || t('common.error'));
                                setShowStatsModal(false);
                                return;
                              }
                              const data = await res.json();
                              setStatsData(data);
                            } catch {
                              toast.error(t('common.networkError'));
                              setShowStatsModal(false);
                            } finally {
                              setStatsLoading(false);
                            }
                          }}>
                            {t('admin.newsletter.statistics')}
                          </Button>
                        )}
                      </div>
                    ),
                  }}
                >
                  <div className="space-y-6">
                    {/* Status */}
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          selectedCampaign.status === 'SENT'
                            ? 'bg-emerald-100 text-emerald-700'
                            : selectedCampaign.status === 'SCHEDULED'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {selectedCampaign.status}
                        </span>
                        {selectedCampaign.recipientCount > 0 && (
                          <span className="text-sm text-slate-600">
                            {t('admin.newsletter.recipients', { count: selectedCampaign.recipientCount })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats (if sent) */}
                    {selectedCampaign.status === 'SENT' && (
                      <div className="grid grid-cols-2 gap-4">
                        {selectedCampaign.openRate !== undefined && (
                          <div className="bg-emerald-50 rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-emerald-700">{selectedCampaign.openRate}%</p>
                            <p className="text-xs text-emerald-600 mt-1">{t('admin.newsletter.openRate', { rate: selectedCampaign.openRate })}</p>
                          </div>
                        )}
                        {selectedCampaign.clickRate !== undefined && (
                          <div className="bg-sky-50 rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-sky-700">{selectedCampaign.clickRate}%</p>
                            <p className="text-xs text-sky-600 mt-1">{t('admin.newsletter.clickRate', { rate: selectedCampaign.clickRate })}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Content preview */}
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">{t('admin.newsletter.content')}</h3>
                      <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap font-mono">
                        {selectedCampaign.content}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="bg-slate-50 rounded-lg p-4">
                      <div className="space-y-2">
                        {selectedCampaign.sentAt && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('admin.newsletter.sentOn', { date: '' }).replace(': ', '')}</span>
                            <span className="font-medium text-slate-900">{formatDate(selectedCampaign.sentAt)}</span>
                          </div>
                        )}
                        {selectedCampaign.scheduledFor && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-600">{t('admin.newsletter.scheduledFor', { date: '' }).replace(': ', '')}</span>
                            <span className="font-medium text-slate-900">{formatDate(selectedCampaign.scheduledFor)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="text-xs text-slate-400 pt-2 border-t border-slate-200">
                      <p>ID: {selectedCampaign.id}</p>
                    </div>
                  </div>
                </DetailPane>
              ) : (
                <DetailPane
                  isEmpty
                  emptyIcon={Mail}
                  emptyTitle={t('admin.newsletter.selectCampaign') || 'Select a campaign'}
                  emptyDescription={t('admin.newsletter.selectCampaignDesc') || 'Select a campaign to see details.'}
                />
              )
            }
          />
        )}
      </div>

      {/* ─── COMPOSER MODAL ─────────────────────────────────────── */}
      <Modal isOpen={showComposer} onClose={() => setShowComposer(false)} title={t('admin.newsletter.modalTitle')} size="lg">
        <div className="space-y-4">
          <FormField label={t('admin.newsletter.subject')} required>
            <Input
              type="text"
              value={newCampaign.subject}
              onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
              placeholder={t('admin.newsletter.subjectPlaceholder')}
            />
          </FormField>
          <FormField label={t('admin.newsletter.content')} required>
            <Textarea
              rows={10}
              value={newCampaign.content}
              onChange={(e) => setNewCampaign({ ...newCampaign, content: e.target.value })}
              placeholder={t('admin.newsletter.contentPlaceholder')}
              className="font-mono text-sm"
            />
          </FormField>
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" className="flex-1" onClick={() => createCampaign('DRAFT')} disabled={savingCampaign}>
              {t('admin.newsletter.saveDraft')}
            </Button>
            <Button variant="outline" icon={Clock} className="flex-1" onClick={() => createCampaign('SCHEDULED')} disabled={savingCampaign}>
              {t('admin.newsletter.schedule')}
            </Button>
            <Button variant="primary" icon={Send} className="flex-1" onClick={() => createCampaign('SENT')} disabled={savingCampaign} loading={savingCampaign}>
              {t('admin.newsletter.sendNow')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── CAMPAIGN STATS MODAL ─────────────────────────────────── */}
      <Modal
        isOpen={showStatsModal}
        onClose={() => { setShowStatsModal(false); setStatsData(null); }}
        title={t('admin.newsletter.statistics')}
        size="lg"
      >
        {statsLoading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Loading">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" />
            <span className="sr-only">Loading...</span>
          </div>
        ) : statsData ? (
          <div className="space-y-6">
            {/* Campaign info */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-1">{statsData.subject}</h3>
              {statsData.sentAt && (
                <p className="text-sm text-slate-500">
                  {t('admin.newsletter.sentOn', { date: formatDate(statsData.sentAt) })}
                </p>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-sky-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-sky-700">{statsData.stats.sentCount}</p>
                <p className="text-xs text-sky-600 mt-1">{t('admin.newsletter.statsSent') || 'Sent'}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-700">{statsData.stats.openRate}%</p>
                <p className="text-xs text-emerald-600 mt-1">{t('admin.newsletter.statsOpenRate') || 'Open Rate'}</p>
              </div>
              <div className="bg-violet-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-violet-700">{statsData.stats.clickRate}%</p>
                <p className="text-xs text-violet-600 mt-1">{t('admin.newsletter.statsClickRate') || 'Click Rate'}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">{statsData.stats.bounceRate}%</p>
                <p className="text-xs text-amber-600 mt-1">{t('admin.newsletter.statsBounceRate') || 'Bounce Rate'}</p>
              </div>
            </div>

            {/* Detailed counts */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-3">{t('admin.newsletter.statsDetails') || 'Details'}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t('admin.newsletter.statsOpened') || 'Opened'}</span>
                  <span className="font-medium text-slate-900">{statsData.stats.openCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t('admin.newsletter.statsClicked') || 'Clicked'}</span>
                  <span className="font-medium text-slate-900">{statsData.stats.clickCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t('admin.newsletter.statsBounced') || 'Bounced'}</span>
                  <span className="font-medium text-slate-900">{statsData.stats.bounceCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t('admin.newsletter.statsUnsubscribed') || 'Unsubscribed'}</span>
                  <span className="font-medium text-slate-900">{statsData.stats.unsubscribeCount}</span>
                </div>
              </div>
            </div>

            {/* Subscriber context */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h3 className="font-semibold text-slate-900 mb-3">{t('admin.newsletter.subscriberContext') || 'Subscriber Context'}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t('admin.newsletter.activeSubscribers')}</span>
                  <span className="font-medium text-slate-900">{statsData.subscriberContext.totalActive}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">{t('admin.newsletter.unsubscribed')}</span>
                  <span className="font-medium text-slate-900">{statsData.subscriberContext.totalUnsubscribed}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 py-4 text-center">
            {t('admin.newsletter.noStats') || 'No stats available.'}
          </p>
        )}
      </Modal>
    </div>
  );
}

// ── Helper Components ───────────────────────────────────────────

function SourceCard({
  label,
  value,
  total,
  color,
  tOfTotal,
}: {
  label: string;
  value: number;
  total: number;
  color: 'violet' | 'sky' | 'amber';
  tOfTotal: (key: string, params?: Record<string, string | number>) => string;
}) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  // FLAW-016 FIX: amber color was using teal classes instead of amber
  const colors = {
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`rounded-lg p-3 border ${colors[color]}`}>
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-75">{tOfTotal('admin.newsletter.ofTotal', { pct })}</p>
    </div>
  );
}
