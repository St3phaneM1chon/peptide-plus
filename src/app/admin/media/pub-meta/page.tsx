'use client';

import { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { toast } from 'sonner';

export default function MediaMetaPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [appId, setAppId] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [pageId, setPageId] = useState('');
  const [igAccountId, setIgAccountId] = useState('');
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [hasAppSecret, setHasAppSecret] = useState(false);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, appId, pixelId, pageId, igAccountId }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/meta', {
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
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developers.facebook.com/docs/marketing-apis"
      />
    </div>
  );
}
