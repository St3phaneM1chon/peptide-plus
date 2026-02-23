'use client';

import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { toast } from 'sonner';

export default function MediaTeamsPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [hasSecret, setHasSecret] = useState(false);
  // F68 FIX: Removed unused hasWebhookUrl state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/teams')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setTenantId(data.tenantId || '');
        setClientId(data.clientId || '');
        setWebhookUrl(data.webhookUrl || '');
        setHasSecret(data.hasSecret || false);
        // hasWebhookUrl removed (unused)
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // FIX: F20 - Add try/catch with toast.error() for network/save failures
  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/integrations/teams', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, tenantId, clientId, webhookUrl }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' }),
    });
    const data = await res.json();
    return { success: data.success, detail: data.org, error: data.error };
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.teamsTitle')}
        description={t('admin.integrations.teamsSetupDesc')}
        icon={<Users className="w-6 h-6" />}
        color="from-purple-500 to-purple-600"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'webhookUrl',
            label: t('admin.integrations.teamsWebhookLabel'),
            value: webhookUrl,
            onChange: setWebhookUrl,
            placeholder: 'https://outlook.office.com/webhook/...',
            type: 'url',
            hint: t('admin.integrations.teamsWebhookHint'),
          },
          {
            key: 'tenantId',
            label: 'Tenant ID (Graph API)',
            value: tenantId,
            onChange: setTenantId,
            placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            hint: t('admin.integrations.teamsOptionalGraphApi'),
          },
          {
            key: 'clientId',
            label: 'Client ID (Graph API)',
            value: clientId,
            onChange: setClientId,
            placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            hint: t('admin.integrations.teamsOptionalGraphApi'),
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
        docsUrl="https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
      />
    </div>
  );
}
