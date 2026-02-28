'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';
import { toast } from 'sonner';

export default function MediaMetaPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [appId, setAppId] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [pageId, setPageId] = useState('');
  const [igAccountId, setIgAccountId] = useState('');
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [hasAppSecret, setHasAppSecret] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/meta')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setAppId(data.appId || '');
        setPixelId(data.pixelId || '');
        setPageId(data.pageId || '');
        setIgAccountId(data.igAccountId || '');
        setHasAccessToken(data.hasAccessToken || false);
        setHasAppSecret(data.hasAppSecret || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // FIX: F20 - Add try/catch with toast.error() for network/save failures
  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/integrations/meta', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled, appId, pixelId, pageId, igAccountId, publicLink }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.media.saveFailedError') || 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/meta', {
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
    fetch('/api/admin/integrations/meta')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setAppId(data.appId || '');
        setPixelId(data.pixelId || '');
        setPageId(data.pageId || '');
        setIgAccountId(data.igAccountId || '');
        setHasAccessToken(data.hasAccessToken || false);
        setHasAppSecret(data.hasAppSecret || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
        toast.success(t('common.refreshed'));
      })
      .catch(() => toast.error(t('common.error')));
  }, [t]);

  const onViewLogs = useCallback(() => { router.push('/admin/logs?filter=meta'); }, [router]);
  const onDocumentation = useCallback(() => { window.open('https://developers.facebook.com/docs/marketing-apis', '_blank'); }, []);
  const onExport = useCallback(() => {
    const config = { platform: 'Meta', enabled, appId, pixelId, pageId, igAccountId, hasAccessToken, hasAppSecret, publicLink, webhookUrl, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meta-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.media.exportSuccess') || 'Configuration exported');
  }, [enabled, appId, pixelId, pageId, igAccountId, hasAccessToken, hasAppSecret, publicLink, webhookUrl, t]);

  useRibbonAction('configure', onConfigure);
  useRibbonAction('testConnection', onTestConnection);
  useRibbonAction('syncData', onSyncData);
  useRibbonAction('viewLogs', onViewLogs);
  useRibbonAction('documentation', onDocumentation);
  useRibbonAction('export', onExport);

  // --- media.ads ribbon actions ---
  useRibbonAction('newAdCampaign', useCallback(() => { toast.info(t('admin.media.adCampaignHint') || 'Create ad campaigns in Meta Ads Manager.'); }, [t]));
  useRibbonAction('delete', useCallback(() => { toast.info(t('admin.media.adDeleteHint') || 'Manage and delete campaigns in Meta Ads Manager.'); }, [t]));
  useRibbonAction('pause', useCallback(() => { toast.info(t('admin.media.adPauseHint') || 'Pause campaigns directly in Meta Ads Manager.'); }, [t]));
  useRibbonAction('resume', useCallback(() => { toast.info(t('admin.media.adResumeHint') || 'Resume paused campaigns in Meta Ads Manager.'); }, [t]));
  useRibbonAction('modifyBudget', useCallback(() => { toast.info(t('admin.media.adBudgetHint') || 'Adjust budgets in Meta Ads Manager.'); }, [t]));
  useRibbonAction('performanceStats', useCallback(() => { toast.info(t('admin.media.adStatsHint') || 'View analytics in Meta Business Suite.'); }, [t]));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        // FIX: F35 - Use i18n for title and description instead of hardcoded English
        title={t('admin.media.metaTitle') || 'Meta (Facebook + Instagram)'}
        description={t('admin.media.metaDescription') || 'Connect Meta Marketing API, Instagram Graph API, Meta Pixel, and Conversions API.'}
        icon={<Globe className="w-6 h-6" />}
        color="from-blue-600 to-indigo-600"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'appId',
            label: 'App ID',
            value: appId,
            onChange: setAppId,
            placeholder: '123456789012345',
            hint: 'Found in Meta for Developers > Your App > Settings > Basic',
          },
          {
            key: 'pixelId',
            label: 'Meta Pixel ID',
            value: pixelId,
            onChange: setPixelId,
            placeholder: '123456789012345',
            hint: 'Found in Events Manager > Data Sources > Pixel',
          },
          {
            key: 'pageId',
            label: 'Facebook Page ID',
            value: pageId,
            onChange: setPageId,
            placeholder: '123456789012345',
            hint: 'Found in Page Settings > Page Transparency',
          },
          {
            key: 'igAccountId',
            label: 'Instagram Business Account ID',
            value: igAccountId,
            onChange: setIgAccountId,
            placeholder: '12345678901',
            hint: 'Found via Graph API: GET /me/accounts > ig_business_account',
          },
          {
            key: 'accessToken',
            label: 'Access Token',
            value: hasAccessToken ? '********' : '',
            onChange: () => {},
            readOnly: true,
            type: 'password',
            hint: t('admin.integrations.secretEnvHint'),
          },
          {
            key: 'appSecret',
            label: 'App Secret',
            value: hasAppSecret ? '********' : '',
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
            placeholder: 'https://facebook.com/biocyclepeptides',
            type: 'url',
            hint: t('admin.integrations.publicLinkHint'),
          },
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developers.facebook.com/docs/marketing-apis"
      />
    </div>
  );
}
