'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Copy, Check, XCircle, Eye, Clock,
  Shield, ShieldOff, Loader2, ExternalLink, Users,
  Mail, Building2, CalendarDays, AlertTriangle,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PortalAccess {
  id: string;
  token: string;
  email: string;
  clientName: string;
  companyName: string | null;
  expiresAt: string | null;
  isActive: boolean;
  lastAccess: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface CreateForm {
  email: string;
  clientName: string;
  companyName: string;
  expiresInDays: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getPortalUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/portal/${token}`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AdminClientPortalPage() {
  const { t } = useI18n();

  const [accesses, setAccesses] = useState<PortalAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [form, setForm] = useState<CreateForm>({
    email: '',
    clientName: '',
    companyName: '',
    expiresInDays: '90',
  });

  // ---------------------------------------------------------------------------
  // Fetch all accesses
  // ---------------------------------------------------------------------------

  const fetchAccesses = useCallback(async () => {
    try {
      const res = await fetch('/api/accounting/client-portal');
      if (res.ok) {
        const data = await res.json();
        setAccesses(data.data || []);
      }
    } catch {
      toast.error(t('admin.clientPortal.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAccesses();
  }, [fetchAccesses]);

  // ---------------------------------------------------------------------------
  // Create new access
  // ---------------------------------------------------------------------------

  async function handleCreate() {
    if (!form.email || !form.clientName) {
      toast.error(t('admin.clientPortal.requiredFields'));
      return;
    }

    setCreating(true);
    try {
      const headers = addCSRFHeader({
        'Content-Type': 'application/json',
      });
      const res = await fetch('/api/accounting/client-portal', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: form.email,
          clientName: form.clientName,
          companyName: form.companyName || undefined,
          expiresInDays: form.expiresInDays ? parseInt(form.expiresInDays) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || t('admin.clientPortal.createError'));
        return;
      }

      const data = await res.json();
      toast.success(t('admin.clientPortal.createSuccess'));
      setShowCreateForm(false);
      setForm({ email: '', clientName: '', companyName: '', expiresInDays: '90' });

      // Copy URL to clipboard automatically
      const url = getPortalUrl(data.data.token);
      await navigator.clipboard.writeText(url);
      toast.success(t('admin.clientPortal.urlCopied'));

      fetchAccesses();
    } catch {
      toast.error(t('admin.clientPortal.createError'));
    } finally {
      setCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Copy URL
  // ---------------------------------------------------------------------------

  async function handleCopyUrl(token: string) {
    const url = getPortalUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      toast.success(t('admin.clientPortal.urlCopied'));
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error(t('admin.clientPortal.copyError'));
    }
  }

  // ---------------------------------------------------------------------------
  // Revoke access
  // ---------------------------------------------------------------------------

  async function handleRevoke(token: string) {
    setRevoking(token);
    try {
      const headers = addCSRFHeader({
        'Content-Type': 'application/json',
      });
      const res = await fetch(`/api/accounting/client-portal/${token}`, {
        method: 'PUT',
        headers,
      });

      if (res.ok) {
        toast.success(t('admin.clientPortal.revokeSuccess'));
        fetchAccesses();
      } else {
        const data = await res.json();
        toast.error(data.error || t('admin.clientPortal.revokeError'));
      }
    } catch {
      toast.error(t('admin.clientPortal.revokeError'));
    } finally {
      setRevoking(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const activeCount = accesses.filter((a) => a.isActive).length;
  const expiredCount = accesses.filter(
    (a) => a.expiresAt && new Date(a.expiresAt) < new Date() && a.isActive
  ).length;
  const revokedCount = accesses.filter((a) => !a.isActive).length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('admin.clientPortal.title')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.clientPortal.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('admin.clientPortal.createAccess')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{t('admin.clientPortal.totalAccesses')}</p>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{accesses.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-600">{t('admin.clientPortal.activeAccesses')}</p>
            <Shield className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-green-700 mt-1">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-orange-600">{t('admin.clientPortal.expiredAccesses')}</p>
            <Clock className="w-5 h-5 text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-orange-700 mt-1">{expiredCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-red-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600">{t('admin.clientPortal.revokedAccesses')}</p>
            <ShieldOff className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-700 mt-1">{revokedCount}</p>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl border border-indigo-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('admin.clientPortal.newAccess')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="inline w-4 h-4 mr-1" />
                {t('admin.clientPortal.email')} *
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="client@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Users className="inline w-4 h-4 mr-1" />
                {t('admin.clientPortal.clientName')} *
              </label>
              <input
                type="text"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                placeholder="John Doe"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Building2 className="inline w-4 h-4 mr-1" />
                {t('admin.clientPortal.companyName')}
              </label>
              <input
                type="text"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                placeholder="Acme Labs Inc."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <CalendarDays className="inline w-4 h-4 mr-1" />
                {t('admin.clientPortal.expiresInDays')}
              </label>
              <select
                value={form.expiresInDays}
                onChange={(e) => setForm({ ...form, expiresInDays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                <option value="">{t('admin.clientPortal.neverExpires')}</option>
                <option value="7">7 {t('admin.clientPortal.days')}</option>
                <option value="30">30 {t('admin.clientPortal.days')}</option>
                <option value="90">90 {t('admin.clientPortal.days')}</option>
                <option value="180">180 {t('admin.clientPortal.days')}</option>
                <option value="365">365 {t('admin.clientPortal.days')}</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {creating ? t('admin.clientPortal.creating') : t('admin.clientPortal.create')}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              {t('admin.clientPortal.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Access List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
          </div>
        ) : accesses.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{t('admin.clientPortal.noAccesses')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('admin.clientPortal.noAccessesHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">{t('admin.clientPortal.client')}</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">{t('admin.clientPortal.emailCol')}</th>
                  <th className="py-3 px-4 text-center font-semibold text-gray-700">{t('admin.clientPortal.statusCol')}</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">{t('admin.clientPortal.expiresCol')}</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">{t('admin.clientPortal.lastAccessCol')}</th>
                  <th className="py-3 px-4 text-left font-semibold text-gray-700">{t('admin.clientPortal.createdCol')}</th>
                  <th className="py-3 px-4 text-right font-semibold text-gray-700">{t('admin.clientPortal.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {accesses.map((access) => {
                  const isExpired = access.expiresAt && new Date(access.expiresAt) < new Date();
                  const effectiveActive = access.isActive && !isExpired;

                  return (
                    <tr key={access.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{access.clientName}</p>
                        {access.companyName && (
                          <p className="text-xs text-gray-500">{access.companyName}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700">{access.email}</td>
                      <td className="py-3 px-4 text-center">
                        {effectiveActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            <Shield className="w-3 h-3" />
                            {t('admin.clientPortal.active')}
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                            <Clock className="w-3 h-3" />
                            {t('admin.clientPortal.expired')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <ShieldOff className="w-3 h-3" />
                            {t('admin.clientPortal.revoked')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {access.expiresAt ? formatDate(access.expiresAt) : t('admin.clientPortal.never')}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {access.lastAccess ? formatDate(access.lastAccess) : t('admin.clientPortal.neverAccessed')}
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {formatDate(access.createdAt)}
                        {access.createdBy && (
                          <p className="text-gray-400">{t('admin.clientPortal.by')} {access.createdBy}</p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleCopyUrl(access.token)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            title={t('admin.clientPortal.copyUrl')}
                          >
                            {copiedToken === access.token ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                          <a
                            href={getPortalUrl(access.token)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            title={t('admin.clientPortal.openPortal')}
                          >
                            <ExternalLink className="w-4 h-4 text-gray-500" />
                          </a>
                          {effectiveActive && (
                            <button
                              onClick={() => handleRevoke(access.token)}
                              disabled={revoking === access.token}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title={t('admin.clientPortal.revoke')}
                            >
                              {revoking === access.token ? (
                                <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-blue-800">{t('admin.clientPortal.infoTitle')}</p>
            <p className="text-xs text-blue-600 mt-1">
              {t('admin.clientPortal.infoDescription')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
