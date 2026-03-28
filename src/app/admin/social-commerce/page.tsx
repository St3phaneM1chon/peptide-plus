'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Share2, ExternalLink, Copy, CheckCircle, RefreshCw,
  TrendingUp, ShoppingBag, MousePointerClick, DollarSign,
  Link2, Plus, Globe, Instagram, MessageCircle,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  SectionCard,
  Button,
  Modal,
  FormField,
  Input,
  EmptyState,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Platform {
  id: string;
  name: string;
  icon: string;
  feedUrl: string;
  feedFormat: string;
  status: 'active' | 'inactive' | 'error';
  description: string;
}

interface FeedStats {
  totalProducts: number;
  activeProducts: number;
  inStockProducts: number;
  outOfStockProducts: number;
  withImages: number;
  withBarcode: number;
  withSku: number;
  lastGenerated: string | null;
}

interface LinkStats {
  totalLinks: number;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  byPlatform: Record<string, {
    links: number;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
}

interface ShoppableLink {
  id: string;
  shortCode: string;
  shortUrl: string;
  fullUrl: string;
  productId: string;
  productName: string;
  platform: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
  clicks: number;
  conversions: number;
  revenue: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Platform icon helper
// ---------------------------------------------------------------------------

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const cls = className || 'w-5 h-5';
  switch (platform) {
    case 'google':
      return <Globe className={cls} />;
    case 'facebook':
      return <MessageCircle className={cls} />;
    case 'tiktok':
      return <ShoppingBag className={cls} />;
    case 'instagram':
      return <Instagram className={cls} />;
    default:
      return <Share2 className={cls} />;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SocialCommercePage() {
  const { t } = useI18n();

  // State
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [feedStats, setFeedStats] = useState<FeedStats | null>(null);
  const [linkStats, setLinkStats] = useState<LinkStats | null>(null);
  const [recentLinks, setRecentLinks] = useState<ShoppableLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Create link modal
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [newLinkSlug, setNewLinkSlug] = useState('');
  const [newLinkPlatform, setNewLinkPlatform] = useState('instagram');
  const [newLinkCampaign, setNewLinkCampaign] = useState('');
  const [creating, setCreating] = useState(false);

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/social-commerce');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setPlatforms(data.platforms || []);
      setFeedStats(data.feedStats || null);
      setLinkStats(data.linkStats || null);
      setRecentLinks(data.recentLinks || []);
    } catch {
      toast.error(t('admin.socialCommerce.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast.success(t('admin.socialCommerce.feedUrlCopied'));
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleCreateLink = async () => {
    if (!newLinkSlug.trim()) {
      toast.error(t('admin.socialCommerce.slugRequired'));
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/admin/social-commerce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          productSlug: newLinkSlug.trim(),
          platform: newLinkPlatform,
          campaign: newLinkCampaign.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create link');
      }

      toast.success(t('admin.socialCommerce.linkCreated'));
      setShowCreateLink(false);
      setNewLinkSlug('');
      setNewLinkCampaign('');
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error');
    } finally {
      setCreating(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <PageHeader
          title={t('admin.socialCommerce.title')}
          subtitle={t('admin.socialCommerce.subtitle')}

        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-[var(--ios-bg-secondary)] rounded-[var(--ios-radius-lg)] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title={t('admin.socialCommerce.title')}
        subtitle={t('admin.socialCommerce.subtitle')}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('common.refresh')}
            </Button>
            <Button onClick={() => setShowCreateLink(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('admin.socialCommerce.createLink')}
            </Button>
          </div>
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.socialCommerce.productsInFeed')}
          value={feedStats?.activeProducts ?? 0}
          icon={ShoppingBag}
        />
        <StatCard
          label={t('admin.socialCommerce.totalLinks')}
          value={linkStats?.totalLinks ?? 0}
          icon={Link2}
        />
        <StatCard
          label={t('admin.socialCommerce.totalClicks')}
          value={linkStats?.totalClicks ?? 0}
          icon={MousePointerClick}
        />
        <StatCard
          label={t('admin.socialCommerce.totalRevenue')}
          value={`$${(linkStats?.totalRevenue ?? 0).toFixed(2)}`}
          icon={DollarSign}
        />
      </div>

      {/* Connected Platforms */}
      <SectionCard title={t('admin.socialCommerce.connectedPlatforms')}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {platforms.map((platform) => (
            <div
              key={platform.id}
              className="border border-[var(--ios-separator)] rounded-[var(--ios-radius-lg)] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PlatformIcon platform={platform.id} className="w-6 h-6 text-[var(--ios-blue)]" />
                  <div>
                    <h3 className="font-semibold text-sm">{platform.name}</h3>
                    <p className="text-xs text-[var(--ios-text-secondary)]">{platform.feedFormat}</p>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  {t('admin.socialCommerce.feedActive')}
                </span>
              </div>

              <p className="text-xs text-[var(--ios-text-secondary)]">
                {platform.description}
              </p>

              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-[var(--ios-bg-secondary)] p-2 rounded-[var(--ios-radius-sm)] truncate font-mono">
                  {platform.feedUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(platform.feedUrl)}
                  className="p-2 hover:bg-[var(--ios-bg-secondary)] rounded-[var(--ios-radius-sm)] transition-colors"
                  title={t('admin.socialCommerce.copyFeedUrl')}
                >
                  {copiedUrl === platform.feedUrl ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <a
                  href={platform.feedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-[var(--ios-bg-secondary)] rounded-[var(--ios-radius-sm)] transition-colors"
                  title={t('admin.socialCommerce.previewFeed')}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Feed Health */}
      {feedStats && (
        <SectionCard title={t('admin.socialCommerce.feedHealth')}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-[var(--ios-bg-secondary)] rounded-[var(--ios-radius-md)]">
              <p className="text-2xl font-bold">{feedStats.withImages}</p>
              <p className="text-xs text-[var(--ios-text-secondary)]">{t('admin.socialCommerce.withImages')}</p>
            </div>
            <div className="text-center p-3 bg-[var(--ios-bg-secondary)] rounded-[var(--ios-radius-md)]">
              <p className="text-2xl font-bold">{feedStats.withSku}</p>
              <p className="text-xs text-[var(--ios-text-secondary)]">{t('admin.socialCommerce.withSku')}</p>
            </div>
            <div className="text-center p-3 bg-[var(--ios-bg-secondary)] rounded-[var(--ios-radius-md)]">
              <p className="text-2xl font-bold">{feedStats.withBarcode}</p>
              <p className="text-xs text-[var(--ios-text-secondary)]">{t('admin.socialCommerce.withBarcode')}</p>
            </div>
            <div className="text-center p-3 bg-[var(--ios-bg-secondary)] rounded-[var(--ios-radius-md)]">
              <p className="text-2xl font-bold">{feedStats.outOfStockProducts}</p>
              <p className="text-xs text-[var(--ios-text-secondary)]">{t('admin.socialCommerce.outOfStock')}</p>
            </div>
          </div>
          {feedStats.lastGenerated && (
            <p className="text-xs text-[var(--ios-text-secondary)] mt-3">
              {t('admin.socialCommerce.lastGenerated')}: {new Date(feedStats.lastGenerated).toLocaleString()}
            </p>
          )}
        </SectionCard>
      )}

      {/* Performance by Platform */}
      {linkStats && Object.keys(linkStats.byPlatform).length > 0 && (
        <SectionCard title={t('admin.socialCommerce.performanceByPlatform')}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ios-separator)]">
                  <th className="text-left py-2 px-3 font-medium">{t('admin.socialCommerce.platform')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('admin.socialCommerce.links')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('admin.socialCommerce.clicks')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('admin.socialCommerce.conversionsCol')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('admin.socialCommerce.revenueCol')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('admin.socialCommerce.convRate')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(linkStats.byPlatform).map(([platform, stats]) => (
                  <tr key={platform} className="border-b border-[var(--ios-separator)] last:border-0">
                    <td className="py-2 px-3 flex items-center gap-2 capitalize">
                      <PlatformIcon platform={platform} className="w-4 h-4" />
                      {platform}
                    </td>
                    <td className="text-right py-2 px-3">{stats.links}</td>
                    <td className="text-right py-2 px-3">{stats.clicks}</td>
                    <td className="text-right py-2 px-3">{stats.conversions}</td>
                    <td className="text-right py-2 px-3">${stats.revenue.toFixed(2)}</td>
                    <td className="text-right py-2 px-3">
                      {stats.clicks > 0 ? ((stats.conversions / stats.clicks) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Recent Shoppable Links */}
      <SectionCard title={t('admin.socialCommerce.recentLinks')}>
        {recentLinks.length === 0 ? (
          <EmptyState
            icon={Link2}
            title={t('admin.socialCommerce.noLinks')}
            description={t('admin.socialCommerce.noLinksDesc')}
            action={
              <button
                onClick={() => setShowCreateLink(true)}
                className="px-4 py-2 bg-[var(--ios-blue)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                {t('admin.socialCommerce.createFirstLink')}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ios-separator)]">
                  <th className="text-left py-2 px-3 font-medium">{t('admin.socialCommerce.product')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('admin.socialCommerce.platform')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('admin.socialCommerce.shortUrl')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('admin.socialCommerce.clicks')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('admin.socialCommerce.conversionsCol')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('admin.socialCommerce.created')}</th>
                </tr>
              </thead>
              <tbody>
                {recentLinks.map((link) => (
                  <tr key={link.id} className="border-b border-[var(--ios-separator)] last:border-0">
                    <td className="py-2 px-3 max-w-[200px] truncate">{link.productName}</td>
                    <td className="py-2 px-3 capitalize flex items-center gap-1">
                      <PlatformIcon platform={link.platform} className="w-3.5 h-3.5" />
                      {link.platform}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        <code className="text-xs font-mono">{link.shortUrl}</code>
                        <button
                          onClick={() => copyToClipboard(link.shortUrl)}
                          className="p-1 hover:bg-[var(--ios-bg-secondary)] rounded"
                        >
                          {copiedUrl === link.shortUrl ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="text-right py-2 px-3">{link.clicks}</td>
                    <td className="text-right py-2 px-3">{link.conversions}</td>
                    <td className="py-2 px-3 text-[var(--ios-text-secondary)]">
                      {new Date(link.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Create Shoppable Link Modal */}
      <Modal
        isOpen={showCreateLink}
        onClose={() => setShowCreateLink(false)}
        title={t('admin.socialCommerce.createLinkTitle')}
      >
        <div className="space-y-4">
          <FormField label={t('admin.socialCommerce.productSlug')}>
            <Input
              value={newLinkSlug}
              onChange={(e) => setNewLinkSlug(e.target.value)}
              placeholder="bpc-157"
            />
          </FormField>

          <FormField label={t('admin.socialCommerce.selectPlatform')}>
            <select
              value={newLinkPlatform}
              onChange={(e) => setNewLinkPlatform(e.target.value)}
              className="w-full px-3 py-2 rounded-[var(--ios-radius-md)] border border-[var(--ios-separator)] bg-[var(--ios-bg-primary)] text-sm"
            >
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="twitter">Twitter / X</option>
              <option value="linkedin">LinkedIn</option>
              <option value="pinterest">Pinterest</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="other">{t('common.other')}</option>
            </select>
          </FormField>

          <FormField label={t('admin.socialCommerce.campaignName')}>
            <Input
              value={newLinkCampaign}
              onChange={(e) => setNewLinkCampaign(e.target.value)}
              placeholder={t('admin.socialCommerce.campaignPlaceholder')}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowCreateLink(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreateLink} disabled={creating}>
              {creating ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              {t('admin.socialCommerce.generateLink')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
