'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Receipt, Coffee, Car, Briefcase, ShoppingBag, Zap, Home, Heart } from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';
import { useI18n } from '@/i18n/client';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '5100': Briefcase,
  '5200': Car,
  '5300': Coffee,
  '5400': ShoppingBag,
  '5500': Zap,
  '5600': Home,
  '5700': Heart,
  '5000': Receipt,
};

const CATEGORY_KEYS: Record<string, string> = {
  '5100': 'mobile.expenses.categories.office',
  '5200': 'mobile.expenses.categories.transport',
  '5300': 'mobile.expenses.categories.meals',
  '5400': 'mobile.expenses.categories.supplies',
  '5500': 'mobile.expenses.categories.energy',
  '5600': 'mobile.expenses.categories.rent',
  '5700': 'mobile.expenses.categories.services',
  '5000': 'mobile.expenses.categories.other',
};

const CATEGORY_CODES = ['5100', '5200', '5300', '5400', '5500', '5600', '5700', '5000'];

export default function MobileExpenses() {
  const [expenses, setExpenses] = useState<Array<{ id: string; description: string; date: string; totalAmount: number }>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCat, setSelectedCat] = useState('5000');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const { t, locale } = useI18n();

  const fmt = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(n);

  useEffect(() => {
    fetch('/api/mobile/expenses').then(r => r.ok ? r.json() : null).then(d => d && setExpenses(d.data));
  }, []);

  const handleSave = async () => {
    if (!amount || !description) return;
    setSaving(true);
    try {
      const res = await fetch('/api/mobile/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...addCSRFHeader() },
        body: JSON.stringify({ description, amount: parseFloat(amount), category: selectedCat, date: new Date().toISOString().split('T')[0], note }),
      });
      if (res.ok) {
        setShowAdd(false); setAmount(''); setDescription(''); setNote('');
        const r = await fetch('/api/mobile/expenses');
        if (r.ok) { const d = await r.json(); setExpenses(d.data); }
      }
    } catch { /* offline */ }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">{t('mobile.expenses.title')}</h2>
        <button onClick={() => setShowAdd(true)} className="bg-purple-600 text-white p-2.5 rounded-full shadow-lg" aria-label="Add expense"><Plus className="w-5 h-5" /></button>
      </div>

      {/* Quick Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-2xl w-full max-h-[90vh] overflow-y-auto p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{t('mobile.expenses.newExpense')}</h3>
              <button onClick={() => setShowAdd(false)} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Amount */}
            <div className="text-center mb-5">
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="text-4xl font-bold text-center w-full border-none focus:outline-none text-gray-900" inputMode="decimal" autoFocus />
              <p className="text-sm text-gray-400 mt-1">{t('mobile.expenses.amountCAD')}</p>
            </div>

            {/* Description */}
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('mobile.expenses.descriptionPlaceholder')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-3" />

            {/* Category Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {CATEGORY_CODES.map((code) => {
                const Icon = CATEGORY_ICONS[code];
                return (
                  <button key={code} onClick={() => setSelectedCat(code)} className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-xs transition-colors ${selectedCat === code ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}>
                    <Icon className="w-5 h-5" />{t(CATEGORY_KEYS[code])}
                  </button>
                );
              })}
            </div>

            {/* Note */}
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder={t('mobile.expenses.noteOptional')} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-4" />

            <button onClick={handleSave} disabled={saving || !amount || !description} className="w-full bg-purple-600 text-white py-3.5 rounded-xl font-semibold disabled:opacity-50">
              {saving ? t('mobile.expenses.saving') : t('mobile.expenses.save')}
            </button>
          </div>
        </div>
      )}

      {/* Expense List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {expenses.map(e => (
          <div key={e.id} className="px-4 py-3 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
              <p className="text-xs text-gray-400">{new Date(e.date).toLocaleDateString(locale)}</p>
            </div>
            <span className="text-sm font-bold text-red-600 ms-3">-{fmt(e.totalAmount)}</span>
          </div>
        ))}
        {expenses.length === 0 && <p className="px-4 py-6 text-sm text-gray-400 text-center">{t('mobile.expenses.noRecent')}</p>}
      </div>
    </div>
  );
}
