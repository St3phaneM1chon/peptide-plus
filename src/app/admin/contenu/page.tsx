'use client';

import { useState, useEffect } from 'react';

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  lastUpdated: string;
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isPublished: boolean;
}

export default function ContenuPage() {
  const [activeTab, setActiveTab] = useState<'pages' | 'faq'>('pages');
  const [pages, setPages] = useState<Page[]>([]);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [editingFaq, setEditingFaq] = useState<FAQItem | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setPages([]);
    setFaqs([]);
    setLoading(false);
  };

  const togglePublished = (type: 'page' | 'faq', id: string) => {
    if (type === 'page') {
      setPages(pages.map(p => p.id === id ? { ...p, isPublished: !p.isPublished } : p));
    } else {
      setFaqs(faqs.map(f => f.id === id ? { ...f, isPublished: !f.isPublished } : f));
    }
  };

  const faqCategories = [...new Set(faqs.map(f => f.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contenu</h1>
          <p className="text-gray-500">Gérez les pages statiques et la FAQ</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {activeTab === 'pages' ? 'Nouvelle page' : 'Nouvelle question'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('pages')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'pages'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Pages ({pages.length})
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'faq'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            FAQ ({faqs.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'pages' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Page</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">URL</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dernière MAJ</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Publié</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pages.map((page) => (
                <tr key={page.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{page.title}</td>
                  <td className="px-4 py-3">
                    <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">/{page.slug}</code>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(page.lastUpdated).toLocaleDateString('fr-CA')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePublished('page', page.id)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        page.isPublished ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        page.isPublished ? 'right-0.5' : 'left-0.5'
                      }`} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setEditingPage(page)}
                        className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
                      >
                        Modifier
                      </button>
                      <a
                        href={`/${page.slug}`}
                        target="_blank"
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
                      >
                        Voir
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {faqCategories.map((category) => (
            <div key={category} className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">{category}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {faqs.filter(f => f.category === category).map((faq) => (
                  <div key={faq.id} className={`p-4 ${!faq.isPublished ? 'opacity-50' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 mb-1">{faq.question}</p>
                        <p className="text-sm text-gray-600 line-clamp-2">{faq.answer}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <button
                          onClick={() => togglePublished('faq', faq.id)}
                          className={`w-10 h-5 rounded-full transition-colors relative ${
                            faq.isPublished ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                            faq.isPublished ? 'right-0.5' : 'left-0.5'
                          }`} />
                        </button>
                        <button
                          onClick={() => setEditingFaq(faq)}
                          className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
                        >
                          Modifier
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Page Modal */}
      {editingPage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Modifier: {editingPage.title}</h2>
              <button onClick={() => setEditingPage(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                <input
                  type="text"
                  defaultValue={editingPage.title}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">/</span>
                  <input
                    type="text"
                    defaultValue={editingPage.slug}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenu (Markdown/HTML)</label>
                <textarea
                  rows={15}
                  defaultValue={editingPage.content}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setEditingPage(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit FAQ Modal */}
      {editingFaq && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Modifier la question</h2>
              <button onClick={() => setEditingFaq(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  defaultValue={editingFaq.category}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {faqCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                <input
                  type="text"
                  defaultValue={editingFaq.question}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Réponse</label>
                <textarea
                  rows={5}
                  defaultValue={editingFaq.answer}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setEditingFaq(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
