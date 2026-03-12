'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Link2, Unlink, Loader2, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface ConnectionInfo {
  isConnected: boolean;
  isEnabled: boolean;
  lastSyncAt: string | null;
  syncStatus: string | null;
  syncError: string | null;
  connectedBy: { name: string | null; email: string } | null;
}

interface PlatformConnectionStatusProps {
  /** Platform key matching the platform-connections API (e.g. 'zoom', 'youtube', 'teams') */
  platform: string;
  /** Whether this platform uses OAuth for connection */
  usesOAuth?: boolean;
}

export function PlatformConnectionStatus({ platform, usesOAuth = true }: PlatformConnectionStatusProps) {
  const { t } = useI18n();
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/platform-connections/${platform}`);
      if (res.ok) {
        const data = await res.json();
        setConnection(data);
      } else if (res.status === 404) {
        // Platform not yet connected
        setConnection({
          isConnected: false,
          isEnabled: false,
          lastSyncAt: null,
          syncStatus: null,
          syncError: null,
          connectedBy: null,
        });
      }
    } catch {
      setConnection({
        isConnected: false,
        isEnabled: false,
        lastSyncAt: null,
        syncStatus: null,
        syncError: null,
        connectedBy: null,
      });
    } finally {
      setLoading(false);
    }
  }, [platform]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleConnect = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/platform-connections/${platform}/oauth`);
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        toast.error(t('admin.platformConnections.connectError') || 'Failed to initiate connection');
      }
    } catch {
      toast.error(t('admin.platformConnections.connectError') || 'Failed to initiate connection');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(t('admin.platformConnections.confirmDisconnect') || 'Are you sure you want to disconnect this platform?')) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/platform-connections/${platform}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('admin.platformConnections.disconnected') || 'Platform disconnected');
        loadStatus();
      } else {
        toast.error(t('admin.platformConnections.disconnectError') || 'Failed to disconnect');
      }
    } catch {
      toast.error(t('admin.platformConnections.disconnectError') || 'Failed to disconnect');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTest = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/platform-connections/${platform}/test`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || t('admin.platformConnections.testSuccess') || 'Connection OK');
      } else {
        toast.error(data.error || t('admin.platformConnections.testFailed') || 'Connection test failed');
      }
    } catch {
      toast.error(t('admin.platformConnections.testFailed') || 'Connection test failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading') || 'Loading...'}
        </div>
      </div>
    );
  }

  const isConnected = connection?.isConnected ?? false;

  return (
    <div className={`rounded-lg border-2 p-4 ${isConnected ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <XCircle className="h-5 w-5 text-slate-400" />
          )}
          <div>
            <span className={`text-sm font-medium ${isConnected ? 'text-green-700' : 'text-slate-600'}`}>
              {isConnected
                ? (t('admin.platformConnections.statusConnected') || 'Connected')
                : (t('admin.platformConnections.statusDisconnected') || 'Not connected')}
            </span>
            {isConnected && connection?.connectedBy && (
              <p className="text-xs text-green-600">
                {connection.connectedBy.name || connection.connectedBy.email}
              </p>
            )}
            {isConnected && connection?.lastSyncAt && (
              <p className="text-xs text-green-600">
                {t('admin.platformConnections.lastSync') || 'Last sync'}: {new Date(connection.lastSyncAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected ? (
            <>
              <button
                onClick={handleTest}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {t('admin.platformConnections.test') || 'Test'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={actionLoading}
                className="inline-flex items-center gap-1 rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
                {t('admin.platformConnections.disconnect') || 'Disconnect'}
              </button>
            </>
          ) : usesOAuth ? (
            <button
              onClick={handleConnect}
              disabled={actionLoading}
              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
              {t('admin.platformConnections.connect') || 'Connect via OAuth'}
            </button>
          ) : (
            <span className="text-xs text-slate-400">
              {t('admin.platformConnections.configureBelow') || 'Configure API credentials below'}
            </span>
          )}
        </div>
      </div>

      {connection?.syncError && (
        <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
          {connection.syncError}
        </div>
      )}
    </div>
  );
}
