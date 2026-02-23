'use client';

import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { toast } from 'sonner';

export default function MediaTikTokPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [advertiserId, setAdvertiserId] = useState('');
  const [appId, setAppId] = useState('');
  const [hasAppSecret, setHasAppSecret] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/tiktok')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setAdvertiserId(data.advertiserId || '');
        setAppId(data.appId || '');
        setHasAppSecret(data.hasAppSecret || false);
        setHasAccessToken(data.hasAccessToken || false);
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // FIX: F20 - Add try/catch with toast.error() for network/save failures
  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/integrations/tiktok', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, advertiserId, appId }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      throw err; // Re-throw so IntegrationCard can handle state
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/tiktok', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' }),
    });
    const data = await res.json();
    return { success: data.success, detail: data.detail, error: data.error };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.tiktokTitle')}
        // FIX: F35 - Use i18n for description instead of hardcoded English
        description={t('admin.media.tiktokDescription') || 'Connect TikTok Marketing API for content posting, ad campaigns, and analytics.'}
        icon={<Activity className="w-6 h-6" />}
        color="from-pink-500 to-pink-600"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'advertiserId',
            label: 'Advertiser ID',
            value: advertiserId,
            onChange: setAdvertiserId,
            placeholder: '1234567890123456789',
            hint: 'Found in TikTok Ads Manager > Account Info',
          },
          {
            key: 'appId',
            label: 'App ID',
            value: appId,
            onChange: setAppId,
            placeholder: '1234567890123456789',
            hint: 'Found in TikTok Developer Portal > App Management',
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
            key: 'accessToken',
            label: 'Access Token',
            value: hasAccessToken ? '********' : '',
            onChange: () => {},
            readOnly: true,
            type: 'password',
            hint: t('admin.integrations.secretEnvHint'),
          },
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://business-api.tiktok.com/portal/docs"
      />
    </div>
  );
}
