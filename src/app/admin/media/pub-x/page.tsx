'use client';

import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';

export default function MediaXPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [username, setUsername] = useState('');
  const [apiKeyId, setApiKeyId] = useState('');
  const [hasApiKeySecret, setHasApiKeySecret] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
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
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const res = await fetch('/api/admin/integrations/x', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, username, apiKeyId }),
    });
    if (!res.ok) throw new Error('Save failed');
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.xTitle')}
        description="Connect X (Twitter) API v2 for post scheduling, analytics, and ad campaigns. Free tier: 500 posts/month. Pay-per-use available."
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
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developer.x.com/en/docs/twitter-api"
      />
    </div>
  );
}
