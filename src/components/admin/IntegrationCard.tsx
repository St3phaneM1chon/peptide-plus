'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Plug, Copy, ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n/client';

// FIX: F94 - TODO: Add pattern (regex) validation for ID fields (Advertiser ID, Channel ID, etc.)
interface ConfigField {
  key: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'url';
  readOnly?: boolean;
  hint?: string;
  pattern?: string;
}

interface IntegrationCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  fields: ConfigField[];
  onSave: () => Promise<void>;
  onTest: () => Promise<{ success: boolean; detail?: string; error?: string }>;
  webhookUrl?: string;
  docsUrl?: string;
  saving?: boolean;
}

export function IntegrationCard({
  title,
  description,
  icon,
  color,
  enabled,
  onToggle,
  fields,
  onSave,
  onTest,
  webhookUrl,
  docsUrl,
  saving: externalSaving,
}: IntegrationCardProps) {
  const { t } = useI18n();
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; detail?: string; error?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      // F34 FIX: Show error feedback when save fails instead of silently failing
      console.error('Integration save failed:', err);
      setTestResult({ success: false, error: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result);
      // F92 FIX: Auto-clear test result after 10 seconds
      setTimeout(() => setTestResult(null), 10000);
    } catch {
      setTestResult({ success: false, error: 'Connection test failed' });
      setTimeout(() => setTestResult(null), 10000);
    } finally {
      setTesting(false);
    }
  };

  const copyWebhook = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isSaving = externalSaving || saving;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 border-b border-slate-100 ${enabled ? `bg-gradient-to-r ${color}` : 'bg-slate-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${enabled ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {icon}
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${enabled ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              <p className={`text-sm ${enabled ? 'text-white/80' : 'text-slate-500'}`}>{description}</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
          </label>
        </div>
      </div>

      {/* Configuration Fields */}
      <div className="p-6 space-y-4">
        {fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">{field.label}</label>
            <input
              type={field.type || 'text'}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={field.placeholder}
              readOnly={field.readOnly}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 ${field.readOnly ? 'bg-slate-50 text-slate-500' : ''}`}
            />
            {field.hint && <p className="mt-1 text-xs text-slate-400">{field.hint}</p>}
          </div>
        ))}

        {/* Webhook URL */}
        {webhookUrl && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.integrations.webhookUrl')}</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={webhookUrl}
                readOnly
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 text-slate-500 font-mono"
              />
              <button
                type="button"
                onClick={copyWebhook}
                className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                title="Copy"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
              </button>
            </div>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {testResult.success ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span>
              {testResult.success
                ? `${t('admin.integrations.connected')}${testResult.detail ? `: ${testResult.detail}` : ''}`
                : `${t('admin.integrations.connectionFailed')}: ${testResult.error}`
              }
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saved ? t('admin.integrations.saved') : t('admin.integrations.saveConfig')}
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
            {t('admin.integrations.testConnection')}
          </button>
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-slate-500 rounded-lg text-sm hover:text-sky-600 transition-colors flex items-center gap-1"
            >
              <ExternalLink className="w-4 h-4" />
              {t('admin.integrations.docs')}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
