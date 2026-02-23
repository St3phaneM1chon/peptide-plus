'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';

export default function MediaGoogleAdsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [hasDeveloperToken, setHasDeveloperToken] = useState(false);
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [hasRefreshToken, setHasRefreshToken] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/google')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setCustomerId(data.customerId || '');
        setMerchantId(data.merchantId || '');
        setHasDeveloperToken(data.hasDeveloperToken || false);
        setHasClientSecret(data.hasClientSecret || false);
        setHasRefreshToken(data.hasRefreshToken || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // FIX: F20 - Add try/catch with toast.error() for network/save failures
  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/integrations/google', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, customerId, merchantId, publicLink }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/google', {
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
    fetch('/api/admin/integrations/google')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setCustomerId(data.customerId || '');
        setMerchantId(data.merchantId || '');
        setHasDeveloperToken(data.hasDeveloperToken || false);
        setHasClientSecret(data.hasClientSecret || false);
        setHasRefreshToken(data.hasRefreshToken || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
        toast.success(t('common.refreshed'));
      })
      .catch(() => toast.error(t('common.error')));
  }, [t]);

  const onViewLogs = useCallback(() => { router.push('/admin/logs?filter=google'); }, [router]);
  const onDocumentation = useCallback(() => { window.open('https://developers.google.com/google-ads/api', '_blank'); }, []);
  const onExport = useCallback(() => { toast.info(t('common.comingSoon')); }, [t]);

  useRibbonAction('configure', onConfigure);
  useRibbonAction('testConnection', onTestConnection);
  useRibbonAction('syncData', onSyncData);
  useRibbonAction('viewLogs', onViewLogs);
  useRibbonAction('documentation', onDocumentation);
  useRibbonAction('export', onExport);

  // --- media.ads ribbon actions ---
  useRibbonAction('newAdCampaign', useCallback(() => { toast.info(t('common.comingSoon')); }, [t]));
  useRibbonAction('delete', useCallback(() => { toast.info(t('common.comingSoon')); }, [t]));
  useRibbonAction('pause', useCallback(() => { toast.info(t('common.comingSoon')); }, [t]));
  useRibbonAction('resume', useCallback(() => { toast.info(t('common.comingSoon')); }, [t]));
  useRibbonAction('modifyBudget', useCallback(() => { toast.info(t('common.comingSoon')); }, [t]));
  useRibbonAction('performanceStats', useCallback(() => { toast.info(t('common.comingSoon')); }, [t]));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.googleTitle')}
        // FIX: F35 - Use i18n for description instead of hardcoded English
        description={t('admin.media.googleDescription') || 'Connect Google Ads API + Merchant Center for Shopping campaigns, conversion tracking, and product feed sync.'}
        icon={<Search className="w-6 h-6" />}
        color="from-blue-600 to-green-500"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'customerId',
            label: 'Google Ads Customer ID',
            value: customerId,
            onChange: setCustomerId,
            placeholder: '123-456-7890',
            hint: 'Found in Google Ads > Account Settings (format: XXX-XXX-XXXX)',
          },
          {
            key: 'merchantId',
            label: 'Merchant Center ID',
            value: merchantId,
            onChange: setMerchantId,
            placeholder: '123456789',
            hint: 'Found in Google Merchant Center > Settings > Account Information',
          },
          {
            key: 'developerToken',
            label: 'Developer Token',
            value: hasDeveloperToken ? '********' : '',
            onChange: () => {},
            readOnly: true,
            type: 'password',
            hint: t('admin.integrations.secretEnvHint'),
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
            key: 'refreshToken',
            label: 'Refresh Token',
            value: hasRefreshToken ? '********' : '',
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
            placeholder: 'https://ads.google.com/...',
            type: 'url',
            hint: t('admin.integrations.publicLinkHint'),
          },
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developers.google.com/google-ads/api"
      />
    </div>
  );
}
