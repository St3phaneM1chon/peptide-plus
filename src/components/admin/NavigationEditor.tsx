'use client';

import { useState, useCallback } from 'react';
import {
  Plus, Trash2, Edit2, ChevronUp, ChevronDown,
  GripVertical, ExternalLink, ChevronRight, Menu,
  Layout, Shield, FileText,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { FormField, Input, Textarea } from '@/components/admin/FormField';
import { Modal } from '@/components/admin/Modal';
import { useI18n } from '@/i18n/client';

// ─── Types ────────────────────────────────────────────────────
export interface HeaderNavItem {
  label: string;
  type: 'link' | 'dropdown';
  href: string;
  children?: { label: string; href: string }[];
}

export interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface TrustBadge {
  icon: string;
  label: string;
}

// ─── Preset pages ─────────────────────────────────────────────
const PRESET_PAGES = [
  { label: 'Accueil', href: '/' },
  { label: 'Boutique', href: '/shop' },
  { label: 'Formations', href: '/learn' },
  { label: 'Blog', href: '/blog' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Videos', href: '/videos' },
  { label: 'Webinaires', href: '/webinars' },
  { label: 'Contact', href: '/contact' },
  { label: 'A propos', href: '/about' },
  { label: 'Catalogue', href: '/catalogue' },
  { label: 'Carrieres', href: '/carrieres' },
  { label: 'Temoignages', href: '/clients/temoignages' },
  { label: 'URL personnalisee', href: '' },
];

// ─── Badge emoji presets ──────────────────────────────────────
const BADGE_ICON_PRESETS = [
  { icon: '\u{1F6E1}\uFE0F', label: 'Bouclier' },
  { icon: '\u{1F512}', label: 'Cadenas' },
  { icon: '\u2705', label: 'Check' },
  { icon: '\u{1F4E6}', label: 'Colis' },
  { icon: '\u{1F69A}', label: 'Camion' },
  { icon: '\u2B50', label: 'Etoile' },
  { icon: '\u{1F4B3}', label: 'Carte' },
  { icon: '\u{1F3C6}', label: 'Trophee' },
  { icon: '\u{1F4AC}', label: 'Discussion' },
  { icon: '\u{1F49A}', label: 'Coeur vert' },
  { icon: '\u{1F30D}', label: 'Globe' },
  { icon: '\u{1F3E5}', label: 'Hopital' },
];

// ═══════════════════════════════════════════════════════════════
// HEADER NAV EDITOR
// ═══════════════════════════════════════════════════════════════

interface HeaderNavEditorProps {
  items: HeaderNavItem[];
  onChange: (items: HeaderNavItem[]) => void;
}

export function HeaderNavEditor({ items, onChange }: HeaderNavEditorProps) {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<HeaderNavItem>({
    label: '', type: 'link', href: '', children: [],
  });
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null);

  const openAdd = useCallback(() => {
    setEditIndex(null);
    setFormData({ label: '', type: 'link', href: '', children: [] });
    setSelectedPreset('');
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((idx: number) => {
    setEditIndex(idx);
    setFormData({ ...items[idx], children: items[idx].children ? [...items[idx].children!.map(c => ({ ...c }))] : [] });
    setSelectedPreset('');
    setModalOpen(true);
  }, [items]);

  const handleSaveItem = useCallback(() => {
    if (!formData.label.trim()) return;
    if (formData.type === 'link' && !formData.href.trim()) return;

    const updated = [...items];
    const clean: HeaderNavItem = {
      label: formData.label.trim(),
      type: formData.type,
      href: formData.type === 'link' ? formData.href.trim() : (formData.href.trim() || '#'),
      ...(formData.type === 'dropdown' && formData.children && formData.children.length > 0
        ? { children: formData.children.filter(c => c.label.trim() && c.href.trim()) }
        : {}),
    };

    if (editIndex !== null) {
      updated[editIndex] = clean;
    } else {
      updated.push(clean);
    }
    onChange(updated);
    setModalOpen(false);
  }, [formData, items, editIndex, onChange]);

  const handleDelete = useCallback((idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
    setDeleteConfirmIdx(null);
  }, [items, onChange]);

  const moveItem = useCallback((idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const updated = [...items];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    onChange(updated);
  }, [items, onChange]);

  const handlePresetChange = useCallback((value: string) => {
    setSelectedPreset(value);
    const preset = PRESET_PAGES.find(p => p.href === value);
    if (preset && preset.href) {
      setFormData(prev => ({ ...prev, href: preset.href, label: prev.label || preset.label }));
    } else {
      setFormData(prev => ({ ...prev, href: '' }));
    }
  }, []);

  // Sub-item management
  const addSubItem = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      children: [...(prev.children || []), { label: '', href: '' }],
    }));
  }, []);

  const updateSubItem = useCallback((idx: number, field: 'label' | 'href', val: string) => {
    setFormData(prev => ({
      ...prev,
      children: (prev.children || []).map((c, i) => i === idx ? { ...c, [field]: val } : c),
    }));
  }, []);

  const removeSubItem = useCallback((idx: number) => {
    setFormData(prev => ({
      ...prev,
      children: (prev.children || []).filter((_, i) => i !== idx),
    }));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Menu className="w-5 h-5 text-[var(--k-text-secondary)]" />
          <h4 className="text-base font-semibold text-[var(--k-text-primary)]">
            {t('admin.settingsPage.navEditor.headerTitle') || 'Navigation en-tete'}
          </h4>
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>
          {t('admin.settingsPage.navEditor.addItem') || 'Ajouter un item'}
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-[var(--k-text-muted)] text-sm border border-dashed border-[var(--k-border-subtle)] rounded-lg">
          {t('admin.settingsPage.navEditor.noHeaderItems') || 'Aucun item de navigation. Cliquez sur "Ajouter un item" pour commencer.'}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-[var(--k-border-subtle)] hover:border-indigo-500/30 transition-colors group"
            >
              <GripVertical className="w-4 h-4 text-[var(--k-text-muted)] flex-shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--k-text-primary)] truncate">{item.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    item.type === 'dropdown'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {item.type === 'dropdown' ? 'Menu' : 'Lien'}
                  </span>
                </div>
                <p className="text-xs text-[var(--k-text-muted)] truncate mt-0.5">
                  {item.href}
                  {item.type === 'dropdown' && item.children
                    ? ` (${item.children.length} sous-items)`
                    : ''}
                </p>
              </div>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 rounded hover:bg-white/10 text-[var(--k-text-muted)] disabled:opacity-30"
                  aria-label="Monter"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="p-1 rounded hover:bg-white/10 text-[var(--k-text-muted)] disabled:opacity-30"
                  aria-label="Descendre"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openEdit(idx)}
                  className="p-1 rounded hover:bg-white/10 text-[var(--k-text-secondary)]"
                  aria-label="Modifier"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {deleteConfirmIdx === idx ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(idx)}
                      className="text-[10px] px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                    >
                      {t('common.confirm') || 'Confirmer'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmIdx(null)}
                      className="text-[10px] px-2 py-1 rounded bg-slate-600 text-white hover:bg-slate-700"
                    >
                      {t('common.cancel') || 'Annuler'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmIdx(idx)}
                    className="p-1 rounded hover:bg-red-100 text-red-500"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editIndex !== null
          ? (t('admin.settingsPage.navEditor.editItem') || 'Modifier l\'item')
          : (t('admin.settingsPage.navEditor.addItem') || 'Ajouter un item')
        }
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel') || 'Annuler'}
            </Button>
            <Button variant="primary" onClick={handleSaveItem}>
              {t('common.save') || 'Sauvegarder'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.settingsPage.navEditor.label') || 'Libelle'}>
            <Input
              value={formData.label}
              onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
              placeholder="Ex: Boutique, Blog, Contact..."
            />
          </FormField>

          <FormField label={t('admin.settingsPage.navEditor.type') || 'Type'}>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'link' | 'dropdown' }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="link">{t('admin.settingsPage.navEditor.typeLink') || 'Lien direct'}</option>
              <option value="dropdown">{t('admin.settingsPage.navEditor.typeDropdown') || 'Menu deroulant'}</option>
            </select>
          </FormField>

          <FormField label={t('admin.settingsPage.navEditor.page') || 'Page'}>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
            >
              <option value="">{t('admin.settingsPage.navEditor.selectPage') || '-- Selectionner une page --'}</option>
              {PRESET_PAGES.map((p) => (
                <option key={p.href || '__custom'} value={p.href}>
                  {p.label} {p.href ? `(${p.href})` : ''}
                </option>
              ))}
            </select>
            <Input
              value={formData.href}
              onChange={(e) => setFormData(prev => ({ ...prev, href: e.target.value }))}
              placeholder="/chemin-personnalise"
            />
          </FormField>

          {formData.type === 'dropdown' && (
            <div className="border border-[var(--k-border-subtle)] rounded-lg p-4 bg-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-[var(--k-text-primary)]">
                  {t('admin.settingsPage.navEditor.subItems') || 'Sous-items'}
                </span>
                <Button variant="ghost" size="sm" icon={Plus} onClick={addSubItem}>
                  {t('admin.settingsPage.navEditor.addSubItem') || 'Ajouter'}
                </Button>
              </div>
              {(!formData.children || formData.children.length === 0) && (
                <p className="text-xs text-[var(--k-text-muted)] text-center py-3">
                  {t('admin.settingsPage.navEditor.noSubItems') || 'Aucun sous-item. Cliquez sur "Ajouter" pour commencer.'}
                </p>
              )}
              <div className="space-y-2">
                {(formData.children || []).map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-[var(--k-text-muted)] flex-shrink-0" />
                    <Input
                      value={sub.label}
                      onChange={(e) => updateSubItem(idx, 'label', e.target.value)}
                      placeholder="Libelle"
                      className="flex-1"
                    />
                    <Input
                      value={sub.href}
                      onChange={(e) => updateSubItem(idx, 'href', e.target.value)}
                      placeholder="/url"
                      className="flex-1"
                    />
                    <button
                      onClick={() => removeSubItem(idx)}
                      className="p-1 rounded hover:bg-red-100 text-red-500 flex-shrink-0"
                      aria-label="Supprimer sous-item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FOOTER NAV EDITOR
// ═══════════════════════════════════════════════════════════════

interface FooterNavEditorProps {
  columns: FooterColumn[];
  onChange: (columns: FooterColumn[]) => void;
}

export function FooterNavEditor({ columns, onChange }: FooterNavEditorProps) {
  const { t } = useI18n();
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [editColumnIdx, setEditColumnIdx] = useState<number | null>(null);
  const [columnTitle, setColumnTitle] = useState('');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkTargetCol, setLinkTargetCol] = useState<number>(0);
  const [editLinkIdx, setEditLinkIdx] = useState<number | null>(null);
  const [linkLabel, setLinkLabel] = useState('');
  const [linkHref, setLinkHref] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'column' | 'link'; colIdx: number; linkIdx?: number } | null>(null);

  // Column management
  const openAddColumn = useCallback(() => {
    setEditColumnIdx(null);
    setColumnTitle('');
    setColumnModalOpen(true);
  }, []);

  const openEditColumn = useCallback((idx: number) => {
    setEditColumnIdx(idx);
    setColumnTitle(columns[idx].title);
    setColumnModalOpen(true);
  }, [columns]);

  const saveColumn = useCallback(() => {
    if (!columnTitle.trim()) return;
    const updated = [...columns];
    if (editColumnIdx !== null) {
      updated[editColumnIdx] = { ...updated[editColumnIdx], title: columnTitle.trim() };
    } else {
      updated.push({ title: columnTitle.trim(), links: [] });
    }
    onChange(updated);
    setColumnModalOpen(false);
  }, [columnTitle, editColumnIdx, columns, onChange]);

  const deleteColumn = useCallback((idx: number) => {
    onChange(columns.filter((_, i) => i !== idx));
    setDeleteConfirm(null);
  }, [columns, onChange]);

  const moveColumn = useCallback((idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= columns.length) return;
    const updated = [...columns];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    onChange(updated);
  }, [columns, onChange]);

  // Link management
  const openAddLink = useCallback((colIdx: number) => {
    setLinkTargetCol(colIdx);
    setEditLinkIdx(null);
    setLinkLabel('');
    setLinkHref('');
    setLinkModalOpen(true);
  }, []);

  const openEditLink = useCallback((colIdx: number, linkIdx: number) => {
    setLinkTargetCol(colIdx);
    setEditLinkIdx(linkIdx);
    setLinkLabel(columns[colIdx].links[linkIdx].label);
    setLinkHref(columns[colIdx].links[linkIdx].href);
    setLinkModalOpen(true);
  }, [columns]);

  const saveLink = useCallback(() => {
    if (!linkLabel.trim() || !linkHref.trim()) return;
    const updated = [...columns];
    const col = { ...updated[linkTargetCol], links: [...updated[linkTargetCol].links] };
    if (editLinkIdx !== null) {
      col.links[editLinkIdx] = { label: linkLabel.trim(), href: linkHref.trim() };
    } else {
      col.links.push({ label: linkLabel.trim(), href: linkHref.trim() });
    }
    updated[linkTargetCol] = col;
    onChange(updated);
    setLinkModalOpen(false);
  }, [linkLabel, linkHref, linkTargetCol, editLinkIdx, columns, onChange]);

  const deleteLink = useCallback((colIdx: number, linkIdx: number) => {
    const updated = [...columns];
    updated[colIdx] = {
      ...updated[colIdx],
      links: updated[colIdx].links.filter((_, i) => i !== linkIdx),
    };
    onChange(updated);
    setDeleteConfirm(null);
  }, [columns, onChange]);

  const moveLinkInColumn = useCallback((colIdx: number, linkIdx: number, dir: -1 | 1) => {
    const newIdx = linkIdx + dir;
    if (newIdx < 0 || newIdx >= columns[colIdx].links.length) return;
    const updated = [...columns];
    const links = [...updated[colIdx].links];
    [links[linkIdx], links[newIdx]] = [links[newIdx], links[linkIdx]];
    updated[colIdx] = { ...updated[colIdx], links };
    onChange(updated);
  }, [columns, onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layout className="w-5 h-5 text-[var(--k-text-secondary)]" />
          <h4 className="text-base font-semibold text-[var(--k-text-primary)]">
            {t('admin.settingsPage.navEditor.footerTitle') || 'Navigation pied de page'}
          </h4>
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={openAddColumn}>
          {t('admin.settingsPage.navEditor.addColumn') || 'Ajouter une colonne'}
        </Button>
      </div>

      {columns.length === 0 ? (
        <div className="text-center py-8 text-[var(--k-text-muted)] text-sm border border-dashed border-[var(--k-border-subtle)] rounded-lg">
          {t('admin.settingsPage.navEditor.noFooterColumns') || 'Aucune colonne. Cliquez sur "Ajouter une colonne" pour commencer.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {columns.map((col, colIdx) => (
            <div
              key={colIdx}
              className="border border-[var(--k-border-subtle)] rounded-lg bg-white/5 overflow-hidden"
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3 bg-white/5 border-b border-[var(--k-border-subtle)]">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-[var(--k-text-primary)]">{col.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600">{col.links.length} liens</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveColumn(colIdx, -1)}
                    disabled={colIdx === 0}
                    className="p-1 rounded hover:bg-white/10 text-[var(--k-text-muted)] disabled:opacity-30"
                    aria-label="Monter colonne"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveColumn(colIdx, 1)}
                    disabled={colIdx === columns.length - 1}
                    className="p-1 rounded hover:bg-white/10 text-[var(--k-text-muted)] disabled:opacity-30"
                    aria-label="Descendre colonne"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => openEditColumn(colIdx)}
                    className="p-1 rounded hover:bg-white/10 text-[var(--k-text-secondary)]"
                    aria-label="Modifier colonne"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {deleteConfirm?.type === 'column' && deleteConfirm.colIdx === colIdx ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => deleteColumn(colIdx)}
                        className="text-[10px] px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-[10px] px-2 py-1 rounded bg-slate-600 text-white hover:bg-slate-700"
                      >
                        Non
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm({ type: 'column', colIdx })}
                      className="p-1 rounded hover:bg-red-100 text-red-500"
                      aria-label="Supprimer colonne"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Links list */}
              <div className="p-3 space-y-1.5">
                {col.links.length === 0 && (
                  <p className="text-xs text-[var(--k-text-muted)] text-center py-2">Aucun lien</p>
                )}
                {col.links.map((link, linkIdx) => (
                  <div
                    key={linkIdx}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 group"
                  >
                    <ExternalLink className="w-3 h-3 text-[var(--k-text-muted)] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-[var(--k-text-primary)] block truncate">{link.label}</span>
                      <span className="text-[10px] text-[var(--k-text-muted)] block truncate">{link.href}</span>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => moveLinkInColumn(colIdx, linkIdx, -1)}
                        disabled={linkIdx === 0}
                        className="p-0.5 rounded hover:bg-white/10 text-[var(--k-text-muted)] disabled:opacity-30"
                        aria-label="Monter lien"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => moveLinkInColumn(colIdx, linkIdx, 1)}
                        disabled={linkIdx === col.links.length - 1}
                        className="p-0.5 rounded hover:bg-white/10 text-[var(--k-text-muted)] disabled:opacity-30"
                        aria-label="Descendre lien"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => openEditLink(colIdx, linkIdx)}
                        className="p-0.5 rounded hover:bg-white/10 text-[var(--k-text-secondary)]"
                        aria-label="Modifier lien"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {deleteConfirm?.type === 'link' && deleteConfirm.colIdx === colIdx && deleteConfirm.linkIdx === linkIdx ? (
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => deleteLink(colIdx, linkIdx)} className="text-[9px] px-1.5 py-0.5 rounded bg-red-600 text-white">OK</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-600 text-white">Non</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm({ type: 'link', colIdx, linkIdx })}
                          className="p-0.5 rounded hover:bg-red-100 text-red-500"
                          aria-label="Supprimer lien"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => openAddLink(colIdx)}
                  className="w-full text-xs text-indigo-400 hover:text-indigo-300 py-1.5 border border-dashed border-[var(--k-border-subtle)] rounded hover:border-indigo-500/30 transition-colors text-center"
                >
                  + {t('admin.settingsPage.navEditor.addLink') || 'Ajouter un lien'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Column Title Modal */}
      <Modal
        isOpen={columnModalOpen}
        onClose={() => setColumnModalOpen(false)}
        title={editColumnIdx !== null
          ? (t('admin.settingsPage.navEditor.editColumn') || 'Modifier la colonne')
          : (t('admin.settingsPage.navEditor.addColumn') || 'Ajouter une colonne')
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setColumnModalOpen(false)}>
              {t('common.cancel') || 'Annuler'}
            </Button>
            <Button variant="primary" onClick={saveColumn}>
              {t('common.save') || 'Sauvegarder'}
            </Button>
          </>
        }
      >
        <FormField label={t('admin.settingsPage.navEditor.columnTitle') || 'Titre de la colonne'}>
          <Input
            value={columnTitle}
            onChange={(e) => setColumnTitle(e.target.value)}
            placeholder="Ex: Entreprise, Ressources, Legal..."
            autoFocus
          />
        </FormField>
      </Modal>

      {/* Link Modal */}
      <Modal
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        title={editLinkIdx !== null
          ? (t('admin.settingsPage.navEditor.editLink') || 'Modifier le lien')
          : (t('admin.settingsPage.navEditor.addLink') || 'Ajouter un lien')
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLinkModalOpen(false)}>
              {t('common.cancel') || 'Annuler'}
            </Button>
            <Button variant="primary" onClick={saveLink}>
              {t('common.save') || 'Sauvegarder'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.settingsPage.navEditor.linkLabel') || 'Libelle'}>
            <Input
              value={linkLabel}
              onChange={(e) => setLinkLabel(e.target.value)}
              placeholder="Ex: A propos, FAQ, Contact..."
              autoFocus
            />
          </FormField>
          <FormField label={t('admin.settingsPage.navEditor.linkUrl') || 'URL'}>
            <select
              value={PRESET_PAGES.find(p => p.href === linkHref) ? linkHref : ''}
              onChange={(e) => {
                if (e.target.value) setLinkHref(e.target.value);
                else setLinkHref('');
              }}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
            >
              <option value="">URL personnalisee</option>
              {PRESET_PAGES.filter(p => p.href).map((p) => (
                <option key={p.href} value={p.href}>{p.label} ({p.href})</option>
              ))}
            </select>
            <Input
              value={linkHref}
              onChange={(e) => setLinkHref(e.target.value)}
              placeholder="/chemin"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRUST BADGES EDITOR
// ═══════════════════════════════════════════════════════════════

interface TrustBadgesEditorProps {
  badges: TrustBadge[];
  onChange: (badges: TrustBadge[]) => void;
}

export function TrustBadgesEditor({ badges, onChange }: TrustBadgesEditorProps) {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [badgeIcon, setBadgeIcon] = useState('');
  const [badgeLabel, setBadgeLabel] = useState('');
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null);

  const openAdd = useCallback(() => {
    setEditIdx(null);
    setBadgeIcon('');
    setBadgeLabel('');
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((idx: number) => {
    setEditIdx(idx);
    setBadgeIcon(badges[idx].icon);
    setBadgeLabel(badges[idx].label);
    setModalOpen(true);
  }, [badges]);

  const handleSave = useCallback(() => {
    if (!badgeIcon.trim() || !badgeLabel.trim()) return;
    const updated = [...badges];
    if (editIdx !== null) {
      updated[editIdx] = { icon: badgeIcon.trim(), label: badgeLabel.trim() };
    } else {
      updated.push({ icon: badgeIcon.trim(), label: badgeLabel.trim() });
    }
    onChange(updated);
    setModalOpen(false);
  }, [badgeIcon, badgeLabel, editIdx, badges, onChange]);

  const handleDelete = useCallback((idx: number) => {
    onChange(badges.filter((_, i) => i !== idx));
    setDeleteConfirmIdx(null);
  }, [badges, onChange]);

  const moveBadge = useCallback((idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= badges.length) return;
    const updated = [...badges];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    onChange(updated);
  }, [badges, onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--k-text-secondary)]" />
          <h4 className="text-base font-semibold text-[var(--k-text-primary)]">
            {t('admin.settingsPage.navEditor.trustBadgesTitle') || 'Badges de confiance'}
          </h4>
        </div>
        <Button variant="primary" size="sm" icon={Plus} onClick={openAdd}>
          {t('admin.settingsPage.navEditor.addBadge') || 'Ajouter un badge'}
        </Button>
      </div>

      {badges.length === 0 ? (
        <div className="text-center py-8 text-[var(--k-text-muted)] text-sm border border-dashed border-[var(--k-border-subtle)] rounded-lg">
          {t('admin.settingsPage.navEditor.noBadges') || 'Aucun badge de confiance. Cliquez sur "Ajouter un badge" pour commencer.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {badges.map((badge, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-[var(--k-border-subtle)] hover:border-indigo-500/30 transition-colors group"
            >
              <span className="text-2xl flex-shrink-0">{badge.icon}</span>
              <span className="text-sm text-[var(--k-text-primary)] flex-1 truncate">{badge.label}</span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => moveBadge(idx, -1)}
                  disabled={idx === 0}
                  className="p-0.5 rounded hover:bg-white/10 text-[var(--k-text-muted)] disabled:opacity-30"
                  aria-label="Monter"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => moveBadge(idx, 1)}
                  disabled={idx === badges.length - 1}
                  className="p-0.5 rounded hover:bg-white/10 text-[var(--k-text-muted)] disabled:opacity-30"
                  aria-label="Descendre"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => openEdit(idx)}
                  className="p-0.5 rounded hover:bg-white/10 text-[var(--k-text-secondary)]"
                  aria-label="Modifier"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {deleteConfirmIdx === idx ? (
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => handleDelete(idx)} className="text-[9px] px-1.5 py-0.5 rounded bg-red-600 text-white">OK</button>
                    <button onClick={() => setDeleteConfirmIdx(null)} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-600 text-white">Non</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirmIdx(idx)}
                    className="p-0.5 rounded hover:bg-red-100 text-red-500"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Badge Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editIdx !== null
          ? (t('admin.settingsPage.navEditor.editBadge') || 'Modifier le badge')
          : (t('admin.settingsPage.navEditor.addBadge') || 'Ajouter un badge')
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              {t('common.cancel') || 'Annuler'}
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {t('common.save') || 'Sauvegarder'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.settingsPage.navEditor.badgeIcon') || 'Icone (emoji ou texte)'}>
            <Input
              value={badgeIcon}
              onChange={(e) => setBadgeIcon(e.target.value)}
              placeholder="Ex: \u{1F6E1}\uFE0F, \u2705, \u{1F512}..."
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {BADGE_ICON_PRESETS.map((preset) => (
                <button
                  key={preset.icon}
                  type="button"
                  onClick={() => setBadgeIcon(preset.icon)}
                  className={`text-xl p-1.5 rounded border transition-colors ${
                    badgeIcon === preset.icon
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-transparent hover:border-slate-300 hover:bg-white/10'
                  }`}
                  title={preset.label}
                >
                  {preset.icon}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label={t('admin.settingsPage.navEditor.badgeLabel') || 'Libelle'}>
            <Input
              value={badgeLabel}
              onChange={(e) => setBadgeLabel(e.target.value)}
              placeholder="Ex: Paiement securise, Livraison gratuite..."
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FOOTER CONTENT EDITOR
// ═══════════════════════════════════════════════════════════════

interface FooterContentEditorProps {
  companyDescription: string;
  disclaimerContent: string;
  onChangeDescription: (val: string) => void;
  onChangeDisclaimer: (val: string) => void;
}

export function FooterContentEditor({
  companyDescription,
  disclaimerContent,
  onChangeDescription,
  onChangeDisclaimer,
}: FooterContentEditorProps) {
  const { t } = useI18n();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-[var(--k-text-secondary)]" />
        <h4 className="text-base font-semibold text-[var(--k-text-primary)]">
          {t('admin.settingsPage.navEditor.footerContentTitle') || 'Contenu du pied de page'}
        </h4>
      </div>

      <div className="space-y-6">
        <FormField
          label={t('admin.settingsPage.navEditor.companyDescription') || 'Description de l\'entreprise'}
          hint={t('admin.settingsPage.navEditor.companyDescriptionHint') || 'Texte affiche dans le pied de page a cote du logo.'}
        >
          <Textarea
            value={companyDescription}
            onChange={(e) => onChangeDescription(e.target.value)}
            placeholder="Votre entreprise offre des formations professionnelles de qualite..."
            rows={3}
          />
        </FormField>

        <FormField
          label={t('admin.settingsPage.navEditor.disclaimerContent') || 'Avertissement legal (disclaimer)'}
          hint={t('admin.settingsPage.navEditor.disclaimerContentHint') || 'Texte legal affiche en bas de page. Peut contenir des mentions de sante, reglementaires, etc.'}
        >
          <Textarea
            value={disclaimerContent}
            onChange={(e) => onChangeDisclaimer(e.target.value)}
            placeholder="Les produits presentes sur ce site ne sont pas destines a diagnostiquer, traiter, guerir ou prevenir une maladie..."
            rows={4}
          />
        </FormField>
      </div>
    </div>
  );
}
