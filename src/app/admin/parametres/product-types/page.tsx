'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Check, X } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

interface ProductType {
  value: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export default function ProductTypesPage() {
  const { t } = useI18n();
  const [types, setTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/product-types?active=false');
      if (res.ok) {
        const json = await res.json();
        setTypes(json.data || []);
      } else {
        toast.error(t('admin.productTypes.loadError'));
      }
    } catch {
      toast.error(t('admin.productTypes.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newValue.trim() || !newLabel.trim()) return;

    setAdding(true);
    try {
      const res = await fetch('/api/admin/product-types', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          value: newValue.toUpperCase().replace(/[^A-Z0-9_]/g, '_'),
          label: newLabel.trim(),
        }),
      });
      if (res.ok) {
        toast.success(t('admin.productTypes.addSuccess'));
        setNewValue('');
        setNewLabel('');
        fetchTypes();
      } else {
        const data = await res.json();
        toast.error(data.error?.message || t('admin.productTypes.addError'));
      }
    } catch {
      toast.error(t('admin.productTypes.addError'));
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (type: ProductType) => {
    try {
      const res = await fetch(`/api/admin/product-types?value=${encodeURIComponent(type.value)}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isActive: !type.isActive }),
      });
      if (res.ok) {
        toast.success(t('admin.productTypes.updateSuccess'));
        setTypes(types.map(pt => pt.value === type.value ? { ...pt, isActive: !pt.isActive } : pt));
      } else {
        toast.error(t('admin.productTypes.updateError'));
      }
    } catch {
      toast.error(t('admin.productTypes.updateError'));
    }
  };

  const handleDelete = async (type: ProductType) => {
    if (!confirm(t('admin.productTypes.deleteConfirm', { label: type.label }))) return;

    try {
      const res = await fetch(`/api/admin/product-types?value=${encodeURIComponent(type.value)}`, {
        method: 'DELETE',
        headers: addCSRFHeader(),
      });
      if (res.ok) {
        toast.success(t('admin.productTypes.deleteSuccess'));
        setTypes(types.filter(pt => pt.value !== type.value));
      } else {
        const data = await res.json();
        toast.error(data.error?.message || t('admin.productTypes.deleteError'));
      }
    } catch {
      toast.error(t('admin.productTypes.deleteError'));
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin/parametres" className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{t('admin.productTypes.title')}</h1>
            <p className="text-sm text-neutral-500">{t('admin.productTypes.subtitle')}</p>
          </div>
        </div>

        {/* Add new type form */}
        <div className="bg-[var(--k-glass-thin)] rounded-xl border border-neutral-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-neutral-900 mb-4">{t('admin.productTypes.addNew')}</h2>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productTypes.valueLabel')}</label>
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
                placeholder={t('admin.productTypes.valuePlaceholder')}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productTypes.labelField')}</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t('admin.productTypes.labelPlaceholder')}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newValue.trim() || !newLabel.trim()}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50 text-sm font-medium flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('admin.productTypes.add')}
            </button>
          </div>
        </div>

        {/* Types list */}
        <div className="bg-[var(--k-glass-thin)] rounded-xl border border-neutral-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-neutral-400">{t('common.loading')}</div>
          ) : types.length === 0 ? (
            <div className="p-12 text-center text-neutral-400">{t('admin.productTypes.empty')}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-100 text-left">
                  <th className="px-6 py-3 text-xs font-medium text-neutral-500 uppercase">{t('admin.productTypes.valueLabel')}</th>
                  <th className="px-6 py-3 text-xs font-medium text-neutral-500 uppercase">{t('admin.productTypes.labelField')}</th>
                  <th className="px-6 py-3 text-xs font-medium text-neutral-500 uppercase text-center">{t('admin.productTypes.active')}</th>
                  <th className="px-6 py-3 text-xs font-medium text-neutral-500 uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => (
                  <tr key={type.value} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-3 text-sm font-mono text-neutral-700">{type.value}</td>
                    <td className="px-6 py-3 text-sm text-neutral-900">{type.label}</td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => handleToggleActive(type)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                          type.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                        }`}
                      >
                        {type.isActive ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        {type.isActive ? t('admin.productTypes.active') : t('admin.productTypes.inactive')}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <button
                        onClick={() => handleDelete(type)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('admin.productTypes.deleteTooltip')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
