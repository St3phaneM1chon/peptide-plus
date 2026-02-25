'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';

export default function MediaXPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [apiKeyId, setApiKeyId] = useState('');
  const [hasApiKeySecret, setHasApiKeySecret] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/x')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setUsername(data.username || '');
        setApiKeyId(data.apiKeyId || '');
        setHasApiKeySecret(data.hasApiKeySecret || false);
        setHasAccessToken(data.hasAccessToken || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // FIX: F20 - Add try/catch with toast.error() for network/save failures
  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/integrations/x', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, username, apiKeyId, publicLink }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    fetch('/api/admin/integrations/x')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setUsername(data.username || '');
        setApiKeyId(data.apiKeyId || '');
        setHasApiKeySecret(data.hasApiKeySecret || false);
        setHasAccessToken(data.hasAccessToken || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
        toast.success(t('common.refreshed'));
      })
      .catch(() => toast.error(t('common.error')));
  }, [t]);

  const onViewLogs = useCallback(() => { router.push('/admin/logs?filter=x'); }, [router]);
  const onDocumentation = useCallback(() => { window.open('https://developer.x.com/en/docs/twitter-api', '_blank'); }, []);
  const onExport = useCallback(() => {
    const config = { platform: 'X (Twitter)', enabled, username, apiKeyId, hasApiKeySecret, hasAccessToken, publicLink, webhookUrl, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `x-twitter-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.media.exportSuccess') || 'Configuration exported');
  }, [enabled, username, apiKeyId, hasApiKeySecret, hasAccessToken, publicLink, webhookUrl, t]);

  useRibbonAction('configure', onConfigure);
  useRibbonAction('testConnection', onTestConnection);
  useRibbonAction('syncData', onSyncData);
  useRibbonAction('viewLogs', onViewLogs);
  useRibbonAction('documentation', onDocumentation);
  useRibbonAction('export', onExport);

  // --- media.ads ribbon actions ---
  useRibbonAction('newAdCampaign', useCallback(() => { toast.info(t('admin.media.adCampaignHint') || 'Create ad campaigns in X Ads Manager.'); }, [t]));
  useRibbonAction('delete', useCallback(() => { toast.info(t('admin.media.adDeleteHint') || 'Manage and delete campaigns in X Ads Manager.'); }, [t]));
  useRibbonAction('pause', useCallback(() => { toast.info(t('admin.media.adPauseHint') || 'Pause campaigns directly in X Ads Manager.'); }, [t]));
  useRibbonAction('resume', useCallback(() => { toast.info(t('admin.media.adResumeHint') || 'Resume paused campaigns in X Ads Manager.'); }, [t]));
  useRibbonAction('modifyBudget', useCallback(() => { toast.info(t('admin.media.adBudgetHint') || 'Adjust budgets in X Ads Manager.'); }, [t]));
  useRibbonAction('performanceStats', useCallback(() => { toast.info(t('admin.media.adStatsHint') || 'View analytics in X Analytics dashboard.'); }, [t]));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.xTitle')}
        // FIX: F35 - Use i18n for description instead of hardcoded English
        description={t('admin.media.xDescription') || 'Connect X (Twitter) API v2 for post scheduling, analytics, and ad campaigns.'}
        icon={<MessageCircle className="w-6 h-6" />}
        color="from-slate-800 to-slate-900"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'username',
            label: 'X Username',
            value: username,
            onChange: setUsername,
            placeholder: '@biocyclepeptides',
            hint: 'Your X account handle',
          },
          {
            key: 'apiKeyId',
            label: 'API Key (Consumer Key)',
            value: apiKeyId,
            onChange: setApiKeyId,
            placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
            hint: 'Found in X Developer Portal > App > Keys and Tokens',
          },
          {
            key: 'apiKeySecret',
            label: 'API Key Secret',
            value: hasApiKeySecret ? '********' : '',
            onChange: () => {},
            readOnly: true,
            type: 'password',
            hint: t('admin.integrations.secretEnvHint'),
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
            key: 'publicLink',
            label: t('admin.integrations.publicLinkLabel'),
            value: publicLink,
            onChange: setPublicLink,
            placeholder: 'https://x.com/BCPeptides',
            type: 'url',
            hint: t('admin.integrations.publicLinkHint'),
          },
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developer.x.com/en/docs/twitter-api"
      />
    </div>
  );
}
