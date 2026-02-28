'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';
import { toast } from 'sonner';

export default function ApiGoogleMeetPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [clientId, setClientId] = useState('');
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/google-meet')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setClientId(data.clientId || '');
        setHasClientSecret(data.hasClientSecret || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/integrations/google-meet', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled, clientId, publicLink }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.media.saveFailedError') || 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/google-meet', {
      method: 'POST',
      headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'test' }),
    });
    const data = await res.json();
    return { success: data.success, detail: data.detail, error: data.error };
  };

  useRibbonAction('configure', useCallback(() => {
    const firstInput = document.querySelector<HTMLInputElement>('input:not([readonly])');
    if (firstInput) { firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); firstInput.focus(); }
  }, []));
  useRibbonAction('testConnection', useCallback(async () => {
    try {
      const result = await handleTest();
      if (result.success) toast.success(t('admin.integrations.testSuccess'));
      else toast.error(result.error || t('admin.integrations.testFailed'));
    } catch { toast.error(t('admin.integrations.testFailed')); }
  }, [t]));
  useRibbonAction('viewLogs', useCallback(() => { router.push('/admin/logs?filter=google-meet'); }, [router]));
  useRibbonAction('documentation', useCallback(() => { window.open('https://developers.google.com/meet/api', '_blank'); }, []));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl">
      <IntegrationCard
        title={t('admin.media.googleMeetTitle') || 'Google Meet'}
        description={t('admin.media.googleMeetDescription') || 'Configure Google Meet API credentials for video conferencing.'}
        icon={<Settings className="w-6 h-6" />}
        color="from-teal-500 to-teal-600"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          { key: 'clientId', label: 'OAuth Client ID', value: clientId, onChange: setClientId, placeholder: 'xxxx.apps.googleusercontent.com' },
          { key: 'clientSecret', label: 'OAuth Client Secret', value: hasClientSecret ? '********' : '', onChange: () => {}, readOnly: true, type: 'password', hint: t('admin.integrations.secretEnvHint') },
          { key: 'publicLink', label: t('admin.integrations.publicLinkLabel'), value: publicLink, onChange: setPublicLink, placeholder: 'https://meet.google.com', type: 'url' },
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developers.google.com/meet/api"
      />
    </div>
  );
}
