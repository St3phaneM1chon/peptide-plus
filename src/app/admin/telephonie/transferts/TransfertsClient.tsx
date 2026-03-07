'use client';

/**
 * TransfertsClient - CRUD interface for call forwarding rules.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import {
  PhoneForwarded, Plus, Pencil, Trash2, X, Check, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface ForwardingRule {
  id: string;
  extension: string;
  condition: string;
  destination: string;
  ringDuration: number;
  enabled: boolean;
}

interface Extension {
  id: string;
  extension: string;
  user?: { name: string | null };
}

const CONDITIONS = ['always', 'busy', 'noAnswer', 'unavailable'] as const;

function generateId() {
  return `fwd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export default function TransfertsClient({
  initialRules,
  extensions,
}: {
  initialRules: ForwardingRule[];
  extensions: Extension[];
}) {
  const { t } = useI18n();
  const [rules, setRules] = useState<ForwardingRule[]>(initialRules);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ForwardingRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    extension: '',
    condition: 'always' as string,
    destination: '',
    ringDuration: 25,
    enabled: true,
  });

  const conditionLabel = (cond: string) => {
    switch (cond) {
      case 'always': return t('voip.admin.forwarding.always');
      case 'busy': return t('voip.admin.forwarding.busy');
      case 'noAnswer': return t('voip.admin.forwarding.noAnswer');
      case 'unavailable': return t('voip.admin.forwarding.unavailable');
      default: return cond;
    }
  };

  const conditionColor = (cond: string) => {
    switch (cond) {
      case 'always': return 'bg-teal-50 text-teal-700';
      case 'busy': return 'bg-red-50 text-red-700';
      case 'noAnswer': return 'bg-amber-50 text-amber-700';
      case 'unavailable': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const openAdd = () => {
    setEditingRule(null);
    setForm({ extension: '', condition: 'always', destination: '', ringDuration: 25, enabled: true });
    setShowModal(true);
  };

  const openEdit = (rule: ForwardingRule) => {
    setEditingRule(rule);
    setForm({
      extension: rule.extension,
      condition: rule.condition,
      destination: rule.destination,
      ringDuration: rule.ringDuration,
      enabled: rule.enabled,
    });
    setShowModal(true);
  };

  const saveRules = async (updatedRules: ForwardingRule[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/voip/forwarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: updatedRules }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to save');
        return false;
      }
      setRules(updatedRules);
      toast.success(t('voip.admin.forwarding.saved'));
      return true;
    } catch {
      toast.error(t('common.error'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!form.extension || !form.destination) return;

    let updatedRules: ForwardingRule[];
    if (editingRule) {
      updatedRules = rules.map((r) =>
        r.id === editingRule.id
          ? { ...r, ...form }
          : r
      );
    } else {
      const newRule: ForwardingRule = { id: generateId(), ...form };
      updatedRules = [...rules, newRule];
    }

    const ok = await saveRules(updatedRules);
    if (ok) setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    const updatedRules = rules.filter((r) => r.id !== id);
    await saveRules(updatedRules);
  };

  const handleToggle = async (id: string) => {
    const updatedRules = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    await saveRules(updatedRules);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('voip.admin.forwarding.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('voip.admin.forwarding.subtitle')}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> {t('voip.admin.forwarding.addRule')}
        </button>
      </div>

      {/* Rules table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('voip.admin.forwarding.extension')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('voip.admin.forwarding.condition')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('voip.admin.forwarding.destination')}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t('voip.admin.forwarding.ringDuration')}</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">{t('voip.admin.forwarding.enabled')}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const ext = extensions.find((e) => e.extension === rule.extension);
              return (
                <tr key={rule.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">Ext. {rule.extension}</div>
                    {ext?.user?.name && (
                      <div className="text-xs text-gray-500">{ext.user.name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${conditionColor(rule.condition)}`}>
                      {conditionLabel(rule.condition)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{rule.destination}</td>
                  <td className="px-4 py-3 text-gray-700">{rule.ringDuration}s</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(rule.id)} className="inline-flex" disabled={saving}>
                      {rule.enabled ? (
                        <ToggleRight className="w-6 h-6 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(rule)} className="p-1.5 text-gray-400 hover:text-teal-600 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rules.length === 0 && (
          <div className="p-12 text-center text-gray-400">
            <PhoneForwarded className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>{t('voip.admin.forwarding.rules')}</p>
            <p className="text-xs mt-1">{t('voip.admin.forwarding.subtitle')}</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingRule ? t('voip.admin.forwarding.editRule') : t('voip.admin.forwarding.addRule')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Extension select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.forwarding.extension')}
                </label>
                <select
                  value={form.extension}
                  onChange={(e) => setForm((f) => ({ ...f, extension: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value="">--</option>
                  {extensions.map((ext) => (
                    <option key={ext.id} value={ext.extension}>
                      {ext.extension} {ext.user?.name ? `(${ext.user.name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.forwarding.condition')}
                </label>
                <select
                  value={form.condition}
                  onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{conditionLabel(c)}</option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.forwarding.destination')}
                </label>
                <input
                  type="text"
                  value={form.destination}
                  onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                  placeholder="+15145551234 / 1002 / voicemail"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Ring duration slider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.forwarding.ringDuration')}: {form.ringDuration}s
                </label>
                <input
                  type="range"
                  min={5}
                  max={60}
                  step={5}
                  value={form.ringDuration}
                  onChange={(e) => setForm((f) => ({ ...f, ringDuration: parseInt(e.target.value) }))}
                  className="w-full accent-teal-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>5s</span>
                  <span>30s</span>
                  <span>60s</span>
                </div>
              </div>

              {/* Enabled checkbox */}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                {t('voip.admin.forwarding.enabled')}
              </label>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.extension || !form.destination}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium disabled:opacity-50"
              >
                <Check className="w-4 h-4" /> {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
