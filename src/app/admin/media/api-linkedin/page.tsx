'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { IntegrationCard } from '@/components/admin/IntegrationCard';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';
import { toast } from 'sonner';

export default function MediaLinkedInPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [appId, setAppId] = useState('');
  const [hasClientSecret, setHasClientSecret] = useState(false);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [publicLink, setPublicLink] = useState('');
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
        setPublicLink(data.publicLink || '');
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
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ enabled, companyId, appId, publicLink }),
      });
      if (!res.ok) throw new Error('Save failed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.media.saveFailedError') || 'Save failed');
      throw err;
    }
  };

  const handleTest = async () => {
    const res = await fetch('/api/admin/integrations/linkedin', {
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
    fetch('/api/admin/integrations/linkedin')
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled || false);
        setCompanyId(data.companyId || '');
        setAppId(data.appId || '');
        setHasClientSecret(data.hasClientSecret || false);
        setHasAccessToken(data.hasAccessToken || false);
        setPublicLink(data.publicLink || '');
        setWebhookUrl(data.webhookUrl || '');
        toast.success(t('common.refreshed'));
      })
      .catch(() => toast.error(t('common.error')));
  }, [t]);

  const onViewLogs = useCallback(() => { router.push('/admin/logs?filter=linkedin'); }, [router]);
  const onDocumentation = useCallback(() => { window.open('https://learn.microsoft.com/en-us/linkedin/marketing/', '_blank'); }, []);
  const onExport = useCallback(() => {
    const config = { platform: 'LinkedIn', enabled, companyId, appId, hasClientSecret, hasAccessToken, publicLink, webhookUrl, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.media.exportSuccess') || 'Configuration exported');
  }, [enabled, companyId, appId, hasClientSecret, hasAccessToken, publicLink, webhookUrl, t]);

  useRibbonAction('configure', onConfigure);
  useRibbonAction('testConnection', onTestConnection);
  useRibbonAction('syncData', onSyncData);
  useRibbonAction('viewLogs', onViewLogs);
  useRibbonAction('documentation', onDocumentation);
  useRibbonAction('export', onExport);

  // --- media.ads ribbon actions ---
  useRibbonAction('newAdCampaign', useCallback(() => { toast.info(t('admin.media.adCampaignHint') || 'Create ad campaigns in LinkedIn Campaign Manager.'); }, [t]));
  useRibbonAction('delete', useCallback(() => { toast.info(t('admin.media.adDeleteHint') || 'Manage and delete campaigns in LinkedIn Campaign Manager.'); }, [t]));
  useRibbonAction('pause', useCallback(() => { toast.info(t('admin.media.adPauseHint') || 'Pause campaigns directly in LinkedIn Campaign Manager.'); }, [t]));
  useRibbonAction('resume', useCallback(() => { toast.info(t('admin.media.adResumeHint') || 'Resume paused campaigns in LinkedIn Campaign Manager.'); }, [t]));
  useRibbonAction('modifyBudget', useCallback(() => { toast.info(t('admin.media.adBudgetHint') || 'Adjust budgets in LinkedIn Campaign Manager.'); }, [t]));
  useRibbonAction('performanceStats', useCallback(() => { toast.info(t('admin.media.adStatsHint') || 'View analytics in LinkedIn Analytics dashboard.'); }, [t]));

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
          {
            key: 'publicLink',
            label: t('admin.integrations.publicLinkLabel'),
            value: publicLink,
            onChange: setPublicLink,
            placeholder: 'https://linkedin.com/company/biocyclepeptides',
            type: 'url',
            hint: t('admin.integrations.publicLinkHint'),
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
