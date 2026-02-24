'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, GripVertical, ExternalLink, FileText, ImageIcon, Video, Link2 } from 'lucide-react';
import { getFormatTypes, getProductTypes, getAvailabilityOptions, VOLUME_OPTIONS, getStockDisplay } from '../product-constants';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductText {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  intro: string;
  text: string;
  summary: string;
  pdfUrl: string;
  imageUrl: string;
  videoUrl: string;
  externalLink: string;
  internalLink: string;
  references: string;
}

interface FormatToCreate {
  id: string;
  formatType: string;
  name: string;
  description: string;
  imageUrl: string;
  volumeMl: number | null;
  dosageMg: number | null;
  unitCount: number | null;
  sku: string;
  costPrice: number | null;
  price: number;
  comparePrice: number | null;
  stockQuantity: number;
  lowStockThreshold: number;
  availability: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Props {
  categories: Category[];
}

export default function NewProductClient({ categories }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'header' | 'texts' | 'formats'>('header');

  const PRODUCT_TYPES = getProductTypes(t);

  const [formData, setFormData] = useState({
    name: '',
    subtitle: '',
    slug: '',
    shortDescription: '',
    description: '',
    productType: 'PEPTIDE',
    price: 0,
    compareAtPrice: '',
    purity: '99.30',
    molecularWeight: '',
    casNumber: '',
    molecularFormula: '',
    storageConditions: '',
    // FIX: BUG-066 - Use empty string for imageUrl default; placeholder shown via component fallback
    imageUrl: '',
    videoUrl: '',
    // FIX: BUG-048 - Don't auto-select first category; force explicit selection
    categoryId: '',
    isFeatured: false,
    isNew: true,
    isBestseller: false,
    isActive: true,
  });

  const [productTexts, setProductTexts] = useState<ProductText[]>([]);
  const [formats, setFormats] = useState<FormatToCreate[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // BUG-079 FIX: Debounced slug uniqueness check
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const slug = formData.slug.trim();
    if (!slug || slug.length < 2) {
      setSlugStatus('idle');
      return;
    }

    setSlugStatus('checking');

    if (slugCheckTimer.current) {
      clearTimeout(slugCheckTimer.current);
    }

    slugCheckTimer.current = setTimeout(async () => {
      try {
        // Check all products (including inactive) for slug uniqueness
        const res = await fetch(`/api/products?slugs=${encodeURIComponent(slug)}&includeInactive=true&limit=1`);
        if (!res.ok) {
          setSlugStatus('idle');
          return;
        }
        const data = await res.json();
        const products = data.products ?? [];
        setSlugStatus(products.length > 0 ? 'taken' : 'available');
      } catch {
        setSlugStatus('idle');
      }
    }, 500);

    return () => {
      if (slugCheckTimer.current) {
        clearTimeout(slugCheckTimer.current);
      }
    };
  }, [formData.slug]);

  // Auto-generate slug
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setFormData({ ...formData, name, slug });
  };

  // Product texts
  const addProductText = () => {
    const newText: ProductText = {
      // BUG-095 FIX: Use crypto.randomUUID for unique IDs
      id: `text-${crypto.randomUUID().slice(0, 12)}`,
      name: '',
      title: '',
      subtitle: '',
      intro: '',
      text: '',
      summary: '',
      pdfUrl: '',
      imageUrl: '',
      videoUrl: '',
      externalLink: '',
      internalLink: '',
      references: '',
    };
    setProductTexts([...productTexts, newText]);
    setEditingTextId(newText.id);
  };

  const updateProductText = (id: string, field: keyof ProductText, value: string) => {
    setProductTexts(productTexts.map(pt => pt.id === id ? { ...pt, [field]: value } : pt));
  };

  const removeProductText = (id: string) => {
    setProductTexts(productTexts.filter(pt => pt.id !== id));
    if (editingTextId === id) setEditingTextId(null);
  };

  // Formats
  const addFormat = () => {
    const newFormat: FormatToCreate = {
      // FIX: BUG-095 - Use crypto.randomUUID for unique IDs instead of Date.now()
      id: `fmt-${crypto.randomUUID().slice(0, 12)}`,
      formatType: 'VIAL_2ML',
      name: '',
      description: '',
      imageUrl: '',
      volumeMl: 2,
      dosageMg: null,
      unitCount: null,
      sku: '',
      costPrice: null,
      price: 0,
      comparePrice: null,
      stockQuantity: 100,
      lowStockThreshold: 5,
      availability: 'IN_STOCK',
      isDefault: formats.length === 0,
      isActive: true,
    };
    setFormats([...formats, newFormat]);
  };

  const updateFormat = (id: string, updates: Partial<FormatToCreate>) => {
    setFormats(formats.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFormat = (id: string) => {
    setFormats(formats.filter(f => f.id !== id));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug || !formData.categoryId) {
      toast.error(t('admin.productForm.requiredFieldsAlert'));
      return;
    }

    // BUG-079 FIX: Prevent submission if slug is already taken
    if (slugStatus === 'taken') {
      toast.error(t('admin.productForm.slugTaken') || 'This slug is already in use. Please choose a different one.');
      return;
    }

    // FIX: BUG-047 - Client-side format validation before sending to API
    if (formats.length > 0) {
      const invalidFormat = formats.find(f => !f.name.trim() || f.price < 0);
      if (invalidFormat) {
        toast.error(
          t('admin.productForm.formatValidationError') ||
          'Each format must have a name and a price >= 0.'
        );
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: formData.price || formats[0]?.price || 0,
          purity: formData.purity ? parseFloat(formData.purity) : null,
          molecularWeight: formData.molecularWeight ? parseFloat(formData.molecularWeight as string) : null,
          customSections: productTexts.map(({ id: _id, ...rest }) => rest),
          // TODO: BUG-047 - Add client-side Zod validation for formats before sending to API
          formats: formats.map(({ id: _id, ...f }) => f),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/produits/${data.product.id}`);
      } else {
        const data = await res.json();
        toast.error(data.error || t('admin.productForm.creationError'));
      }
    } catch {
      toast.error(t('admin.productForm.creationError'));
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'header' as const, label: t('admin.productForm.tabHeader'), icon: '📋', count: null },
    { id: 'texts' as const, label: t('admin.productForm.tabTexts'), icon: '📝', count: productTexts.length },
    { id: 'formats' as const, label: t('admin.productForm.tabFormats'), icon: '📦', count: formats.length },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/produits" className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{t('admin.productForm.newProduct')}</h1>
              <p className="text-sm text-neutral-500">{t('admin.productForm.newProductSubtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? t('admin.productForm.creating') : t('admin.productForm.createProduct')}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-neutral-200 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-2.5 rounded-md font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-sky-100 text-sky-700 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ===== TAB: HEADER ===== */}
        {activeTab === 'header' && (
          <div className="space-y-6">
            {/* General info */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('admin.productForm.generalInfo')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.productCategory')} *</label>
                  {/* FIX: BUG-048 - Show error if no categories available */}
                  {categories.length === 0 ? (
                    <p className="text-sm text-red-600 py-2.5">
                      {t('admin.productForm.noCategoriesAvailable') || 'No categories available. Please create a category first.'}
                    </p>
                  ) : (
                    <select
                      value={formData.categoryId}
                      onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="">{t('admin.productForm.selectCategory') || '-- Select a category --'}</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.productType')} *</label>
                  <select
                    value={formData.productType}
                    onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {PRODUCT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.productName')} *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder={t('admin.productForm.placeholderProductName')}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.slugUrl')} *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder={t('admin.productForm.placeholderSlug')}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm ${
                        slugStatus === 'taken' ? 'border-red-400 bg-red-50' :
                        slugStatus === 'available' ? 'border-green-400 bg-green-50' :
                        'border-neutral-200'
                      }`}
                    />
                    {/* BUG-079 FIX: Slug uniqueness indicator */}
                    {slugStatus === 'checking' && (
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">...</span>
                    )}
                    {slugStatus === 'available' && (
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-green-600 text-sm">&#10003;</span>
                    )}
                    {slugStatus === 'taken' && (
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-red-600 text-sm">&#10007;</span>
                    )}
                  </div>
                  {slugStatus === 'taken' && (
                    <p className="text-xs text-red-600 mt-1">
                      {t('admin.productForm.slugTaken') || 'This slug is already in use. Please choose a different one.'}
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.titleDescription')}</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                    placeholder={t('admin.productForm.placeholderSubtitle')}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.shortHeaderDescription')}</label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    value={formData.shortDescription}
                    onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                    placeholder={t('admin.productForm.placeholderShortDescription')}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-xs text-neutral-400 mt-1">{(formData.shortDescription || '').length}/300 {t('admin.productForm.characters')}</p>
                </div>
              </div>
            </div>

            {/* Peptide specs */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('admin.productForm.peptideSpecs')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    {t('admin.productForm.purity')}
                    <span className="text-neutral-400 font-normal ms-1">{t('admin.productForm.purityDefault')}</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.purity}
                      onChange={(e) => setFormData({ ...formData, purity: e.target.value })}
                      className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <span className="absolute end-3 top-1/2 -translate-y-1/2 text-neutral-400">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.casNumber')}</label>
                  <input
                    type="text"
                    value={formData.casNumber}
                    onChange={(e) => setFormData({ ...formData, casNumber: e.target.value })}
                    placeholder="137525-51-0"
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.molecularWeight')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.molecularWeight}
                    onChange={(e) => setFormData({ ...formData, molecularWeight: e.target.value })}
                    placeholder="1419.53"
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.molecularFormula')}</label>
                  <input
                    type="text"
                    value={formData.molecularFormula}
                    onChange={(e) => setFormData({ ...formData, molecularFormula: e.target.value })}
                    placeholder="C62H98N16O22"
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.storageConditions')}</label>
                  <input
                    type="text"
                    value={formData.storageConditions}
                    onChange={(e) => setFormData({ ...formData, storageConditions: e.target.value })}
                    placeholder={t('admin.productForm.placeholderStorageConditions')}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.basePrice')} *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    placeholder="49.99"
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Image & Options */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('admin.productForm.mediaAndStatus')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <MediaUploader
                    value={formData.imageUrl}
                    onChange={(url) => setFormData({ ...formData, imageUrl: url || '' })}
                    context="product-image"
                    label={t('admin.productForm.mainImage')}
                    previewSize="md"
                  />
                </div>
                <div>
                  <MediaUploader
                    value={formData.videoUrl}
                    onChange={(url) => setFormData({ ...formData, videoUrl: url })}
                    context="product-video"
                    label={t('admin.productForm.videoYoutubeVimeo')}
                    previewSize="md"
                  />
                </div>
              </div>

              {/* Active / Inactive Toggle */}
              <div className="border-t border-neutral-100 pt-5">
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-200 rounded-full peer-checked:bg-green-500 transition-colors"></div>
                      <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-neutral-700">{t('admin.productForm.active')}</span>
                      <p className="text-xs text-neutral-400">{t('admin.productForm.visibleOnSite')}</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isFeatured} onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })} className="w-4 h-4 text-sky-500 border-neutral-300 rounded focus:ring-sky-500" />
                    <span className="text-sm text-neutral-700">{t('admin.productForm.featured')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isNew} onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })} className="w-4 h-4 text-sky-500 border-neutral-300 rounded focus:ring-sky-500" />
                    <span className="text-sm text-neutral-700">{t('admin.productForm.new')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.isBestseller} onChange={(e) => setFormData({ ...formData, isBestseller: e.target.checked })} className="w-4 h-4 text-sky-500 border-neutral-300 rounded focus:ring-sky-500" />
                    <span className="text-sm text-neutral-700">{t('admin.productForm.bestseller')}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== TAB: PRODUCT TEXTS ===== */}
        {activeTab === 'texts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{t('admin.productForm.productTexts')}</h2>
                <p className="text-sm text-neutral-500">{t('admin.productForm.productTextsDescription')}</p>
              </div>
              <button
                onClick={addProductText}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('admin.productForm.addText')}
              </button>
            </div>

            {productTexts.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
                <p className="text-neutral-500 mb-4">{t('admin.productForm.noProductTexts')}</p>
                <button onClick={addProductText} className="text-sky-600 hover:text-sky-700 font-medium">
                  {t('admin.productForm.addFirstText')}
                </button>
              </div>
            ) : (
              productTexts.map((pt) => (
                <div key={pt.id} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  {/* Text header - clickable */}
                  <div
                    onClick={() => setEditingTextId(editingTextId === pt.id ? null : pt.id)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <GripVertical className="w-4 h-4 text-neutral-300" />
                      <div>
                        <p className="font-medium text-neutral-900">{pt.name || t('admin.productForm.untitledText')}</p>
                        <p className="text-sm text-neutral-500 truncate max-w-md">
                          {pt.title || pt.summary || t('admin.productForm.clickToEdit')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pt.pdfUrl && <FileText className="w-4 h-4 text-red-400" />}
                      {pt.imageUrl && <ImageIcon className="w-4 h-4 text-blue-400" />}
                      {pt.videoUrl && <Video className="w-4 h-4 text-purple-400" />}
                      {pt.externalLink && <ExternalLink className="w-4 h-4 text-green-400" />}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeProductText(pt.id); }}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded edit form */}
                  {editingTextId === pt.id && (
                    <div className="border-t border-neutral-100 p-5 space-y-4 bg-neutral-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.textName')} *</label>
                          <input
                            type="text"
                            value={pt.name}
                            onChange={(e) => updateProductText(pt.id, 'name', e.target.value)}
                            placeholder={t('admin.productForm.placeholderTextName')}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.title')}</label>
                          <input
                            type="text"
                            value={pt.title}
                            onChange={(e) => updateProductText(pt.id, 'title', e.target.value)}
                            placeholder={t('admin.productForm.placeholderTitle')}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.subtitle')}</label>
                          <input
                            type="text"
                            value={pt.subtitle}
                            onChange={(e) => updateProductText(pt.id, 'subtitle', e.target.value)}
                            placeholder={t('admin.productForm.placeholderSubtitleText')}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.summary')}</label>
                          <input
                            type="text"
                            value={pt.summary}
                            onChange={(e) => updateProductText(pt.id, 'summary', e.target.value)}
                            placeholder={t('admin.productForm.placeholderSummary')}
                            className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.introduction')}</label>
                        <textarea
                          rows={2}
                          value={pt.intro}
                          onChange={(e) => updateProductText(pt.id, 'intro', e.target.value)}
                          placeholder={t('admin.productForm.placeholderIntro')}
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.fullText')}</label>
                        <textarea
                          rows={6}
                          value={pt.text}
                          onChange={(e) => updateProductText(pt.id, 'text', e.target.value)}
                          placeholder={t('admin.productForm.placeholderFullText')}
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono"
                        />
                      </div>

                      {/* Media & Links */}
                      <div className="border-t border-neutral-200 pt-4">
                        <p className="text-xs font-medium text-neutral-600 mb-3">{t('admin.productForm.mediaAndLinks')}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <MediaUploader
                              value={pt.pdfUrl}
                              onChange={(url) => updateProductText(pt.id, 'pdfUrl', url)}
                              context="product-doc"
                              label={t('admin.productForm.pdf')}
                              previewSize="sm"
                            />
                          </div>
                          <div>
                            <MediaUploader
                              value={pt.imageUrl}
                              onChange={(url) => updateProductText(pt.id, 'imageUrl', url)}
                              context="product-image"
                              label={t('admin.productForm.image')}
                              previewSize="sm"
                            />
                          </div>
                          <div>
                            <MediaUploader
                              value={pt.videoUrl}
                              onChange={(url) => updateProductText(pt.id, 'videoUrl', url)}
                              context="product-video"
                              label={t('admin.productForm.video')}
                              previewSize="sm"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                              <ExternalLink className="w-3 h-3" /> {t('admin.productForm.externalLink')}
                            </label>
                            <input
                              type="url"
                              value={pt.externalLink}
                              onChange={(e) => updateProductText(pt.id, 'externalLink', e.target.value)}
                              placeholder="https://..."
                              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                              <Link2 className="w-3 h-3" /> {t('admin.productForm.internalLink')}
                            </label>
                            <input
                              type="text"
                              value={pt.internalLink}
                              onChange={(e) => updateProductText(pt.id, 'internalLink', e.target.value)}
                              placeholder="/product/bpc-157"
                              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1">
                              <FileText className="w-3 h-3" /> {t('admin.productForm.references')}
                            </label>
                            <input
                              type="text"
                              value={pt.references}
                              onChange={(e) => updateProductText(pt.id, 'references', e.target.value)}
                              placeholder={t('admin.productForm.placeholderReferences')}
                              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ===== TAB: FORMATS ===== */}
        {activeTab === 'formats' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{t('admin.productForm.availableFormats')}</h2>
                <p className="text-sm text-neutral-500">{t('admin.productForm.formatsDescription')}</p>
              </div>
              <button
                onClick={addFormat}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('admin.productForm.addFormat')}
              </button>
            </div>

            {formats.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                <p className="text-neutral-500 mb-4">{t('admin.productForm.noFormats')}</p>
                <button onClick={addFormat} className="text-sky-600 hover:text-sky-700 font-medium">
                  {t('admin.productForm.addFirstFormat')}
                </button>
              </div>
            ) : (
              formats.map((format, index) => (
                <FormatCard
                  key={format.id}
                  format={format}
                  index={index}
                  onUpdate={(updates) => updateFormat(format.id, updates)}
                  onRemove={() => removeFormat(format.id)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== FORMAT CARD COMPONENT ====================

function FormatCard({
  format,
  index,
  onUpdate,
  onRemove,
}: {
  format: FormatToCreate;
  index: number;
  onUpdate: (updates: Partial<FormatToCreate>) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(true);

  const FORMAT_TYPES = getFormatTypes(t);
  const AVAILABILITY_OPTIONS = getAvailabilityOptions(t);

  const stock = getStockDisplay(format.stockQuantity, format.lowStockThreshold, t);
  const margin = format.costPrice && format.price
    ? ((format.price - format.costPrice) / format.price * 100).toFixed(1)
    : null;

  return (
    <div className={`bg-white rounded-xl border ${
      format.stockQuantity === 0 ? 'border-red-200' :
      format.stockQuantity <= format.lowStockThreshold ? 'border-amber-200' :
      format.isDefault ? 'border-sky-200' :
      'border-neutral-200'
    } overflow-hidden`}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{FORMAT_TYPES.find(ft => ft.value === format.formatType)?.icon || '📦'}</span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-neutral-900">
                {format.name || t('admin.productForm.formatNumber', { number: index + 1 })}
              </p>
              {format.isDefault && (
                <span className="px-2 py-0.5 text-xs bg-sky-100 text-sky-700 rounded-full">{t('admin.productForm.default')}</span>
              )}
            </div>
            <p className="text-sm text-neutral-500">
              {format.volumeMl && `${format.volumeMl}ml`}
              {format.dosageMg && ` · ${format.dosageMg}mg`}
              {format.sku && ` · SKU: ${format.sku}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-end">
            <p className="font-semibold text-neutral-900">${format.price.toFixed(2)}</p>
            {format.costPrice && (
              <p className="text-xs text-neutral-400">{t('admin.productForm.cost')}: ${format.costPrice.toFixed(2)}</p>
            )}
          </div>
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${stock.color} ${stock.bg}`}>
            {stock.text}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-neutral-100 p-5 bg-neutral-50 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.formatType')} *</label>
              <select
                value={format.formatType}
                onChange={(e) => onUpdate({ formatType: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {FORMAT_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.icon} {type.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.formatName')} *</label>
              <input
                type="text"
                value={format.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder={t('admin.productForm.placeholderFormatName')}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.volumeMl')}</label>
              <select
                value={format.volumeMl || ''}
                onChange={(e) => onUpdate({ volumeMl: e.target.value ? parseFloat(e.target.value) : null })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">{t('admin.productForm.select')}</option>
                {VOLUME_OPTIONS.map(v => (
                  <option key={v} value={v}>{v} ml</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.dosageMg')}</label>
              <input
                type="number"
                step="0.01"
                value={format.dosageMg || ''}
                onChange={(e) => onUpdate({ dosageMg: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="5"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.costPrice')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={format.costPrice || ''}
                onChange={(e) => onUpdate({ costPrice: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="15.00"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.sellingPrice')} *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={format.price || ''}
                onChange={(e) => onUpdate({ price: parseFloat(e.target.value) || 0 })}
                placeholder="49.99"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.strikethroughPrice')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={format.comparePrice || ''}
                onChange={(e) => onUpdate({ comparePrice: e.target.value ? parseFloat(e.target.value) : null })}
                placeholder="69.99"
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            {margin && (
              <div className="flex items-end pb-2">
                <span className={`text-sm font-medium ${parseFloat(margin) >= 50 ? 'text-green-600' : parseFloat(margin) >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
                  {t('admin.productForm.margin')}: {margin}%
                </span>
              </div>
            )}
          </div>

          {/* Inventory */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.stockQuantity')} *</label>
              <input
                type="number"
                min="0"
                value={format.stockQuantity}
                onChange={(e) => {
                  const qty = parseInt(e.target.value) || 0;
                  const availability = qty === 0 ? 'OUT_OF_STOCK' : qty <= format.lowStockThreshold ? 'LIMITED' : 'IN_STOCK';
                  onUpdate({ stockQuantity: qty, availability });
                }}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.stockAlertThreshold')}</label>
              <input
                type="number"
                min="0"
                value={format.lowStockThreshold}
                onChange={(e) => onUpdate({ lowStockThreshold: parseInt(e.target.value) || 5 })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.sku')}</label>
              <input
                type="text"
                value={format.sku}
                onChange={(e) => onUpdate({ sku: e.target.value })}
                placeholder={t('admin.productForm.placeholderSku')}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.availability')}</label>
              <select
                value={format.availability}
                onChange={(e) => onUpdate({ availability: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {AVAILABILITY_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Photo & Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <MediaUploader
                value={format.imageUrl}
                onChange={(url) => onUpdate({ imageUrl: url })}
                context="product-image"
                label={t('admin.productForm.formatPhoto')}
                previewSize="sm"
              />
            </div>
            <div className="flex items-end gap-4 pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={format.isDefault}
                  onChange={(e) => onUpdate({ isDefault: e.target.checked })}
                  className="w-4 h-4 text-sky-500 border-neutral-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-neutral-700">{t('admin.productForm.default')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={format.isActive}
                  onChange={(e) => onUpdate({ isActive: e.target.checked })}
                  className="w-4 h-4 text-sky-500 border-neutral-300 rounded focus:ring-sky-500"
                />
                <span className="text-sm text-neutral-700">{t('admin.productForm.active')}</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
