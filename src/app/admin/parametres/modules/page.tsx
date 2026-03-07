'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Handshake, Calculator, Phone, Mail,
  Megaphone, Award, Video, MessageCircle, Package,
  Save, Loader2, ToggleLeft, ToggleRight, AlertTriangle,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import type { ModuleKey } from '@/lib/module-flags';

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  ecommerce: ShoppingCart,
  crm: Handshake,
  accounting: Calculator,
  voip: Phone,
  email: Mail,
  marketing: Megaphone,
  loyalty: Award,
  media: Video,
  community: MessageCircle,
  catalog: Package,
};

interface ModuleFlag {
  key: ModuleKey;
  labelKey: string;
  description: string;
  enabled: boolean;
}

export default function ModulesPage() {
  const { t } = useI18n();
  const [modules, setModules] = useState<ModuleFlag[]>([]);
  const [original, setOriginal] = useState<ModuleFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchModules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/modules');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const mods = json.data?.modules ?? [];
      setModules(mods);
      setOriginal(mods);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModules();
  }, [fetchModules]);

  const hasChanges = JSON.stringify(modules) !== JSON.stringify(original);

  const toggleModule = (key: ModuleKey) => {
    setModules((prev) =>
      prev.map((m) => (m.key === key ? { ...m, enabled: !m.enabled } : m))
    );
    setSuccessMsg(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const changed = modules.filter((m, i) => m.enabled !== original[i]?.enabled);
      if (changed.length === 0) return;

      const res = await fetch('/api/admin/modules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modules: changed.map((m) => ({ key: m.key, enabled: m.enabled })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOriginal([...modules]);
      setSuccessMsg(t('admin.modules.saved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title={t('admin.modules.title')}
        subtitle={t('admin.modules.subtitle')}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {successMsg}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
        {modules.map((mod) => {
          const Icon = MODULE_ICONS[mod.key] || Package;
          return (
            <div
              key={mod.key}
              className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${mod.enabled ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {t(mod.labelKey)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {mod.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => toggleModule(mod.key)}
                className="flex-shrink-0 focus:outline-none"
                aria-label={`Toggle ${t(mod.labelKey)}`}
              >
                {mod.enabled ? (
                  <ToggleRight className="w-8 h-8 text-teal-600" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-300" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
        <AlertTriangle className="w-4 h-4 inline mr-1" />
        {t('admin.modules.warning')}
      </div>

      {hasChanges && (
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {t('admin.modules.save')}
          </Button>
        </div>
      )}
    </div>
  );
}
