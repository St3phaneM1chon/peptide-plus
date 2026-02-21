'use client';

import { useState, useEffect } from 'react';
import { Video } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';

export default function MediaZoomPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [clientId, setClientId] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/zoom')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setAccountId(data.accountId || '');
        setClientId(data.clientId || '');
        setHasSecret(data.hasSecret || false);
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const res = await fetch('/api/admin/integrations/zoom', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, accountId, clientId }),
    });
    if (!res.ok) throw new Error('Save failed');
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/zoom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' }),
    });
    const data = await res.json();
    return { success: data.success, detail: data.user, error: data.error };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.zoomTitle')}
        description={t('admin.integrations.zoomSetupDesc')}
        icon={<Video className="w-6 h-6" />}
        color="from-blue-500 to-blue-600"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'accountId',
            label: 'Account ID',
            value: accountId,
            onChange: setAccountId,
            placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            hint: t('admin.integrations.zoomAccountIdHint'),
          },
          {
            key: 'clientId',
            label: 'Client ID',
            value: clientId,
            onChange: setClientId,
            placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
            hint: t('admin.integrations.zoomClientIdHint'),
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            value: hasSecret ? '********' : '',
            onChange: () => {},
            readOnly: true,
            type: 'password',
            hint: t('admin.integrations.secretEnvHint'),
          },
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developers.zoom.us/docs/api/"
      />
    </div>
  );
}
