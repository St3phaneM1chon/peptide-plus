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
  Shield,
  FlaskConical,
  Target,
  CheckCircle2,
  AlertTriangle,
  Trophy,
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
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { BUILT_IN_SEGMENTS, type Segment } from '@/lib/email/segmentation';
import { CASL_DEFAULTS } from '@/lib/email/casl-compliance';
import { type ABTestVariant, getMetricValue } from '@/lib/email/ab-test-engine';
// FAILLE-002 FIX: Import CSRF helper to include CSRF token in all mutating requests
import { addCSRFHeader } from '@/lib/csrf';

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

interface ABTestResult {
  status: 'RUNNING' | 'COMPLETED' | 'WINNER_SELECTED';
  variantA: ABTestVariant;
  variantB: ABTestVariant;
  winnerId?: string;
  significant?: boolean;
  winningMetric: 'open_rate' | 'click_rate' | 'conversion_rate';
  checkWinnerAfter?: string;
  winnerSelectedAt?: string;
  sentToRemainder?: number;
}

interface Campaign {
  id: string;
  subject: string;
  content: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'AB_TESTING';
  scheduledFor?: string;
  sentAt?: string;
  recipientCount: number;
  openRate?: number;
  clickRate?: number;
  abTestConfig?: {
    enabled: boolean;
    testType: 'subject' | 'content';
    variantA: { subject?: string; htmlContent?: string };
    variantB: { subject?: string; htmlContent?: string };
    splitPercentage: number;
    waitDurationMinutes: number;
    winningMetric: 'open_rate' | 'click_rate' | 'conversion_rate';
  };
  abTestResult?: ABTestResult;
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
    case 'AB_TESTING': return 'warning';
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
  const [composerErrors, setComposerErrors] = useState<Record<string, string>>({});
  const [showStatsModal, setShowStatsModal] = useState(false);

  // UX FIX: ConfirmDialog state for send/delete actions
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });
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

  // A/B Test composer state
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [abTestType, setAbTestType] = useState<'subject' | 'content'>('subject');
  const [abVariantBSubject, setAbVariantBSubject] = useState('');
  const [abVariantBContent, setAbVariantBContent] = useState('');
  const [abSplitPercentage, setAbSplitPercentage] = useState(20);
  const [abWaitMinutes, setAbWaitMinutes] = useState(120);
  const [abWinningMetric, setAbWinningMetric] = useState<'open_rate' | 'click_rate'>('open_rate');

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
    // UX FIX: Validate with inline error messages instead of just toast
    const errors: Record<string, string> = {};
    if (!newCampaign.subject.trim()) {
      errors.subject = t('admin.newsletter.subjectRequired') || 'Subject is required';
    }
    if (!newCampaign.content.trim()) {
      errors.content = t('admin.newsletter.contentRequired') || 'Content is required';
    }
    setComposerErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingCampaign(true);
    try {
      // Build A/B test config if enabled
      const abConfig = abTestEnabled ? {
        enabled: true,
        testType: abTestType,
        variantA: {
          subject: newCampaign.subject,
          htmlContent: newCampaign.content,
        },
        variantB: {
          subject: abTestType === 'subject' ? abVariantBSubject : newCampaign.subject,
          htmlContent: abTestType === 'content' ? abVariantBContent : newCampaign.content,
        },
        splitPercentage: abSplitPercentage,
        waitDurationMinutes: abWaitMinutes,
        winningMetric: abWinningMetric,
      } : undefined;

      const res = await fetch('/api/admin/newsletter/campaigns', {
        method: 'POST',
        // FAILLE-002 FIX: Include CSRF token for server-side validation
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          subject: newCampaign.subject,
          content: newCampaign.content,
          status,
          abTestConfig: abConfig,
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
      setAbTestEnabled(false);
      setAbVariantBSubject('');
      setAbVariantBContent('');
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

  // ─── Ribbon Actions ─────────────────────────────────────────

  const onNewNewsletter = useCallback(() => {
    setNewCampaign({ subject: '', content: '' });
    setAbTestEnabled(false);
    setAbVariantBSubject('');
    setAbVariantBContent('');
    setAbSplitPercentage(20);
    setAbWaitMinutes(120);
    setAbWinningMetric('open_rate');
    setShowComposer(true);
  }, []);

  const onDeleteRibbon = useCallback(() => {
    if (!selectedId) return;
    if (activeTab === 'subscribers' && selectedSubscriber) {
      // UX FIX: Replaced native confirm() with ConfirmDialog
      setConfirmAction({
        isOpen: true,
        title: t('admin.newsletter.deleteSubscriberTitle') || 'Remove subscriber?',
        message: t('admin.newsletter.deleteSubscriberConfirm') || `Are you sure you want to remove ${selectedSubscriber.email}?`,
        variant: 'danger',
        onConfirm: () => {
          setConfirmAction(prev => ({ ...prev, isOpen: false }));
          setDeletingId(selectedSubscriber.id);
          fetch(`/api/admin/newsletter/subscribers/${selectedSubscriber.id}`, {
            method: 'DELETE',
            // FAILLE-002 FIX: Include CSRF token
            headers: addCSRFHeader(),
          })
            .then(res => {
              if (!res.ok) {
                toast.error(t('common.deleteFailed'));
                return;
              }
              setSubscribers(prev => prev.filter(s => s.id !== selectedSubscriber.id));
              setSelectedId(null);
              toast.success(t('admin.newsletter.subscriberDeleted') || 'Subscriber removed');
            })
            .catch(() => toast.error(t('common.networkError')))
            .finally(() => setDeletingId(null));
        },
      });
    }
  }, [selectedId, activeTab, selectedSubscriber, t]);

  const onScheduleDelivery = useCallback(() => {
    setNewCampaign({ subject: '', content: '' });
    setShowComposer(true);
  }, []);

  const onSendNow = useCallback(() => {
    if (!selectedCampaign || selectedCampaign.status !== 'DRAFT') {
      toast.info(t('admin.newsletter.selectDraftToSend') || 'Select a draft campaign to send');
      return;
    }
    // UX FIX: Replaced native confirm() with ConfirmDialog
    setConfirmAction({
      isOpen: true,
      title: t('admin.newsletter.sendConfirmTitle') || 'Send campaign?',
      message: t('admin.newsletter.sendConfirm') || `Send "${selectedCampaign.subject}" to all active subscribers? This action cannot be undone.`,
      variant: 'warning',
      onConfirm: () => {
        setConfirmAction(prev => ({ ...prev, isOpen: false }));
        fetch(`/api/admin/newsletter/campaigns/${selectedCampaign.id}`, {
          method: 'PATCH',
          // FAILLE-002 FIX: Include CSRF token
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ status: 'SENT' }),
        })
          .then(res => {
            if (!res.ok) {
              toast.error(t('common.saveFailed'));
              return;
            }
            toast.success(t('admin.newsletter.campaignSent') || 'Campaign sent');
            fetchData();
          })
          .catch(() => toast.error(t('common.networkError')));
      },
    });
  }, [selectedCampaign, t, fetchData]);

  const onPreview = useCallback(() => {
    if (selectedCampaign) {
      // Open a preview window with the campaign content
      const rawContent = selectedCampaign.content || '';
      const wrapper = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t('admin.newsletter.preview') || 'Preview'}: ${selectedCampaign.subject}</title><style>body{margin:20px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:600px;margin:20px auto;line-height:1.6;color:#333;}</style></head><body><h1 style="border-bottom:1px solid #ddd;padding-bottom:8px;">${selectedCampaign.subject}</h1><div style="white-space:pre-wrap;">${rawContent}</div></body></html>`;
      const blob = new Blob([wrapper], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const preview = window.open('', '_blank');
      if (preview) {
        preview.document.write(`<!DOCTYPE html><html><head><title>${t('admin.newsletter.preview') || 'Preview'}</title></head><body style="margin:0;">
          <iframe sandbox="allow-same-origin" style="width:100%;height:100vh;border:none;" src="${blobUrl}"></iframe>
        </body></html>`);
        preview.document.close();
      }
    } else {
      toast.info(t('admin.newsletter.selectCampaignFirst') || 'Select a campaign to preview');
    }
  }, [selectedCampaign, t]);

  const onOpenClickStats = useCallback(() => {
    if (!selectedCampaign || selectedCampaign.status !== 'SENT') {
      toast.info(t('admin.newsletter.selectSentForStats') || 'Select a sent campaign to view statistics');
      return;
    }
    setStatsLoading(true);
    setShowStatsModal(true);
    fetch(`/api/admin/newsletter/campaigns/${selectedCampaign.id}/stats`)
      .then(res => {
        if (!res.ok) {
          toast.error(t('common.error'));
          setShowStatsModal(false);
          return;
        }
        return res.json();
      })
      .then(data => { if (data) setStatsData(data); })
      .catch(() => { toast.error(t('common.networkError')); setShowStatsModal(false); })
      .finally(() => setStatsLoading(false));
  }, [selectedCampaign, t]);

  const onManageSubscribers = useCallback(() => {
    setActiveTab('subscribers');
  }, []);

  useRibbonAction('newNewsletter', onNewNewsletter);
  useRibbonAction('delete', onDeleteRibbon);
  useRibbonAction('scheduleDelivery', onScheduleDelivery);
  useRibbonAction('sendNow', onSendNow);
  useRibbonAction('preview', onPreview);
  useRibbonAction('openClickStats', onOpenClickStats);
  useRibbonAction('manageSubscribers', onManageSubscribers);

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

        {/* Segmentation intelligente */}
        <div className="bg-white rounded-lg p-4 border border-slate-200 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-violet-600" />
            <h3 className="text-sm font-semibold text-slate-900">Segmentation intelligente</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {BUILT_IN_SEGMENTS.map((segment: Segment) => (
              <div
                key={segment.id}
                className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-violet-200 hover:bg-violet-50/30 transition-colors cursor-default"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  <p className="text-sm font-medium text-slate-800">{segment.nameFr}</p>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2">{segment.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {segment.criteria.map((c, idx) => (
                    <span key={idx} className="inline-flex items-center px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-[10px] font-medium">
                      {c.label || `${c.field} ${c.operator} ${String(c.value)}`}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conformité CASL et résultats A/B Test */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Badge conformité CASL */}
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-5 w-5 text-emerald-600" />
              <h3 className="text-sm font-semibold text-slate-900">Conformité LCAP (CASL)</h3>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    Conforme
                  </span>
                  <span className="text-xs text-slate-500">Loi canadienne anti-pourriel</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Double opt-in</span>
                    <span className={`font-medium ${CASL_DEFAULTS.requireDoubleOptIn ? 'text-emerald-600' : 'text-red-500'}`}>
                      {CASL_DEFAULTS.requireDoubleOptIn ? 'Activé' : 'Désactivé'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Consentement implicite</span>
                    <span className="font-medium text-slate-800">{CASL_DEFAULTS.impliedConsentDurationDays} jours max</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Délai de désinscription</span>
                    <span className="font-medium text-slate-800">{CASL_DEFAULTS.unsubscribeProcessingDays} jours max</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Fins autorisées</span>
                    <span className="font-medium text-slate-800">{CASL_DEFAULTS.consentPurposes.length} types</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {CASL_DEFAULTS.consentPurposes.map((purpose) => (
                    <span key={purpose} className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                      {purpose === 'marketing' ? 'Marketing' :
                       purpose === 'promotions' ? 'Promotions' :
                       purpose === 'newsletter' ? 'Infolettre' :
                       purpose === 'product_updates' ? 'Mises à jour' :
                       purpose === 'research' ? 'Recherche' : purpose}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Résultats A/B Test */}
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical className="h-5 w-5 text-sky-600" />
              <h3 className="text-sm font-semibold text-slate-900">Résultats des tests A/B</h3>
            </div>
            {campaigns.filter(c => c.abTestResult).length > 0 ? (
              <div className="space-y-3">
                {campaigns.filter(c => c.abTestResult).slice(0, 3).map((campaign) => {
                  const abResult = campaign.abTestResult!;
                  const metric = abResult.winningMetric || 'open_rate';
                  const rateA = getMetricValue(abResult.variantA, metric);
                  const rateB = getMetricValue(abResult.variantB, metric);
                  const winner = abResult.winnerId || (rateA >= rateB ? 'A' : 'B');
                  const metricLabel = metric === 'open_rate' ? "taux d'ouverture" : metric === 'click_rate' ? 'taux de clic' : 'taux conversion';
                  const isRunning = abResult.status === 'RUNNING';
                  return (
                    <div key={campaign.id} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs font-medium text-slate-700 truncate flex-1">{campaign.subject}</p>
                        {isRunning && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium animate-pulse">
                            En cours
                          </span>
                        )}
                        {abResult.status === 'COMPLETED' && abResult.significant && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-medium">
                            Significatif
                          </span>
                        )}
                        {abResult.status === 'COMPLETED' && !abResult.significant && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">
                            Non significatif
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`flex-1 text-center p-2 rounded ${winner === 'A' && !isRunning ? 'bg-emerald-100 ring-1 ring-emerald-300' : 'bg-white'}`}>
                          <div className="flex items-center justify-center gap-1">
                            {winner === 'A' && !isRunning && <Trophy className="h-3 w-3 text-emerald-600" />}
                            <p className="text-xs font-semibold text-slate-700">Variante A</p>
                          </div>
                          <p className="text-lg font-bold text-slate-900">{(rateA * 100).toFixed(1)}%</p>
                          <p className="text-[10px] text-slate-500">{metricLabel}</p>
                          <p className="text-[10px] text-slate-400">{abResult.variantA.sent} envoyés</p>
                        </div>
                        <span className="text-xs text-slate-400 font-medium">vs</span>
                        <div className={`flex-1 text-center p-2 rounded ${winner === 'B' && !isRunning ? 'bg-emerald-100 ring-1 ring-emerald-300' : 'bg-white'}`}>
                          <div className="flex items-center justify-center gap-1">
                            {winner === 'B' && !isRunning && <Trophy className="h-3 w-3 text-emerald-600" />}
                            <p className="text-xs font-semibold text-slate-700">Variante B</p>
                          </div>
                          <p className="text-lg font-bold text-slate-900">{(rateB * 100).toFixed(1)}%</p>
                          <p className="text-[10px] text-slate-500">{metricLabel}</p>
                          <p className="text-[10px] text-slate-400">{abResult.variantB.sent} envoyés</p>
                        </div>
                      </div>
                      {isRunning && abResult.checkWinnerAfter && (
                        <p className="text-[10px] text-amber-600 mt-2 text-center">
                          Résultat attendu: {new Date(abResult.checkWinnerAfter).toLocaleString(locale)}
                        </p>
                      )}
                      {abResult.sentToRemainder !== undefined && abResult.sentToRemainder > 0 && (
                        <p className="text-[10px] text-emerald-600 mt-2 text-center">
                          Gagnant envoyé à {abResult.sentToRemainder} destinataires restants
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <AlertTriangle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Aucun résultat A/B disponible</p>
                <p className="text-xs text-slate-400 mt-1">Activez le test A/B dans le compositeur de campagne</p>
              </div>
            )}
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
                        onClick={() => {
                          // UX FIX: Replaced native confirm() with ConfirmDialog
                          setConfirmAction({
                            isOpen: true,
                            title: t('admin.newsletter.deleteSubscriberTitle') || 'Remove subscriber?',
                            message: t('admin.newsletter.deleteSubscriberConfirm') || `Are you sure you want to remove ${selectedSubscriber.email}?`,
                            variant: 'danger',
                            onConfirm: async () => {
                              setConfirmAction(prev => ({ ...prev, isOpen: false }));
                              setDeletingId(selectedSubscriber.id);
                              try {
                                const res = await fetch(`/api/admin/newsletter/subscribers/${selectedSubscriber.id}`, {
                                  method: 'DELETE',
                                  // FAILLE-002 FIX: Include CSRF token
                                  headers: addCSRFHeader(),
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
                            },
                          });
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
                            <Button variant="primary" size="sm" icon={Send} onClick={() => {
                              // UX FIX: Replaced native confirm() with ConfirmDialog
                              setConfirmAction({
                                isOpen: true,
                                title: t('admin.newsletter.sendConfirmTitle') || 'Send campaign?',
                                message: t('admin.newsletter.sendConfirm') || `Send "${selectedCampaign.subject}" to all active subscribers? This action cannot be undone.`,
                                variant: 'warning',
                                onConfirm: async () => {
                                  setConfirmAction(prev => ({ ...prev, isOpen: false }));
                                  try {
                                    const res = await fetch(`/api/admin/newsletter/campaigns/${selectedCampaign.id}`, {
                                      method: 'PATCH',
                                      // FAILLE-002 FIX: Include CSRF token
                                      headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
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
                                },
                              });
                            }}>
                              {t('admin.newsletter.send')}
                            </Button>
                          </>
                        )}
                        {selectedCampaign.status === 'SCHEDULED' && (
                          <Button variant="ghost" size="sm" icon={XCircle} className="text-red-600" onClick={() => {
                            // UX FIX: Replaced native confirm() with ConfirmDialog
                            setConfirmAction({
                              isOpen: true,
                              title: t('admin.newsletter.cancelConfirmTitle') || 'Cancel campaign?',
                              message: t('admin.newsletter.cancelConfirm') || 'Cancel this scheduled campaign? It will be reverted to draft.',
                              variant: 'danger',
                              onConfirm: async () => {
                                setConfirmAction(prev => ({ ...prev, isOpen: false }));
                                try {
                                  const res = await fetch(`/api/admin/newsletter/campaigns/${selectedCampaign.id}`, {
                                    method: 'PATCH',
                                    // FAILLE-002 FIX: Include CSRF token
                                    headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
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
                              },
                            });
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

      {/* UX FIX: ConfirmDialog for send/delete actions */}
      <ConfirmDialog
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        variant={confirmAction.variant}
        onConfirm={confirmAction.onConfirm}
        onCancel={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
      />

      {/* ─── COMPOSER MODAL ─────────────────────────────────────── */}
      <Modal isOpen={showComposer} onClose={() => setShowComposer(false)} title={t('admin.newsletter.modalTitle')} size="lg">
        <div className="space-y-4">
          <FormField label={t('admin.newsletter.subject')} required>
            <Input
              type="text"
              value={newCampaign.subject}
              onChange={(e) => { setNewCampaign({ ...newCampaign, subject: e.target.value }); setComposerErrors(prev => { const n = { ...prev }; delete n.subject; return n; }); }}
              placeholder={t('admin.newsletter.subjectPlaceholder')}
            />
            {composerErrors.subject && (
              <p className="mt-1 text-sm text-red-600" role="alert">{composerErrors.subject}</p>
            )}
          </FormField>
          <FormField label={t('admin.newsletter.content')} required>
            <Textarea
              rows={10}
              value={newCampaign.content}
              onChange={(e) => { setNewCampaign({ ...newCampaign, content: e.target.value }); setComposerErrors(prev => { const n = { ...prev }; delete n.content; return n; }); }}
              placeholder={t('admin.newsletter.contentPlaceholder')}
              className="font-mono text-sm"
            />
            {composerErrors.content && (
              <p className="mt-1 text-sm text-red-600" role="alert">{composerErrors.content}</p>
            )}
          </FormField>

          {/* ── A/B Test Configuration ─────────────────────────── */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={abTestEnabled}
                onChange={(e) => setAbTestEnabled(e.target.checked)}
                className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <FlaskConical className="h-4 w-4 text-sky-600" />
              <span className="text-sm font-medium text-slate-700">
                {t('admin.newsletter.enableABTest') || 'Enable A/B Test'}
              </span>
            </label>

            {abTestEnabled && (
              <div className="mt-4 space-y-4">
                {/* Test type */}
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1.5">
                    {t('admin.newsletter.abTestType') || 'Test Type'}
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAbTestType('subject')}
                      className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                        abTestType === 'subject'
                          ? 'bg-sky-50 border-sky-300 text-sky-700 font-medium'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {t('admin.newsletter.abTestSubject') || 'Subject Line'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbTestType('content')}
                      className={`flex-1 px-3 py-2 text-xs rounded-lg border transition-colors ${
                        abTestType === 'content'
                          ? 'bg-sky-50 border-sky-300 text-sky-700 font-medium'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {t('admin.newsletter.abTestContent') || 'Content'}
                    </button>
                  </div>
                </div>

                {/* Variant B input */}
                {abTestType === 'subject' ? (
                  <FormField label={t('admin.newsletter.abVariantBSubject') || 'Variant B Subject'} required>
                    <Input
                      type="text"
                      value={abVariantBSubject}
                      onChange={(e) => setAbVariantBSubject(e.target.value)}
                      placeholder={t('admin.newsletter.abVariantBSubjectPlaceholder') || 'Alternative subject line...'}
                    />
                  </FormField>
                ) : (
                  <FormField label={t('admin.newsletter.abVariantBContent') || 'Variant B Content'} required>
                    <Textarea
                      rows={6}
                      value={abVariantBContent}
                      onChange={(e) => setAbVariantBContent(e.target.value)}
                      placeholder={t('admin.newsletter.abVariantBContentPlaceholder') || 'Alternative email content...'}
                      className="font-mono text-sm"
                    />
                  </FormField>
                )}

                {/* Split & timing settings */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">
                      {t('admin.newsletter.abSplitPct') || 'Test Pool %'}
                    </label>
                    <select
                      value={abSplitPercentage}
                      onChange={(e) => setAbSplitPercentage(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value={10}>10%</option>
                      <option value={20}>20%</option>
                      <option value={30}>30%</option>
                      <option value={40}>40%</option>
                      <option value={50}>50%</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {abSplitPercentage / 2}% A + {abSplitPercentage / 2}% B
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">
                      {t('admin.newsletter.abWaitTime') || 'Wait Time'}
                    </label>
                    <select
                      value={abWaitMinutes}
                      onChange={(e) => setAbWaitMinutes(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value={30}>30 min</option>
                      <option value={60}>1h</option>
                      <option value={120}>2h</option>
                      <option value={240}>4h</option>
                      <option value={480}>8h</option>
                      <option value={1440}>24h</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1.5">
                      {t('admin.newsletter.abWinMetric') || 'Win Metric'}
                    </label>
                    <select
                      value={abWinningMetric}
                      onChange={(e) => setAbWinningMetric(e.target.value as 'open_rate' | 'click_rate')}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="open_rate">{t('admin.newsletter.abMetricOpens') || 'Open Rate'}</option>
                      <option value="click_rate">{t('admin.newsletter.abMetricClicks') || 'Click Rate'}</option>
                    </select>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400">
                  {t('admin.newsletter.abTestExplanation') || `${abSplitPercentage / 2}% of recipients will receive Variant A, ${abSplitPercentage / 2}% Variant B. After ${abWaitMinutes >= 60 ? `${abWaitMinutes / 60}h` : `${abWaitMinutes}min`}, the winning variant (by ${abWinningMetric === 'open_rate' ? 'open rate' : 'click rate'}) will be sent to the remaining ${100 - abSplitPercentage}%.`}
                </p>
              </div>
            )}
          </div>

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
