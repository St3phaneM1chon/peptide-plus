'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import {
  Link2, Unlink, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  Loader2, Video, Users, Monitor, Globe, Play, Settings2, Download,
  ToggleLeft, ToggleRight, TestTube,
} from 'lucide-react';
import { toast } from 'sonner';

interface PlatformInfo {
  platform: string;
  name: string;
  icon: string;
  description: string;
  hasWebhook: boolean;
  isConnected: boolean;
  isEnabled: boolean;
  autoImport: boolean;
  defaultCategoryId: string | null;
  defaultCategory: { id: string; name: string; slug: string } | null;
  defaultVisibility: string;
  defaultContentType: string;
  lastSyncAt: string | null;
  syncStatus: string | null;
  syncError: string | null;
  connectedBy: { id: string; name: string | null; email: string } | null;
  importCount: number;
}

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  Video: <Video className="h-6 w-6" />,
  Users: <Users className="h-6 w-6" />,
  Monitor: <Monitor className="h-6 w-6" />,
  Globe: <Globe className="h-6 w-6" />,
  Play: <Play className="h-6 w-6" />,
};

const PLATFORM_COLORS: Record<string, string> = {
  zoom: 'border-blue-500 bg-blue-50',
  teams: 'border-purple-500 bg-purple-50',
  'google-meet': 'border-green-500 bg-green-50',
  webex: 'border-cyan-500 bg-cyan-50',
  youtube: 'border-red-500 bg-red-50',
};

const VISIBILITY_OPTIONS = ['PUBLIC', 'CUSTOMERS_ONLY', 'CLIENTS_ONLY', 'EMPLOYEES_ONLY', 'PRIVATE'] as const;
const CONTENT_TYPE_OPTIONS = [
  'PODCAST', 'TRAINING', 'PERSONAL_SESSION', 'PRODUCT_DEMO', 'TESTIMONIAL',
  'FAQ_VIDEO', 'WEBINAR_RECORDING', 'TUTORIAL', 'BRAND_STORY', 'LIVE_STREAM', 'OTHER',
] as const;

export default function PlatformConnectionsPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [platforms, setPlatforms] = useState<PlatformInfo[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [platformsRes, categoriesRes] = await Promise.all([
        fetch('/api/admin/platform-connections'),
        fetch('/api/admin/video-categories'),
      ]);

      if (platformsRes.ok) {
        const data = await platformsRes.json();
        setPlatforms(data.platforms);
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        // Flatten category tree
        const flat: CategoryOption[] = [];
        const flatten = (cats: Array<{ id: string; name: string; slug: string; children?: unknown[] }>) => {
          for (const c of cats) {
            flat.push({ id: c.id, name: c.name, slug: c.slug });
            if (c.children && Array.isArray(c.children)) {
              flatten(c.children as typeof cats);
            }
          }
        };
        flatten(Array.isArray(data) ? data : data.categories || []);
        setCategories(flat);
      }
    } catch (err) {
      console.error('Failed to load platform data:', err);
      toast.error(t('admin.platformConnections.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle OAuth callback messages from URL params
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    const platform = searchParams.get('platform');

    if (connected) {
      toast.success(t('admin.platformConnections.connected', { platform: connected }));
      // Clean URL
      window.history.replaceState({}, '', '/admin/media/connections');
      loadData();
    }
    if (error) {
      toast.error(t('admin.platformConnections.oauthError', { platform: platform || '', error }));
      window.history.replaceState({}, '', '/admin/media/connections');
    }
  }, [searchParams, t, loadData]);

  const handleConnect = async (platform: string) => {
    setActionLoading(`connect-${platform}`);
    try {
      const res = await fetch(`/api/admin/platform-connections/${platform}/oauth`);
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        toast.error(t('admin.platformConnections.connectError'));
      }
    } catch {
      toast.error(t('admin.platformConnections.connectError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (!confirm(t('admin.platformConnections.confirmDisconnect'))) return;

    setActionLoading(`disconnect-${platform}`);
    try {
      const res = await fetch(`/api/admin/platform-connections/${platform}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('admin.platformConnections.disconnected', { platform }));
        loadData();
      } else {
        toast.error(t('admin.platformConnections.disconnectError'));
      }
    } catch {
      toast.error(t('admin.platformConnections.disconnectError'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleTest = async (platform: string) => {
    setActionLoading(`test-${platform}`);
    try {
      const res = await fetch(`/api/admin/platform-connections/${platform}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || t('admin.platformConnections.testSuccess'));
      } else {
        toast.error(data.error || t('admin.platformConnections.testFailed'));
      }
    } catch {
      toast.error(t('admin.platformConnections.testFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSettingChange = async (
    platform: string,
    field: string,
    value: string | boolean | null
  ) => {
    try {
      const res = await fetch(`/api/admin/platform-connections/${platform}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        loadData();
      } else {
        toast.error(t('admin.platformConnections.updateError'));
      }
    } catch {
      toast.error(t('admin.platformConnections.updateError'));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.platformConnections.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('admin.platformConnections.subtitle')}
          </p>
        </div>
        <button
          onClick={() => loadData()}
          className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          {t('common.refresh')}
        </button>
      </div>

      {/* Platform Cards */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {platforms.map((p) => (
          <div
            key={p.platform}
            className={`rounded-lg border-2 p-6 shadow-sm transition-shadow hover:shadow-md ${
              p.isConnected
                ? PLATFORM_COLORS[p.platform] || 'border-gray-300 bg-gray-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            {/* Platform Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${p.isConnected ? 'bg-white/80' : 'bg-gray-100'}`}>
                  {PLATFORM_ICONS[p.icon] || <Video className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-xs text-gray-500">{p.description}</p>
                </div>
              </div>
              {/* Status Badge */}
              <div className="flex items-center gap-1">
                {p.isConnected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('admin.platformConnections.statusConnected')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                    <XCircle className="h-3 w-3" />
                    {t('admin.platformConnections.statusDisconnected')}
                  </span>
                )}
              </div>
            </div>

            {/* Sync Error */}
            {p.syncError && (
              <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{p.syncError}</span>
              </div>
            )}

            {/* Connection Actions */}
            <div className="mt-4 flex items-center gap-2">
              {p.isConnected ? (
                <>
                  <button
                    onClick={() => handleTest(p.platform)}
                    disabled={actionLoading === `test-${p.platform}`}
                    className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {actionLoading === `test-${p.platform}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <TestTube className="h-3 w-3" />
                    )}
                    {t('admin.platformConnections.test')}
                  </button>
                  <button
                    onClick={() => handleDisconnect(p.platform)}
                    disabled={actionLoading === `disconnect-${p.platform}`}
                    className="inline-flex items-center gap-1 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
                  >
                    {actionLoading === `disconnect-${p.platform}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                    {t('admin.platformConnections.disconnect')}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleConnect(p.platform)}
                  disabled={actionLoading === `connect-${p.platform}`}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {actionLoading === `connect-${p.platform}` ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Link2 className="h-3 w-3" />
                  )}
                  {t('admin.platformConnections.connect')}
                </button>
              )}
            </div>

            {/* Settings (only when connected) */}
            {p.isConnected && (
              <div className="mt-4 space-y-3 border-t pt-4">
                {/* Auto-import toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700">
                    {t('admin.platformConnections.autoImport')}
                  </span>
                  <button
                    onClick={() => handleSettingChange(p.platform, 'autoImport', !p.autoImport)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    {p.autoImport ? (
                      <ToggleRight className="h-6 w-6 text-blue-600" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-gray-400" />
                    )}
                  </button>
                </div>

                {/* Default Category */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    {t('admin.platformConnections.defaultCategory')}
                  </label>
                  <select
                    value={p.defaultCategoryId || ''}
                    onChange={(e) =>
                      handleSettingChange(p.platform, 'defaultCategoryId', e.target.value || null)
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="">{t('admin.platformConnections.noCategory')}</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Default Visibility */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    {t('admin.platformConnections.defaultVisibility')}
                  </label>
                  <select
                    value={p.defaultVisibility}
                    onChange={(e) =>
                      handleSettingChange(p.platform, 'defaultVisibility', e.target.value)
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    {VISIBILITY_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {t(`contentVisibility.${v}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Default Content Type */}
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    {t('admin.platformConnections.defaultContentType')}
                  </label>
                  <select
                    value={p.defaultContentType}
                    onChange={(e) =>
                      handleSettingChange(p.platform, 'defaultContentType', e.target.value)
                    }
                    className="mt-1 block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    {CONTENT_TYPE_OPTIONS.map((ct) => (
                      <option key={ct} value={ct}>
                        {t(`videoContentType.${ct}`)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-3 w-3" />
                    {p.importCount} {t('admin.platformConnections.imports')}
                  </span>
                  {p.lastSyncAt && (
                    <span className="inline-flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      {new Date(p.lastSyncAt).toLocaleDateString()}
                    </span>
                  )}
                  {p.connectedBy && (
                    <span className="inline-flex items-center gap-1">
                      <Settings2 className="h-3 w-3" />
                      {p.connectedBy.name || p.connectedBy.email}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
