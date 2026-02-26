'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Shield,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Code,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  usageToday: number;
  usageWeek: number;
  usageMonth: number;
}

const ALL_PERMISSIONS = [
  { key: 'products:read', label: 'Products (Read)', group: 'Products' },
  { key: 'products:write', label: 'Products (Write)', group: 'Products' },
  { key: 'orders:read', label: 'Orders (Read)', group: 'Orders' },
  { key: 'orders:write', label: 'Orders (Write)', group: 'Orders' },
  { key: 'invoices:read', label: 'Invoices (Read)', group: 'Invoices' },
  { key: 'invoices:write', label: 'Invoices (Write)', group: 'Invoices' },
  { key: 'customers:read', label: 'Customers (Read)', group: 'Customers' },
  { key: 'customers:write', label: 'Customers (Write)', group: 'Customers' },
  { key: 'inventory:read', label: 'Inventory (Read)', group: 'Inventory' },
  { key: 'webhooks:read', label: 'Webhooks (Read)', group: 'Webhooks' },
  { key: 'webhooks:write', label: 'Webhooks (Write)', group: 'Webhooks' },
];

const PERMISSION_GROUPS = ['Products', 'Orders', 'Invoices', 'Customers', 'Inventory', 'Webhooks'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ApiPubliquePage() {
  const { t } = useI18n();
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [showDocsSection, setShowDocsSection] = useState(false);

  // Create form state
  const [formName, setFormName] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formRateLimit, setFormRateLimit] = useState(1000);
  const [formExpiresInDays, setFormExpiresInDays] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const loadApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/api-keys', {
        headers: { 'x-csrf-token': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '' },
      });
      if (!res.ok) throw new Error('Failed to load API keys');
      const data = await res.json();
      setApiKeys(data.data || []);
    } catch (err) {
      toast.error(t('admin.apiPublique.loadError'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error(t('admin.apiPublique.nameRequired'));
      return;
    }
    if (formPermissions.length === 0) {
      toast.error(t('admin.apiPublique.permissionsRequired'));
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
        },
        body: JSON.stringify({
          name: formName.trim(),
          permissions: formPermissions,
          rateLimit: formRateLimit,
          expiresInDays: formExpiresInDays,
        }),
      });

      if (!res.ok) throw new Error('Failed to create API key');
      const data = await res.json();

      // Show the raw key ONCE
      setNewKeyRevealed(data.data.rawKey);
      setShowCreateModal(false);
      setFormName('');
      setFormPermissions([]);
      setFormRateLimit(1000);
      setFormExpiresInDays(null);

      toast.success(t('admin.apiPublique.keyCreated'));
      loadApiKeys();
    } catch (err) {
      toast.error(t('admin.apiPublique.createError'));
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(t('admin.apiPublique.confirmRevoke', { name }))) return;

    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
        },
      });
      if (!res.ok) throw new Error('Failed to revoke');
      toast.success(t('admin.apiPublique.keyRevoked'));
      loadApiKeys();
    } catch (err) {
      toast.error(t('admin.apiPublique.revokeError'));
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('admin.apiPublique.copied'));
  };

  const togglePermission = (perm: string) => {
    setFormPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const toggleGroupPermissions = (group: string) => {
    const groupPerms = ALL_PERMISSIONS.filter((p) => p.group === group).map((p) => p.key);
    const allSelected = groupPerms.every((p) => formPermissions.includes(p));
    if (allSelected) {
      setFormPermissions((prev) => prev.filter((p) => !groupPerms.includes(p)));
    } else {
      setFormPermissions((prev) => [...new Set([...prev, ...groupPerms])]);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Key className="w-6 h-6 text-indigo-600" />
            {t('admin.apiPublique.title')}
          </h1>
          <p className="text-slate-500 mt-1">{t('admin.apiPublique.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDocsSection(!showDocsSection)}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium"
          >
            <Code className="w-4 h-4" />
            {t('admin.apiPublique.apiDocs')}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {t('admin.apiPublique.createKey')}
          </button>
        </div>
      </div>

      {/* Newly created key reveal */}
      {newKeyRevealed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">{t('admin.apiPublique.keyCreatedTitle')}</h3>
              <p className="text-amber-700 text-sm mt-1">{t('admin.apiPublique.keyCreatedWarning')}</p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 bg-white border border-amber-300 rounded px-3 py-2 font-mono text-sm text-slate-800 break-all">
                  {newKeyRevealed}
                </code>
                <button
                  onClick={() => copyToClipboard(newKeyRevealed)}
                  className="p-2 bg-amber-100 hover:bg-amber-200 rounded text-amber-700"
                  title="Copy"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setNewKeyRevealed(null)}
                className="mt-3 text-sm text-amber-600 hover:text-amber-800 underline"
              >
                {t('admin.apiPublique.dismissKeyWarning')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Key className="w-4 h-4" />
            {t('admin.apiPublique.totalKeys')}
          </div>
          <div className="text-2xl font-bold text-slate-800">{apiKeys.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            {t('admin.apiPublique.activeKeys')}
          </div>
          <div className="text-2xl font-bold text-emerald-600">{apiKeys.filter((k) => k.isActive).length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Activity className="w-4 h-4 text-blue-500" />
            {t('admin.apiPublique.requestsToday')}
          </div>
          <div className="text-2xl font-bold text-blue-600">{apiKeys.reduce((sum, k) => sum + (k.usageToday || 0), 0).toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
            <Activity className="w-4 h-4 text-purple-500" />
            {t('admin.apiPublique.requestsMonth')}
          </div>
          <div className="text-2xl font-bold text-purple-600">{apiKeys.reduce((sum, k) => sum + (k.usageMonth || 0), 0).toLocaleString()}</div>
        </div>
      </div>

      {/* API Keys List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">{t('admin.apiPublique.apiKeysTitle')}</h2>
          <button onClick={loadApiKeys} className="text-slate-400 hover:text-slate-600">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            {t('admin.apiPublique.loading')}
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>{t('admin.apiPublique.noKeys')}</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-3 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
            >
              {t('admin.apiPublique.createFirstKey')}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {apiKeys.map((key) => (
              <div key={key.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800">{key.name}</span>
                      {key.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">
                          <CheckCircle className="w-3 h-3" />
                          {t('admin.apiPublique.statusActive')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs font-medium">
                          <XCircle className="w-3 h-3" />
                          {t('admin.apiPublique.statusRevoked')}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-slate-500 mb-2">
                      <code className="bg-slate-100 px-2 py-0.5 rounded font-mono text-xs">{key.keyPrefix}...</code>
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        {key.permissions.length} {t('admin.apiPublique.permissionsCount')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        {key.rateLimit}/{t('admin.apiPublique.perHour')}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {key.permissions.slice(0, 6).map((perm) => (
                        <span key={perm} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-mono">
                          {perm}
                        </span>
                      ))}
                      {key.permissions.length > 6 && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-xs">
                          +{key.permissions.length - 6}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t('admin.apiPublique.lastUsed')}: {formatDate(key.lastUsedAt)}
                      </span>
                      {key.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t('admin.apiPublique.expires')}: {formatDate(key.expiresAt)}
                        </span>
                      )}
                      <span>{t('admin.apiPublique.created')}: {formatDate(key.createdAt)}</span>
                    </div>
                  </div>

                  {/* Usage stats */}
                  <div className="flex items-center gap-4 text-center text-xs flex-shrink-0">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{(key.usageToday || 0).toLocaleString()}</div>
                      <div className="text-slate-400">{t('admin.apiPublique.today')}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{(key.usageWeek || 0).toLocaleString()}</div>
                      <div className="text-slate-400">{t('admin.apiPublique.week')}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{(key.usageMonth || 0).toLocaleString()}</div>
                      <div className="text-slate-400">{t('admin.apiPublique.month')}</div>
                    </div>

                    {key.isActive && (
                      <button
                        onClick={() => handleRevoke(key.id, key.name)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title={t('admin.apiPublique.revoke')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Documentation Quick Reference */}
      {showDocsSection && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Code className="w-5 h-5 text-indigo-600" />
              {t('admin.apiPublique.quickReference')}
            </h2>
            <a
              href="/api-docs"
              target="_blank"
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
            >
              {t('admin.apiPublique.fullDocs')} <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-slate-700 mb-2">{t('admin.apiPublique.authentication')}</h3>
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto">
{`curl -H "Authorization: Bearer bp_live_YOUR_KEY" \\
  https://biocyclepeptides.com/api/v1/products`}
              </pre>
            </div>

            <div>
              <h3 className="font-medium text-slate-700 mb-2">{t('admin.apiPublique.endpoints')}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-3 font-medium text-slate-600">{t('admin.apiPublique.method')}</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-600">{t('admin.apiPublique.endpoint')}</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-600">{t('admin.apiPublique.permission')}</th>
                      <th className="text-left py-2 px-3 font-medium text-slate-600">{t('admin.apiPublique.description')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { method: 'GET', path: '/api/v1/products', perm: 'products:read', desc: t('admin.apiPublique.descListProducts') },
                      { method: 'GET', path: '/api/v1/products/:id', perm: 'products:read', desc: t('admin.apiPublique.descGetProduct') },
                      { method: 'GET', path: '/api/v1/orders', perm: 'orders:read', desc: t('admin.apiPublique.descListOrders') },
                      { method: 'POST', path: '/api/v1/orders', perm: 'orders:write', desc: t('admin.apiPublique.descCreateOrder') },
                      { method: 'GET', path: '/api/v1/orders/:id', perm: 'orders:read', desc: t('admin.apiPublique.descGetOrder') },
                      { method: 'GET', path: '/api/v1/invoices', perm: 'invoices:read', desc: t('admin.apiPublique.descListInvoices') },
                      { method: 'GET', path: '/api/v1/invoices/:id', perm: 'invoices:read', desc: t('admin.apiPublique.descGetInvoice') },
                      { method: 'GET', path: '/api/v1/customers', perm: 'customers:read', desc: t('admin.apiPublique.descListCustomers') },
                      { method: 'GET', path: '/api/v1/customers/:id', perm: 'customers:read', desc: t('admin.apiPublique.descGetCustomer') },
                      { method: 'GET', path: '/api/v1/inventory', perm: 'inventory:read', desc: t('admin.apiPublique.descInventory') },
                      { method: 'GET', path: '/api/v1/webhooks', perm: 'webhooks:read', desc: t('admin.apiPublique.descListWebhooks') },
                      { method: 'POST', path: '/api/v1/webhooks', perm: 'webhooks:write', desc: t('admin.apiPublique.descCreateWebhook') },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            row.method === 'GET' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {row.method}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-xs text-slate-600">{row.path}</td>
                        <td className="py-2 px-3 font-mono text-xs text-indigo-600">{row.perm}</td>
                        <td className="py-2 px-3 text-slate-500">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-slate-700 mb-2">{t('admin.apiPublique.responseFormat')}</h3>
              <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-sm overflow-x-auto">
{`{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">{t('admin.apiPublique.createKeyTitle')}</h2>
              <p className="text-sm text-slate-500 mt-1">{t('admin.apiPublique.createKeySubtitle')}</p>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.apiPublique.keyName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder={t('admin.apiPublique.keyNamePlaceholder')}
                />
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('admin.apiPublique.selectPermissions')} <span className="text-red-500">*</span>
                </label>
                <div className="space-y-3">
                  {PERMISSION_GROUPS.map((group) => {
                    const groupPerms = ALL_PERMISSIONS.filter((p) => p.group === group);
                    const allSelected = groupPerms.every((p) => formPermissions.includes(p.key));
                    const someSelected = groupPerms.some((p) => formPermissions.includes(p.key));

                    return (
                      <div key={group} className="border border-slate-200 rounded-lg p-3">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={() => toggleGroupPermissions(group)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-slate-700">{group}</span>
                        </label>
                        <div className="ml-6 flex flex-wrap gap-2">
                          {groupPerms.map((perm) => (
                            <label key={perm.key} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formPermissions.includes(perm.key)}
                                onChange={() => togglePermission(perm.key)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-xs text-slate-600">{perm.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rate Limit */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.apiPublique.rateLimit')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={formRateLimit}
                    onChange={(e) => setFormRateLimit(Math.max(10, parseInt(e.target.value, 10) || 1000))}
                    className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                    min={10}
                    max={100000}
                  />
                  <span className="text-sm text-slate-500">{t('admin.apiPublique.requestsPerHour')}</span>
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.apiPublique.expiration')}
                </label>
                <select
                  value={formExpiresInDays ?? ''}
                  onChange={(e) => setFormExpiresInDays(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{t('admin.apiPublique.noExpiration')}</option>
                  <option value="30">30 {t('admin.apiPublique.days')}</option>
                  <option value="90">90 {t('admin.apiPublique.days')}</option>
                  <option value="180">180 {t('admin.apiPublique.days')}</option>
                  <option value="365">365 {t('admin.apiPublique.days')}</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
              >
                {t('admin.apiPublique.cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
              >
                {creating ? t('admin.apiPublique.creating') : t('admin.apiPublique.createKeyBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
