'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Plus, Trash2, ExternalLink, FileText, ImageIcon, Video, Link2, Globe, Check, AlertTriangle, Pencil, ClipboardList, FileEdit, Package, ShoppingCart, Tag, Film, Loader2, Star, Briefcase } from 'lucide-react';
import { getFormatTypes, getProductTypes, getAvailabilityOptions, VOLUME_OPTIONS, getStockDisplay } from '../product-constants';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface ProductFormat {
  id: string;
  formatType: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  dosageMg: number | null;
  volumeMl: number | null;
  unitCount: number | null;
  costPrice: number | null;
  price: number;
  comparePrice: number | null;
  sku: string | null;
  barcode: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  inStock: boolean;
  availability: string;
  availableDate: string | null;
  discontinuedAt: string | null;
  weightGrams: number | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  // BUG-049 FIX: Track updatedAt for concurrent edit detection
  updatedAt?: string;
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

interface TranslationStatus {
  locale: string;
  isApproved: boolean;
  updatedAt: string;
}

interface Product {
  id: string;
  name: string;
  subtitle: string | null;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  productType: string;
  price: number;
  compareAtPrice: number | null;
  purity: number | null;
  molecularWeight: number | null;
  casNumber: string | null;
  molecularFormula: string | null;
  storageConditions: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  categoryId: string;
  customSections: ProductText[] | null;
  isFeatured: boolean;
  isNew: boolean;
  isBestseller: boolean;
  isActive: boolean;
  formats: ProductFormat[];
  category: { id: string; name: string; slug: string };
  translations?: TranslationStatus[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  product: Product;
  categories: Category[];
  isOwner: boolean;
}

// BUG-032 FIX: Import locales from central config instead of hardcoding a mismatched list
import { locales as ALL_LOCALES } from '@/i18n/config';
import { addCSRFHeader } from '@/lib/csrf';

// BUG-080 FIX: Track unsaved changes and warn before navigating away
export default function ProductEditClient({ product, categories, isOwner }: Props) {
  const router = useRouter();
  const { t, formatCurrency } = useI18n();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formatToDelete, setFormatToDelete] = useState<string | null>(null);
  const [concurrentEditConfirm, setConcurrentEditConfirm] = useState<{ format: ProductFormat; initialFormat: ProductFormat } | null>(null);
  const [activeTab, setActiveTab] = useState<'header' | 'texts' | 'formats' | 'sales' | 'promos' | 'videos' | 'reviews' | 'deals'>('header');
  const [translationStatuses, setTranslationStatuses] = useState<TranslationStatus[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Bridge states (#25: sales, #17: promos, #27: videos)
  const [salesData, setSalesData] = useState<{
    totalUnitsSold: number; totalOrders: number; totalRevenue: number;
    recentOrders: Array<{ orderId: string; orderNumber: string; orderStatus: string; quantity: number; price: number; date: string }>;
  } | null>(null);
  const [promosData, setPromosData] = useState<Array<{
    id: string; code: string; type: string; value: number; usageCount: number; usageLimit: number | null; endsAt: string | null;
  }> | null>(null);
  const [videosData, setVideosData] = useState<Array<{
    id: string; title: string; thumbnailUrl: string | null; duration: number | null; viewCount: number; publishedAt: string | null;
  }> | null>(null);
  const [reviewsData, setReviewsData] = useState<{
    avgRating: number; reviewCount: number;
    reviews: Array<{ id: string; rating: number; title: string | null; comment: string | null; isVerified: boolean; createdAt: string; user: { id: string; name: string | null } }>;
    questions: Array<{ id: string; question: string; answer: string | null; isPublished: boolean; createdAt: string }>;
  } | null>(null);
  const [dealsData, setDealsData] = useState<Array<{
    dealId: string; dealTitle: string; dealValue: number; currency: string; stage: string; isWon: boolean; isLost: boolean;
    quantity: number; unitPrice: number; total: number; date: string;
  }> | null>(null);
  const [bridgeLoading, setBridgeLoading] = useState<Record<string, boolean>>({});

  // Lazy-load bridge data on tab switch
  useEffect(() => {
    if (activeTab === 'sales' && !salesData && !bridgeLoading.sales) {
      setBridgeLoading((p) => ({ ...p, sales: true }));
      fetch(`/api/admin/products/${product.id}/sales`)
        .then((r) => r.json())
        .then((j) => { if (j.data?.enabled) setSalesData(j.data); })
        .catch(() => {})
        .finally(() => setBridgeLoading((p) => ({ ...p, sales: false })));
    }
    if (activeTab === 'promos' && !promosData && !bridgeLoading.promos) {
      setBridgeLoading((p) => ({ ...p, promos: true }));
      fetch(`/api/admin/products/${product.id}/promos`)
        .then((r) => r.json())
        .then((j) => { if (j.data?.enabled) setPromosData(j.data.promos); })
        .catch(() => {})
        .finally(() => setBridgeLoading((p) => ({ ...p, promos: false })));
    }
    if (activeTab === 'videos' && !videosData && !bridgeLoading.videos) {
      setBridgeLoading((p) => ({ ...p, videos: true }));
      fetch(`/api/admin/products/${product.id}/videos`)
        .then((r) => r.json())
        .then((j) => { if (j.data?.enabled) setVideosData(j.data.videos); })
        .catch(() => {})
        .finally(() => setBridgeLoading((p) => ({ ...p, videos: false })));
    }
    if (activeTab === 'reviews' && !reviewsData && !bridgeLoading.reviews) {
      setBridgeLoading((p) => ({ ...p, reviews: true }));
      fetch(`/api/admin/products/${product.id}/reviews`)
        .then((r) => r.json())
        .then((j) => { if (j.data?.enabled) setReviewsData(j.data); })
        .catch(() => {})
        .finally(() => setBridgeLoading((p) => ({ ...p, reviews: false })));
    }
    if (activeTab === 'deals' && !dealsData && !bridgeLoading.deals) {
      setBridgeLoading((p) => ({ ...p, deals: true }));
      fetch(`/api/admin/products/${product.id}/deals`)
        .then((r) => r.json())
        .then((j) => { if (j.data?.enabled) setDealsData(j.data.deals); })
        .catch(() => {})
        .finally(() => setBridgeLoading((p) => ({ ...p, deals: false })));
    }
  }, [activeTab, product.id, salesData, promosData, videosData, reviewsData, dealsData, bridgeLoading]);

  const FORMAT_TYPES = getFormatTypes(t);
  const PRODUCT_TYPES = getProductTypes(t);

  const [formData, setFormData] = useState({
    name: product.name,
    subtitle: product.subtitle || '',
    slug: product.slug,
    shortDescription: product.shortDescription || '',
    description: product.description || '',
    productType: product.productType,
    price: product.price,
    // BUG-069 FIX: Use null instead of '' for optional numeric field
    compareAtPrice: product.compareAtPrice ?? null,
    purity: product.purity ? String(product.purity) : '99.30',
    molecularWeight: product.molecularWeight ? String(product.molecularWeight) : '',
    casNumber: product.casNumber || '',
    molecularFormula: product.molecularFormula || '',
    storageConditions: product.storageConditions || '',
    imageUrl: product.imageUrl || '',
    videoUrl: product.videoUrl || '',
    categoryId: product.categoryId,
    isFeatured: product.isFeatured,
    isNew: product.isNew,
    isBestseller: product.isBestseller,
    isActive: product.isActive,
  });

  // Load product texts from customSections
  const [productTexts, setProductTexts] = useState<ProductText[]>(() => {
    if (product.customSections && Array.isArray(product.customSections)) {
      return (product.customSections as ProductText[]).map((s, i) => ({
        id: `text-${i}`,
        name: s.name || '',
        title: s.title || '',
        subtitle: s.subtitle || '',
        intro: s.intro || '',
        text: s.text || '',
        summary: s.summary || '',
        pdfUrl: s.pdfUrl || '',
        imageUrl: s.imageUrl || '',
        videoUrl: s.videoUrl || '',
        externalLink: s.externalLink || '',
        internalLink: s.internalLink || '',
        references: s.references || '',
      }));
    }
    return [];
  });

  const [formats, setFormats] = useState<ProductFormat[]>(product.formats);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingFormatId, setEditingFormatId] = useState<string | null>(null);

  // Fetch translation statuses
  useEffect(() => {
    fetch(`/api/products/${product.id}/translations`)
      .then(res => res.ok ? res.json() : { translations: [] })
      .then(data => setTranslationStatuses(data.translations || []))
      .catch(() => {});
  }, [product.id]);

  // BUG-080 FIX: Warn user before navigating away with unsaved changes
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setIsDirty(true);
  }, [formData, productTexts]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Product texts management
  const addProductText = () => {
    const newText: ProductText = {
      // BUG-095 FIX: Use crypto.randomUUID for unique IDs
      id: `text-${crypto.randomUUID().slice(0, 12)}`,
      name: '', title: '', subtitle: '', intro: '', text: '', summary: '',
      pdfUrl: '', imageUrl: '', videoUrl: '', externalLink: '', internalLink: '', references: '',
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

  // Format management
  const handleAddFormat = async () => {
    try {
      const res = await fetch(`/api/products/${product.id}/formats`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          formatType: 'VIAL_2ML',
          name: t('admin.productForm.newFormat'),
          price: 0,
          stockQuantity: 100,
          lowStockThreshold: 5,
          availability: 'IN_STOCK',
          isDefault: formats.length === 0,
          isActive: true,
        }),
      });
      if (res.ok) {
        const createdFormat = await res.json();
        setFormats([...formats, createdFormat]);
        setEditingFormatId(createdFormat.id);
      }
    } catch {
      toast.error(t('admin.productForm.formatCreationError'));
    }
  };

  // BUG-049 FIX: Detect concurrent edits via updatedAt check before saving format.
  // Sends only fields that differ from the original to minimize overwrite risk.
  // BUG-075 FIX: Optimistic update - update local state immediately, revert on error.
  const handleSaveFormat = async (format: ProductFormat, initialFormat: ProductFormat) => {
    // BUG-049: Fetch the current server state to check for concurrent modifications
    try {
      const checkRes = await fetch(`/api/products/${product.id}/formats/${format.id}`);
      if (checkRes.ok) {
        const serverFormat = await checkRes.json();
        if (serverFormat.updatedAt && initialFormat.updatedAt && serverFormat.updatedAt !== initialFormat.updatedAt) {
          // Show ConfirmDialog instead of window.confirm for concurrent edit warning
          setConcurrentEditConfirm({ format, initialFormat });
          return;
        }
      }
    } catch {
      // If the check fails, proceed anyway - the save itself will fail if there's a real issue
    }

    // BUG-075: Optimistic update - apply changes to local state immediately
    const previousFormats = formats;
    setFormats(formats.map(f => f.id === format.id ? format : f));
    setEditingFormatId(null);

    try {
      // BUG-049: Build a partial payload with only changed fields to reduce overwrite surface
      const changedFields: Record<string, unknown> = {};
      for (const key of Object.keys(format) as (keyof ProductFormat)[]) {
        if (format[key] !== initialFormat[key]) {
          changedFields[key] = format[key];
        }
      }

      const res = await fetch(`/api/products/${product.id}/formats/${format.id}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(Object.keys(changedFields).length > 0 ? changedFields : format),
      });
      if (res.ok) {
        // Replace optimistic data with confirmed server data (includes updatedAt, etc.)
        const updatedFormat = await res.json();
        setFormats(prev => prev.map(f => f.id === format.id ? updatedFormat : f));
      } else {
        // BUG-075: Revert optimistic update on server error
        setFormats(previousFormats);
        setEditingFormatId(format.id);
        toast.error(t('admin.productForm.formatUpdateError'));
      }
    } catch {
      // BUG-075: Revert optimistic update on network error
      setFormats(previousFormats);
      setEditingFormatId(format.id);
      toast.error(t('admin.productForm.formatUpdateError'));
    }
  };

  // Proceed with save after concurrent edit confirmation
  const handleConcurrentEditConfirm = async () => {
    if (!concurrentEditConfirm) return;
    const { format, initialFormat } = concurrentEditConfirm;
    setConcurrentEditConfirm(null);
    // Skip the server check and go straight to the optimistic update + save
    const previousFormats = formats;
    setFormats(formats.map(f => f.id === format.id ? format : f));
    setEditingFormatId(null);
    try {
      const changedFields: Record<string, unknown> = {};
      for (const key of Object.keys(format) as (keyof ProductFormat)[]) {
        if (format[key] !== initialFormat[key]) {
          changedFields[key] = format[key];
        }
      }
      const res = await fetch(`/api/products/${product.id}/formats/${format.id}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(Object.keys(changedFields).length > 0 ? changedFields : format),
      });
      if (res.ok) {
        const updatedFormat = await res.json();
        setFormats(prev => prev.map(f => f.id === format.id ? updatedFormat : f));
      } else {
        setFormats(previousFormats);
        setEditingFormatId(format.id);
        toast.error(t('admin.productForm.formatUpdateError'));
      }
    } catch {
      setFormats(previousFormats);
      setEditingFormatId(format.id);
      toast.error(t('admin.productForm.formatUpdateError'));
    }
  };

  // BUG-093/094 FIX: Use ConfirmDialog instead of window.confirm() for format deletion
  const handleDeleteFormat = (formatId: string) => {
    setFormatToDelete(formatId);
  };

  const confirmDeleteFormat = async () => {
    if (!formatToDelete) return;
    try {
      const res = await fetch(`/api/products/${product.id}/formats/${formatToDelete}`, { method: 'DELETE', headers: addCSRFHeader() });
      if (res.ok) {
        setFormats(formats.filter(f => f.id !== formatToDelete));
      }
    } catch {
      toast.error(t('admin.productForm.deletionError'));
    } finally {
      setFormatToDelete(null);
    }
  };

  // Save product
  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          ...formData,
          purity: formData.purity ? parseFloat(formData.purity) : null,
          molecularWeight: formData.molecularWeight ? parseFloat(formData.molecularWeight) : null,
          customSections: productTexts.map(({ id: _id, ...rest }) => rest),
        }),
      });
      if (res.ok) {
        // FIX: BUG-098 - Show success toast after product save
        toast.success(t('admin.productForm.updateSuccess') || 'Product updated successfully');
        // BUG-080 FIX: Reset dirty flag after successful save
        setIsDirty(false);
        router.refresh();
      } else {
        const data = await res.json();
        toast.error(data.error || t('admin.productForm.updateError'));
      }
    } catch {
      toast.error(t('admin.productForm.updateError'));
    } finally {
      setSaving(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${product.id}`, { method: 'DELETE', headers: addCSRFHeader() });
      if (res.ok) {
        router.push('/admin/produits');
      } else {
        toast.error(t('admin.productForm.deletionError'));
      }
    } catch {
      toast.error(t('admin.productForm.deletionError'));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const translatedCount = translationStatuses.length;
  const approvedCount = translationStatuses.filter(ts => ts.isApproved).length;

  // BUG-086 FIX: Replaced emoji icons with Lucide icons for consistent cross-platform rendering
  const tabIcons = {
    header: <ClipboardList className="w-4 h-4" />,
    texts: <FileEdit className="w-4 h-4" />,
    formats: <Package className="w-4 h-4" />,
  };
  const tabs = [
    { id: 'header' as const, label: t('admin.productForm.tabHeader'), icon: tabIcons.header, count: null },
    { id: 'texts' as const, label: t('admin.productForm.tabTexts'), icon: tabIcons.texts, count: productTexts.length },
    { id: 'formats' as const, label: t('admin.productForm.tabFormats'), icon: tabIcons.formats, count: formats.length },
    { id: 'sales' as const, label: t('admin.bridges.salesStats') || 'Sales', icon: <ShoppingCart className="w-4 h-4" />, count: null },
    { id: 'promos' as const, label: t('admin.bridges.activePromos') || 'Promos', icon: <Tag className="w-4 h-4" />, count: promosData?.length ?? null },
    { id: 'videos' as const, label: t('admin.bridges.linkedVideos') || 'Videos', icon: <Film className="w-4 h-4" />, count: videosData?.length ?? null },
    { id: 'reviews' as const, label: t('admin.bridges.productReviews') || 'Reviews', icon: <Star className="w-4 h-4" />, count: reviewsData?.reviewCount ?? null },
    { id: 'deals' as const, label: t('admin.bridges.productDeals') || 'Deals', icon: <Briefcase className="w-4 h-4" />, count: dealsData?.length ?? null },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 p-6" aria-busy={saving || undefined}>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/produits" className="p-2 text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors" aria-label="Retour aux produits">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-neutral-900">{product.name}</h1>
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                  formData.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {formData.isActive ? t('admin.productForm.active') : t('admin.productForm.inactive')}
                </span>
              </div>
              <p className="text-sm text-neutral-500">ID: {product.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/product/${product.slug}`}
              target="_blank"
              className="px-4 py-2 text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors text-sm"
            >
              {t('admin.productForm.viewProduct')}
            </Link>
            {/* BUG-093 FIX: Save button disables; form content below gets pointer-events-none + opacity during save */}
            <button
              onClick={handleSaveProduct}
              disabled={saving}
              className="px-6 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors disabled:opacity-50 font-medium"
            >
              {saving ? t('admin.productForm.saving') : t('admin.productForm.save')}
            </button>
          </div>
        </div>

        {/* Translation Status Bar */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-neutral-500" />
              <span className="text-sm font-medium text-neutral-700">{t('admin.productForm.translationConfirmation')}</span>
            </div>
            <span className="text-xs text-neutral-500">
              {t('admin.productForm.languagesTranslated', { count: translatedCount, total: ALL_LOCALES.length })}
              {approvedCount > 0 && ` · ${t('admin.productForm.approved', { count: approvedCount })}`}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_LOCALES.map((loc) => {
              const status = translationStatuses.find(ts => ts.locale === loc);
              return (
                <div
                  key={loc}
                  className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                    status?.isApproved
                      ? 'bg-green-100 text-green-700'
                      : status
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-neutral-100 text-neutral-400'
                  }`}
                  title={status?.isApproved ? t('admin.productForm.approvedTooltip', { date: status.updatedAt }) : status ? t('admin.productForm.autoTranslatedPending') : t('admin.productForm.notTranslated')}
                >
                  {status?.isApproved ? <Check className="w-3 h-3" /> : status ? <AlertTriangle className="w-3 h-3" /> : null}
                  {loc.toUpperCase()}
                </div>
              );
            })}
          </div>
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
              {tab.icon}
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-sky-100 text-sky-700 rounded-full">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ===== TAB: HEADER ===== */}
        {activeTab === 'header' && (
          <div className={`space-y-6 transition-opacity ${saving ? 'opacity-50 pointer-events-none' : ''}`} aria-disabled={saving || undefined}>
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('admin.productForm.generalInfo')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.productCategory')} *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.productType')}</label>
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
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.slugUrl')} *</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.titleDescription')}</label>
                  <input
                    type="text"
                    value={formData.subtitle}
                    onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
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
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-xs text-neutral-400 mt-1">{(formData.shortDescription || '').length}/300</p>
                </div>
              </div>
            </div>

            {/* Specs */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('admin.productForm.peptideSpecs')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.purity')}</label>
                  <div className="relative">
                    <input
                      type="number" step="0.01" min="0" max="100"
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
                    type="text" value={formData.casNumber}
                    onChange={(e) => setFormData({ ...formData, casNumber: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.molecularWeight')}</label>
                  <input
                    type="number" step="0.01" value={formData.molecularWeight}
                    onChange={(e) => setFormData({ ...formData, molecularWeight: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.molecularFormula')}</label>
                  <input
                    type="text" value={formData.molecularFormula}
                    onChange={(e) => setFormData({ ...formData, molecularFormula: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.storageConditions')}</label>
                  <input
                    type="text" value={formData.storageConditions}
                    onChange={(e) => setFormData({ ...formData, storageConditions: e.target.value })}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">{t('admin.productForm.basePrice')}</label>
                  <input
                    type="number" step="0.01"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Media & Status */}
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">{t('admin.productForm.mediaAndStatus')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <MediaUploader
                    value={formData.imageUrl}
                    onChange={(url) => setFormData({ ...formData, imageUrl: url })}
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
                    label={t('admin.productForm.video')}
                    previewSize="md"
                  />
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-5">
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox" checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-neutral-200 rounded-full peer-checked:bg-green-500 transition-colors"></div>
                      <div className="absolute start-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-neutral-700">{t('admin.productForm.active')}</span>
                      <p className="text-xs text-neutral-400">{t('admin.productForm.visibleOnSite')}</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" aria-label="Produit en vedette" checked={formData.isFeatured} onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })} className="w-4 h-4 text-sky-500 border-neutral-300 rounded" />
                    <span className="text-sm text-neutral-700">{t('admin.productForm.featured')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" aria-label="Nouveau produit" checked={formData.isNew} onChange={(e) => setFormData({ ...formData, isNew: e.target.checked })} className="w-4 h-4 text-sky-500 border-neutral-300 rounded" />
                    <span className="text-sm text-neutral-700">{t('admin.productForm.new')}</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" aria-label="Meilleure vente" checked={formData.isBestseller} onChange={(e) => setFormData({ ...formData, isBestseller: e.target.checked })} className="w-4 h-4 text-sky-500 border-neutral-300 rounded" />
                    <span className="text-sm text-neutral-700">{t('admin.productForm.bestseller')}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            {isOwner && (
              <div className="bg-white rounded-xl border border-red-200 p-6">
                <h2 className="text-lg font-semibold text-red-700 mb-2">{t('admin.productForm.dangerZone')}</h2>
                <p className="text-sm text-neutral-500 mb-4">{t('admin.productForm.dangerZoneDescription')}</p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors font-medium text-sm"
                >
                  {t('admin.productForm.deleteProduct')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== TAB: TEXTS ===== */}
        {activeTab === 'texts' && (
          <div className={`space-y-4 transition-opacity ${saving ? 'opacity-50 pointer-events-none' : ''}`} aria-disabled={saving || undefined}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{t('admin.productForm.productTexts')}</h2>
                <p className="text-sm text-neutral-500">{t('admin.productForm.productTextsClickToEdit')}</p>
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
                <p className="text-neutral-500 mb-4">{t('admin.productForm.noProductTextsShort')}</p>
                <button onClick={addProductText} className="text-sky-600 hover:text-sky-700 font-medium">
                  {t('admin.productForm.addFirstText')}
                </button>
              </div>
            ) : (
              productTexts.map((pt) => (
                <div key={pt.id} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                  <div
                    onClick={() => setEditingTextId(editingTextId === pt.id ? null : pt.id)}
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {/* BUG-099 FIX: Removed GripVertical icon since drag-and-drop is not implemented */}
                      <div>
                        <p className="font-medium text-neutral-900">{pt.name || t('admin.productForm.untitledText')}</p>
                        <p className="text-sm text-neutral-500 truncate max-w-md">{pt.title || pt.summary || t('admin.productForm.clickToEdit')}</p>
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
                        aria-label="Supprimer le texte"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {editingTextId === pt.id && (
                    <div className="border-t border-neutral-100 p-5 space-y-4 bg-neutral-50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.textName')} *</label>
                          <input type="text" value={pt.name} onChange={(e) => updateProductText(pt.id, 'name', e.target.value)} placeholder={t('admin.productForm.placeholderTextNameShort')} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.title')}</label>
                          <input type="text" value={pt.title} onChange={(e) => updateProductText(pt.id, 'title', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.subtitle')}</label>
                          <input type="text" value={pt.subtitle} onChange={(e) => updateProductText(pt.id, 'subtitle', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.summary')}</label>
                          <input type="text" value={pt.summary} onChange={(e) => updateProductText(pt.id, 'summary', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.introduction')}</label>
                        <textarea rows={2} value={pt.intro} onChange={(e) => updateProductText(pt.id, 'intro', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.fullText')}</label>
                        <textarea rows={6} value={pt.text} onChange={(e) => updateProductText(pt.id, 'text', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono" />
                      </div>
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
                            <label className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1"><ExternalLink className="w-3 h-3" /> {t('admin.productForm.externalLink')}</label>
                            <input type="url" value={pt.externalLink} onChange={(e) => updateProductText(pt.id, 'externalLink', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1"><Link2 className="w-3 h-3" /> {t('admin.productForm.internalLink')}</label>
                            <input type="text" value={pt.internalLink} onChange={(e) => updateProductText(pt.id, 'internalLink', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-xs text-neutral-500 mb-1"><FileText className="w-3 h-3" /> {t('admin.productForm.references')}</label>
                            <input type="text" value={pt.references} onChange={(e) => updateProductText(pt.id, 'references', e.target.value)} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
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
          <div className={`space-y-4 transition-opacity ${saving ? 'opacity-50 pointer-events-none' : ''}`} aria-disabled={saving || undefined}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">{t('admin.productForm.availableFormats')}</h2>
                <p className="text-sm text-neutral-500">{t('admin.productForm.formatsDescription')}</p>
              </div>
              <button
                onClick={handleAddFormat}
                className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('admin.productForm.addFormat')}
              </button>
            </div>

            {formats.length === 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
                <p className="text-neutral-500 mb-4">{t('admin.productForm.noFormatsShort')}</p>
                <button onClick={handleAddFormat} className="text-sky-600 hover:text-sky-700 font-medium">
                  {t('admin.productForm.addFirstFormat')}
                </button>
              </div>
            ) : (
              formats.map((format) => {
                const stock = getStockDisplay(format.stockQuantity, format.lowStockThreshold, t);
                const isEditing = editingFormatId === format.id;

                return (
                  <div
                    key={format.id}
                    className={`bg-white rounded-xl border ${
                      format.stockQuantity === 0 ? 'border-red-200' :
                      format.stockQuantity <= format.lowStockThreshold ? 'border-amber-200' :
                      format.isDefault ? 'border-sky-200' : 'border-neutral-200'
                    } overflow-hidden`}
                  >
                    {isEditing ? (
                      <EditFormatForm
                        format={format}
                        onSave={handleSaveFormat}
                        onCancel={() => setEditingFormatId(null)}
                      />
                    ) : (
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          {format.imageUrl ? (
                            <Image src={format.imageUrl} alt="" width={48} height={48} className="w-12 h-12 object-cover rounded-lg border" unoptimized />
                          ) : (
                            <span className="text-2xl">{FORMAT_TYPES.find(ft => ft.value === format.formatType)?.icon || '📦'}</span>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-neutral-900">{format.name}</p>
                              {format.isDefault && <span className="px-2 py-0.5 text-xs bg-sky-100 text-sky-700 rounded-full">{t('admin.productForm.default')}</span>}
                              {!format.isActive && <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{t('admin.productForm.inactive')}</span>}
                            </div>
                            <p className="text-sm text-neutral-500">
                              {format.volumeMl && `${Number(format.volumeMl)}ml`}
                              {format.dosageMg && ` · ${Number(format.dosageMg)}mg`}
                              {format.sku && ` · SKU: ${format.sku}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-end">
                            <p className="font-semibold text-neutral-900">{formatCurrency(Number(format.price))}</p>
                            {format.costPrice && <p className="text-xs text-neutral-400">{t('admin.productForm.cost')}: {formatCurrency(Number(format.costPrice))}</p>}
                            {format.comparePrice && <p className="text-xs text-neutral-400 line-through">{formatCurrency(Number(format.comparePrice))}</p>}
                          </div>
                          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${stock.color} ${stock.bg}`}>
                            {stock.text}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEditingFormatId(format.id)}
                              className="p-2 text-neutral-600 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                              aria-label="Modifier le format"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            {isOwner && (
                              <button
                                onClick={() => handleDeleteFormat(format.id)}
                                className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                aria-label="Supprimer le format"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ===== TAB: SALES (Bridge #25) ===== */}
        {activeTab === 'sales' && (
          <div className="space-y-4">
            {bridgeLoading.sales ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
            ) : salesData ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
                    <p className="text-2xl font-bold text-neutral-900">{salesData.totalUnitsSold}</p>
                    <p className="text-xs text-neutral-500">{t('admin.bridges.unitsSold') || 'Units sold'}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
                    <p className="text-2xl font-bold text-neutral-900">{salesData.totalOrders}</p>
                    <p className="text-xs text-neutral-500">{t('admin.bridges.ordersWithProduct') || 'Orders'}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
                    <p className="text-2xl font-bold text-sky-600">{formatCurrency(salesData.totalRevenue)}</p>
                    <p className="text-xs text-neutral-500">{t('admin.bridges.totalRevenue') || 'Revenue'}</p>
                  </div>
                </div>
                {salesData.recentOrders.length > 0 && (
                  <div className="bg-white rounded-xl border border-neutral-200 p-4">
                    <h3 className="text-sm font-semibold text-neutral-700 mb-3">{t('admin.bridges.recentOrders') || 'Recent orders'}</h3>
                    <div className="space-y-2">
                      {salesData.recentOrders.map((o) => (
                        <Link
                          key={o.orderId}
                          href={`/admin/commandes?orderId=${o.orderId}`}
                          className="flex items-center justify-between text-sm p-2 rounded-lg hover:bg-neutral-50 border border-neutral-100"
                        >
                          <span className="font-mono text-neutral-700">#{o.orderNumber}</span>
                          <span className="text-neutral-500">{o.quantity} x {formatCurrency(o.price)}</span>
                          <span className="text-neutral-400 text-xs">{new Date(o.date).toLocaleDateString()}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-neutral-400 text-center py-8">{t('admin.bridges.noData') || 'No sales data available'}</p>
            )}
          </div>
        )}

        {/* ===== TAB: PROMOS (Bridge #17) ===== */}
        {activeTab === 'promos' && (
          <div className="space-y-4">
            {bridgeLoading.promos ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
            ) : promosData && promosData.length > 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 p-4">
                <h3 className="text-sm font-semibold text-neutral-700 mb-3">{t('admin.bridges.activePromos') || 'Active promo codes for this product'}</h3>
                <div className="space-y-2">
                  {promosData.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                      <div>
                        <span className="font-mono font-medium text-neutral-900">{p.code}</span>
                        <span className="text-sm text-neutral-500 ms-2">
                          {p.type === 'PERCENTAGE' ? `${p.value}%` : formatCurrency(p.value)}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400">
                        {p.usageCount}{p.usageLimit ? ` / ${p.usageLimit}` : ''} {t('admin.bridges.usages') || 'uses'}
                        {p.endsAt && <span className="ms-2">→ {new Date(p.endsAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-neutral-400 text-center py-8">{t('admin.bridges.noPromos') || 'No active promo codes for this product'}</p>
            )}
          </div>
        )}

        {/* ===== TAB: VIDEOS (Bridge #27) ===== */}
        {activeTab === 'videos' && (
          <div className="space-y-4">
            {bridgeLoading.videos ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
            ) : videosData && videosData.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {videosData.map((v) => (
                  <div key={v.id} className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                    {v.thumbnailUrl && (
                      <div className="relative aspect-video bg-neutral-100">
                        <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-sm font-medium text-neutral-900 truncate">{v.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                        {v.duration && <span>{Math.floor(v.duration / 60)}:{String(v.duration % 60).padStart(2, '0')}</span>}
                        <span>{v.viewCount.toLocaleString()} {t('admin.bridges.views') || 'views'}</span>
                        {v.publishedAt && <span>{new Date(v.publishedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 text-center py-8">{t('admin.bridges.noVideos') || 'No videos linked to this product'}</p>
            )}
          </div>
        )}

        {/* ===== TAB: REVIEWS (Bridge #26) ===== */}
        {activeTab === 'reviews' && (
          <div className="space-y-4">
            {bridgeLoading.reviews ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
            ) : reviewsData ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" /> {reviewsData.avgRating}/5
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">{t('admin.bridges.avgRating') || 'Average Rating'}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-neutral-200 p-4 text-center">
                    <div className="text-2xl font-bold text-neutral-900">{reviewsData.reviewCount}</div>
                    <p className="text-xs text-neutral-500 mt-1">{t('admin.bridges.totalReviews') || 'Total Reviews'}</p>
                  </div>
                </div>
                {reviewsData.reviews.length > 0 && (
                  <div className="bg-white rounded-xl border border-neutral-200 divide-y divide-neutral-100">
                    {reviewsData.reviews.map((r) => (
                      <div key={r.id} className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex">{Array.from({ length: 5 }, (_, i) => (
                            <Star key={i} className={`w-3.5 h-3.5 ${i < r.rating ? 'fill-yellow-500 text-yellow-500' : 'text-neutral-300'}`} />
                          ))}</div>
                          <span className="text-xs text-neutral-500">{r.user.name || 'Anonymous'}</span>
                          {r.isVerified && <span className="text-xs text-green-600 font-medium">Verified</span>}
                        </div>
                        {r.title && <p className="text-sm font-medium text-neutral-900">{r.title}</p>}
                        {r.comment && <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {reviewsData.questions.length > 0 && (
                  <div className="bg-white rounded-xl border border-neutral-200">
                    <div className="px-3 py-2 border-b border-neutral-100"><span className="text-sm font-medium text-neutral-700">{t('admin.bridges.recentQuestions') || 'Recent Questions'}</span></div>
                    <div className="divide-y divide-neutral-100">
                      {reviewsData.questions.map((q) => (
                        <div key={q.id} className="p-3">
                          <p className="text-sm text-neutral-900">Q: {q.question}</p>
                          {q.answer && <p className="text-xs text-neutral-600 mt-1">A: {q.answer}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-neutral-400 text-center py-8">{t('admin.bridges.noReviews') || 'No reviews for this product'}</p>
            )}
          </div>
        )}

        {/* ===== TAB: DEALS (Bridge #28) ===== */}
        {activeTab === 'deals' && (
          <div className="space-y-4">
            {bridgeLoading.deals ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
            ) : dealsData && dealsData.length > 0 ? (
              <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-neutral-600">Deal</th>
                      <th className="px-3 py-2 text-left text-neutral-600">Stage</th>
                      <th className="px-3 py-2 text-right text-neutral-600">Qty</th>
                      <th className="px-3 py-2 text-right text-neutral-600">Total</th>
                      <th className="px-3 py-2 text-right text-neutral-600">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {dealsData.map((d) => (
                      <tr key={d.dealId} className="hover:bg-neutral-50">
                        <td className="px-3 py-2 font-medium">{d.dealTitle}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${d.isWon ? 'bg-green-100 text-green-700' : d.isLost ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                            {d.stage}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{d.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(d.total)}</td>
                        <td className="px-3 py-2 text-right text-neutral-500">{new Date(d.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-neutral-400 text-center py-8">{t('admin.bridges.noDeals') || 'No CRM deals for this product'}</p>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 id="delete-confirm-title" className="text-lg font-bold text-neutral-900 mb-2">{t('admin.productForm.deleteProductConfirm')}</h3>
            <p className="text-sm text-neutral-500 mb-6">
              {t('admin.productForm.deleteProductDescription', { name: product.name })}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50">
                {t('admin.productForm.cancel')}
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t('admin.productForm.deleting') : t('admin.productForm.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BUG-093 FIX: Custom ConfirmDialog for format deletion instead of window.confirm() */}
      <ConfirmDialog
        isOpen={formatToDelete !== null}
        title={t('admin.productForm.deleteFormatConfirm')}
        message={t('admin.productForm.deleteFormatDescription') || 'This action cannot be undone. The format and its associated data will be permanently removed.'}
        confirmLabel={t('admin.productForm.delete')}
        cancelLabel={t('admin.productForm.cancel')}
        onConfirm={confirmDeleteFormat}
        onCancel={() => setFormatToDelete(null)}
        variant="danger"
      />

      {/* Concurrent edit warning ConfirmDialog (replaces window.confirm) */}
      <ConfirmDialog
        isOpen={concurrentEditConfirm !== null}
        title={t('admin.productForm.concurrentEditTitle') || 'Concurrent Edit Detected'}
        message={t('admin.productForm.concurrentEditWarning') || 'This format was modified by another user since you started editing. Save anyway and overwrite their changes?'}
        confirmLabel={t('admin.productForm.overwrite') || 'Overwrite'}
        cancelLabel={t('common.cancel')}
        onConfirm={handleConcurrentEditConfirm}
        onCancel={() => setConcurrentEditConfirm(null)}
        variant="warning"
      />
    </div>
  );
}

// ==================== EDIT FORMAT FORM ====================

function EditFormatForm({
  format: initialFormat,
  onSave,
  onCancel,
}: {
  format: ProductFormat;
  // BUG-049 FIX: onSave now receives both the edited format and the initial format
  // so the parent can diff them and detect concurrent edits via updatedAt
  onSave: (format: ProductFormat, initialFormat: ProductFormat) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [format, setFormat] = useState({ ...initialFormat });

  const FORMAT_TYPES = getFormatTypes(t);
  const AVAILABILITY_OPTIONS = getAvailabilityOptions(t);

  const stock = getStockDisplay(format.stockQuantity, format.lowStockThreshold, t);
  const margin = format.costPrice && format.price
    ? ((Number(format.price) - Number(format.costPrice)) / Number(format.price) * 100).toFixed(1)
    : null;

  return (
    <div className="p-5 bg-neutral-50 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-neutral-900">{t('admin.productForm.editFormat')}</h3>
        <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${stock.color} ${stock.bg}`}>{stock.text}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.type')} *</label>
          <select aria-label="Type de format" value={format.formatType} onChange={(e) => setFormat({ ...format, formatType: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
            {FORMAT_TYPES.map(type => (<option key={type.value} value={type.value}>{type.icon} {type.label}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.name')} *</label>
          <input type="text" value={format.name} onChange={(e) => setFormat({ ...format, name: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.volumeMl')}</label>
          <select aria-label="Volume en ml" value={format.volumeMl || ''} onChange={(e) => setFormat({ ...format, volumeMl: e.target.value ? parseFloat(e.target.value) : null })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
            <option value="">--</option>
            {VOLUME_OPTIONS.map(v => (<option key={v} value={v}>{v} ml</option>))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.dosageMg')}</label>
          <input type="number" step="0.01" value={format.dosageMg || ''} onChange={(e) => setFormat({ ...format, dosageMg: e.target.value ? parseFloat(e.target.value) : null })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.costPrice')}</label>
          <input type="number" step="0.01" min="0" value={format.costPrice || ''} onChange={(e) => setFormat({ ...format, costPrice: e.target.value ? parseFloat(e.target.value) : null })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.sellingPrice')} *</label>
          <input type="number" step="0.01" min="0" value={format.price} onChange={(e) => setFormat({ ...format, price: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.strikethroughPrice')}</label>
          <input type="number" step="0.01" min="0" value={format.comparePrice || ''} onChange={(e) => setFormat({ ...format, comparePrice: e.target.value ? parseFloat(e.target.value) : null })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        {margin && (
          <div className="flex items-end pb-2">
            <span className={`text-sm font-medium ${parseFloat(margin) >= 50 ? 'text-green-600' : parseFloat(margin) >= 30 ? 'text-amber-600' : 'text-red-600'}`}>
              {t('admin.productForm.margin')}: {margin}%
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.stock')} *</label>
          <input type="number" min="0" value={format.stockQuantity} onChange={(e) => {
            const qty = parseInt(e.target.value) || 0;
            setFormat({ ...format, stockQuantity: qty, availability: qty === 0 ? 'OUT_OF_STOCK' : qty <= format.lowStockThreshold ? 'LIMITED' : 'IN_STOCK', inStock: qty > 0 });
          }} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.stockAlertShort')}</label>
          <input type="number" min="0" value={format.lowStockThreshold} onChange={(e) => setFormat({ ...format, lowStockThreshold: parseInt(e.target.value) || 5 })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.sku')}</label>
          <input type="text" value={format.sku || ''} onChange={(e) => setFormat({ ...format, sku: e.target.value || null })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">{t('admin.productForm.availability')}</label>
          <select aria-label="Disponibilité" value={format.availability} onChange={(e) => setFormat({ ...format, availability: e.target.value })} className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
            {AVAILABILITY_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <MediaUploader
            value={format.imageUrl || ''}
            onChange={(url) => setFormat({ ...format, imageUrl: url || null })}
            context="product-image"
            label={t('admin.productForm.formatPhoto')}
            previewSize="sm"
          />
        </div>
        <div className="flex items-end gap-4 pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={format.isDefault} onChange={(e) => setFormat({ ...format, isDefault: e.target.checked })} className="w-4 h-4 text-sky-500 border-neutral-300 rounded" />
            <span className="text-sm text-neutral-700">{t('admin.productForm.default')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={format.isActive} onChange={(e) => setFormat({ ...format, isActive: e.target.checked })} className="w-4 h-4 text-sky-500 border-neutral-300 rounded" />
            <span className="text-sm text-neutral-700">{t('admin.productForm.active')}</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-4 py-2 text-neutral-600 border border-neutral-200 rounded-lg hover:bg-neutral-50">
          {t('admin.productForm.cancel')}
        </button>
        {/* BUG-049 FIX: Pass both edited and initial format for concurrent edit detection */}
        <button onClick={() => onSave(format, initialFormat)} className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600">
          {t('admin.productForm.save')}
        </button>
      </div>
    </div>
  );
}
