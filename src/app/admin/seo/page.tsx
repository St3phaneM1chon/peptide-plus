'use client';

import { useState, useEffect } from 'react';
import { Globe, Pencil, FileCode, BarChart3 } from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  FormField,
  Input,
  Textarea,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';

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
  const { t } = useI18n();
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
    setPages(pages.map((p) => (p.id === id ? { ...p, noIndex: !p.noIndex } : p)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.seo.title')}
        subtitle={t('admin.seo.subtitle')}
        actions={
          <Button variant="primary" icon={Globe}>
            {t('admin.seo.generateSitemap')}
          </Button>
        }
      />

      {/* Global Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">{t('admin.seo.globalSettings')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField label={t('admin.seo.siteName')}>
            <Input
              type="text"
              value={globalSettings.siteName}
              onChange={(e) => setGlobalSettings({ ...globalSettings, siteName: e.target.value })}
            />
          </FormField>
          <FormField label={t('admin.seo.siteUrl')}>
            <Input
              type="url"
              value={globalSettings.siteUrl}
              onChange={(e) => setGlobalSettings({ ...globalSettings, siteUrl: e.target.value })}
            />
          </FormField>
          <div className="col-span-2">
            <FormField label={t('admin.seo.defaultOgImage')}>
              <Input
                type="text"
                value={globalSettings.defaultOgImage}
                onChange={(e) => setGlobalSettings({ ...globalSettings, defaultOgImage: e.target.value })}
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* Analytics */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-slate-400" />
          <h3 className="font-semibold text-slate-900">{t('admin.seo.analyticsTracking')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label={t('admin.seo.googleAnalyticsId')}>
            <Input
              type="text"
              placeholder="G-XXXXXXXXXX"
              value={globalSettings.googleAnalyticsId}
              onChange={(e) => setGlobalSettings({ ...globalSettings, googleAnalyticsId: e.target.value })}
            />
          </FormField>
          <FormField label={t('admin.seo.googleTagManagerId')}>
            <Input
              type="text"
              placeholder="GTM-XXXXXXX"
              value={globalSettings.googleTagManagerId}
              onChange={(e) => setGlobalSettings({ ...globalSettings, googleTagManagerId: e.target.value })}
            />
          </FormField>
          <FormField label={t('admin.seo.facebookPixelId')}>
            <Input
              type="text"
              placeholder="XXXXXXXXXXXXXXX"
              value={globalSettings.facebookPixelId}
              onChange={(e) => setGlobalSettings({ ...globalSettings, facebookPixelId: e.target.value })}
            />
          </FormField>
        </div>
      </div>

      {/* Pages */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">{t('admin.seo.pages')}</h3>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.seo.page')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.seo.titleCol')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.seo.description')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.seo.indexed')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.seo.actionsCol')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pages.map((page) => (
              <tr key={page.id} className="hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <code className="text-sm bg-slate-100 px-2 py-0.5 rounded text-slate-700">{page.path}</code>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-900 truncate max-w-xs">{page.title}</p>
                  <p className="text-xs text-slate-400">{page.title.length}/60 {t('admin.seo.characters')}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-slate-600 truncate max-w-sm">{page.description || '-'}</p>
                  <p className="text-xs text-slate-400">{page.description?.length || 0}/160 {t('admin.seo.characters')}</p>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleNoIndex(page.id)}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      page.noIndex ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {page.noIndex ? t('admin.seo.no') : t('admin.seo.yes')}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditingPage(page)}>
                    {t('admin.seo.edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Robots.txt Preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900">robots.txt</h3>
          </div>
          <Button variant="ghost" size="sm" icon={Pencil}>
            {t('admin.seo.edit')}
          </Button>
        </div>
        <pre className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 overflow-x-auto">
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
      <Modal
        isOpen={!!editingPage}
        onClose={() => setEditingPage(null)}
        title={t('admin.seo.editSeoTitle', { path: editingPage?.path || '' })}
      >
        {editingPage && (
          <div className="space-y-4">
            <FormField label={t('admin.seo.titleField')} hint={`${editingPage.title.length}/60`}>
              <Input type="text" defaultValue={editingPage.title} maxLength={60} />
            </FormField>
            <FormField label={t('admin.seo.metaDescription')} hint={`${editingPage.description?.length || 0}/160`}>
              <Textarea rows={3} defaultValue={editingPage.description} maxLength={160} />
            </FormField>
            <FormField label={t('admin.seo.keywords')}>
              <Input type="text" defaultValue={editingPage.keywords} placeholder={t('admin.seo.keywordsPlaceholder')} />
            </FormField>
            <FormField label={t('admin.seo.ogImage')}>
              <Input type="text" defaultValue={editingPage.ogImage} placeholder="/images/og-page.jpg" />
            </FormField>
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setEditingPage(null)} className="flex-1">
                {t('admin.seo.cancel')}
              </Button>
              <Button variant="primary" className="flex-1">
                {t('admin.seo.save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
