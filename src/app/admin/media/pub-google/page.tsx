'use client';

import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';

export default function MediaGoogleAdsPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [merchantId, setMerchantId] = useState('');
  const [hasDeveloperToken, setHasDeveloperToken] = useState(false);
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [hasRefreshToken, setHasRefreshToken] = useState(false);
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
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    const res = await fetch('/api/admin/integrations/google', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, customerId, merchantId }),
    });
    if (!res.ok) throw new Error('Save failed');
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.googleTitle')}
        description="Connect Google Ads API + Merchant Center for Shopping campaigns, conversion tracking, and product feed sync. Free API access."
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
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developers.google.com/google-ads/api"
      />
    </div>
  );
}
