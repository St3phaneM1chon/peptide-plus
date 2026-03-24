'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, FormField, Input } from '@/components/admin';
import { Settings, Save, Loader2 } from 'lucide-react';

interface LmsSettings {
  // General
  moduleName: string;
  defaultLanguage: string;
  enableDiscussions: boolean;
  enableNotifications: boolean;
  enableProgressEmails: boolean;
  // Certificates
  autoIssueCertificates: boolean;
  defaultCertificateTemplate: string;
  certificateExpiryDays: number;
  // Compliance
  regulatoryBodies: string;
  defaultCePeriodMonths: number;
  alertDaysBeforeDeadline: number;
  // AI Tutor
  enableAiTutor: boolean;
  aiModel: string;
  maxTokensPerResponse: number;
  knowledgeDomains: string;
  // Gamification
  enableBadges: boolean;
  enableStreaks: boolean;
  enableLeaderboard: boolean;
}

const defaultSettings: LmsSettings = {
  moduleName: 'Formation',
  defaultLanguage: 'fr',
  enableDiscussions: true,
  enableNotifications: true,
  enableProgressEmails: true,
  autoIssueCertificates: true,
  defaultCertificateTemplate: '',
  certificateExpiryDays: 0,
  regulatoryBodies: '',
  defaultCePeriodMonths: 12,
  alertDaysBeforeDeadline: 30,
  enableAiTutor: false,
  aiModel: 'gpt-4o-mini',
  maxTokensPerResponse: 1024,
  knowledgeDomains: '',
  enableBadges: true,
  enableStreaks: true,
  enableLeaderboard: false,
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
        <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{label}</span>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
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
  icon: typeof Settings;
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
      <div className="p-5 space-y-1">{children}</div>
    </div>
  );
}

export default function ParametresPage() {
  const { t } = useTranslations();

  const [settings, setSettings] = useState<LmsSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/lms/settings');
      if (res.ok) {
        const data = await res.json();
        const fetched = data.data ?? data;
        setSettings(prev => ({ ...prev, ...fetched }));
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin/lms/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || t('admin.lms.settings.saveError'));
      }

      setSuccessMsg(t('admin.lms.settings.saved'));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('admin.lms.settings.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof LmsSettings>(key: K, value: LmsSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('admin.lms.settings.title')}
          subtitle={t('admin.lms.settings.subtitle')}
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
        title={t('admin.lms.settings.title')}
        subtitle={t('admin.lms.settings.subtitle')}
        backHref="/admin/formation"
        actions={
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? t('admin.lms.settings.saving') : t('admin.lms.settings.save')}
          </Button>
        }
      />

      {/* Success/Error messages */}
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

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Section */}
        <SectionCard title={t('admin.lms.settings.general')} icon={Settings}>
          <FormField
            label={t('admin.lms.settings.moduleName')}
            htmlFor="moduleName"
            hint={t('admin.lms.settings.moduleNameHint')}
          >
            <Input
              id="moduleName"
              value={settings.moduleName}
              onChange={(e) => update('moduleName', e.target.value)}
              placeholder={t('admin.lms.settings.moduleNamePlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.lms.settings.defaultLanguage')} htmlFor="defaultLang">
            <select
              id="defaultLang"
              value={settings.defaultLanguage}
              onChange={(e) => update('defaultLanguage', e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900
                bg-white focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
            >
              <option value="fr">Francais</option>
              <option value="en">English</option>
              <option value="es">Espanol</option>
              <option value="de">Deutsch</option>
              <option value="pt">Portugues</option>
              <option value="it">Italiano</option>
              <option value="ar">العربية</option>
              <option value="zh">中文</option>
            </select>
          </FormField>

          <div className="divide-y divide-slate-100 mt-2">
            <ToggleField
              id="enableDiscussions"
              label={t('admin.lms.settings.enableDiscussions')}
              checked={settings.enableDiscussions}
              onChange={(v) => update('enableDiscussions', v)}
            />
            <ToggleField
              id="enableNotifications"
              label={t('admin.lms.settings.enableNotifications')}
              checked={settings.enableNotifications}
              onChange={(v) => update('enableNotifications', v)}
            />
            <ToggleField
              id="enableProgressEmails"
              label={t('admin.lms.settings.enableProgressEmails')}
              checked={settings.enableProgressEmails}
              onChange={(v) => update('enableProgressEmails', v)}
            />
          </div>
        </SectionCard>

        {/* Certificates Section */}
        <SectionCard title={t('admin.lms.settings.certificatesSection')} icon={Settings}>
          <ToggleField
            id="autoIssueCerts"
            label={t('admin.lms.settings.autoIssueCertificates')}
            checked={settings.autoIssueCertificates}
            onChange={(v) => update('autoIssueCertificates', v)}
          />

          {settings.autoIssueCertificates && (
            <div className="space-y-4 pt-2">
              <FormField label={t('admin.lms.settings.defaultTemplate')} htmlFor="certTemplate">
                <Input
                  id="certTemplate"
                  value={settings.defaultCertificateTemplate}
                  onChange={(e) => update('defaultCertificateTemplate', e.target.value)}
                  placeholder={t('admin.lms.settings.defaultTemplatePlaceholder')}
                />
              </FormField>

              <FormField
                label={t('admin.lms.settings.expiryDays')}
                htmlFor="certExpiry"
                hint={t('admin.lms.settings.expiryDaysHint')}
              >
                <Input
                  id="certExpiry"
                  type="number"
                  min="0"
                  value={settings.certificateExpiryDays}
                  onChange={(e) => update('certificateExpiryDays', parseInt(e.target.value, 10) || 0)}
                />
              </FormField>
            </div>
          )}
        </SectionCard>

        {/* Compliance Section */}
        <SectionCard title={t('admin.lms.settings.complianceSection')} icon={Settings}>
          <FormField
            label={t('admin.lms.settings.regulatoryBodies')}
            htmlFor="regBodies"
            hint={t('admin.lms.settings.regulatoryBodiesHint')}
          >
            <Input
              id="regBodies"
              value={settings.regulatoryBodies}
              onChange={(e) => update('regulatoryBodies', e.target.value)}
              placeholder={t('admin.lms.settings.regulatoryBodiesPlaceholder')}
            />
          </FormField>

          <FormField label={t('admin.lms.settings.defaultCePeriod')} htmlFor="cePeriod">
            <Input
              id="cePeriod"
              type="number"
              min="1"
              value={settings.defaultCePeriodMonths}
              onChange={(e) => update('defaultCePeriodMonths', parseInt(e.target.value, 10) || 12)}
            />
          </FormField>

          <FormField label={t('admin.lms.settings.alertDaysBeforeDeadline')} htmlFor="alertDays">
            <Input
              id="alertDays"
              type="number"
              min="1"
              value={settings.alertDaysBeforeDeadline}
              onChange={(e) => update('alertDaysBeforeDeadline', parseInt(e.target.value, 10) || 30)}
            />
          </FormField>
        </SectionCard>

        {/* AI Tutor Section */}
        <SectionCard title={t('admin.lms.settings.aiTutorSection')} icon={Settings}>
          <ToggleField
            id="enableAiTutor"
            label={t('admin.lms.settings.enableAiTutor')}
            checked={settings.enableAiTutor}
            onChange={(v) => update('enableAiTutor', v)}
          />

          {settings.enableAiTutor && (
            <div className="space-y-4 pt-2">
              <FormField label={t('admin.lms.settings.aiModel')} htmlFor="aiModel">
                <select
                  id="aiModel"
                  value={settings.aiModel}
                  onChange={(e) => update('aiModel', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900
                    bg-white focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="claude-sonnet">Claude Sonnet</option>
                  <option value="claude-opus">Claude Opus</option>
                </select>
              </FormField>

              <FormField label={t('admin.lms.settings.maxTokensPerResponse')} htmlFor="maxTokens">
                <Input
                  id="maxTokens"
                  type="number"
                  min="256"
                  max="8192"
                  step="256"
                  value={settings.maxTokensPerResponse}
                  onChange={(e) => update('maxTokensPerResponse', parseInt(e.target.value, 10) || 1024)}
                />
              </FormField>

              <FormField
                label={t('admin.lms.settings.knowledgeDomains')}
                htmlFor="knowledgeDomains"
                hint={t('admin.lms.settings.knowledgeDomainsHint')}
              >
                <Input
                  id="knowledgeDomains"
                  value={settings.knowledgeDomains}
                  onChange={(e) => update('knowledgeDomains', e.target.value)}
                  placeholder={t('admin.lms.settings.knowledgeDomainsPlaceholder')}
                />
              </FormField>
            </div>
          )}
        </SectionCard>

        {/* Gamification Section */}
        <SectionCard title={t('admin.lms.settings.gamificationSection')} icon={Settings}>
          <div className="divide-y divide-slate-100">
            <ToggleField
              id="enableBadges"
              label={t('admin.lms.settings.enableBadges')}
              checked={settings.enableBadges}
              onChange={(v) => update('enableBadges', v)}
            />
            <ToggleField
              id="enableStreaks"
              label={t('admin.lms.settings.enableStreaks')}
              checked={settings.enableStreaks}
              onChange={(v) => update('enableStreaks', v)}
            />
            <ToggleField
              id="enableLeaderboard"
              label={t('admin.lms.settings.enableLeaderboard')}
              checked={settings.enableLeaderboard}
              onChange={(v) => update('enableLeaderboard', v)}
            />
          </div>
        </SectionCard>
      </form>
    </div>
  );
}
