'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Shuffle, Tag, CheckCircle, BarChart3 } from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  EmptyState,
  FormField,
  Input,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';

interface PromoCode {
  id: string;
  code: string;
  description?: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  usageLimitPerUser?: number;
  usageCount: number;
  startsAt?: string;
  endsAt?: string;
  firstOrderOnly: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function PromoCodesPage() {
  const { t, locale, formatCurrency } = useI18n();
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    type: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    value: 10,
    minOrderAmount: '',
    maxDiscount: '',
    usageLimit: '',
    usageLimitPerUser: '1',
    startsAt: '',
    endsAt: '',
    firstOrderOnly: false,
  });

  useEffect(() => {
    fetchPromoCodes();
  }, []);

  const fetchPromoCodes = async () => {
    try {
      const res = await fetch('/api/admin/promo-codes');
      const data = await res.json();
      setPromoCodes(data.promoCodes || []);
    } catch (err) {
      console.error('Error fetching promo codes:', err);
      setPromoCodes([]);
    }
    setLoading(false);
  };

  const generateCode = () => {
    // SECURITY: Use crypto.getRandomValues for non-guessable promo codes
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomBytes = crypto.getRandomValues(new Uint8Array(8));
    const code = Array.from(randomBytes).map(b => chars.charAt(b % chars.length)).join('');
    setFormData({ ...formData, code });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingCode
        ? `/api/admin/promo-codes/${editingCode.id}`
        : '/api/admin/promo-codes';
      const method = editingCode ? 'PUT' : 'POST';

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          minOrderAmount: formData.minOrderAmount ? parseFloat(formData.minOrderAmount) : null,
          maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
          usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
          usageLimitPerUser: formData.usageLimitPerUser ? parseInt(formData.usageLimitPerUser) : null,
        }),
      });

      await fetchPromoCodes();
      resetForm();
    } catch (err) {
      console.error('Error saving promo code:', err);
    }
    setSaving(false);
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await fetch(`/api/admin/promo-codes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      setPromoCodes(promoCodes.map((p) => (p.id === id ? { ...p, isActive: !isActive } : p)));
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const deletePromoCode = async (id: string) => {
    if (!confirm(t('admin.promoCodes.confirmDelete'))) return;
    try {
      await fetch(`/api/admin/promo-codes/${id}`, { method: 'DELETE' });
      setPromoCodes(promoCodes.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      description: '',
      type: 'PERCENTAGE',
      value: 10,
      minOrderAmount: '',
      maxDiscount: '',
      usageLimit: '',
      usageLimitPerUser: '1',
      startsAt: '',
      endsAt: '',
      firstOrderOnly: false,
    });
    setEditingCode(null);
    setShowForm(false);
  };

  const startEdit = (promo: PromoCode) => {
    setFormData({
      code: promo.code,
      description: promo.description || '',
      type: promo.type,
      value: promo.value,
      minOrderAmount: promo.minOrderAmount?.toString() || '',
      maxDiscount: promo.maxDiscount?.toString() || '',
      usageLimit: promo.usageLimit?.toString() || '',
      usageLimitPerUser: promo.usageLimitPerUser?.toString() || '',
      startsAt: promo.startsAt ? promo.startsAt.slice(0, 16) : '',
      endsAt: promo.endsAt ? promo.endsAt.slice(0, 16) : '',
      firstOrderOnly: promo.firstOrderOnly,
    });
    setEditingCode(promo);
    setShowForm(true);
  };

  const stats = {
    total: promoCodes.length,
    active: promoCodes.filter((p) => p.isActive).length,
    totalUsage: promoCodes.reduce((sum, p) => sum + p.usageCount, 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.promoCodes.title')}
        subtitle={t('admin.promoCodes.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            {t('admin.promoCodes.newCode')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">{t('admin.promoCodes.totalCodes')}</p>
            <p className="text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-emerald-200 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-emerald-600">{t('admin.promoCodes.active')}</p>
            <p className="text-xl font-bold text-emerald-700">{stats.active}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-sky-200 flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-100 rounded-lg flex items-center justify-center text-sky-600">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-sky-600">{t('admin.promoCodes.totalUsage')}</p>
            <p className="text-xl font-bold text-sky-700">{stats.totalUsage}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.promoCodes.colCode')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.promoCodes.colDiscount')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.promoCodes.colConditions')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.promoCodes.colUsage')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.promoCodes.colValidity')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.promoCodes.colStatus')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.promoCodes.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {promoCodes.map((promo) => {
              const isExpired = promo.endsAt && new Date(promo.endsAt) < new Date();
              const usageFull = promo.usageLimit && promo.usageCount >= promo.usageLimit;
              return (
                <tr
                  key={promo.id}
                  className={`hover:bg-slate-50 ${!promo.isActive || isExpired || usageFull ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-slate-900">{promo.code}</p>
                    {promo.description && <p className="text-xs text-slate-500">{promo.description}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-sky-600">
                      {promo.type === 'PERCENTAGE' ? `${promo.value}%` : formatCurrency(promo.value)}
                    </span>
                    {promo.maxDiscount && <p className="text-xs text-slate-500">{t('admin.promoCodes.maxPrefix')} {formatCurrency(promo.maxDiscount)}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {promo.minOrderAmount && <p>{t('admin.promoCodes.minPrefix')} {formatCurrency(promo.minOrderAmount)}</p>}
                    {promo.firstOrderOnly && <p className="text-sky-600">{t('admin.promoCodes.firstOrderOnly')}</p>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-slate-900">{promo.usageCount}</span>
                    {promo.usageLimit && <span className="text-slate-400"> / {promo.usageLimit}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {promo.startsAt || promo.endsAt ? (
                      <>
                        {promo.startsAt && (
                          <p className="text-slate-500">
                            {t('admin.promoCodes.fromDate')} {new Date(promo.startsAt).toLocaleDateString(locale)}
                          </p>
                        )}
                        {promo.endsAt && (
                          <p className={isExpired ? 'text-red-500' : 'text-slate-500'}>
                            {t('admin.promoCodes.toDate')} {new Date(promo.endsAt).toLocaleDateString(locale)}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">{t('admin.promoCodes.unlimited')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(promo.id, promo.isActive)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        promo.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          promo.isActive ? 'right-1' : 'left-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => startEdit(promo)}>
                        {t('admin.promoCodes.edit')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Trash2}
                        onClick={() => deletePromoCode(promo.id)}
                        className="text-slate-400 hover:text-red-600"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {promoCodes.length === 0 && (
          <EmptyState
            icon={Tag}
            title={t('admin.promoCodes.emptyTitle')}
            description={t('admin.promoCodes.emptyDescription')}
            action={
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                {t('admin.promoCodes.newCode')}
              </Button>
            }
          />
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingCode ? t('admin.promoCodes.editModalTitle') : t('admin.promoCodes.newModalTitle')}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FormField label={t('admin.promoCodes.labelCode')} required>
              <div className="flex gap-2">
                <Input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder={t('admin.promoCodes.codePlaceholder')}
                  className="uppercase"
                />
                <Button type="button" variant="secondary" icon={Shuffle} onClick={generateCode}>
                  {t('admin.promoCodes.generate')}
                </Button>
              </div>
            </FormField>
          </div>

          <FormField label={t('admin.promoCodes.labelDescription')}>
            <Input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('admin.promoCodes.descriptionPlaceholder')}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promoCodes.labelType')} required>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'PERCENTAGE' | 'FIXED_AMOUNT' })}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="PERCENTAGE">{t('admin.promoCodes.typePercentage')}</option>
                <option value="FIXED_AMOUNT">{t('admin.promoCodes.typeFixedAmount')}</option>
              </select>
            </FormField>
            <FormField label={t('admin.promoCodes.labelValue')} required>
              <Input
                type="number"
                required
                min={1}
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) || 0 })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promoCodes.labelMinOrder')}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formData.minOrderAmount}
                onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                placeholder={t('admin.promoCodes.minOrderPlaceholder')}
              />
            </FormField>
            <FormField label={t('admin.promoCodes.labelMaxDiscount')}>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formData.maxDiscount}
                onChange={(e) => setFormData({ ...formData, maxDiscount: e.target.value })}
                placeholder={t('admin.promoCodes.maxDiscountPlaceholder')}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promoCodes.labelTotalLimit')}>
              <Input
                type="number"
                min={1}
                value={formData.usageLimit}
                onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                placeholder={t('admin.promoCodes.totalLimitPlaceholder')}
              />
            </FormField>
            <FormField label={t('admin.promoCodes.labelPerCustomerLimit')}>
              <Input
                type="number"
                min={1}
                value={formData.usageLimitPerUser}
                onChange={(e) => setFormData({ ...formData, usageLimitPerUser: e.target.value })}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.promoCodes.labelStartDate')}>
              <Input
                type="datetime-local"
                value={formData.startsAt}
                onChange={(e) => setFormData({ ...formData, startsAt: e.target.value })}
              />
            </FormField>
            <FormField label={t('admin.promoCodes.labelEndDate')}>
              <Input
                type="datetime-local"
                value={formData.endsAt}
                onChange={(e) => setFormData({ ...formData, endsAt: e.target.value })}
              />
            </FormField>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.firstOrderOnly}
              onChange={(e) => setFormData({ ...formData, firstOrderOnly: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-sky-500"
            />
            <span className="text-sm text-slate-700">{t('admin.promoCodes.firstOrderOnlyCheckbox')}</span>
          </label>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={resetForm} className="flex-1">
              {t('admin.promoCodes.cancel')}
            </Button>
            <Button type="submit" variant="primary" loading={saving} className="flex-1">
              {editingCode ? t('admin.promoCodes.save') : t('admin.promoCodes.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
