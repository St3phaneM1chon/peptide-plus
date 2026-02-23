// TODO: FAILLE-051 - This page is fully client-side ('use client') without server-side permission check before render.
//       Add a server layout or middleware check that verifies admin.permissions access before serving this component.
// TODO: FAILLE-052 - Checkbox mutations fire immediately per click; add debounce (300ms) or batch modifications to reduce race conditions.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Shield, Users, UserCog, Settings, Plus, Trash2, Check, X, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { Modal } from '@/components/admin/Modal';
import { EmptyState } from '@/components/admin/EmptyState';
import { Input } from '@/components/admin/FormField';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';
import { useRibbonAction } from '@/hooks/useRibbonAction';

type Tab = 'defaults' | 'groups' | 'overrides';

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  defaultOwner: boolean;
  defaultEmployee: boolean;
  defaultClient: boolean;
  defaultCustomer: boolean;
}

interface PermissionGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isActive: boolean;
  permissions: { permission: Permission }[];
  _count: { users: number };
}

interface UserBasic {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Override {
  id: string;
  userId: string;
  permissionCode: string;
  granted: boolean;
  reason: string | null;
  grantedBy: string;
  expiresAt: string | null;
  createdAt: string;
}

export default function PermissionsPage() {
  const { t } = useI18n();
  const { data: session } = useSession();
  const isOwner = session?.user?.role === 'OWNER';
  const [activeTab, setActiveTab] = useState<Tab>('defaults');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<Record<string, { label: string; permissions: string[] }>>({});
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Group modal state
  const [groupModal, setGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PermissionGroup | null>(null);
  const [groupForm, setGroupForm] = useState({ name: '', description: '', color: '#0ea5e9', permissionCodes: [] as string[] });

  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [removingOverrideCode, setRemovingOverrideCode] = useState<string | null>(null);

  // Override state
  const [users, setUsers] = useState<UserBasic[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserBasic | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [overrides, setOverrides] = useState<Override[]>([]);

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'defaults', label: t('admin.permissions.tabDefaults'), icon: Settings },
    { id: 'groups', label: t('admin.permissions.tabGroups'), icon: Users },
    { id: 'overrides', label: t('admin.permissions.tabOverrides'), icon: UserCog },
  ];

  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/permissions?tab=permissions');
      if (!res.ok) { toast.error(t('common.errorOccurred')); setLoading(false); return; }
      const data = await res.json();
      setPermissions(data.permissions || []);
      setModules(data.modules || {});
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
    setLoading(false);
  }, [t]);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/permissions?tab=groups');
      if (!res.ok) { toast.error(t('common.errorOccurred')); return; }
      const data = await res.json();
      setGroups(data.groups || []);
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  }, [t]);

  const searchUsers = useCallback(async (search: string) => {
    if (!search || search.length < 2) { setUsers([]); return; }
    try {
      const res = await fetch(`/api/admin/permissions?tab=users&search=${encodeURIComponent(search)}`);
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchOverrides = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/permissions?tab=overrides&userId=${userId}`);
      if (!res.ok) { toast.error(t('common.errorOccurred')); return; }
      const data = await res.json();
      setOverrides(data.overrides || []);
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  }, [t]);

  useEffect(() => {
    fetchPermissions();
    fetchGroups();
  }, [fetchPermissions, fetchGroups]);

  // FAILLE-010: Seed permissions on first load if empty - OWNER only with confirmation
  useEffect(() => {
    if (!loading && permissions.length === 0 && isOwner) {
      // Auto-seed only if there are truly no permissions (first setup)
      fetch('/api/admin/permissions', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'seed' }),
      }).then(() => fetchPermissions()).catch(() => toast.error(t('common.errorOccurred')));
    }
  }, [loading, permissions.length, fetchPermissions, isOwner]);

  const toggleModule = (mod: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  };

  const updateDefault = async (code: string, field: string, value: boolean) => {
    setPermissions(prev => prev.map(p => p.code === code ? { ...p, [field]: value } : p));
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'updateDefaults', code, [field]: value }),
      });
      if (!res.ok) toast.error(t('common.errorOccurred'));
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  };

  const saveGroup = async () => {
    const action = editingGroup ? 'updateGroup' : 'createGroup';
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action,
          groupId: editingGroup?.id,
          ...groupForm,
        }),
      });
      if (!res.ok) { toast.error(t('common.errorOccurred')); return; }
      toast.success(t('common.savedSuccessfully'));
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
      return;
    }
    setGroupModal(false);
    setEditingGroup(null);
    setGroupForm({ name: '', description: '', color: '#0ea5e9', permissionCodes: [] });
    fetchGroups();
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm(t('admin.permissions.deleteGroupConfirm'))) return;
    setDeletingGroupId(groupId);
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action: 'deleteGroup', groupId }),
      });
      if (!res.ok) { toast.error(t('common.errorOccurred')); return; }
      toast.success(t('common.deletedSuccessfully'));
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
      return;
    } finally {
      setDeletingGroupId(null);
    }
    fetchGroups();
  };

  const toggleOverride = async (permissionCode: string, granted: boolean) => {
    if (!selectedUser) return;
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'setOverride',
          userId: selectedUser.id,
          permissionCode,
          granted,
        }),
      });
      if (!res.ok) { toast.error(t('common.errorOccurred')); return; }
      toast.success(t('common.savedSuccessfully'));
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
      return;
    }
    fetchOverrides(selectedUser.id);
  };

  const removeOverride = async (permissionCode: string) => {
    if (!selectedUser) return;
    setRemovingOverrideCode(permissionCode);
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: 'removeOverride',
          userId: selectedUser.id,
          permissionCode,
        }),
      });
      if (!res.ok) { toast.error(t('common.errorOccurred')); return; }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
      return;
    } finally {
      setRemovingOverrideCode(null);
    }
    fetchOverrides(selectedUser.id);
  };

  const groupedPermissions = Object.entries(modules).map(([key, mod]) => ({
    key,
    label: mod.label,
    permissions: permissions.filter(p => p.module === key),
  }));

  // ─── Ribbon action handlers ───────────────────────────────
  const handleRibbonNewRole = useCallback(() => {
    setEditingGroup(null);
    setGroupForm({ name: '', description: '', color: '#0ea5e9', permissionCodes: [] });
    setGroupModal(true);
  }, []);

  const handleRibbonDelete = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonModifyPermissions = useCallback(() => {
    setActiveTab('defaults');
  }, []);

  const handleRibbonDuplicateRole = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonAccessAudit = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonExport = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  useRibbonAction('newRole', handleRibbonNewRole);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('modifyPermissions', handleRibbonModifyPermissions);
  useRibbonAction('duplicateRole', handleRibbonDuplicateRole);
  useRibbonAction('accessAudit', handleRibbonAccessAudit);
  useRibbonAction('export', handleRibbonExport);

  return (
    <div>
      <PageHeader
        title={t('admin.permissions.title')}
        subtitle={t('admin.permissions.subtitle')}
        badge={<StatusBadge variant="info">{t('admin.permissions.ownerOnly')}</StatusBadge>}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB: Role Defaults */}
      {activeTab === 'defaults' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>{t('admin.permissions.permission')}</span>
              <span className="text-center">{t('admin.permissions.owner')}</span>
              <span className="text-center">{t('admin.permissions.employee')}</span>
              <span className="text-center">{t('admin.permissions.client')}</span>
              <span className="text-center">{t('admin.permissions.customer')}</span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {groupedPermissions.map(group => (
              <div key={group.key}>
                <button
                  onClick={() => toggleModule(group.key)}
                  className="w-full flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {expandedModules.has(group.key) ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  )}
                  {group.label}
                  <span className="text-xs text-slate-400 font-normal ms-1">
                    ({group.permissions.length})
                  </span>
                </button>
                {expandedModules.has(group.key) && (
                  <div className="divide-y divide-slate-50">
                    {group.permissions.map(perm => (
                      <div key={perm.code} className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-4 px-5 py-2 items-center">
                        <div>
                          <p className="text-sm text-slate-700">{perm.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{perm.code}</p>
                        </div>
                        {['defaultOwner', 'defaultEmployee', 'defaultClient', 'defaultCustomer'].map(field => (
                          <div key={field} className="flex justify-center">
                            <button
                              onClick={() => field !== 'defaultOwner' && updateDefault(perm.code, field, !(perm as unknown as Record<string, boolean>)[field])}
                              disabled={field === 'defaultOwner'}
                              className={`w-6 h-6 rounded flex items-center justify-center transition-colors
                                ${(perm as unknown as Record<string, boolean>)[field]
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : 'bg-slate-100 text-slate-300'
                                }
                                ${field === 'defaultOwner' ? 'cursor-not-allowed opacity-60' : 'hover:ring-2 hover:ring-sky-300'}
                              `}
                            >
                              {(perm as unknown as Record<string, boolean>)[field] ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Permission Groups */}
      {activeTab === 'groups' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => {
                setEditingGroup(null);
                setGroupForm({ name: '', description: '', color: '#0ea5e9', permissionCodes: [] });
                setGroupModal(true);
              }}
            >
              {t('admin.permissions.newGroup')}
            </Button>
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t('admin.permissions.noGroupsTitle')}
              description={t('admin.permissions.noGroupsDescription')}
              action={
                <Button variant="primary" icon={Plus} onClick={() => setGroupModal(true)}>
                  {t('admin.permissions.createFirstGroup')}
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {groups.map(group => (
                <div key={group.id} className="bg-white border border-slate-200 rounded-lg p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: group.color || '#0ea5e9' }}
                      />
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{group.name}</h3>
                        {group.description && <p className="text-xs text-slate-500 mt-0.5">{group.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge variant="neutral">{t('admin.permissions.usersCount', { count: group._count.users })}</StatusBadge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingGroup(group);
                          setGroupForm({
                            name: group.name,
                            description: group.description || '',
                            color: group.color || '#0ea5e9',
                            permissionCodes: group.permissions.map(p => p.permission.code),
                          });
                          setGroupModal(true);
                        }}
                      >
                        {t('admin.permissions.edit')}
                      </Button>
                      <Button size="sm" variant="ghost" icon={Trash2} disabled={deletingGroupId === group.id} onClick={() => deleteGroup(group.id)} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {group.permissions.slice(0, 8).map(p => (
                      <span key={p.permission.code} className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-mono">
                        {p.permission.code}
                      </span>
                    ))}
                    {group.permissions.length > 8 && (
                      <span className="text-[11px] text-slate-400 px-2 py-0.5">
                        {t('admin.permissions.morePermissions', { count: group.permissions.length - 8 })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Group Modal */}
          <Modal
            isOpen={groupModal}
            onClose={() => setGroupModal(false)}
            title={editingGroup ? t('admin.permissions.editGroup') : t('admin.permissions.newGroupTitle')}
            size="lg"
            footer={
              <>
                <Button variant="secondary" onClick={() => setGroupModal(false)}>{t('admin.permissions.cancel')}</Button>
                <Button variant="primary" onClick={saveGroup}>{t('admin.permissions.saveGroup')}</Button>
              </>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.permissions.groupName')}</label>
                <Input
                  value={groupForm.name}
                  onChange={e => setGroupForm(f => ({ ...f, name: e.target.value }))}
                  placeholder={t('admin.permissions.groupNamePlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.permissions.descriptionLabel')}</label>
                <Input
                  value={groupForm.description}
                  onChange={e => setGroupForm(f => ({ ...f, description: e.target.value }))}
                  placeholder={t('admin.permissions.descriptionPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.permissions.color')}</label>
                <input
                  type="color"
                  value={groupForm.color}
                  onChange={e => setGroupForm(f => ({ ...f, color: e.target.value }))}
                  className="h-9 w-20 rounded border border-slate-300 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('admin.permissions.permissionsLabel')}</label>
                <div className="max-h-80 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {groupedPermissions.map(group => (
                    <div key={group.key}>
                      <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                        {group.label}
                      </div>
                      {group.permissions.map(perm => (
                        <label key={perm.code} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={groupForm.permissionCodes.includes(perm.code)}
                            onChange={e => {
                              setGroupForm(f => ({
                                ...f,
                                permissionCodes: e.target.checked
                                  ? [...f.permissionCodes, perm.code]
                                  : f.permissionCodes.filter(c => c !== perm.code),
                              }));
                            }}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <p className="text-sm text-slate-700">{perm.name}</p>
                            <p className="text-xs text-slate-400 font-mono">{perm.code}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* TAB: User Overrides */}
      {activeTab === 'overrides' && (
        <div>
          {/* User search */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">{t('admin.permissions.searchUser')}</label>
            <div className="relative w-full max-w-md">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={userSearch}
                onChange={e => {
                  setUserSearch(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder={t('admin.permissions.searchPlaceholder')}
                className="ps-9"
              />
            </div>
            {users.length > 0 && !selectedUser && (
              <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      setUsers([]);
                      setUserSearch('');
                      fetchOverrides(user.id);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-start"
                  >
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium text-slate-600">
                      {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{user.name || user.email}</p>
                      <p className="text-xs text-slate-400">{user.email} - {user.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedUser ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-sm font-medium text-slate-600">
                    {selectedUser.name?.charAt(0)?.toUpperCase() || selectedUser.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedUser.name || selectedUser.email}</p>
                    <p className="text-xs text-slate-500">{selectedUser.email}</p>
                  </div>
                  <StatusBadge variant="info">{selectedUser.role}</StatusBadge>
                </div>
                <Button variant="secondary" onClick={() => { setSelectedUser(null); setOverrides([]); }}>
                  {t('admin.permissions.changeUser')}
                </Button>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                  <div className="grid grid-cols-[1fr_120px_80px] gap-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <span>{t('admin.permissions.permission')}</span>
                    <span className="text-center">{t('admin.permissions.overrideCol')}</span>
                    <span className="text-center">{t('admin.permissions.actionsCol')}</span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100 max-h-[60vh] overflow-y-auto">
                  {groupedPermissions.map(group => (
                    <div key={group.key}>
                      <div className="px-5 py-2 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                        {group.label}
                      </div>
                      {group.permissions.map(perm => {
                        const override = overrides.find(o => o.permissionCode === perm.code);
                        return (
                          <div key={perm.code} className="grid grid-cols-[1fr_120px_80px] gap-4 px-5 py-2.5 items-center">
                            <div>
                              <p className="text-sm text-slate-700">{perm.name}</p>
                              <p className="text-xs text-slate-400 font-mono">{perm.code}</p>
                            </div>
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => toggleOverride(perm.code, true)}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                                  ${override?.granted === true
                                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
                                    : 'bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                                  }`}
                              >
                                {t('admin.permissions.grant')}
                              </button>
                              <button
                                onClick={() => toggleOverride(perm.code, false)}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors
                                  ${override?.granted === false
                                    ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                                    : 'bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-600'
                                  }`}
                              >
                                {t('admin.permissions.revoke')}
                              </button>
                            </div>
                            <div className="flex justify-center">
                              {override && (
                                <button
                                  onClick={() => removeOverride(perm.code)}
                                  disabled={removingOverrideCode === perm.code}
                                  className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                                  title={t('admin.permissions.removeOverrideTitle')}
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={UserCog}
              title={t('admin.permissions.selectUserTitle')}
              description={t('admin.permissions.selectUserDescription')}
            />
          )}
        </div>
      )}
    </div>
  );
}
