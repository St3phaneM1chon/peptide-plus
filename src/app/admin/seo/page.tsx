'use client';

import { useState, useEffect, useCallback } from 'react';
import { Globe, Pencil, FileCode, BarChart3, Save } from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  FormField,
  Input,
  Textarea,
  MediaUploader,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

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
  const [isSaving, setIsSaving] = useState(false);
  const [editingPage, setEditingPage] = useState<PageSEO | null>(null);
  const [globalSettings, setGlobalSettings] = useState({
    siteName: 'BioCycle Peptides',
    siteUrl: 'https://biocycle.ca',
    defaultOgImage: '/og-image.jpg',
    googleAnalyticsId: '',
    googleTagManagerId: '',
    facebookPixelId: '',
  });

  // Controlled state for Edit Page SEO modal
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editOgImage, setEditOgImage] = useState('');

  // Robots.txt modal state
  const [editingRobots, setEditingRobots] = useState(false);
  const [robotsContent, setRobotsContent] = useState('');

  // FIX: FLAW-055 - Wrap fetchData in useCallback for stable reference
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/seo');
      if (res.ok) {
        const data = await res.json();
        const seoMap: Record<string, string> = data.seoMap || {};
        const rawSettings = data.settings || [];

        // Populate global settings from seoMap
        setGlobalSettings((prev) => ({
          ...prev,
          siteName: seoMap['seo_site_name'] || prev.siteName,
          siteUrl: seoMap['seo_site_url'] || prev.siteUrl,
          defaultOgImage: seoMap['seo_default_og_image'] || prev.defaultOgImage,
          googleAnalyticsId: seoMap['seo_google_analytics_id'] || prev.googleAnalyticsId,
          googleTagManagerId: seoMap['seo_google_tag_manager_id'] || prev.googleTagManagerId,
          facebookPixelId: seoMap['seo_facebook_pixel_id'] || prev.facebookPixelId,
        }));

        // Populate robots.txt from seoMap if saved
        if (seoMap['seo_robots_txt']) {
          setRobotsContent(seoMap['seo_robots_txt']);
        }

        // Map settings into PageSEO[] for any page-specific SEO entries
        const pageEntries: PageSEO[] = rawSettings
          .filter((s: Record<string, unknown>) => (s.key as string).startsWith('seo_page_'))
          .map((s: Record<string, unknown>) => {
            const key = s.key as string;
            const value = s.value as string;
            let parsed: Record<string, unknown> = {};
            try {
              parsed = JSON.parse(value);
            } catch {
              parsed = { title: value };
            }
            return {
              id: s.id as string,
              path: (parsed.path as string) || key.replace('seo_page_', '/'),
              title: (parsed.title as string) || '',
              description: (parsed.description as string) || '',
              keywords: (parsed.keywords as string) || undefined,
              ogImage: (parsed.ogImage as string) || undefined,
              noIndex: (parsed.noIndex as boolean) || false,
              lastUpdated: (s.updatedAt as string) || new Date().toISOString(),
            };
          });
        setPages(pageEntries);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save global settings + analytics to API
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            seo_site_name: globalSettings.siteName,
            seo_site_url: globalSettings.siteUrl,
            seo_default_og_image: globalSettings.defaultOgImage,
            seo_google_analytics_id: globalSettings.googleAnalyticsId,
            seo_google_tag_manager_id: globalSettings.googleTagManagerId,
            seo_facebook_pixel_id: globalSettings.facebookPixelId,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(t('admin.seo.settingsSaved'));
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsSaving(false);
    }
  };

  // Open edit modal with controlled state initialized from the page
  const openEditModal = (page: PageSEO) => {
    setEditTitle(page.title);
    setEditDescription(page.description || '');
    setEditKeywords(page.keywords || '');
    setEditOgImage(page.ogImage || '');
    setEditingPage(page);
  };

  // Save page-specific SEO from edit modal
  const savePageSeo = async () => {
    if (!editingPage) return;
    setIsSaving(true);
    try {
      const pageKey = `seo_page_${editingPage.path.replace(/^\//, '')}`;
      const res = await fetch('/api/admin/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            [pageKey]: JSON.stringify({
              path: editingPage.path,
              title: editTitle,
              description: editDescription,
              keywords: editKeywords || undefined,
              ogImage: editOgImage || undefined,
              noIndex: editingPage.noIndex,
            }),
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save');

      // Update local state
      setPages((prev) =>
        prev.map((p) =>
          p.id === editingPage.id
            ? {
                ...p,
                title: editTitle,
                description: editDescription,
                keywords: editKeywords || undefined,
                ogImage: editOgImage || undefined,
                lastUpdated: new Date().toISOString(),
              }
            : p
        )
      );
      toast.success(t('admin.seo.settingsSaved'));
      setEditingPage(null);
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle noIndex locally and persist via API (fire-and-forget)
  const toggleNoIndex = (id: string) => {
    const page = pages.find((p) => p.id === id);
    if (!page) return;

    const newNoIndex = !page.noIndex;
    setPages(pages.map((p) => (p.id === id ? { ...p, noIndex: newNoIndex } : p)));

    // Fire-and-forget API call
    const pageKey = `seo_page_${page.path.replace(/^\//, '')}`;
    fetch('/api/admin/seo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          [pageKey]: JSON.stringify({
            path: page.path,
            title: page.title,
            description: page.description,
            keywords: page.keywords,
            ogImage: page.ogImage,
            noIndex: newNoIndex,
          }),
        },
      }),
    }).then((res) => {
      // FLAW-051 FIX: Add success feedback for toggleNoIndex
      if (res && res.ok) {
        toast.success(t('admin.seo.settingsSaved'));
      } else if (res) {
        toast.error(t('common.errorOccurred'));
        setPages((prev) => prev.map((p) => (p.id === id ? { ...p, noIndex: !newNoIndex } : p)));
      }
    }).catch(() => {
      toast.error(t('common.errorOccurred'));
      // Revert on failure
      setPages((prev) => prev.map((p) => (p.id === id ? { ...p, noIndex: !newNoIndex } : p)));
    });
  };

  // Generate sitemap via dedicated API endpoint
  const generateSitemap = async () => {
    try {
      const res = await fetch('/api/admin/seo/sitemap', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          t('admin.seo.sitemapGenerated') +
            (data.totalUrls ? ` (${data.totalUrls} URLs)` : '')
        );
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  // Open robots.txt edit modal
  const openRobotsModal = () => {
    if (!robotsContent) {
      setRobotsContent(
        `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/\nDisallow: /checkout/\nDisallow: /account/\n\nSitemap: ${globalSettings.siteUrl}/sitemap.xml`
      );
    }
    setEditingRobots(true);
  };

  // Save robots.txt content
  const saveRobotsTxt = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            seo_robots_txt: robotsContent,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast.success(t('admin.seo.settingsSaved'));
      setEditingRobots(false);
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsSaving(false);
    }
  };

  // Ribbon action handlers
  const handleRibbonSave = useCallback(() => {
    saveSettings();
  }, []);

  const handleRibbonResetDefaults = useCallback(() => {
    setGlobalSettings({
      siteName: 'BioCycle Peptides',
      siteUrl: 'https://biocycle.ca',
      defaultOgImage: '/og-image.jpg',
      googleAnalyticsId: '',
      googleTagManagerId: '',
      facebookPixelId: '',
    });
    toast.success(t('admin.seo.resetSuccess') || 'Settings reset to defaults');
  }, [t]);

  const handleRibbonImportConfig = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const config = JSON.parse(text);
        if (config.siteName) setGlobalSettings((prev) => ({ ...prev, ...config }));
        toast.success(t('admin.seo.importSuccess') || 'Configuration imported');
      } catch {
        toast.error(t('admin.seo.importError') || 'Invalid JSON file');
      }
    };
    input.click();
  }, [t]);

  const handleRibbonExportConfig = useCallback(() => {
    const config = JSON.stringify(globalSettings, null, 2);
    const blob = new Blob([config], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported');
  }, [globalSettings, t]);

  const handleRibbonTest = useCallback(() => {
    generateSitemap();
  }, []);

  useRibbonAction('save', handleRibbonSave);
  useRibbonAction('resetDefaults', handleRibbonResetDefaults);
  useRibbonAction('importConfig', handleRibbonImportConfig);
  useRibbonAction('exportConfig', handleRibbonExportConfig);
  useRibbonAction('test', handleRibbonTest);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.seo.title')}
        subtitle={t('admin.seo.subtitle')}
        actions={
          <Button variant="primary" icon={Globe} onClick={generateSitemap}>
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
              <MediaUploader
                value={globalSettings.defaultOgImage}
                onChange={(url) => setGlobalSettings({ ...globalSettings, defaultOgImage: url })}
                context="seo"
                previewSize="md"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Save Settings Button */}
      <div className="flex justify-end">
        <Button variant="primary" icon={Save} loading={isSaving} disabled={isSaving} onClick={saveSettings}>
          {t('admin.seo.saveSettings')}
        </Button>
      </div>

      {/* Pages */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">{t('admin.seo.pages')}</h3>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.seo.page')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.seo.titleCol')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">{t('admin.seo.description')}</th>
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
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEditModal(page)}>
                    {t('admin.seo.edit')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Robots.txt Preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-slate-400" />
            <h3 className="font-semibold text-slate-900">robots.txt</h3>
          </div>
          <Button variant="ghost" size="sm" icon={Pencil} onClick={openRobotsModal}>
            {t('admin.seo.edit')}
          </Button>
        </div>
        <pre className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 overflow-x-auto">
          {robotsContent ||
            `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /checkout/
Disallow: /account/

Sitemap: ${globalSettings.siteUrl}/sitemap.xml`}
        </pre>
      </div>

      {/* Edit Page SEO Modal */}
      <Modal
        isOpen={!!editingPage}
        onClose={() => setEditingPage(null)}
        title={t('admin.seo.editSeoTitle', { path: editingPage?.path || '' })}
      >
        {editingPage && (
          <div className="space-y-4">
            <FormField label={t('admin.seo.titleField')} hint={`${editTitle.length}/60`}>
              <Input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={60}
              />
            </FormField>
            <FormField label={t('admin.seo.metaDescription')} hint={`${editDescription.length}/160`}>
              <Textarea
                rows={3}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={160}
              />
            </FormField>
            <FormField label={t('admin.seo.keywords')}>
              <Input
                type="text"
                value={editKeywords}
                onChange={(e) => setEditKeywords(e.target.value)}
                placeholder={t('admin.seo.keywordsPlaceholder')}
              />
            </FormField>
            {/* FIX: FLAW-085 - TODO: Replace plain Input with MediaUploader component for consistent OG image selection */}
            <FormField label={t('admin.seo.ogImage')}>
              <Input
                type="text"
                value={editOgImage}
                onChange={(e) => setEditOgImage(e.target.value)}
                placeholder="/images/og-page.jpg"
              />
            </FormField>
            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setEditingPage(null)} className="flex-1">
                {t('admin.seo.cancel')}
              </Button>
              <Button variant="primary" loading={isSaving} disabled={isSaving} onClick={savePageSeo} className="flex-1">
                {t('admin.seo.save')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Robots.txt Modal */}
      <Modal
        isOpen={editingRobots}
        onClose={() => setEditingRobots(false)}
        title={t('admin.seo.editRobotsTxt')}
      >
        <div className="space-y-4">
          <FormField label="robots.txt">
            <Textarea
              rows={12}
              value={robotsContent}
              onChange={(e) => setRobotsContent(e.target.value)}
              className="font-mono text-sm"
            />
          </FormField>
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setEditingRobots(false)} className="flex-1">
              {t('admin.seo.cancel')}
            </Button>
            <Button variant="primary" loading={isSaving} disabled={isSaving} onClick={saveRobotsTxt} className="flex-1">
              {t('admin.seo.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
