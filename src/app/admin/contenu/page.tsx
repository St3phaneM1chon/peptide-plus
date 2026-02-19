'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, HelpCircle, Pencil, Trash2, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { EmptyState } from '@/components/admin/EmptyState';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { FilterBar } from '@/components/admin/FilterBar';
import { FormField, Input, Textarea } from '@/components/admin/FormField';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

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

  // FAQ modal
  const [faqModal, setFaqModal] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);
  const [faqForm, setFaqForm] = useState({
    question: '', answer: '', category: 'general', sortOrder: 0, isPublished: true,
  });

  const fetchPages = useCallback(async () => {
    const res = await fetch('/api/admin/content/pages');
    const data = await res.json();
    setPages(data.pages || []);
  }, []);

  const fetchFaqs = useCallback(async () => {
    const res = await fetch('/api/admin/content/faqs');
    const data = await res.json();
    setFaqs(data.faqs || []);
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
    const method = editingPage ? 'PUT' : 'POST';
    const body = editingPage ? { id: editingPage.id, ...pageForm } : pageForm;

    const res = await fetch('/api/admin/content/pages', {
      method,
      headers: { 'Content-Type': 'application/json' },
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
    setSaving(false);
  };

  const deletePage = async (id: string) => {
    if (!confirm(t('admin.content.deletePageConfirm'))) return;
    await fetch(`/api/admin/content/pages?id=${id}`, { method: 'DELETE' });
    fetchPages();
  };

  const togglePagePublished = async (page: Page) => {
    await fetch('/api/admin/content/pages', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: page.id, isPublished: !page.isPublished }),
    });
    fetchPages();
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
    const method = editingFaq ? 'PUT' : 'POST';
    const body = editingFaq ? { id: editingFaq.id, ...faqForm } : faqForm;

    const res = await fetch('/api/admin/content/faqs', {
      method,
      headers: { 'Content-Type': 'application/json' },
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
    setSaving(false);
  };

  const deleteFaq = async (id: string) => {
    if (!confirm(t('admin.content.deleteFaqConfirm'))) return;
    await fetch(`/api/admin/content/faqs?id=${id}`, { method: 'DELETE' });
    fetchFaqs();
  };

  const toggleFaqPublished = async (faq: FAQItem) => {
    await fetch('/api/admin/content/faqs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: faq.id, isPublished: !faq.isPublished }),
    });
    fetchFaqs();
  };

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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
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
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase tracking-wider">{t('admin.content.colPage')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase tracking-wider">{t('admin.content.colUrl')}</th>
                  <th className="px-4 py-3 text-start text-xs font-medium text-slate-500 uppercase tracking-wider">{t('admin.content.colUpdated')}</th>
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
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">/{page.slug}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(page.updatedAt).toLocaleDateString(locale)}
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
                        <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" icon={ExternalLink} />
                        </a>
                        <Button size="sm" variant="ghost" icon={Trash2} onClick={() => deletePage(page.id)} />
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
                          <Button size="sm" variant="ghost" icon={Trash2} onClick={() => deleteFaq(faq.id)} />
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
    </div>
  );
}
