'use client';

import { useState, useEffect } from 'react';
import { Video } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { toast } from 'sonner';

export default function MediaYouTubePage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [channelId, setChannelId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasClientSecret, setHasClientSecret] = useState(false);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, channelId, apiKey }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/youtube', {
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
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developers.google.com/youtube/v3"
      />
    </div>
  );
}
