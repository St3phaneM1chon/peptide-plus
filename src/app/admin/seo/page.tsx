'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Globe, Pencil, FileCode, BarChart3, Save, Sparkles, Eye, Code2, ShoppingBag } from 'lucide-react';
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

interface ProductSEO {
  id: string;
  name: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  imageUrl?: string;
}

export default function SEOPage() {
  const { t } = useI18n();
  const [pages, setPages] = useState<PageSEO[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPage, setEditingPage] = useState<PageSEO | null>(null);

  // Product SEO state
  const [products, setProducts] = useState<ProductSEO[]>([]);
  const [editingProduct, setEditingProduct] = useState<ProductSEO | null>(null);
  const [productMetaTitle, setProductMetaTitle] = useState('');
  const [productMetaDesc, setProductMetaDesc] = useState('');
  // OG preview state
  const [showOgPreview, setShowOgPreview] = useState<string | null>(null);
  // JSON-LD preview state
  const [showJsonLd, setShowJsonLd] = useState<string | null>(null);
  // AI suggestion state
  const [aiLoading, setAiLoading] = useState<string | null>(null);

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

  // Fetch products for per-product SEO
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/admin/products?limit=100');
        if (res.ok) {
          const data = await res.json();
          const prods = (data.products || []).map((p: Record<string, unknown>) => ({
            id: p.id as string,
            name: p.name as string,
            slug: p.slug as string,
            metaTitle: (p.metaTitle as string) || '',
            metaDescription: (p.metaDescription as string) || '',
            imageUrl: (p.imageUrl as string) || undefined,
          }));
          setProducts(prods);
        }
      } catch {
        // Products loading is optional
      }
    };
    fetchProducts();
  }, []);

  // Open product SEO editor
  const openProductSeoEditor = (product: ProductSEO) => {
    setEditingProduct(product);
    setProductMetaTitle(product.metaTitle || product.name);
    setProductMetaDesc(product.metaDescription || '');
  };

  // Save product SEO
  const saveProductSeo = async () => {
    if (!editingProduct) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/products/${editingProduct.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaTitle: productMetaTitle, metaDescription: productMetaDesc }),
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, metaTitle: productMetaTitle, metaDescription: productMetaDesc } : p));
        setEditingProduct(null);
        toast.success('SEO produit sauvegardé');
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsSaving(false);
    }
  };

  // AI suggestion for meta description
  const generateAiSuggestion = async (productId: string, productName: string) => {
    setAiLoading(productId);
    // Simulate AI suggestion (replace with actual API call when available)
    await new Promise(resolve => setTimeout(resolve, 800));
    const suggestion = `${productName} - Peptide de recherche de haute qualité par BioCycle Peptides. Certificat d'analyse inclus. Livraison rapide au Canada.`.substring(0, 160);
    setProductMetaDesc(suggestion);
    setAiLoading(null);
    toast.success('Suggestion IA générée');
  };

  // Generate JSON-LD for a product
  const generateJsonLd = (product: ProductSEO): string => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.metaTitle || product.name,
      description: product.metaDescription || `${product.name} par BioCycle Peptides`,
      url: `${globalSettings.siteUrl}/products/${product.slug}`,
      brand: {
        '@type': 'Brand',
        name: globalSettings.siteName,
      },
      image: product.imageUrl || globalSettings.defaultOgImage,
      offers: {
        '@type': 'Offer',
        availability: 'https://schema.org/InStock',
        priceCurrency: 'CAD',
      },
    };
    return JSON.stringify(jsonLd, null, 2);
  };

  // Generate JSON-LD for a page
  const generatePageJsonLd = (page: PageSEO): string => {
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: `${globalSettings.siteUrl}${page.path}`,
      publisher: {
        '@type': 'Organization',
        name: globalSettings.siteName,
        url: globalSettings.siteUrl,
      },
    };
    return JSON.stringify(jsonLd, null, 2);
  };

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
              <React.Fragment key={page.id}>
              <tr className="hover:bg-slate-50/50">
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
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openEditModal(page)}>
                      {t('admin.seo.edit')}
                    </Button>
                    <button
                      onClick={() => setShowOgPreview(showOgPreview === page.id ? null : page.id)}
                      className={`p-1.5 rounded hover:bg-sky-50 transition-colors ${showOgPreview === page.id ? 'text-sky-600' : 'text-slate-400'}`}
                      title="Aperçu Open Graph"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShowJsonLd(showJsonLd === page.id ? null : page.id)}
                      className={`p-1.5 rounded hover:bg-violet-50 transition-colors ${showJsonLd === page.id ? 'text-violet-600' : 'text-slate-400'}`}
                      title="JSON-LD"
                    >
                      <Code2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
              {/* Open Graph Preview Row */}
              {showOgPreview === page.id && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 bg-slate-50">
                    <div className="max-w-lg mx-auto">
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Aperçu Open Graph (Facebook / LinkedIn)
                      </p>
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="h-32 bg-slate-100 flex items-center justify-center">
                          {page.ogImage ? (
                            <img src={page.ogImage} alt="OG" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-slate-400 text-xs">Image: {globalSettings.defaultOgImage}</span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-[10px] text-slate-400 uppercase">{globalSettings.siteUrl.replace('https://', '')}</p>
                          <p className="text-sm font-semibold text-slate-900 mt-0.5">{page.title || 'Titre de la page'}</p>
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{page.description || 'Description de la page'}</p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {/* JSON-LD Preview Row */}
              {showJsonLd === page.id && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 bg-violet-50/50">
                    <p className="text-xs font-semibold text-violet-600 uppercase mb-2 flex items-center gap-1">
                      <Code2 className="w-3 h-3" /> Données structurées JSON-LD
                    </p>
                    <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto font-mono">
                      {generatePageJsonLd(page)}
                    </pre>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Per-Product SEO Section */}
      {products.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-slate-400" />
              SEO par produit ({products.length})
            </h3>
            <p className="text-xs text-slate-500 mt-1">Titre et description méta par produit, aperçu Open Graph et données structurées</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Produit</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Titre méta</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold text-slate-500 uppercase">Description méta</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(product => (
                  <React.Fragment key={product.id}>
                  <tr className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-900">{product.name}</p>
                      <code className="text-[10px] text-slate-400">/products/{product.slug}</code>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700 truncate max-w-xs">{product.metaTitle || <span className="text-slate-400 italic">Non défini</span>}</p>
                      <p className="text-[10px] text-slate-400">{(product.metaTitle || '').length}/60 caractères</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-600 truncate max-w-sm">{product.metaDescription || <span className="text-slate-400 italic">Non défini</span>}</p>
                      <p className="text-[10px] text-slate-400">{(product.metaDescription || '').length}/160 caractères</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => openProductSeoEditor(product)}>
                          Modifier
                        </Button>
                        <button
                          onClick={() => setShowOgPreview(showOgPreview === `prod-${product.id}` ? null : `prod-${product.id}`)}
                          className={`p-1.5 rounded hover:bg-sky-50 ${showOgPreview === `prod-${product.id}` ? 'text-sky-600' : 'text-slate-400'}`}
                          title="Aperçu OG"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setShowJsonLd(showJsonLd === `prod-${product.id}` ? null : `prod-${product.id}`)}
                          className={`p-1.5 rounded hover:bg-violet-50 ${showJsonLd === `prod-${product.id}` ? 'text-violet-600' : 'text-slate-400'}`}
                          title="JSON-LD"
                        >
                          <Code2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* OG Preview and JSON-LD rows for this product */}
                  {(showOgPreview === `prod-${product.id}` || showJsonLd === `prod-${product.id}`) && (
                    <tr>
                      <td colSpan={4} className="px-4 py-3 bg-slate-50">
                        {showOgPreview === `prod-${product.id}` && (
                          <div className="max-w-lg mx-auto mb-3">
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                              <Eye className="w-3 h-3" /> Aperçu Open Graph - {product.name}
                            </p>
                            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                              <div className="h-32 bg-slate-100 flex items-center justify-center">
                                {product.imageUrl ? (
                                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-slate-400 text-xs">{globalSettings.defaultOgImage}</span>
                                )}
                              </div>
                              <div className="p-3">
                                <p className="text-[10px] text-slate-400 uppercase">{globalSettings.siteUrl.replace('https://', '')}</p>
                                <p className="text-sm font-semibold text-slate-900 mt-0.5">{product.metaTitle || product.name}</p>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{product.metaDescription || 'Peptide de recherche par BioCycle Peptides'}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {showJsonLd === `prod-${product.id}` && (
                          <div>
                            <p className="text-xs font-semibold text-violet-600 uppercase mb-2 flex items-center gap-1">
                              <Code2 className="w-3 h-3" /> JSON-LD - {product.name}
                            </p>
                            <pre className="bg-slate-900 text-green-400 rounded-lg p-4 text-xs overflow-x-auto font-mono">
                              {generateJsonLd(product)}
                            </pre>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
              {/* AI Suggestions Button for page meta descriptions */}
              <button
                onClick={async () => {
                  setAiLoading(editingPage?.id || '');
                  await new Promise(resolve => setTimeout(resolve, 800));
                  const title = editTitle || editingPage?.path || '';
                  const suggestion = `${title} - ${globalSettings.siteName}. Découvrez nos peptides de recherche de haute qualité avec certificat d'analyse.`.substring(0, 160);
                  setEditDescription(suggestion);
                  setAiLoading(null);
                  toast.success('Suggestion IA générée');
                }}
                disabled={aiLoading === editingPage?.id}
                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors"
              >
                {aiLoading === editingPage?.id ? (
                  <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Suggestion IA pour la description
              </button>
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

      {/* Product SEO Edit Modal */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={`SEO Produit: ${editingProduct?.name || ''}`}
      >
        {editingProduct && (
          <div className="space-y-4">
            <FormField label="Titre méta" hint={`${productMetaTitle.length}/60 caractères`}>
              <Input
                type="text"
                value={productMetaTitle}
                onChange={(e) => setProductMetaTitle(e.target.value)}
                maxLength={60}
                placeholder={editingProduct.name}
              />
            </FormField>
            <FormField label="Description méta" hint={`${productMetaDesc.length}/160 caractères`}>
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  value={productMetaDesc}
                  onChange={(e) => setProductMetaDesc(e.target.value)}
                  maxLength={160}
                  placeholder="Description optimisée pour le référencement..."
                />
                {/* AI Suggestions Button */}
                <button
                  onClick={() => generateAiSuggestion(editingProduct.id, editingProduct.name)}
                  disabled={aiLoading === editingProduct.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-colors"
                >
                  {aiLoading === editingProduct.id ? (
                    <div className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Suggestion IA pour la description
                </button>
              </div>
            </FormField>

            {/* Live OG Preview */}
            <div className="border-t border-slate-200 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1">
                <Eye className="w-3 h-3" /> Aperçu Open Graph
              </p>
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm max-w-sm">
                <div className="h-24 bg-slate-100 flex items-center justify-center">
                  {editingProduct.imageUrl ? (
                    <img src={editingProduct.imageUrl} alt={editingProduct.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-slate-400 text-[10px]">{globalSettings.defaultOgImage}</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[9px] text-slate-400 uppercase">{globalSettings.siteUrl.replace('https://', '')}</p>
                  <p className="text-xs font-semibold text-slate-900">{productMetaTitle || editingProduct.name}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-2">{productMetaDesc || 'Description du produit'}</p>
                </div>
              </div>
            </div>

            {/* JSON-LD Preview */}
            <div>
              <p className="text-xs font-semibold text-violet-600 uppercase mb-2 flex items-center gap-1">
                <Code2 className="w-3 h-3" /> Données structurées JSON-LD
              </p>
              <pre className="bg-slate-900 text-green-400 rounded-lg p-3 text-[10px] overflow-x-auto font-mono max-h-32">
                {generateJsonLd({ ...editingProduct, metaTitle: productMetaTitle, metaDescription: productMetaDesc })}
              </pre>
            </div>

            <div className="flex gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setEditingProduct(null)} className="flex-1">
                Annuler
              </Button>
              <Button variant="primary" loading={isSaving} disabled={isSaving} onClick={saveProductSeo} className="flex-1">
                Sauvegarder
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
