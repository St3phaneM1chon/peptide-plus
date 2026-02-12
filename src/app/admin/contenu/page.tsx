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

const FAQ_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'payment', label: 'Payment' },
  { value: 'products', label: 'Products' },
  { value: 'returns', label: 'Returns & Refunds' },
  { value: 'account', label: 'Account' },
];

export default function ContenuPage() {
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
      alert(err.error || 'Error saving page');
    }
    setSaving(false);
  };

  const deletePage = async (id: string) => {
    if (!confirm('Delete this page? This cannot be undone.')) return;
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
      alert(err.error || 'Error saving FAQ');
    }
    setSaving(false);
  };

  const deleteFaq = async (id: string) => {
    if (!confirm('Delete this FAQ? This cannot be undone.')) return;
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
        title="Content Management"
        subtitle={`${pages.length} pages, ${faqs.length} FAQs`}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => activeTab === 'pages' ? openPageModal() : openFaqModal()}
          >
            {activeTab === 'pages' ? 'New Page' : 'New FAQ'}
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
          Pages ({pages.length})
        </button>
        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${activeTab === 'faq' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <HelpCircle className="w-4 h-4" />
          FAQ ({faqs.length})
        </button>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={activeTab === 'pages' ? 'Search pages...' : 'Search FAQs...'}
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
            title="No pages yet"
            description="Create your first page to start managing content."
            action={<Button variant="primary" icon={Plus} onClick={() => openPageModal()}>Create Page</Button>}
          />
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Page</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">URL</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Updated</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPages.map((page) => (
                  <tr key={page.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{page.title}</p>
                      {page.translations.length > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {page.translations.length} translation{page.translations.length > 1 ? 's' : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">/{page.slug}</code>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(page.updatedAt).toLocaleDateString('en-CA')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => togglePagePublished(page)}>
                        <StatusBadge variant={page.isPublished ? 'success' : 'neutral'} dot>
                          {page.isPublished ? 'Published' : 'Draft'}
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
            title="No FAQs yet"
            description="Create your first FAQ to help customers find answers."
            action={<Button variant="primary" icon={Plus} onClick={() => openFaqModal()}>Create FAQ</Button>}
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
                          <button onClick={() => toggleFaqPublished(faq)} title={faq.isPublished ? 'Unpublish' : 'Publish'}>
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
        title={editingPage ? `Edit: ${editingPage.title}` : 'New Page'}
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPageModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={savePage} loading={saving}>Save Page</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Title" required>
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
                placeholder="Page title"
              />
            </FormField>
            <FormField label="Slug (URL)" required>
              <div className="flex items-center gap-1">
                <span className="text-slate-400 text-sm">/</span>
                <Input
                  value={pageForm.slug}
                  onChange={e => setPageForm(f => ({ ...f, slug: e.target.value }))}
                  placeholder="page-slug"
                />
              </div>
            </FormField>
          </div>
          <FormField label="Excerpt" hint="Short summary for listings">
            <Input
              value={pageForm.excerpt}
              onChange={e => setPageForm(f => ({ ...f, excerpt: e.target.value }))}
              placeholder="Brief page description..."
            />
          </FormField>
          <FormField label="Content" required>
            <Textarea
              value={pageForm.content}
              onChange={e => setPageForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Page content (HTML or Markdown)..."
              rows={12}
              className="font-mono text-sm"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Meta Title" hint="SEO title tag">
              <Input
                value={pageForm.metaTitle}
                onChange={e => setPageForm(f => ({ ...f, metaTitle: e.target.value }))}
                placeholder="SEO title..."
              />
            </FormField>
            <FormField label="Template">
              <select
                value={pageForm.template}
                onChange={e => setPageForm(f => ({ ...f, template: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="default">Default</option>
                <option value="full-width">Full Width</option>
                <option value="sidebar">With Sidebar</option>
              </select>
            </FormField>
          </div>
          <FormField label="Meta Description" hint="SEO description">
            <Input
              value={pageForm.metaDescription}
              onChange={e => setPageForm(f => ({ ...f, metaDescription: e.target.value }))}
              placeholder="SEO description..."
            />
          </FormField>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={pageForm.isPublished}
              onChange={e => setPageForm(f => ({ ...f, isPublished: e.target.checked }))}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm text-slate-700">Publish immediately</span>
          </label>
        </div>
      </Modal>

      {/* FAQ Modal */}
      <Modal
        isOpen={faqModal}
        onClose={() => setFaqModal(false)}
        title={editingFaq ? 'Edit FAQ' : 'New FAQ'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFaqModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveFaq} loading={saving}>Save FAQ</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category">
              <select
                value={faqForm.category}
                onChange={e => setFaqForm(f => ({ ...f, category: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {FAQ_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Sort Order">
              <Input
                type="number"
                value={faqForm.sortOrder}
                onChange={e => setFaqForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))}
              />
            </FormField>
          </div>
          <FormField label="Question" required>
            <Input
              value={faqForm.question}
              onChange={e => setFaqForm(f => ({ ...f, question: e.target.value }))}
              placeholder="How do I...?"
            />
          </FormField>
          <FormField label="Answer" required>
            <Textarea
              value={faqForm.answer}
              onChange={e => setFaqForm(f => ({ ...f, answer: e.target.value }))}
              placeholder="The answer to this question..."
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
            <span className="text-sm text-slate-700">Published</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
