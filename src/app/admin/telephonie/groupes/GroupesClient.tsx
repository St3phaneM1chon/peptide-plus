'use client';

/**
 * GroupesClient - CRUD ring groups (CallQueue) with member management.
 */

import { useState } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Users, Plus, Pencil, Trash2, X, Check, UserPlus, UserMinus, Clock,
} from 'lucide-react';
import { toast } from 'sonner';

interface QueueMember {
  id: string;
  userId: string;
  priority: number;
  user: { id: string; name: string | null; email: string };
}

interface RingGroup {
  id: string;
  name: string;
  strategy: string;
  ringTimeout: number;
  maxWaitTime: number;
  wrapUpTime: number;
  isActive: boolean;
  members: QueueMember[];
}

interface AvailableUser {
  id: string;
  name: string | null;
  email: string;
}

type Strategy = 'RING_ALL' | 'ROUND_ROBIN' | 'HUNT' | 'RANDOM' | 'LEAST_RECENT';

const STRATEGIES: Strategy[] = ['RING_ALL', 'ROUND_ROBIN', 'HUNT', 'RANDOM', 'LEAST_RECENT'];

export default function GroupesClient({
  initialGroups,
  availableUsers,
}: {
  initialGroups: RingGroup[];
  availableUsers: AvailableUser[];
}) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<RingGroup[]>(initialGroups);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RingGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    strategy: 'RING_ALL' as Strategy,
    ringTimeout: 30,
    maxWaitTime: 300,
    wrapUpTime: 15,
    memberIds: [] as string[],
  });

  const strategyLabel = (s: string): string => {
    switch (s) {
      case 'RING_ALL': return t('voip.admin.ringGroups.ringAll');
      case 'ROUND_ROBIN': return t('voip.admin.ringGroups.roundRobin');
      case 'HUNT': return t('voip.admin.ringGroups.hunt');
      case 'RANDOM': return t('voip.admin.ringGroups.random');
      case 'LEAST_RECENT': return t('voip.admin.ringGroups.leastRecent');
      default: return s;
    }
  };

  const strategyColor = (s: string) => {
    switch (s) {
      case 'RING_ALL': return 'bg-teal-50 text-teal-700';
      case 'ROUND_ROBIN': return 'bg-violet-50 text-violet-700';
      case 'HUNT': return 'bg-amber-50 text-amber-700';
      case 'RANDOM': return 'bg-emerald-50 text-emerald-700';
      case 'LEAST_RECENT': return 'bg-orange-50 text-orange-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const openAdd = () => {
    setEditingGroup(null);
    setForm({ name: '', strategy: 'RING_ALL', ringTimeout: 30, maxWaitTime: 300, wrapUpTime: 15, memberIds: [] });
    setShowModal(true);
  };

  const openEdit = (group: RingGroup) => {
    setEditingGroup(group);
    setForm({
      name: group.name,
      strategy: group.strategy as Strategy,
      ringTimeout: group.ringTimeout,
      maxWaitTime: group.maxWaitTime,
      wrapUpTime: group.wrapUpTime,
      memberIds: group.members.map((m) => m.userId),
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const method = editingGroup ? 'PUT' : 'POST';
      const body = editingGroup
        ? { id: editingGroup.id, ...form }
        : form;

      const res = await fetch('/api/admin/voip/ring-groups', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed');
        return;
      }
      const data = await res.json();
      if (editingGroup) {
        setGroups((prev) => prev.map((g) => (g.id === editingGroup.id ? data.group : g)));
      } else {
        setGroups((prev) => [...prev, data.group]);
      }
      toast.success(t('voip.admin.ringGroups.saved'));
      setShowModal(false);
    } catch {
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      const res = await fetch(`/api/admin/voip/ring-groups?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed');
        return;
      }
      setGroups((prev) => prev.filter((g) => g.id !== id));
      toast.success(t('voip.admin.ringGroups.deleted'));
    } catch {
      toast.error(t('common.error'));
    }
  };

  const toggleMember = (userId: string) => {
    setForm((f) => ({
      ...f,
      memberIds: f.memberIds.includes(userId)
        ? f.memberIds.filter((id) => id !== userId)
        : [...f.memberIds, userId],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('voip.admin.ringGroups.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('voip.admin.ringGroups.subtitle')}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> {t('voip.admin.ringGroups.addGroup')}
        </button>
      </div>

      {/* Groups grid */}
      {groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{group.name}</h3>
                  <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${strategyColor(group.strategy)}`}>
                    {strategyLabel(group.strategy)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(group)} className="p-1.5 text-gray-400 hover:text-teal-600 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(group.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{group.members.length} {t('voip.admin.ringGroups.members')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{group.ringTimeout}s</span>
                </div>
              </div>

              {/* Member avatars */}
              {group.members.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {group.members.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                    >
                      {m.user.name || m.user.email}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>{t('voip.admin.ringGroups.empty')}</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingGroup ? t('voip.admin.ringGroups.editGroup') : t('voip.admin.ringGroups.addGroup')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.ringGroups.name')}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Sales, Support..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              {/* Strategy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.ringGroups.strategy')}
                </label>
                <select
                  value={form.strategy}
                  onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value as Strategy }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  {STRATEGIES.map((s) => (
                    <option key={s} value={s}>{strategyLabel(s)}</option>
                  ))}
                </select>
              </div>

              {/* Ring Timeout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.ringGroups.ringTimeout')}: {form.ringTimeout}s
                </label>
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={5}
                  value={form.ringTimeout}
                  onChange={(e) => setForm((f) => ({ ...f, ringTimeout: parseInt(e.target.value) }))}
                  className="w-full accent-teal-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>10s</span>
                  <span>60s</span>
                  <span>120s</span>
                </div>
              </div>

              {/* Members multi-select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('voip.admin.ringGroups.members')} ({form.memberIds.length})
                </label>
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-50">
                  {availableUsers.map((user) => {
                    const isSelected = form.memberIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleMember(user.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                          isSelected ? 'bg-teal-50' : ''
                        }`}
                      >
                        <span className={isSelected ? 'text-teal-700 font-medium' : 'text-gray-700'}>
                          {user.name || user.email}
                        </span>
                        {isSelected ? (
                          <UserMinus className="w-4 h-4 text-red-400" />
                        ) : (
                          <UserPlus className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    );
                  })}
                  {availableUsers.length === 0 && (
                    <div className="px-3 py-4 text-center text-gray-400 text-sm">No users available</div>
                  )}
                </div>
              </div>
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
                disabled={saving || !form.name.trim()}
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
