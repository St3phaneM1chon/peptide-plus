'use client';

import { useState, useEffect } from 'react';

interface PageSEO {
  id: string;
  path: string;
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  noIndex: boolean;
  lastUpdated: string;
}

export default function SEOPage() {
  const [pages, setPages] = useState<PageSEO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<PageSEO | null>(null);
  const [globalSettings, setGlobalSettings] = useState({
    siteName: 'BioCycle Peptides',
    siteUrl: 'https://biocycle.ca',
    defaultOgImage: '/og-image.jpg',
    googleAnalyticsId: '',
    googleTagManagerId: '',
    facebookPixelId: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setPages([]);
    setLoading(false);
  };

  const toggleNoIndex = (id: string) => {
    setPages(pages.map(p => p.id === id ? { ...p, noIndex: !p.noIndex } : p));
  };

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
          <h1 className="text-2xl font-bold text-gray-900">SEO</h1>
          <p className="text-gray-500">Optimisez le référencement de votre site</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
          Générer sitemap.xml
        </button>
      </div>

      {/* Global Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Paramètres globaux</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom du site</label>
            <input
              type="text"
              value={globalSettings.siteName}
              onChange={(e) => setGlobalSettings({ ...globalSettings, siteName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL du site</label>
            <input
              type="url"
              value={globalSettings.siteUrl}
              onChange={(e) => setGlobalSettings({ ...globalSettings, siteUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Image OG par défaut</label>
            <input
              type="text"
              value={globalSettings.defaultOgImage}
              onChange={(e) => setGlobalSettings({ ...globalSettings, defaultOgImage: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Analytics & Tracking</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Analytics ID</label>
            <input
              type="text"
              placeholder="G-XXXXXXXXXX"
              value={globalSettings.googleAnalyticsId}
              onChange={(e) => setGlobalSettings({ ...globalSettings, googleAnalyticsId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Google Tag Manager ID</label>
            <input
              type="text"
              placeholder="GTM-XXXXXXX"
              value={globalSettings.googleTagManagerId}
              onChange={(e) => setGlobalSettings({ ...globalSettings, googleTagManagerId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Pixel ID</label>
            <input
              type="text"
              placeholder="XXXXXXXXXXXXXXX"
              value={globalSettings.facebookPixelId}
              onChange={(e) => setGlobalSettings({ ...globalSettings, facebookPixelId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Pages */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Pages</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Page</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Titre</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Indexée</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pages.map((page) => (
              <tr key={page.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{page.path}</code>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-900 truncate max-w-xs">{page.title}</p>
                  <p className="text-xs text-gray-400">{page.title.length}/60 caractères</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-600 truncate max-w-sm">{page.description || '-'}</p>
                  <p className="text-xs text-gray-400">{page.description?.length || 0}/160 caractères</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleNoIndex(page.id)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      page.noIndex 
                        ? 'bg-red-100 text-red-700' 
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {page.noIndex ? 'Non' : 'Oui'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setEditingPage(page)}
                    className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Robots.txt Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">robots.txt</h3>
          <button className="text-sm text-amber-600 hover:text-amber-700">Modifier</button>
        </div>
        <pre className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 overflow-x-auto">
{`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /account/

Sitemap: ${globalSettings.siteUrl}/sitemap.xml`}
        </pre>
      </div>

      {/* Edit Page Modal */}
      {editingPage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Modifier SEO - {editingPage.path}</h3>
              <button onClick={() => setEditingPage(null)} className="p-1 hover:bg-gray-100 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titre <span className="text-gray-400">({editingPage.title.length}/60)</span>
                </label>
                <input
                  type="text"
                  defaultValue={editingPage.title}
                  maxLength={60}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meta Description <span className="text-gray-400">({editingPage.description?.length || 0}/160)</span>
                </label>
                <textarea
                  rows={3}
                  defaultValue={editingPage.description}
                  maxLength={160}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mots-clés</label>
                <input
                  type="text"
                  defaultValue={editingPage.keywords}
                  placeholder="mot1, mot2, mot3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image OG</label>
                <input
                  type="text"
                  defaultValue={editingPage.ogImage}
                  placeholder="/images/og-page.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
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
    </div>
  );
}
