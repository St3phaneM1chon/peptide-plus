'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, HelpCircle, Pencil, Trash2, ExternalLink, Eye, EyeOff, Calendar, Clock, ArrowRight, FileSearch } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { EmptyState } from '@/components/admin/EmptyState';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { FilterBar } from '@/components/admin/FilterBar';
import { FormField, Input, Textarea } from '@/components/admin/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  template: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  translations: { locale: string }[];
}

// Content scheduling types
interface ScheduledContent {
  id: string;
  contentId: string;
  contentType: 'page' | 'faq';
  title: string;
  action: 'publish' | 'unpublish';
  scheduledAt: string;
  status: 'scheduled' | 'executed' | 'cancelled';
}

type ContentStatus = 'draft' | 'review' | 'scheduled' | 'published';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isPublished: boolean;
  updatedAt: string;
  translations: { locale: string }[];
}

type Tab = 'pages' | 'faq';

function getFaqCategories(t: (key: string) => string) {
  return [
    { value: 'general', label: t('admin.content.faqCategoryGeneral') },
    { value: 'shipping', label: t('admin.content.faqCategoryShipping') },
    { value: 'payment', label: t('admin.content.faqCategoryPayment') },
    { value: 'products', label: t('admin.content.faqCategoryProducts') },
    { value: 'returns', label: t('admin.content.faqCategoryReturns') },
    { value: 'account', label: t('admin.content.faqCategoryAccount') },
  ];
}

export default function ContenuPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>('pages');
  const [pages, setPages] = useState<Page[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Page modal
  const [pageModal, setPageModal] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [pageForm, setPageForm] = useState({
    title: '', slug: '', content: '', excerpt: '', metaTitle: '', metaDescription: '', template: 'default', isPublished: false,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // UX FIX: ConfirmDialog state for delete actions
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; type: 'page' | 'faq' } | null>(null);

  // Scheduling state
  const [scheduledItems, setScheduledItems] = useState<ScheduledContent[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<{ id: string; type: 'page' | 'faq'; title: string } | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ action: 'publish' as 'publish' | 'unpublish', scheduledAt: '' });
  // Preview state
  const [previewPageId, setPreviewPageId] = useState<string | null>(null);

  // FAQ modal
  const [faqModal, setFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [faqForm, setFaqForm] = useState({
    question: '', answer: '', category: 'general', sortOrder: 0, isPublished: true,
  });

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/content/pages');
      const data = await res.json();
      setPages(data.pages || []);
    } catch (err) {
      console.error('Error fetching pages:', err);
      toast.error(t('common.error'));
      setPages([]);
    }
  }, []);

  const fetchFaqs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/content/faqs');
      const data = await res.json();
      setFaqs(data.faqs || []);
    } catch (err) {
      console.error('Error fetching FAQs:', err);
      toast.error(t('common.error'));
      setFaqs([]);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchPages(), fetchFaqs()]).finally(() => setLoading(false));
  }, [fetchPages, fetchFaqs]);

  // Page CRUD
  const openPageModal = (page?: Page) => {
    if (page) {
      setEditingPage(page);
      setPageForm({
        title: page.title, slug: page.slug, content: page.content,
        excerpt: page.excerpt || '', metaTitle: page.metaTitle || '',
        metaDescription: page.metaDescription || '', template: page.template,
        isPublished: page.isPublished,
      });
    } else {
      setEditingPage(null);
      setPageForm({ title: '', slug: '', content: '', excerpt: '', metaTitle: '', metaDescription: '', template: 'default', isPublished: false });
    }
    setPageModal(true);
  };

  const savePage = async () => {
    setSaving(true);
    try {
      const method = editingPage ? 'PUT' : 'POST';
      const body = editingPage ? { id: editingPage.id, ...pageForm } : pageForm;

      const res = await fetch('/api/admin/content/pages', {
        method,
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setPageModal(false);
        setEditingPage(null);
        fetchPages();
      } else {
        const err = await res.json();
        toast.error(err.error || t('admin.content.errorSavingPage'));
      }
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setSaving(false);
    }
  };

  const deletePage = async (id: string) => {
    setConfirmDelete(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/content/pages?id=${id}`, { method: 'DELETE', headers: addCSRFHeader() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.deleteFailed'));
        return;
      }
      toast.success(t('admin.content.pageDeleted') || 'Page deleted');
      fetchPages();
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setDeletingId(null);
    }
  };

  const togglePagePublished = async (page: Page) => {
    try {
      const res = await fetch('/api/admin/content/pages', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: page.id, isPublished: !page.isPublished }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        return;
      }
      fetchPages();
    } catch {
      toast.error(t('common.networkError'));
    }
  };

  // FAQ CRUD
  const openFaqModal = (faq?: FAQItem) => {
    if (faq) {
      setEditingFaq(faq);
      setFaqForm({
        question: faq.question, answer: faq.answer, category: faq.category,
        sortOrder: faq.sortOrder, isPublished: faq.isPublished,
      });
    } else {
      setEditingFaq(null);
      setFaqForm({ question: '', answer: '', category: 'general', sortOrder: 0, isPublished: true });
    }
    setFaqModal(true);
  };

  const saveFaq = async () => {
    setSaving(true);
    try {
      const method = editingFaq ? 'PUT' : 'POST';
      const body = editingFaq ? { id: editingFaq.id, ...faqForm } : faqForm;

      const res = await fetch('/api/admin/content/faqs', {
        method,
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setFaqModal(false);
        setEditingFaq(null);
        fetchFaqs();
      } else {
        const err = await res.json();
        toast.error(err.error || t('admin.content.errorSavingFaq'));
      }
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setSaving(false);
    }
  };

  const deleteFaq = async (id: string) => {
    setConfirmDelete(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/content/faqs?id=${id}`, { method: 'DELETE', headers: addCSRFHeader() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.deleteFailed'));
        return;
      }
      toast.success(t('admin.content.faqDeleted') || 'FAQ deleted');
      fetchFaqs();
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleFaqPublished = async (faq: FAQItem) => {
    try {
      const res = await fetch('/api/admin/content/faqs', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: faq.id, isPublished: !faq.isPublished }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        return;
      }
      toast.success(faq.isPublished
        ? (t('admin.content.faqUnpublished') || 'FAQ unpublished')
        : (t('admin.content.faqPublished') || 'FAQ published'));
      fetchFaqs();
    } catch {
      toast.error(t('common.networkError'));
    }
  };

  // Content scheduling functions
  const openScheduleModal = (id: string, type: 'page' | 'faq', title: string) => {
    setScheduleTarget({ id, type, title });
    setScheduleForm({ action: 'publish', scheduledAt: '' });
    setShowScheduleModal(true);
  };

  const saveSchedule = async () => {
    if (!scheduleTarget || !scheduleForm.scheduledAt) {
      toast.error('Veuillez sélectionner une date');
      return;
    }
    // Save scheduled content (local state simulation - connect to API when backend ready)
    const newSchedule: ScheduledContent = {
      id: `sched-${Date.now()}`,
      contentId: scheduleTarget.id,
      contentType: scheduleTarget.type,
      title: scheduleTarget.title,
      action: scheduleForm.action,
      scheduledAt: scheduleForm.scheduledAt,
      status: 'scheduled',
    };
    setScheduledItems(prev => [...prev, newSchedule]);
    setShowScheduleModal(false);
    toast.success(`Planifié: "${scheduleTarget.title}" sera ${scheduleForm.action === 'publish' ? 'publié' : 'dépublié'} le ${new Date(scheduleForm.scheduledAt).toLocaleDateString(locale)}`);
  };

  const cancelSchedule = (schedId: string) => {
    setScheduledItems(prev => prev.map(s => s.id === schedId ? { ...s, status: 'cancelled' as const } : s));
    toast.success('Planification annulée');
  };

  // Get content status for timeline display
  const getContentStatus = (page: Page): ContentStatus => {
    if (page.isPublished && page.publishedAt) return 'published';
    const hasSchedule = scheduledItems.find(s => s.contentId === page.id && s.status === 'scheduled');
    if (hasSchedule) return 'scheduled';
    if (page.content && page.content.length > 100) return 'review';
    return 'draft';
  };

  // Ribbon action handlers
  const handleRibbonSave = useCallback(() => {
    if (activeTab === 'pages') {
      savePage();
    } else {
      saveFaq();
    }
  }, [activeTab]);

  const handleRibbonResetDefaults = useCallback(() => {
    // Reload all content from server
    setLoading(true);
    Promise.all([fetchPages(), fetchFaqs()]).finally(() => setLoading(false));
    toast.success(t('admin.content.contentReloaded') || 'Content reloaded from server');
  }, [fetchPages, fetchFaqs, t]);

  const handleRibbonImportConfig = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        let created = 0;
        if (activeTab === 'pages' && Array.isArray(imported.pages)) {
          for (const p of imported.pages) {
            try {
              const res = await fetch('/api/admin/content/pages', {
                method: 'POST',
                headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(p),
              });
              if (res.ok) created++;
            } catch { /* skip */ }
          }
          fetchPages();
          toast.success(`${created} ${t('admin.content.tabPages') || 'pages'} ${t('admin.content.imported') || 'imported'}`);
        } else if (activeTab === 'faq' && Array.isArray(imported.faqs)) {
          for (const f of imported.faqs) {
            try {
              const res = await fetch('/api/admin/content/faqs', {
                method: 'POST',
                headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(f),
              });
              if (res.ok) created++;
            } catch { /* skip */ }
          }
          fetchFaqs();
          toast.success(`${created} ${t('admin.content.tabFaq') || 'FAQs'} ${t('admin.content.imported') || 'imported'}`);
        } else {
          toast.error(t('admin.content.importError') || 'Invalid format');
        }
      } catch {
        toast.error(t('admin.content.importError') || 'Invalid JSON file');
      }
    };
    input.click();
  }, [activeTab, fetchPages, fetchFaqs, t]);

  const handleRibbonExportConfig = useCallback(() => {
    if (activeTab === 'pages') {
      if (pages.length === 0) {
        toast.info(t('admin.content.noPagesTitle') || 'No pages to export');
        return;
      }
      const headers = [
        t('admin.content.colPage') || 'Title',
        t('admin.content.colUrl') || 'Slug',
        t('admin.content.fieldExcerpt') || 'Excerpt',
        t('admin.content.fieldTemplate') || 'Template',
        t('admin.content.colStatus') || 'Status',
        t('admin.content.colUpdated') || 'Updated',
      ];
      const rows = pages.map(p => [
        p.title, `/${p.slug}`, p.excerpt || '', p.template,
        p.isPublished ? 'Published' : 'Draft',
        new Date(p.updatedAt).toLocaleDateString(locale),
      ]);
      const bom = '\uFEFF';
      const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `pages-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    } else {
      if (faqs.length === 0) {
        toast.info(t('admin.content.noFaqsTitle') || 'No FAQs to export');
        return;
      }
      const headers = [
        t('admin.content.fieldCategory') || 'Category',
        t('admin.content.fieldQuestion') || 'Question',
        t('admin.content.fieldAnswer') || 'Answer',
        t('admin.content.fieldSortOrder') || 'Order',
        t('admin.content.colStatus') || 'Status',
      ];
      const rows = faqs.map(f => [
        f.category, f.question, f.answer, f.sortOrder,
        f.isPublished ? 'Published' : 'Draft',
      ]);
      const bom = '\uFEFF';
      const csv = bom + [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `faqs-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
    toast.success(t('common.exported') || 'Exported');
  }, [activeTab, pages, faqs, t, locale]);

  const handleRibbonTest = useCallback(() => {
    // Show content stats summary
    const publishedPages = pages.filter(p => p.isPublished).length;
    const publishedFaqs = faqs.filter(f => f.isPublished).length;
    const categories = [...new Set(faqs.map(f => f.category))].length;
    toast.success(
      `${t('admin.content.tabPages') || 'Pages'}: ${publishedPages}/${pages.length} ${t('admin.content.published') || 'published'} | ` +
      `${t('admin.content.tabFaq') || 'FAQs'}: ${publishedFaqs}/${faqs.length} ${t('admin.content.published') || 'published'} (${categories} ${t('admin.content.fieldCategory') || 'categories'})`,
      { duration: 6000 }
    );
  }, [pages, faqs, t]);

  useRibbonAction('save', handleRibbonSave);
  useRibbonAction('resetDefaults', handleRibbonResetDefaults);
  useRibbonAction('importConfig', handleRibbonImportConfig);
  useRibbonAction('exportConfig', handleRibbonExportConfig);
  useRibbonAction('test', handleRibbonTest);

  // Filtered data
  const filteredPages = pages.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase())
  );

  const filteredFaqs = faqs.filter(f =>
    !search || f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase())
  );

  const faqCategories = [...new Set(filteredFaqs.map(f => f.category))].sort();

  // Auto-generate slug from title
  const autoSlug = (title: string) => {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  return (
    <div>
      <PageHeader
        title={t('admin.content.title')}
        subtitle={t('admin.content.subtitle', { pages: String(pages.length), faqs: String(faqs.length) })}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => activeTab === 'pages' ? openPageModal() : openFaqModal()}
          >
            {activeTab === 'pages' ? t('admin.content.newPage') : t('admin.content.newFaq')}
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('pages')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${activeTab === 'pages' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <FileText className="w-4 h-4" />
          {t('admin.content.tabPages', { count: String(pages.length) })}
        </button>
        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${activeTab === 'faq' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <HelpCircle className="w-4 h-4" />
          {t('admin.content.tabFaq', { count: String(faqs.length) })}
        </button>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={activeTab === 'pages' ? t('admin.content.searchPages') : t('admin.content.searchFaqs')}
      />

      {/* Content Scheduling Section */}
      {scheduledItems.filter(s => s.status === 'scheduled').length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
          <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4" />
            Contenus planifiés ({scheduledItems.filter(s => s.status === 'scheduled').length})
          </h3>
          <div className="space-y-2">
            {scheduledItems.filter(s => s.status === 'scheduled').map(sched => (
              <div key={sched.id} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-amber-100">
                <div className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                  sched.action === 'publish' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {sched.action === 'publish' ? 'Publication' : 'Dépublication'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{sched.title}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(sched.scheduledAt).toLocaleDateString(locale)} à {new Date(sched.scheduledAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase font-medium">
                  {sched.contentType}
                </span>
                <button
                  onClick={() => cancelSchedule(sched.id)}
                  className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded"
                >
                  Annuler
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
          <span className="sr-only">Loading...</span>
        </div>
      ) : activeTab === 'pages' ? (
        /* Pages Tab */
        filteredPages.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={t('admin.content.noPagesTitle')}
            description={t('admin.content.noPagesDescription')}
            action={<Button variant="primary" icon={Plus} onClick={() => openPageModal()}>{t('admin.content.createPage')}</Button>}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase tracking-wider">{t('admin.content.colPage')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase tracking-wider">{t('admin.content.colUrl')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase tracking-wider">{t('admin.content.colUpdated')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Parcours</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">{t('admin.content.colStatus')}</th>
                  <th className="px-4 py-3 text-end text-xs font-medium text-slate-500 uppercase tracking-wider">{t('admin.content.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPages.map((page) => (
                  <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{page.title}</p>
                      {page.translations.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {page.translations.length > 1
                            ? t('admin.content.translationCountPlural', { count: String(page.translations.length) })
                            : t('admin.content.translationCount', { count: String(page.translations.length) })}
                        </p>
                      )}
                      {/* Rich preview of scheduled content */}
                      {scheduledItems.find(s => s.contentId === page.id && s.status === 'scheduled') && (
                        <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          Planifié: {new Date(scheduledItems.find(s => s.contentId === page.id && s.status === 'scheduled')!.scheduledAt).toLocaleDateString(locale)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">/{page.slug}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(page.updatedAt).toLocaleDateString(locale)}
                    </td>
                    {/* Content Status Timeline */}
                    <td className="px-4 py-3">
                      {(() => {
                        const status = getContentStatus(page);
                        const steps: { key: ContentStatus; label: string }[] = [
                          { key: 'draft', label: 'Brouillon' },
                          { key: 'review', label: 'Revue' },
                          { key: 'scheduled', label: 'Planifié' },
                          { key: 'published', label: 'Publié' },
                        ];
                        const currentIdx = steps.findIndex(s => s.key === status);
                        return (
                          <div className="flex items-center gap-0.5 justify-center">
                            {steps.map((step, idx) => (
                              <div key={step.key} className="flex items-center">
                                <div className={`w-2 h-2 rounded-full ${
                                  idx <= currentIdx ? (
                                    step.key === 'published' ? 'bg-emerald-500' :
                                    step.key === 'scheduled' ? 'bg-amber-500' :
                                    step.key === 'review' ? 'bg-sky-500' : 'bg-slate-400'
                                  ) : 'bg-slate-200'
                                }`} title={step.label} />
                                {idx < steps.length - 1 && (
                                  <div className={`w-3 h-0.5 ${idx < currentIdx ? 'bg-slate-400' : 'bg-slate-200'}`} />
                                )}
                              </div>
                            ))}
                            <span className="ml-1.5 text-[10px] text-slate-500">
                              {steps[currentIdx]?.label || 'Brouillon'}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => togglePagePublished(page)}>
                        <StatusBadge variant={page.isPublished ? 'success' : 'neutral'} dot>
                          {page.isPublished ? t('admin.content.published') : t('admin.content.draft')}
                        </StatusBadge>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openPageModal(page)} />
                        <button
                          onClick={() => openScheduleModal(page.id, 'page', page.title)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50 transition-colors"
                          title="Planifier la publication"
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPreviewPageId(previewPageId === page.id ? null : page.id)}
                          className={`p-1.5 rounded hover:bg-sky-50 transition-colors ${previewPageId === page.id ? 'text-sky-600' : 'text-slate-400 hover:text-sky-600'}`}
                          title="Aperçu enrichi"
                        >
                          <FileSearch className="w-4 h-4" />
                        </button>
                        <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" icon={ExternalLink} />
                        </a>
                        <Button size="sm" variant="ghost" icon={Trash2} disabled={deletingId === page.id} onClick={() => setConfirmDelete({ id: page.id, type: 'page' })} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* FAQ Tab */
        filteredFaqs.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title={t('admin.content.noFaqsTitle')}
            description={t('admin.content.noFaqsDescription')}
            action={<Button variant="primary" icon={Plus} onClick={() => openFaqModal()}>{t('admin.content.createFaq')}</Button>}
          />
        ) : (
          <div className="space-y-4">
            {faqCategories.map((category) => (
              <div key={category} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-sm font-semibold text-slate-700 capitalize">{category}</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredFaqs.filter(f => f.category === category).map((faq) => (
                    <div key={faq.id} className={`p-4 ${!faq.isPublished ? 'opacity-60' : ''}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{faq.question}</p>
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{faq.answer}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button onClick={() => toggleFaqPublished(faq)} title={faq.isPublished ? t('admin.content.unpublish') : t('admin.content.publish')}>
                            {faq.isPublished ? (
                              <Eye className="w-4 h-4 text-emerald-500" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openFaqModal(faq)} />
                          <Button size="sm" variant="ghost" icon={Trash2} disabled={deletingId === faq.id} onClick={() => setConfirmDelete({ id: faq.id, type: 'faq' })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Page Modal */}
      <Modal
        isOpen={pageModal}
        onClose={() => setPageModal(false)}
        title={editingPage ? t('admin.content.editPageTitle', { title: editingPage.title }) : t('admin.content.newPageTitle')}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPageModal(false)}>{t('admin.content.cancel')}</Button>
            <Button variant="primary" onClick={savePage} loading={saving}>{t('admin.content.savePage')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.content.fieldTitle')} required>
              <Input
                value={pageForm.title}
                onChange={e => {
                  const title = e.target.value;
                  setPageForm(f => ({
                    ...f,
                    title,
                    slug: !editingPage ? autoSlug(title) : f.slug,
                  }));
                }}
                placeholder={t('admin.content.fieldTitlePlaceholder')}
              />
            </FormField>
            <FormField label={t('admin.content.fieldSlug')} required>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-sm">/</span>
                <Input
                  value={pageForm.slug}
                  onChange={e => setPageForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder={t('admin.content.fieldSlugPlaceholder')}
                />
              </div>
            </FormField>
          </div>
          <FormField label={t('admin.content.fieldExcerpt')} hint={t('admin.content.fieldExcerptHint')}>
            <Input
              value={pageForm.excerpt}
              onChange={e => setPageForm(f => ({ ...f, excerpt: e.target.value }))}
              placeholder={t('admin.content.fieldExcerptPlaceholder')}
            />
          </FormField>
          <FormField label={t('admin.content.fieldContent')} required>
            <Textarea
              value={pageForm.content}
              onChange={e => setPageForm(f => ({ ...f, content: e.target.value }))}
              placeholder={t('admin.content.fieldContentPlaceholder')}
              rows={12}
              className="font-mono text-sm"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.content.fieldMetaTitle')} hint={t('admin.content.fieldMetaTitleHint')}>
              <Input
                value={pageForm.metaTitle}
                onChange={e => setPageForm(f => ({ ...f, metaTitle: e.target.value }))}
                placeholder={t('admin.content.fieldMetaTitlePlaceholder')}
              />
            </FormField>
            <FormField label={t('admin.content.fieldTemplate')}>
              <select
                value={pageForm.template}
                onChange={e => setPageForm(f => ({ ...f, template: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="default">{t('admin.content.templateDefault')}</option>
                <option value="full-width">{t('admin.content.templateFullWidth')}</option>
                <option value="sidebar">{t('admin.content.templateSidebar')}</option>
              </select>
            </FormField>
          </div>
          <FormField label={t('admin.content.fieldMetaDescription')} hint={t('admin.content.fieldMetaDescriptionHint')}>
            <Input
              value={pageForm.metaDescription}
              onChange={e => setPageForm(f => ({ ...f, metaDescription: e.target.value }))}
              placeholder={t('admin.content.fieldMetaDescriptionPlaceholder')}
            />
          </FormField>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pageForm.isPublished}
              onChange={e => setPageForm(f => ({ ...f, isPublished: e.target.checked }))}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm text-slate-700">{t('admin.content.publishImmediately')}</span>
          </label>
        </div>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        isOpen={faqModal}
        onClose={() => setFaqModal(false)}
        title={editingFaq ? t('admin.content.editFaqTitle') : t('admin.content.newFaqTitle')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFaqModal(false)}>{t('admin.content.cancel')}</Button>
            <Button variant="primary" onClick={saveFaq} loading={saving}>{t('admin.content.saveFaq')}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.content.fieldCategory')}>
              <select
                value={faqForm.category}
                onChange={e => setFaqForm(f => ({ ...f, category: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {getFaqCategories(t).map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label={t('admin.content.fieldSortOrder')}>
              <Input
                type="number"
                value={faqForm.sortOrder}
                onChange={e => setFaqForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </FormField>
          </div>
          <FormField label={t('admin.content.fieldQuestion')} required>
            <Input
              value={faqForm.question}
              onChange={e => setFaqForm(f => ({ ...f, question: e.target.value }))}
              placeholder={t('admin.content.fieldQuestionPlaceholder')}
            />
          </FormField>
          <FormField label={t('admin.content.fieldAnswer')} required>
            <Textarea
              value={faqForm.answer}
              onChange={e => setFaqForm(f => ({ ...f, answer: e.target.value }))}
              placeholder={t('admin.content.fieldAnswerPlaceholder')}
              rows={6}
            />
          </FormField>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={faqForm.isPublished}
              onChange={e => setFaqForm(f => ({ ...f, isPublished: e.target.checked }))}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm text-slate-700">{t('admin.content.publishedCheckbox')}</span>
          </label>
        </div>
      </Modal>

      {/* Rich Preview Panel */}
      {previewPageId && (() => {
        const p = pages.find(pg => pg.id === previewPageId);
        if (!p) return null;
        const status = getContentStatus(p);
        const schedule = scheduledItems.find(s => s.contentId === p.id && s.status === 'scheduled');
        return (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-sky-500" />
                Aperçu enrichi: {p.title}
              </h3>
              <button onClick={() => setPreviewPageId(null)} className="text-slate-400 hover:text-slate-600 text-xs">
                Fermer
              </button>
            </div>

            {/* Status timeline horizontal */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              {(['draft', 'review', 'scheduled', 'published'] as ContentStatus[]).map((step, idx) => {
                const labels: Record<ContentStatus, string> = { draft: 'Brouillon', review: 'En revue', scheduled: 'Planifié', published: 'Publié' };
                const isActive = step === status;
                const isPast = ['draft', 'review', 'scheduled', 'published'].indexOf(step) <= ['draft', 'review', 'scheduled', 'published'].indexOf(status);
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
                      isActive ? 'bg-sky-100 text-sky-700 ring-1 ring-sky-200' :
                      isPast ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-slate-400'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-sky-500' : isPast ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      {labels[step]}
                    </div>
                    {idx < 3 && <ArrowRight className={`w-3 h-3 ${isPast ? 'text-slate-400' : 'text-slate-200'}`} />}
                  </div>
                );
              })}
            </div>

            {/* Preview content */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">URL</p>
                <code className="text-xs bg-slate-100 px-2 py-1 rounded block">/{p.slug}</code>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Template</p>
                <span className="text-xs text-slate-700">{p.template}</span>
              </div>
              {p.excerpt && (
                <div className="col-span-2">
                  <p className="text-xs font-medium text-slate-500 mb-1">Extrait</p>
                  <p className="text-sm text-slate-700">{p.excerpt}</p>
                </div>
              )}
              {schedule && (
                <div className="col-span-2 bg-amber-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Publication planifiée
                  </p>
                  <p className="text-sm text-amber-600 mt-1">
                    {schedule.action === 'publish' ? 'Publication' : 'Dépublication'} le {new Date(schedule.scheduledAt).toLocaleDateString(locale)} à {new Date(schedule.scheduledAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}
              <div className="col-span-2">
                <p className="text-xs font-medium text-slate-500 mb-1">Contenu ({p.content.length} caractères)</p>
                <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto text-sm text-slate-700 whitespace-pre-wrap">
                  {p.content.substring(0, 500)}{p.content.length > 500 ? '...' : ''}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title={`Planifier: ${scheduleTarget?.title || ''}`}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>Annuler</Button>
            <Button variant="primary" onClick={saveSchedule}>Planifier</Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Action">
            <select
              value={scheduleForm.action}
              onChange={e => setScheduleForm(f => ({ ...f, action: e.target.value as 'publish' | 'unpublish' }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="publish">Publier</option>
              <option value="unpublish">Dépublier</option>
            </select>
          </FormField>
          <FormField label="Date et heure">
            <Input
              type="datetime-local"
              value={scheduleForm.scheduledAt}
              onChange={e => setScheduleForm(f => ({ ...f, scheduledAt: e.target.value }))}
              min={new Date().toISOString().slice(0, 16)}
            />
          </FormField>
          {scheduleForm.scheduledAt && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
              <p className="text-sm text-sky-800">
                <Calendar className="w-4 h-4 inline mr-1" />
                &laquo;{scheduleTarget?.title}&raquo; sera {scheduleForm.action === 'publish' ? 'publié' : 'dépublié'} le{' '}
                <strong>{new Date(scheduleForm.scheduledAt).toLocaleDateString(locale)}</strong> à{' '}
                <strong>{new Date(scheduleForm.scheduledAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</strong>
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── DELETE CONFIRM DIALOG ─────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        title={confirmDelete?.type === 'faq'
          ? (t('admin.content.deleteFaqTitle') || 'Delete FAQ')
          : (t('admin.content.deletePageTitle') || 'Delete Page')}
        message={confirmDelete?.type === 'faq'
          ? (t('admin.content.deleteFaqConfirm') || 'Are you sure you want to delete this FAQ entry? This action cannot be undone.')
          : (t('admin.content.deletePageConfirm') || 'Are you sure you want to delete this page? This action cannot be undone.')}
        variant="danger"
        confirmLabel={t('common.delete') || 'Delete'}
        onConfirm={() => {
          if (confirmDelete) {
            if (confirmDelete.type === 'page') deletePage(confirmDelete.id);
            else deleteFaq(confirmDelete.id);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
