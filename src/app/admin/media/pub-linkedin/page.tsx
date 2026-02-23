'use client';

import { useState, useEffect } from 'react';
import { Briefcase } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { toast } from 'sonner';

export default function MediaLinkedInPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [appId, setAppId] = useState('');
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/linkedin')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setCompanyId(data.companyId || '');
        setAppId(data.appId || '');
        setHasClientSecret(data.hasClientSecret || false);
        setHasAccessToken(data.hasAccessToken || false);
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // FIX: F20 - Add try/catch with toast.error() for network/save failures
  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/integrations/linkedin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, companyId, appId }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/linkedin', {
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
        title={t('admin.media.linkedinTitle') || 'LinkedIn Marketing'}
        description={t('admin.media.linkedinDescription') || 'Connect LinkedIn Marketing API for B2B campaigns targeting researchers, lab directors, and biotech professionals.'}
        icon={<Briefcase className="w-6 h-6" />}
        color="from-blue-700 to-blue-800"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'companyId',
            label: 'Company Page ID',
            value: companyId,
            onChange: setCompanyId,
            placeholder: '12345678',
            hint: 'Found in LinkedIn Admin Center > Page source URL or via API',
          },
          {
            key: 'appId',
            label: 'App Client ID',
            value: appId,
            onChange: setAppId,
            placeholder: '86xxxxxxxx',
            hint: 'Found in LinkedIn Developer Portal > My Apps > Auth',
          },
          {
            key: 'clientSecret',
            label: 'Client Secret',
            value: hasClientSecret ? '********' : '',
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
        docsUrl="https://learn.microsoft.com/en-us/linkedin/marketing/"
      />
    </div>
  );
}
