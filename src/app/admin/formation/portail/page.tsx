'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, FormField, Input, Textarea } from '@/components/admin';
import { Palette, Save, Loader2, Globe, Shield, Eye } from 'lucide-react';

interface PortalConfig {
  portalName: string;
  subdomain: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  welcomeMessage: string;
  customCss: string;
  ssoEnabled: boolean;
  ssoProviderUrl: string;
  registrationOpen: boolean;
  catalogVisible: boolean;
}

const defaultConfig: PortalConfig = {
  portalName: '',
  subdomain: '',
  logoUrl: '',
  primaryColor: '#0066CC',
  secondaryColor: '#003366',
  welcomeMessage: '',
  customCss: '',
  ssoEnabled: false,
  ssoProviderUrl: '',
  registrationOpen: true,
  catalogVisible: true,
};

function ToggleField({
  label,
  description,
  checked,
  onChange,
  id,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-center justify-between py-3 cursor-pointer group"
    >
      <div className="flex-1 pr-4">
        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">
          {label}
        </span>
        {description && (
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent
          transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-indigo-500 focus-visible:ring-offset-2
          ${checked ? 'bg-indigo-600' : 'bg-slate-200'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0
            transition duration-200 ease-in-out
            ${checked ? 'translate-x-5' : 'translate-x-0'}
          `}
        />
      </button>
    </label>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Palette;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="p-1.5 rounded-lg bg-indigo-50">
          <Icon className="w-4 h-4 text-indigo-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function PortalPreview({
  config,
  t,
}: {
  config: PortalConfig;
  t: (key: string) => string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="p-1.5 rounded-lg bg-indigo-50">
          <Eye className="w-4 h-4 text-indigo-600" />
        </div>
        <h3 className="text-sm font-semibold text-slate-800">
          {t('admin.lms.portal.preview')}
        </h3>
      </div>
      <div className="p-5">
        <div
          className="rounded-xl border border-slate-200 overflow-hidden shadow-sm"
          style={{ minHeight: 280 }}
        >
          {/* Header bar */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ backgroundColor: config.primaryColor }}
          >
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt="Logo"
                className="h-8 w-auto rounded object-contain bg-white/10 p-0.5"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="h-8 w-8 rounded bg-white/20 flex items-center justify-center">
                <Globe className="w-4 h-4 text-white" />
              </div>
            )}
            <span className="text-white font-semibold text-sm truncate">
              {config.portalName || t('admin.lms.portal.previewWelcome')}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-white/80 text-xs">
                {t('admin.lms.portal.previewCourses')}
              </span>
              <span
                className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{
                  backgroundColor: config.secondaryColor,
                  color: '#fff',
                }}
              >
                {t('admin.lms.portal.previewLogin')}
              </span>
            </div>
          </div>

          {/* Hero section */}
          <div className="px-6 py-8 bg-gradient-to-br from-slate-50 to-slate-100">
            <h2 className="text-lg font-bold text-slate-800 mb-2">
              {config.welcomeMessage
                ? config.welcomeMessage.slice(0, 80)
                : t('admin.lms.portal.previewWelcome')}
            </h2>
            <div className="flex gap-2 mt-4">
              <div
                className="h-2 rounded-full w-24"
                style={{ backgroundColor: config.primaryColor, opacity: 0.7 }}
              />
              <div
                className="h-2 rounded-full w-16"
                style={{ backgroundColor: config.secondaryColor, opacity: 0.5 }}
              />
              <div className="h-2 rounded-full w-20 bg-slate-200" />
            </div>
          </div>

          {/* Course cards mockup */}
          <div className="px-6 py-4 grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 overflow-hidden"
              >
                <div
                  className="h-12"
                  style={{
                    backgroundColor: config.primaryColor,
                    opacity: 0.15 + i * 0.1,
                  }}
                />
                <div className="p-2 space-y-1.5">
                  <div className="h-2 bg-slate-200 rounded-full w-3/4" />
                  <div className="h-2 bg-slate-100 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="px-4 py-2 text-center"
            style={{ backgroundColor: config.secondaryColor }}
          >
            <span className="text-white/60 text-[10px]">
              {config.subdomain
                ? `${config.subdomain}.aptitudes.attitudes.vip`
                : 'votre-portail.aptitudes.attitudes.vip'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortailPage() {
  const { t } = useTranslations();

  const [config, setConfig] = useState<PortalConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lms/portal');
      if (res.ok) {
        const data = await res.json();
        const portal = data.data?.portal ?? data.portal;
        if (portal) {
          setConfig({
            portalName: portal.portalName ?? portal.ssoConfig?.portalName ?? '',
            subdomain: portal.subdomain ?? '',
            logoUrl: portal.logoUrl ?? '',
            primaryColor: portal.primaryColor ?? '#0066CC',
            secondaryColor: portal.secondaryColor ?? '#003366',
            welcomeMessage: portal.welcomeMessage ?? '',
            customCss: portal.customCss ?? portal.ssoConfig?.customCss ?? '',
            ssoEnabled: portal.ssoEnabled ?? false,
            ssoProviderUrl:
              portal.ssoProviderUrl ?? portal.ssoConfig?.providerUrl ?? '',
            registrationOpen:
              portal.registrationOpen ?? portal.ssoConfig?.registrationOpen ?? true,
            catalogVisible:
              portal.catalogVisible ?? portal.ssoConfig?.catalogVisible ?? true,
          });
        }
      }
    } catch {
      setErrorMsg(t('admin.lms.portal.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/lms/portal', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalName: config.portalName || null,
          subdomain: config.subdomain || undefined,
          logoUrl: config.logoUrl || null,
          primaryColor: config.primaryColor,
          secondaryColor: config.secondaryColor,
          welcomeMessage: config.welcomeMessage || null,
          customCss: config.customCss || null,
          ssoEnabled: config.ssoEnabled,
          ssoProviderUrl: config.ssoProviderUrl || null,
          registrationOpen: config.registrationOpen,
          catalogVisible: config.catalogVisible,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || err.message || t('admin.lms.portal.saveError')
        );
      }

      setSuccessMsg(t('admin.lms.portal.saved'));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : t('admin.lms.portal.saveError')
      );
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof PortalConfig>(
    key: K,
    value: PortalConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('admin.lms.portal.title')}
          subtitle={t('admin.lms.portal.subtitle')}
          backHref="/admin/formation"
        />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.portal.title')}
        subtitle={t('admin.lms.portal.subtitle')}
        backHref="/admin/formation"
        actions={
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving
              ? t('admin.lms.portal.saving')
              : t('admin.lms.portal.save')}
          </Button>
        }
      />

      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left column - Config */}
        <div className="space-y-6">
          {/* Appearance */}
          <SectionCard title={t('admin.lms.portal.appearance')} icon={Palette}>
            <FormField
              label={t('admin.lms.portal.portalName')}
              htmlFor="portalName"
              hint={t('admin.lms.portal.portalNameHint')}
            >
              <Input
                id="portalName"
                value={config.portalName}
                onChange={(e) => update('portalName', e.target.value)}
                placeholder={t('admin.lms.portal.portalNamePlaceholder')}
              />
            </FormField>

            <FormField
              label={t('admin.lms.portal.subdomain')}
              htmlFor="subdomain"
              hint={t('admin.lms.portal.subdomainHint')}
            >
              <div className="flex items-center gap-0">
                <Input
                  id="subdomain"
                  value={config.subdomain}
                  onChange={(e) =>
                    update(
                      'subdomain',
                      e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                    )
                  }
                  placeholder={t('admin.lms.portal.subdomainPlaceholder')}
                  className="rounded-r-none"
                />
                <span className="inline-flex items-center px-3 h-9 border border-l-0 border-slate-300 rounded-r-lg bg-slate-50 text-xs text-slate-500 whitespace-nowrap">
                  {t('admin.lms.portal.subdomainSuffix')}
                </span>
              </div>
            </FormField>

            <FormField
              label={t('admin.lms.portal.logoUrl')}
              htmlFor="logoUrl"
            >
              <Input
                id="logoUrl"
                value={config.logoUrl}
                onChange={(e) => update('logoUrl', e.target.value)}
                placeholder={t('admin.lms.portal.logoUrlPlaceholder')}
              />
              {config.logoUrl && (
                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">
                    {t('admin.lms.portal.logoPreview')}
                  </p>
                  <img
                    src={config.logoUrl}
                    alt={t('admin.lms.portal.logoPreview')}
                    className="h-12 w-auto object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                label={t('admin.lms.portal.primaryColor')}
                htmlFor="primaryColor"
              >
                <div className="flex items-center gap-2">
                  <input
                    id="primaryColor"
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => update('primaryColor', e.target.value)}
                    className="h-9 w-12 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                  />
                  <Input
                    value={config.primaryColor}
                    onChange={(e) => update('primaryColor', e.target.value)}
                    placeholder="#0066CC"
                    className="flex-1"
                  />
                </div>
              </FormField>

              <FormField
                label={t('admin.lms.portal.secondaryColor')}
                htmlFor="secondaryColor"
              >
                <div className="flex items-center gap-2">
                  <input
                    id="secondaryColor"
                    type="color"
                    value={config.secondaryColor}
                    onChange={(e) => update('secondaryColor', e.target.value)}
                    className="h-9 w-12 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                  />
                  <Input
                    value={config.secondaryColor}
                    onChange={(e) => update('secondaryColor', e.target.value)}
                    placeholder="#003366"
                    className="flex-1"
                  />
                </div>
              </FormField>
            </div>

            <FormField
              label={t('admin.lms.portal.welcomeMessage')}
              htmlFor="welcomeMessage"
              hint={t('admin.lms.portal.welcomeMessageHint')}
            >
              <Textarea
                id="welcomeMessage"
                value={config.welcomeMessage}
                onChange={(e) => update('welcomeMessage', e.target.value)}
                placeholder={t('admin.lms.portal.welcomeMessagePlaceholder')}
                rows={3}
              />
            </FormField>

            <FormField
              label={t('admin.lms.portal.customCss')}
              htmlFor="customCss"
              hint={t('admin.lms.portal.customCssHint')}
            >
              <textarea
                id="customCss"
                value={config.customCss}
                onChange={(e) => update('customCss', e.target.value)}
                placeholder={t('admin.lms.portal.customCssPlaceholder')}
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900
                  bg-slate-50 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
              />
            </FormField>
          </SectionCard>

          {/* SSO / Integration */}
          <SectionCard
            title={t('admin.lms.portal.integration')}
            icon={Shield}
          >
            <div className="divide-y divide-slate-100">
              <ToggleField
                id="ssoEnabled"
                label={t('admin.lms.portal.ssoEnabled')}
                description={t('admin.lms.portal.ssoEnabledDesc')}
                checked={config.ssoEnabled}
                onChange={(v) => update('ssoEnabled', v)}
              />
            </div>

            {config.ssoEnabled && (
              <FormField
                label={t('admin.lms.portal.ssoProviderUrl')}
                htmlFor="ssoProviderUrl"
              >
                <Input
                  id="ssoProviderUrl"
                  value={config.ssoProviderUrl}
                  onChange={(e) => update('ssoProviderUrl', e.target.value)}
                  placeholder={t('admin.lms.portal.ssoProviderUrlPlaceholder')}
                />
              </FormField>
            )}
          </SectionCard>

          {/* Access & Registration */}
          <SectionCard title={t('admin.lms.portal.access')} icon={Globe}>
            <div className="divide-y divide-slate-100">
              <ToggleField
                id="registrationOpen"
                label={t('admin.lms.portal.registrationOpen')}
                description={t('admin.lms.portal.registrationOpenDesc')}
                checked={config.registrationOpen}
                onChange={(v) => update('registrationOpen', v)}
              />
              <ToggleField
                id="catalogVisible"
                label={t('admin.lms.portal.catalogVisibility')}
                description={t('admin.lms.portal.catalogVisibilityDesc')}
                checked={config.catalogVisible}
                onChange={(v) => update('catalogVisible', v)}
              />
            </div>
          </SectionCard>
        </div>

        {/* Right column - Preview */}
        <div className="space-y-6">
          <PortalPreview config={config} t={t} />
        </div>
      </form>
    </div>
  );
}
