/**
 * ADMIN - BNPL (Buy Now Pay Later) Provider Management
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Plus,
  Check,
  X,
  DollarSign,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatCard,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

interface BnplProvider {
  id: string;
  tenantId: string;
  provider: string;
  isActive: boolean;
  config: Record<string, unknown>;
  minAmount: number | null;
  maxAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

const PROVIDER_INFO: Record<string, { name: string; description: string; color: string }> = {
  afterpay: {
    name: 'Afterpay',
    description: 'Pay in 4 interest-free installments',
    color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  },
  klarna: {
    name: 'Klarna',
    description: 'Pay in 3 or pay later in 30 days',
    color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
  },
  sezzle: {
    name: 'Sezzle',
    description: 'Split into 4 interest-free payments',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  paybright: {
    name: 'PayBright',
    description: 'Affirm Canada — monthly installments',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
};

export default function BnplPage() {
  const { t, formatCurrency } = useI18n();
  const [providers, setProviders] = useState<BnplProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formProvider, setFormProvider] = useState('afterpay');
  const [formActive, setFormActive] = useState(true);
  const [formMinAmount, setFormMinAmount] = useState('');
  const [formMaxAmount, setFormMaxAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/bnpl');
      const data = await res.json();
      if (data.success) {
        setProviders(data.providers || []);
      }
    } catch {
      toast.error(t('admin.bnpl.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/bnpl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          provider: formProvider,
          isActive: formActive,
          minAmount: formMinAmount ? parseFloat(formMinAmount) : undefined,
          maxAmount: formMaxAmount ? parseFloat(formMaxAmount) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.bnpl.saved'));
        setShowForm(false);
        fetchProviders();
      } else {
        toast.error(data.error?.message || t('admin.bnpl.saveError'));
      }
    } catch {
      toast.error(t('admin.bnpl.saveError'));
    } finally {
      setSaving(false);
    }
  }, [formProvider, formActive, formMinAmount, formMaxAmount, t, fetchProviders]);

  const toggleProvider = useCallback(async (provider: BnplProvider) => {
    try {
      const res = await fetch('/api/admin/bnpl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({
          provider: provider.provider,
          isActive: !provider.isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(provider.isActive ? t('admin.bnpl.disabled') : t('admin.bnpl.enabled'));
        fetchProviders();
      }
    } catch {
      toast.error(t('admin.bnpl.toggleError'));
    }
  }, [t, fetchProviders]);

  useRibbonAction('add', () => setShowForm(true));

  const activeCount = providers.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.bnpl.title')}
        subtitle={t('admin.bnpl.description')}
        actions={
          <Button onClick={() => setShowForm(true)} icon={Plus}>
            {t('admin.bnpl.addProvider')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label={t('admin.bnpl.totalProviders')}
          value={String(providers.length)}
          icon={CreditCard}
        />
        <StatCard
          label={t('admin.bnpl.activeProviders')}
          value={String(activeCount)}
          icon={Check}
          trend={activeCount > 0 ? { value: 1 } : undefined}
        />
        <StatCard
          label={t('admin.bnpl.inactiveProviders')}
          value={String(providers.length - activeCount)}
          icon={X}
        />
      </div>

      {/* Provider list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('admin.bnpl.noProviders')}
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t('admin.bnpl.noProvidersHint')}
          </p>
          <Button onClick={() => setShowForm(true)} className="mt-4" icon={Plus}>
            {t('admin.bnpl.addProvider')}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => {
            const info = PROVIDER_INFO[provider.provider] || {
              name: provider.provider,
              description: '',
              color: 'bg-gray-100 text-gray-800',
            };
            return (
              <div
                key={provider.id}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${info.color}`}>
                      {info.name}
                    </span>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      {info.description}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleProvider(provider)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      provider.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                    aria-label={provider.isActive ? t('common.disable') : t('common.enable')}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        provider.isActive ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  {provider.minAmount !== null && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {t('admin.bnpl.min')}: {formatCurrency(provider.minAmount)}
                    </span>
                  )}
                  {provider.maxAmount !== null && (
                    <span className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      {t('admin.bnpl.max')}: {formatCurrency(provider.maxAmount)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={t('admin.bnpl.addProvider')}
      >
        <div className="space-y-4 p-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('admin.bnpl.providerLabel')}
            </label>
            <select
              value={formProvider}
              onChange={(e) => setFormProvider(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                <option key={key} value={key}>{info.name} — {info.description}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('admin.bnpl.activeLabel')}
            </label>
            <button
              onClick={() => setFormActive(!formActive)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.bnpl.minAmountLabel')}
              </label>
              <input
                type="number"
                value={formMinAmount}
                onChange={(e) => setFormMinAmount(e.target.value)}
                placeholder="0.00"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('admin.bnpl.maxAmountLabel')}
              </label>
              <input
                type="number"
                value={formMaxAmount}
                onChange={(e) => setFormMaxAmount(e.target.value)}
                placeholder="2000.00"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} loading={saving} icon={Check}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
