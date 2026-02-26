'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

export default function MediaWhatsAppPage() {
  const { t } = useI18n();
  const [enabled, setEnabled] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/whatsapp')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setPhoneNumberId(data.phoneNumberId || '');
        setBusinessAccountId(data.businessAccountId || '');
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
      const res = await fetch('/api/admin/integrations/whatsapp', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled, phoneNumberId, businessAccountId, publicLink }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/whatsapp', {
      method: 'POST',
      headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'test' }),
    });
    const data = await res.json();
    return { success: data.success, detail: data.phone, error: data.error };
  };

  const onConfigure = useCallback(() => {
    const el = document.querySelector<HTMLInputElement>('input[placeholder]');
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
  }, []);
  const onTestConnection = useCallback(() => { handleTest().then(r => { if (r.success) toast.success('Connection OK'); else toast.error(r.error || 'Test failed'); }); }, []);
  const onRefreshToken = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/integrations/whatsapp').then(res => res.json()).then(data => {
      setEnabled(data.enabled || false); setPhoneNumberId(data.phoneNumberId || ''); setBusinessAccountId(data.businessAccountId || ''); setHasAccessToken(data.hasAccessToken || false); setPublicLink(data.publicLink || ''); setWebhookUrl(data.webhookUrl || '');
    }).catch(console.error).finally(() => setLoading(false));
  }, []);
  const onViewLogs = useCallback(() => { window.open('/admin/logs?filter=whatsapp', '_self'); }, []);
  const onDocumentation = useCallback(() => { window.open('https://developers.facebook.com/docs/whatsapp/cloud-api', '_blank'); }, []);

  useRibbonAction('configure', onConfigure);
  useRibbonAction('testConnection', onTestConnection);
  useRibbonAction('refreshToken', onRefreshToken);
  useRibbonAction('viewLogs', onViewLogs);
  useRibbonAction('documentation', onDocumentation);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.whatsappTitle')}
        description={t('admin.integrations.whatsappSetupDesc')}
        icon={<MessageCircle className="w-6 h-6" />}
        color="from-green-500 to-green-600"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'phoneNumberId',
            label: 'Phone Number ID',
            value: phoneNumberId,
            onChange: setPhoneNumberId,
            placeholder: '123456789012345',
            hint: t('admin.integrations.whatsappPhoneIdHint'),
          },
          {
            key: 'businessAccountId',
            label: 'Business Account ID',
            value: businessAccountId,
            onChange: setBusinessAccountId,
            placeholder: '123456789012345',
            hint: t('admin.integrations.whatsappBusinessIdHint'),
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
            placeholder: 'https://wa.me/15145551234',
            type: 'url',
            hint: t('admin.integrations.publicLinkWhatsAppHint'),
          },
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developers.facebook.com/docs/whatsapp/cloud-api"
      />
    </div>
  );
}
