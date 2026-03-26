'use client';

/**
 * IvrBuilderClient - Visual IVR flow editor.
 * Tree/card layout representing IVR menus, DTMF options, and destinations.
 * Supports CRUD operations via /api/voip/ivr.
 */

import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Phone,
  Plus,
  Trash2,
  Save,
  X,
  ChevronRight,
  ArrowDown,
  Loader2,
  Volume2,
  Clock,
  Hash,
  PhoneForwarded,
  Voicemail,
  RotateCcw,
  PhoneOff,
  GitBranch,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IvrOption {
  id: string;
  menuId: string;
  digit: string;
  label: string;
  action: string;
  target: string;
  announcement: string | null;
  sortOrder: number;
}

interface IvrMenu {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  greetingText: string | null;
  greetingUrl: string | null;
  language: string;
  inputTimeout: number;
  maxRetries: number;
  timeoutAction: string;
  timeoutTarget: string | null;
  businessHoursStart: string | null;
  businessHoursEnd: string | null;
  afterHoursMenuId: string | null;
  isActive: boolean;
  options: IvrOption[];
}

type DtmfDigit = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0' | '*' | '#';
type OptionAction = 'transfer_ext' | 'transfer_queue' | 'sub_menu' | 'voicemail' | 'replay' | 'hangup';

const DTMF_DIGITS: DtmfDigit[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '*', '#'];

const ACTION_KEYS: { value: OptionAction; labelKey: string; icon: typeof Phone }[] = [
  { value: 'transfer_ext', labelKey: 'transferToExt', icon: PhoneForwarded },
  { value: 'transfer_queue', labelKey: 'transferToQueue', icon: Users },
  { value: 'sub_menu', labelKey: 'goToSubmenu', icon: GitBranch },
  { value: 'voicemail', labelKey: 'voicemail', icon: Voicemail },
  { value: 'replay', labelKey: 'repeatMenu', icon: RotateCcw },
  { value: 'hangup', labelKey: 'hangUp', icon: PhoneOff },
];

interface EditingOption {
  digit: DtmfDigit;
  label: string;
  action: OptionAction;
  target: string;
  announcement: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IvrBuilderClient({
  initialMenus,
}: {
  initialMenus: IvrMenu[];
}) {
  const { t } = useI18n();
  const [menus, setMenus] = useState<IvrMenu[]>(initialMenus);
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(
    initialMenus[0]?.id ?? null,
  );
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Editor form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGreetingText, setFormGreetingText] = useState('');
  const [formGreetingUrl, setFormGreetingUrl] = useState('');
  const [formTimeout, setFormTimeout] = useState(5);
  const [formMaxRetries, setFormMaxRetries] = useState(3);
  const [formTimeoutAction, setFormTimeoutAction] = useState('replay');
  const [formOptions, setFormOptions] = useState<EditingOption[]>([]);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);

  const selectedMenu = menus.find((m) => m.id === selectedMenuId) ?? null;

  // ------ Open editor for new menu ------

  const openNewMenu = useCallback(() => {
    setFormName('');
    setFormDescription('');
    setFormGreetingText('');
    setFormGreetingUrl('');
    setFormTimeout(5);
    setFormMaxRetries(3);
    setFormTimeoutAction('replay');
    setFormOptions([]);
    setEditingMenuId(null);
    setShowEditor(true);
  }, []);

  // ------ Open editor for existing menu ------

  const openEditMenu = useCallback((menu: IvrMenu) => {
    setFormName(menu.name);
    setFormDescription(menu.description ?? '');
    setFormGreetingText(menu.greetingText ?? '');
    setFormGreetingUrl(menu.greetingUrl ?? '');
    setFormTimeout(menu.inputTimeout);
    setFormMaxRetries(menu.maxRetries);
    setFormTimeoutAction(menu.timeoutAction);
    setFormOptions(
      menu.options.map((opt) => ({
        digit: opt.digit as DtmfDigit,
        label: opt.label,
        action: opt.action as OptionAction,
        target: opt.target,
        announcement: opt.announcement ?? '',
      })),
    );
    setEditingMenuId(menu.id);
    setShowEditor(true);
  }, []);

  // ------ Add / Remove DTMF option ------

  const addOption = useCallback(() => {
    const usedDigits = new Set(formOptions.map((o) => o.digit));
    const nextDigit = DTMF_DIGITS.find((d) => !usedDigits.has(d)) ?? '1';
    setFormOptions((prev) => [
      ...prev,
      { digit: nextDigit, label: '', action: 'transfer_ext', target: '', announcement: '' },
    ]);
  }, [formOptions]);

  const removeOption = useCallback((idx: number) => {
    setFormOptions((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateOption = useCallback(
    (idx: number, field: keyof EditingOption, value: string) => {
      setFormOptions((prev) =>
        prev.map((opt, i) => (i === idx ? { ...opt, [field]: value } : opt)),
      );
    },
    [],
  );

  // ------ Save (Create or Update) ------

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      toast.error(t('voip.admin.ivrEditor.menuNameRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        companyId: menus[0]?.companyId ?? 'default',
        name: formName,
        description: formDescription || null,
        greetingText: formGreetingText || null,
        greetingUrl: formGreetingUrl || null,
        inputTimeout: formTimeout,
        maxRetries: formMaxRetries,
        timeoutAction: formTimeoutAction,
        options: formOptions.map((opt, idx) => ({
          digit: opt.digit,
          label: opt.label,
          action: opt.action,
          target: opt.target,
          announcement: opt.announcement || null,
          sortOrder: idx,
        })),
      };

      let res: Response;
      if (editingMenuId) {
        res = await fetch(`/api/voip/ivr/${editingMenuId}`, {
          method: 'PUT',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/voip/ivr', {
          method: 'POST',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      const result = await res.json();
      const savedMenu: IvrMenu = result.data;

      setMenus((prev) => {
        if (editingMenuId) {
          return prev.map((m) => (m.id === editingMenuId ? savedMenu : m));
        }
        return [savedMenu, ...prev];
      });

      setSelectedMenuId(savedMenu.id);
      setShowEditor(false);
      toast.success(editingMenuId ? t('voip.admin.ivrEditor.menuUpdated') : t('voip.admin.ivrEditor.menuCreated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('voip.admin.ivrEditor.saveFailed'));
    } finally {
      setSaving(false);
    }
  }, [
    formName,
    formDescription,
    formGreetingText,
    formGreetingUrl,
    formTimeout,
    formMaxRetries,
    formTimeoutAction,
    formOptions,
    editingMenuId,
    menus,
  ]);

  // ------ Delete menu ------

  const handleDelete = useCallback(
    async (menuId: string) => {
      if (!confirm(t('voip.admin.ivrEditor.confirmDelete'))) return;
      setDeleting(true);
      try {
        const res = await fetch(`/api/voip/ivr/${menuId}`, { method: 'DELETE', headers: addCSRFHeader({}) });
        if (!res.ok) throw new Error('Failed to delete');
        setMenus((prev) => prev.filter((m) => m.id !== menuId));
        if (selectedMenuId === menuId) {
          setSelectedMenuId(menus.find((m) => m.id !== menuId)?.id ?? null);
        }
        setShowEditor(false);
        toast.success(t('voip.admin.ivrEditor.menuDeleted'));
      } catch {
        toast.error(t('voip.admin.ivrEditor.deleteFailed'));
      } finally {
        setDeleting(false);
      }
    },
    [selectedMenuId, menus],
  );

  // ------ Action icon helper ------

  const getActionIcon = (action: string) => {
    const match = ACTION_KEYS.find((a) => a.value === action);
    if (match) {
      const Icon = match.icon;
      return <Icon className="w-3.5 h-3.5" />;
    }
    return <Phone className="w-3.5 h-3.5" />;
  };

  const getActionLabel = (action: string) => {
    const key = ACTION_KEYS.find((a) => a.value === action)?.labelKey;
    return key ? t(`voip.admin.ivrEditor.${key}`) : action;
  };

  // ------ Find submenu names for connectors ------

  const getMenuName = (menuId: string) => {
    return menus.find((m) => m.id === menuId)?.name ?? menuId;
  };

  // ------ Render ------

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-0">
      {/* Left sidebar: menu list */}
      <div className="w-72 flex-shrink-0 bg-[var(--k-glass-thin)] border-e border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-indigo-600" />
              {t('voip.enterprise.ivrBuilder')}
            </h2>
            <button
              onClick={openNewMenu}
              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              title={t('voip.admin.ivrEditor.newIvr')}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400">
            {t('voip.enterprise.ivrBuilderSubtitle')}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {menus.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-400">{t('voip.admin.ivrEditor.noMenusYet')}</p>
            </div>
          ) : (
            menus.map((menu) => (
              <button
                key={menu.id}
                onClick={() => setSelectedMenuId(menu.id)}
                className={`w-full text-start p-3 rounded-lg transition-colors ${
                  selectedMenuId === menu.id
                    ? 'bg-indigo-50 border border-indigo-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="text-sm font-medium text-gray-800 truncate">
                  {menu.name}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {menu.options.length} {menu.options.length !== 1 ? t('voip.admin.ivrEditor.options') : t('voip.admin.ivrEditor.option')} &middot;{' '}
                  {menu.language}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main area: visual flow */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        {showEditor ? (
          /* ===================== EDITOR MODE ===================== */
          <div className="max-w-2xl mx-auto bg-[var(--k-glass-thin)] rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">
                {editingMenuId ? t('voip.admin.ivrEditor.editMenu') : t('voip.admin.ivrEditor.newMenu')}
              </h2>
              <button
                onClick={() => setShowEditor(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('voip.admin.ivrEditor.menuName')}</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('voip.admin.ivrEditor.menuNamePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Description */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('voip.admin.ivrEditor.description')}</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t('voip.admin.ivrEditor.descriptionPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Greeting */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5" /> {t('voip.admin.ivrEditor.greetingTts')}
                </label>
                <textarea
                  value={formGreetingText}
                  onChange={(e) => setFormGreetingText(e.target.value)}
                  rows={2}
                  placeholder={t('voip.admin.ivrEditor.greetingPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('voip.admin.ivrEditor.audioUrl')}
                </label>
                <input
                  type="url"
                  value={formGreetingUrl}
                  onChange={(e) => setFormGreetingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Timeout / Retries */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {t('voip.admin.ivrEditor.timeoutSeconds')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={formTimeout}
                  onChange={(e) => setFormTimeout(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('voip.admin.ivrEditor.maxRetries')}</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={formMaxRetries}
                  onChange={(e) => setFormMaxRetries(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('voip.admin.ivrEditor.onTimeout')}</label>
                <select
                  value={formTimeoutAction}
                  onChange={(e) => setFormTimeoutAction(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="replay">{t('voip.admin.ivrEditor.replay')}</option>
                  <option value="operator">{t('voip.admin.ivrEditor.operator')}</option>
                  <option value="voicemail">{t('voip.admin.ivrEditor.voicemail')}</option>
                </select>
              </div>
            </div>

            {/* DTMF Options */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <Hash className="w-4 h-4" /> {t('voip.admin.ivrEditor.dtmfOptions')}
                </h3>
                <button
                  onClick={addOption}
                  disabled={formOptions.length >= 12}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-40"
                >
                  <Plus className="w-3 h-3" />
                  {t('voip.admin.ivrEditor.addOption')}
                </button>
              </div>

              {formOptions.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  {t('voip.admin.ivrEditor.noDtmfOptions')}
                </div>
              ) : (
                <div className="space-y-2">
                  {formOptions.map((opt, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      {/* Digit */}
                      <select
                        value={opt.digit}
                        onChange={(e) => updateOption(idx, 'digit', e.target.value)}
                        className="w-14 px-2 py-1.5 border border-gray-300 rounded text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {DTMF_DIGITS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>

                      {/* Label */}
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => updateOption(idx, 'label', e.target.value)}
                        placeholder={t('voip.admin.ivrEditor.labelPlaceholder')}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />

                      {/* Action */}
                      <select
                        value={opt.action}
                        onChange={(e) => updateOption(idx, 'action', e.target.value)}
                        className="w-44 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {ACTION_KEYS.map((a) => (
                          <option key={a.value} value={a.value}>
                            {t(`voip.admin.ivrEditor.${a.labelKey}`)}
                          </option>
                        ))}
                      </select>

                      {/* Target */}
                      {opt.action !== 'replay' && opt.action !== 'hangup' && (
                        <input
                          type="text"
                          value={opt.target}
                          onChange={(e) => updateOption(idx, 'target', e.target.value)}
                          placeholder={
                            opt.action === 'sub_menu'
                              ? t('voip.admin.ivrEditor.menuIdPlaceholder')
                              : opt.action === 'transfer_queue'
                                ? t('voip.admin.ivrEditor.queueNamePlaceholder')
                                : t('voip.admin.ivrEditor.extNumberPlaceholder')
                          }
                          className="w-28 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => removeOption(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                {editingMenuId && (
                  <button
                    onClick={() => handleDelete(editingMenuId)}
                    disabled={deleting}
                    className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                  >
                    {deleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    {t('voip.admin.ivrEditor.delete')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  {t('voip.admin.ivrEditor.cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formName.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingMenuId ? t('voip.admin.ivrEditor.update') : t('voip.admin.ivrEditor.create')}
                </button>
              </div>
            </div>
          </div>
        ) : selectedMenu ? (
          /* ===================== VISUAL FLOW VIEW ===================== */
          <div className="max-w-3xl mx-auto">
            {/* Menu header card */}
            <div className="bg-[var(--k-glass-thin)] rounded-xl border border-indigo-200 shadow-sm p-5 mb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                    <GitBranch className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedMenu.name}</h2>
                    {selectedMenu.description && (
                      <p className="text-xs text-gray-500">{selectedMenu.description}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => openEditMenu(selectedMenu)}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 transition-colors"
                >
                  {t('voip.admin.ivrEditor.edit')}
                </button>
              </div>

              {/* Greeting */}
              {selectedMenu.greetingText && (
                <div className="flex items-start gap-2 p-3 bg-indigo-50 rounded-lg mb-3">
                  <Volume2 className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-indigo-800 italic">
                    &ldquo;{selectedMenu.greetingText}&rdquo;
                  </p>
                </div>
              )}

              {/* Settings row */}
              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {t('voip.admin.ivrEditor.timeout')}: {selectedMenu.inputTimeout}s
                </span>
                <span>{t('voip.admin.ivrEditor.retries')}: {selectedMenu.maxRetries}</span>
                <span>{t('voip.admin.ivrEditor.onTimeoutLabel')}: {selectedMenu.timeoutAction}</span>
                <span>{t('voip.admin.ivrEditor.language')}: {selectedMenu.language}</span>
              </div>
            </div>

            {/* Connector arrow */}
            <div className="flex justify-center py-1">
              <ArrowDown className="w-5 h-5 text-indigo-300" />
            </div>

            {/* DTMF Options as cards */}
            {selectedMenu.options.length === 0 ? (
              <div className="text-center py-8 bg-[var(--k-glass-thin)] rounded-xl border border-dashed border-gray-200">
                <Hash className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">{t('voip.admin.ivrEditor.noDtmfConfigured')}</p>
                <button
                  onClick={() => openEditMenu(selectedMenu)}
                  className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {t('voip.admin.ivrEditor.addOptions')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {selectedMenu.options.map((opt) => {
                  const isSubMenu = opt.action === 'sub_menu';
                  const targetMenu = isSubMenu ? menus.find((m) => m.id === opt.target) : null;

                  return (
                    <div
                      key={opt.id}
                      className={`bg-[var(--k-glass-thin)] rounded-lg border p-3 transition-colors ${
                        isSubMenu
                          ? 'border-indigo-200 hover:border-indigo-300'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {/* Digit badge */}
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-gray-900 text-white text-sm font-bold">
                          {opt.digit}
                        </span>
                        <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        {getActionIcon(opt.action)}
                        <span>{getActionLabel(opt.action)}</span>
                        {opt.target && opt.action !== 'replay' && opt.action !== 'hangup' && (
                          <>
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                            <span className="font-mono text-gray-700">
                              {isSubMenu && targetMenu ? targetMenu.name : opt.target}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Visual connector to submenu */}
                      {isSubMenu && targetMenu && (
                        <button
                          onClick={() => setSelectedMenuId(targetMenu.id)}
                          className="mt-2 flex items-center gap-1 text-[10px] text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          <GitBranch className="w-3 h-3" />
                          {t('voip.admin.ivrEditor.goToMenu')} &ldquo;{getMenuName(opt.target)}&rdquo;
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* After-hours link */}
            {selectedMenu.afterHoursMenuId && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Clock className="w-4 h-4" />
                  <span>
                    {t('voip.admin.ivrEditor.afterHours')} ({selectedMenu.businessHoursStart} - {selectedMenu.businessHoursEnd}):
                  </span>
                  <button
                    onClick={() => setSelectedMenuId(selectedMenu.afterHoursMenuId ?? '')}
                    className="font-medium underline"
                  >
                    {getMenuName(selectedMenu.afterHoursMenuId)}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ===================== EMPTY STATE ===================== */
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <GitBranch className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500 mb-2">
                {t('voip.enterprise.ivrBuilder')}
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                {t('voip.admin.ivrEditor.selectOrCreate')}
              </p>
              <button
                onClick={openNewMenu}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium mx-auto"
              >
                <Plus className="w-4 h-4" />
                {t('voip.admin.ivrEditor.newMenu')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
