'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Globe, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/i18n/client';
import { PageHeader, Button, Modal, FormField, Input, EmptyState } from '@/components/admin';
import { availableIcons } from '@/lib/admin/icon-resolver';

interface NavSection { id: string; title: string; subtitle?: string | null; icon?: string | null; railId: string; sortOrder: number; isActive: boolean; subSections: NavSubSection[]; }
interface NavSubSection { id: string; title: string; subtitle?: string | null; icon?: string | null; sectionId: string; sortOrder: number; isActive: boolean; pages: NavPage[]; }
interface NavPage { id: string; title: string; subtitle?: string | null; url: string; icon?: string | null; subSectionId: string; sortOrder: number; isActive: boolean; openInNewTab: boolean; }

type ModalMode = 'section' | 'subsection' | 'page';
type ModalAction = 'create' | 'edit';

export default function NavigateurPage() {
  const { t } = useI18n();
  const [sections, setSections] = useState<NavSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<NavSection | null>(null);
  const [selectedSubSection, setSelectedSubSection] = useState<NavSubSection | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('section');
  const [modalAction, setModalAction] = useState<ModalAction>('create');
  const [editingItem, setEditingItem] = useState<NavSection | NavSubSection | NavPage | null>(null);

  const fetchSections = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/nav-sections');
      if (res.ok) setSections(await res.json());
    } catch { toast.error(t('common.errorOccurred')); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const openCreateModal = (mode: ModalMode) => {
    setModalMode(mode);
    setModalAction('create');
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEditModal = (mode: ModalMode, item: NavSection | NavSubSection | NavPage) => {
    setModalMode(mode);
    setModalAction('edit');
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleSave = async (formData: FormData) => {
    const title = formData.get('title') as string;
    const subtitle = formData.get('subtitle') as string || null;
    const icon = formData.get('icon') as string || null;
    const url = formData.get('url') as string || '';
    const openInNewTab = formData.get('openInNewTab') === 'on';
    const railId = formData.get('railId') as string || 'system';

    try {
      let endpoint = '';
      let body: Record<string, unknown> = {};

      if (modalMode === 'section') {
        endpoint = modalAction === 'edit' ? `/api/admin/nav-sections/${(editingItem as NavSection)?.id}` : '/api/admin/nav-sections';
        body = { title, subtitle, icon, railId, sortOrder: sections.length };
      } else if (modalMode === 'subsection') {
        endpoint = modalAction === 'edit' ? `/api/admin/nav-subsections/${(editingItem as NavSubSection)?.id}` : '/api/admin/nav-subsections';
        body = { title, subtitle, icon, sectionId: selectedSection?.id, sortOrder: selectedSection?.subSections.length ?? 0 };
      } else {
        endpoint = modalAction === 'edit' ? `/api/admin/nav-pages/${(editingItem as NavPage)?.id}` : '/api/admin/nav-pages';
        body = { title, subtitle, icon, url, openInNewTab, subSectionId: selectedSubSection?.id, sortOrder: selectedSubSection?.pages.length ?? 0 };
      }

      const res = await fetch(endpoint, {
        method: modalAction === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(t('common.saved'));
        setModalOpen(false);
        await fetchSections();
      } else {
        const data = await res.json();
        toast.error(data.error?.fieldErrors ? JSON.stringify(data.error.fieldErrors) : t('common.errorOccurred'));
      }
    } catch { toast.error(t('common.errorOccurred')); }
  };

  const handleDelete = async (mode: ModalMode, id: string) => {
    const endpoint = mode === 'section' ? `/api/admin/nav-sections/${id}`
      : mode === 'subsection' ? `/api/admin/nav-subsections/${id}`
      : `/api/admin/nav-pages/${id}`;

    try {
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('common.deleted') || 'Deleted');
        if (mode === 'section') { setSelectedSection(null); setSelectedSubSection(null); }
        if (mode === 'subsection') setSelectedSubSection(null);
        await fetchSections();
      }
    } catch { toast.error(t('common.errorOccurred')); }
  };

  // Keep selections synced after refetch
  useEffect(() => {
    if (selectedSection) {
      const updated = sections.find(s => s.id === selectedSection.id);
      setSelectedSection(updated ?? null);
      if (selectedSubSection && updated) {
        const updatedSub = updated.subSections.find(ss => ss.id === selectedSubSection.id);
        setSelectedSubSection(updatedSub ?? null);
      }
    }
  }, [sections, selectedSection, selectedSubSection]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" /></div>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('admin.webNavigator.title')}
        subtitle={t('admin.webNavigator.subtitle')}
      />

      {/* 3-column editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: '500px' }}>
        {/* Column 1: Sections */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700">{t('admin.webNavigator.sections')}</h3>
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => openCreateModal('section')} />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {sections.map(sec => (
              <button
                key={sec.id}
                onClick={() => { setSelectedSection(sec); setSelectedSubSection(null); }}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                  selectedSection?.id === sec.id ? 'bg-sky-50 border-s-[3px] border-s-sky-600' : ''
                }`}
              >
                <span className="text-sm text-slate-900 truncate">{sec.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEditModal('section', sec); }} className="p-1 hover:bg-slate-200 rounded">
                    <Pencil className="w-3 h-3 text-slate-400" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete('section', sec.id); }} className="p-1 hover:bg-red-100 rounded">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            ))}
            {sections.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">{t('admin.webNavigator.noSections')}</div>
            )}
          </div>
        </div>

        {/* Column 2: Sub-sections */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700">{t('admin.webNavigator.subSections')}</h3>
            {selectedSection && <Button variant="ghost" size="sm" icon={Plus} onClick={() => openCreateModal('subsection')} />}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {(selectedSection?.subSections ?? []).map(sub => (
              <button
                key={sub.id}
                onClick={() => setSelectedSubSection(sub)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                  selectedSubSection?.id === sub.id ? 'bg-sky-50 border-s-[3px] border-s-sky-600' : ''
                }`}
              >
                <span className="text-sm text-slate-900 truncate">{sub.title}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); openEditModal('subsection', sub); }} className="p-1 hover:bg-slate-200 rounded">
                    <Pencil className="w-3 h-3 text-slate-400" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete('subsection', sub.id); }} className="p-1 hover:bg-red-100 rounded">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              </button>
            ))}
            {!selectedSection && <div className="p-6 text-center text-sm text-slate-400">{t('admin.webNavigator.selectSection')}</div>}
            {selectedSection && selectedSection.subSections.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-400">{t('admin.webNavigator.noSubSections')}</div>
            )}
          </div>
        </div>

        {/* Column 3: Pages */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700">{t('admin.webNavigator.pages')}</h3>
            {selectedSubSection && <Button variant="ghost" size="sm" icon={Plus} onClick={() => openCreateModal('page')} />}
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {(selectedSubSection?.pages ?? []).map(page => (
              <div
                key={page.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-900 truncate">{page.title}</div>
                  <div className="text-xs text-slate-400 truncate">{page.url}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEditModal('page', page)} className="p-1 hover:bg-slate-200 rounded">
                    <Pencil className="w-3 h-3 text-slate-400" />
                  </button>
                  <button onClick={() => handleDelete('page', page.id)} className="p-1 hover:bg-red-100 rounded">
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              </div>
            ))}
            {!selectedSubSection && <div className="p-6 text-center text-sm text-slate-400">{t('admin.webNavigator.selectSubSection')}</div>}
            {selectedSubSection && selectedSubSection.pages.length === 0 && (
              <EmptyState icon={Globe} title={t('admin.webNavigator.noPages')} description={t('admin.webNavigator.noPagesDesc')} />
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={`${modalAction === 'edit' ? t('common.edit') : t('common.add')} — ${
          modalMode === 'section' ? t('admin.webNavigator.section')
          : modalMode === 'subsection' ? t('admin.webNavigator.subSection')
          : t('admin.webNavigator.page')
        }`}
        size="md"
      >
        <form
          onSubmit={(e) => { e.preventDefault(); handleSave(new FormData(e.currentTarget)); }}
          className="space-y-4"
        >
          <FormField label={t('admin.webNavigator.fieldTitle')}>
            <Input name="title" required defaultValue={(editingItem as { title?: string })?.title ?? ''} />
          </FormField>
          <FormField label={t('admin.webNavigator.fieldSubtitle')}>
            <Input name="subtitle" defaultValue={(editingItem as { subtitle?: string | null })?.subtitle ?? ''} />
          </FormField>
          <FormField label={t('admin.webNavigator.fieldIcon')}>
            <select name="icon" defaultValue={(editingItem as { icon?: string | null })?.icon ?? ''} className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm">
              <option value="">—</option>
              {availableIcons.map(ic => <option key={ic} value={ic}>{ic}</option>)}
            </select>
          </FormField>
          {modalMode === 'section' && (
            <FormField label="Rail ID">
              <select name="railId" defaultValue={(editingItem as NavSection)?.railId ?? 'system'} className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm">
                {['dashboard','commerce','catalog','marketing','community','loyalty','emails','accounting','system'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </FormField>
          )}
          {modalMode === 'page' && (
            <>
              <FormField label="URL">
                <Input name="url" type="url" required defaultValue={(editingItem as NavPage)?.url ?? ''} placeholder="https://..." />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="openInNewTab" defaultChecked={(editingItem as NavPage)?.openInNewTab ?? false} className="rounded border-slate-300" />
                {t('admin.webNavigator.openInNewTabLabel')}
              </label>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
