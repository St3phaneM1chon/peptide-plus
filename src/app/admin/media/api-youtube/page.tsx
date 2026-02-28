'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Video } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';
import { toast } from 'sonner';

export default function MediaYouTubePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/youtube')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setChannelId(data.channelId || '');
        setApiKey(data.apiKey || '');
        setHasClientSecret(data.hasClientSecret || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // FIX: F20 - Add try/catch with toast.error() for network/save failures
  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/integrations/youtube', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled, channelId, apiKey, publicLink }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.media.saveFailedError') || 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/youtube', {
      method: 'POST',
      headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'test' }),
    });
    const data = await res.json();
    return { success: data.success, detail: data.detail, error: data.error };
  };

  // --- Ribbon actions ---
  const onConfigure = useCallback(() => {
    const firstInput = document.querySelector<HTMLInputElement>('input:not([readonly])');
    if (firstInput) { firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); firstInput.focus(); }
  }, []);

  const onTestConnection = useCallback(async () => {
    try {
      const result = await handleTest();
      if (result.success) toast.success(t('admin.integrations.testSuccess'));
      else toast.error(result.error || t('admin.integrations.testFailed'));
    } catch { toast.error(t('admin.integrations.testFailed')); }
  }, [t]);

  const onSyncData = useCallback(() => {
    fetch('/api/admin/integrations/youtube')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setChannelId(data.channelId || '');
        setApiKey(data.apiKey || '');
        setHasClientSecret(data.hasClientSecret || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
        toast.success(t('common.refreshed'));
      })
      .catch(() => toast.error(t('common.error')));
  }, [t]);

  const onViewLogs = useCallback(() => { router.push('/admin/logs?filter=youtube'); }, [router]);
  const onDocumentation = useCallback(() => { window.open('https://developers.google.com/youtube/v3', '_blank'); }, []);
  const onExport = useCallback(() => {
    const config = { platform: 'YouTube', enabled, channelId, apiKey: apiKey ? '***' : '', hasClientSecret, publicLink, webhookUrl, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youtube-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.media.exportSuccess') || 'Configuration exported');
  }, [enabled, channelId, apiKey, hasClientSecret, publicLink, webhookUrl, t]);

  useRibbonAction('configure', onConfigure);
  useRibbonAction('testConnection', onTestConnection);
  useRibbonAction('syncData', onSyncData);
  useRibbonAction('viewLogs', onViewLogs);
  useRibbonAction('documentation', onDocumentation);
  useRibbonAction('export', onExport);

  // --- media.ads ribbon actions ---
  useRibbonAction('newAdCampaign', useCallback(() => { toast.info(t('admin.media.adCampaignHint') || 'Create ad campaigns in YouTube Studio or Google Ads console.'); }, [t]));
  useRibbonAction('delete', useCallback(() => { toast.info(t('admin.media.adDeleteHint') || 'Manage and delete campaigns in the platform dashboard.'); }, [t]));
  useRibbonAction('pause', useCallback(() => { toast.info(t('admin.media.adPauseHint') || 'Pause campaigns directly in YouTube Studio or Google Ads.'); }, [t]));
  useRibbonAction('resume', useCallback(() => { toast.info(t('admin.media.adResumeHint') || 'Resume paused campaigns in the platform dashboard.'); }, [t]));
  useRibbonAction('modifyBudget', useCallback(() => { toast.info(t('admin.media.adBudgetHint') || 'Adjust budgets in Google Ads console.'); }, [t]));
  useRibbonAction('performanceStats', useCallback(() => { toast.info(t('admin.media.adStatsHint') || 'View analytics in YouTube Studio or Google Ads.'); }, [t]));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.youtubeTitle')}
        // FIX: F35 - Use i18n for description instead of hardcoded English
        description={t('admin.media.youtubeDescription') || 'Connect your YouTube channel for video management, playlists, analytics, and ad campaigns.'}
        icon={<Video className="w-6 h-6" />}
        color="from-red-500 to-red-600"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'channelId',
            label: 'Channel ID',
            value: channelId,
            onChange: setChannelId,
            placeholder: 'UCxxxxxxxxxxxxxxxxxxxxxxxxx',
            hint: 'Found in YouTube Studio > Settings > Channel > Advanced Settings',
          },
          {
            key: 'apiKey',
            label: 'API Key (Data API v3)',
            value: apiKey,
            onChange: setApiKey,
            placeholder: 'AIzaSy...',
            hint: 'Create in Google Cloud Console > APIs & Services > Credentials',
          },
          {
            key: 'clientSecret',
            label: 'OAuth Client Secret',
            value: hasClientSecret ? '********' : '',
            onChange: () => {},
            readOnly: true,
            type: 'password',
            hint: t('admin.integrations.secretEnvHint'),
          },
          {
            key: 'publicLink',
            label: t('admin.integrations.publicLinkLabel'),
            value: publicLink,
            onChange: setPublicLink,
            placeholder: 'https://youtube.com/@biocyclepeptides',
            type: 'url',
            hint: t('admin.integrations.publicLinkHint'),
          },
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developers.google.com/youtube/v3"
      />
    </div>
  );
}
