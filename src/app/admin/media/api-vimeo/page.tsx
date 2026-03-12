'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Video } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { PlatformConnectionStatus } from '@/components/admin/PlatformConnectionStatus';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';
import { toast } from 'sonner';

export default function MediaVimeoPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  // accessToken is stored for potential future display but not currently rendered
  const [, setAccessToken] = useState('');
  const [clientId, setClientId] = useState('');
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [userId, setUserId] = useState('');
  const [publicLink, setPublicLink] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/integrations/vimeo')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setAccessToken(data.accessToken || '');
        setClientId(data.clientId || '');
        setHasClientSecret(data.hasClientSecret || false);
        setUserId(data.userId || '');
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/admin/integrations/vimeo', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled, clientId, userId, publicLink }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.media.saveFailedError'));
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/vimeo', {
      method: 'POST',
      headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ action: 'test' }),
    });
    const data = await res.json();
    return { success: data.success, detail: data.detail, error: data.error };
  };

  // --- Ribbon actions ---
  const onConfigure = useCallback(() => {
    const firstInput = document.querySelector<HTMLInputElement>('input:not([readonly])');
    if (firstInput) { firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); firstInput.focus(); }
  }, []);

  const onTestConnection = useCallback(async () => {
    try {
      const result = await handleTest();
      if (result.success) toast.success(t('admin.integrations.testSuccess'));
      else toast.error(result.error || t('admin.integrations.testFailed'));
    } catch { toast.error(t('admin.integrations.testFailed')); }
  }, [t]);

  const onSyncData = useCallback(() => {
    fetch('/api/admin/integrations/vimeo')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setAccessToken(data.accessToken || '');
        setClientId(data.clientId || '');
        setHasClientSecret(data.hasClientSecret || false);
        setUserId(data.userId || '');
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
        toast.success(t('common.refreshed'));
      })
      .catch(() => toast.error(t('common.error')));
  }, [t]);

  const onViewLogs = useCallback(() => { router.push('/admin/logs?filter=vimeo'); }, [router]);
  const onDocumentation = useCallback(() => { window.open('https://developer.vimeo.com/api/reference', '_blank'); }, []);
  const onExport = useCallback(() => {
    const config = { platform: 'Vimeo', enabled, clientId, userId, hasClientSecret, publicLink, webhookUrl, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vimeo-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.media.exportSuccess'));
  }, [enabled, clientId, userId, hasClientSecret, publicLink, webhookUrl, t]);

  useRibbonAction('configure', onConfigure);
  useRibbonAction('testConnection', onTestConnection);
  useRibbonAction('syncData', onSyncData);
  useRibbonAction('viewLogs', onViewLogs);
  useRibbonAction('documentation', onDocumentation);
  useRibbonAction('export', onExport);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" /></div>;
  }

  return (
    <div className="p-6 max-w-3xl space-y-4">
      <PlatformConnectionStatus platform="vimeo" usesOAuth={true} />
      <IntegrationCard
        title={t('admin.media.vimeoTitle')}
        description={t('admin.media.vimeoDescription')}
        icon={<Video className="w-6 h-6" />}
        color="from-sky-500 to-sky-600"
        enabled={enabled}
        onToggle={setEnabled}
        fields={[
          {
            key: 'clientId',
            label: 'Client ID',
            value: clientId,
            onChange: setClientId,
            placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            hint: 'Found in Vimeo Developer Portal > My Apps > App Details',
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
            key: 'userId',
            label: 'User ID',
            value: userId,
            onChange: setUserId,
            placeholder: '12345678',
            hint: 'Your Vimeo numeric user ID (visible in your profile URL)',
          },
          {
            key: 'publicLink',
            label: t('admin.integrations.publicLinkLabel'),
            value: publicLink,
            onChange: setPublicLink,
            placeholder: 'https://vimeo.com/biocyclepeptides',
            type: 'url',
            hint: t('admin.integrations.publicLinkHint'),
          },
        ]}
        onSave={handleSave}
        onTest={handleTest}
        webhookUrl={webhookUrl}
        docsUrl="https://developer.vimeo.com/api/reference"
      />
    </div>
  );
}
