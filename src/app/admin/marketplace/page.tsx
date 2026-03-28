'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Package,
  Star,
  Download,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Truck,
  CreditCard,
  Megaphone,
  Globe,
  Share2,
  Zap,
  Calculator,
  MessageSquare,
  Bot,
  Grid3X3,
  List,
  X,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { EmptyState } from '@/components/admin/EmptyState';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetch-with-retry';
import { addCSRFHeader } from '@/lib/csrf';

// ── Types ─────────────────────────────────────────────────────

interface AppListing {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  icon: string | null;
  developerName: string;
  pricing: string;
  monthlyPrice: number | null;
  rating: number;
  reviewCount: number;
  installCount: number;
  isVerified: boolean;
  isFeatured: boolean;
  isInstalled: boolean;
  permissions: string[];
  createdAt: string;
}

interface AppDetail extends AppListing {
  description: string;
  screenshots: string[];
  developerUrl: string | null;
  websiteUrl: string | null;
  documentationUrl: string | null;
}

interface Review {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  createdAt: string;
}

// ── Category Configuration ────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof Package; color: string }> = {
  shipping: { label: 'Livraison', icon: Truck, color: 'text-blue-500' },
  payments: { label: 'Paiements', icon: CreditCard, color: 'text-green-500' },
  marketing: { label: 'Marketing', icon: Megaphone, color: 'text-purple-500' },
  seo: { label: 'SEO', icon: Globe, color: 'text-orange-500' },
  social: { label: 'Social', icon: Share2, color: 'text-pink-500' },
  productivity: { label: 'Productivit\u00e9', icon: Zap, color: 'text-yellow-500' },
  accounting: { label: 'Comptabilit\u00e9', icon: Calculator, color: 'text-teal-500' },
  communication: { label: 'Communication', icon: MessageSquare, color: 'text-indigo-500' },
  ai: { label: 'Intelligence artificielle', icon: Bot, color: 'text-violet-500' },
};

const PRICING_LABELS: Record<string, string> = {
  free: 'Gratuit',
  freemium: 'Freemium',
  paid: 'Payant',
  contact: 'Sur demande',
};

// ── Helpers ───────────────────────────────────────────────────

function formatPrice(price: number | null, pricing: string): string {
  if (pricing === 'free') return 'Gratuit';
  if (pricing === 'contact') return 'Sur demande';
  if (price != null) return `${price.toFixed(2)} $/mois`;
  if (pricing === 'freemium') return 'Gratuit + options';
  return pricing;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const stars = [];
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5';
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`${sizeClass} ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    );
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
}

// ── Main Component ────────────────────────────────────────────

export default function MarketplacePage() {
  const { t } = useI18n();

  // State
  const [apps, setApps] = useState<AppListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPricing, setSelectedPricing] = useState<string>('');
  const [showFeatured, setShowFeatured] = useState(false);
  const [showInstalled, setShowInstalled] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedApp, setSelectedApp] = useState<AppDetail | null>(null);
  const [selectedAppReviews, setSelectedAppReviews] = useState<Review[]>([]);
  const [installing, setInstalling] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);

  // Review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewContent, setReviewContent] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // ── Fetch apps ──────────────────────────────────────────────

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedPricing) params.set('pricing', selectedPricing);
      if (showFeatured) params.set('featured', 'true');

      const res = await fetchWithRetry(`/api/admin/marketplace?${params.toString()}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.data)) {
        setApps(data.data);
        setTotal(data.pagination?.total ?? data.data.length);
        // Extract categories from first item's _extra if available
        if (data.data.length > 0 && data.data[0]._extra?.categories) {
          setCategories(data.data[0]._extra.categories);
        }
      }
    } catch {
      toast.error('Erreur lors du chargement des applications');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedPricing, showFeatured]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // ── Filtered apps (client-side for "installed" filter) ──────

  const displayedApps = useMemo(() => {
    if (showInstalled) return apps.filter((a) => a.isInstalled);
    return apps;
  }, [apps, showInstalled]);

  // ── Fetch app detail ────────────────────────────────────────

  const openAppDetail = useCallback(async (app: AppListing) => {
    try {
      // For detail, fetch the full app from the API (or we already have enough data)
      // We use the listing data plus fetch reviews
      setSelectedApp({
        ...app,
        description: '',
        screenshots: [],
        developerUrl: null,
        websiteUrl: null,
        documentationUrl: null,
      });

      // Fetch reviews
      const res = await fetchWithRetry(`/api/admin/marketplace/${app.id}/review?limit=20`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSelectedAppReviews(data.data);
      }
    } catch {
      // Reviews not critical
    }
  }, []);

  // ── Install / Uninstall ─────────────────────────────────────

  const handleInstall = useCallback(async (appId: string) => {
    setInstalling(appId);
    try {
      const res = await fetchWithRetry(`/api/admin/marketplace/${appId}/install`, {
        method: 'POST',
        headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.data.appName} install\u00e9e avec succ\u00e8s`);
        setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, isInstalled: true, installCount: a.installCount + 1 } : a)));
        if (selectedApp?.id === appId) {
          setSelectedApp((prev) => prev ? { ...prev, isInstalled: true, installCount: prev.installCount + 1 } : prev);
        }
      } else {
        toast.error(data.error?.message || 'Erreur lors de l\'installation');
      }
    } catch {
      toast.error('Erreur lors de l\'installation');
    } finally {
      setInstalling(null);
    }
  }, [selectedApp]);

  const handleUninstall = useCallback(async (appId: string) => {
    setInstalling(appId);
    try {
      const res = await fetchWithRetry(`/api/admin/marketplace/${appId}/install`, {
        method: 'DELETE',
        headers: addCSRFHeader(),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Application d\u00e9sinstall\u00e9e');
        setApps((prev) => prev.map((a) => (a.id === appId ? { ...a, isInstalled: false } : a)));
        if (selectedApp?.id === appId) {
          setSelectedApp((prev) => prev ? { ...prev, isInstalled: false } : prev);
        }
      } else {
        toast.error(data.error?.message || 'Erreur lors de la d\u00e9sinstallation');
      }
    } catch {
      toast.error('Erreur lors de la d\u00e9sinstallation');
    } finally {
      setInstalling(null);
    }
  }, [selectedApp]);

  // ── Submit review ───────────────────────────────────────────

  const handleSubmitReview = useCallback(async () => {
    if (!selectedApp) return;
    setSubmittingReview(true);
    try {
      const res = await fetchWithRetry(`/api/admin/marketplace/${selectedApp.id}/review`, {
        method: 'POST',
        headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: reviewRating,
          title: reviewTitle || undefined,
          content: reviewContent || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Avis soumis avec succ\u00e8s');
        setShowReviewForm(false);
        setReviewTitle('');
        setReviewContent('');
        setReviewRating(5);
        // Refresh reviews
        const revRes = await fetchWithRetry(`/api/admin/marketplace/${selectedApp.id}/review?limit=20`);
        const revData = await revRes.json();
        if (revData.success) setSelectedAppReviews(revData.data);
      } else {
        toast.error(data.error?.message || 'Erreur lors de la soumission');
      }
    } catch {
      toast.error('Erreur lors de la soumission');
    } finally {
      setSubmittingReview(false);
    }
  }, [selectedApp, reviewRating, reviewTitle, reviewContent]);

  // ── Stats ───────────────────────────────────────────────────

  const installedCount = useMemo(() => apps.filter((a) => a.isInstalled).length, [apps]);
  const featuredCount = useMemo(() => apps.filter((a) => a.isFeatured).length, [apps]);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--k-border)]">
        <div>
          <h1 className="text-lg font-semibold text-[var(--k-text-primary)]">
            {t('admin.marketplace.title')}
          </h1>
          <p className="text-sm text-[var(--k-text-secondary)] mt-0.5">
            {t('admin.marketplace.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--k-text-muted)]">
            {total} {t('admin.marketplace.apps')} &middot; {installedCount} {t('admin.marketplace.installed')}
          </span>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-[var(--k-border)] bg-[var(--k-bg-secondary)]">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.marketplace.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--k-border)] bg-[var(--k-bg-primary)] text-[var(--k-text-primary)] placeholder:text-[var(--k-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--k-accent)]/30 focus:border-[var(--k-accent)]"
          />
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-[var(--k-border)] bg-[var(--k-bg-primary)] text-[var(--k-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--k-accent)]/30"
          >
            <option value="">{t('admin.marketplace.allCategories')}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_CONFIG[cat]?.label || cat}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
        </div>

        {/* Pricing filter */}
        <div className="relative">
          <select
            value={selectedPricing}
            onChange={(e) => setSelectedPricing(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm rounded-lg border border-[var(--k-border)] bg-[var(--k-bg-primary)] text-[var(--k-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--k-accent)]/30"
          >
            <option value="">{t('admin.marketplace.allPricing')}</option>
            {Object.entries(PRICING_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--k-text-muted)] pointer-events-none" />
        </div>

        {/* Toggle buttons */}
        <button
          onClick={() => setShowFeatured(!showFeatured)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
            showFeatured
              ? 'bg-[var(--k-accent)] text-white border-[var(--k-accent)]'
              : 'border-[var(--k-border)] text-[var(--k-text-secondary)] hover:bg-[var(--k-bg-hover)]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {t('admin.marketplace.featured')} ({featuredCount})
        </button>

        <button
          onClick={() => setShowInstalled(!showInstalled)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors ${
            showInstalled
              ? 'bg-[var(--k-accent)] text-white border-[var(--k-accent)]'
              : 'border-[var(--k-border)] text-[var(--k-text-secondary)] hover:bg-[var(--k-bg-hover)]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t('admin.marketplace.installed')} ({installedCount})
        </button>

        {/* View mode */}
        <div className="flex items-center border border-[var(--k-border)] rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' ? 'bg-[var(--k-accent)] text-white' : 'text-[var(--k-text-muted)] hover:bg-[var(--k-bg-hover)]'}`}
            aria-label="Grid view"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 ${viewMode === 'list' ? 'bg-[var(--k-accent)] text-white' : 'text-[var(--k-text-muted)] hover:bg-[var(--k-bg-hover)]'}`}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-[var(--k-border)] bg-[var(--k-bg-secondary)] p-5 h-48" />
            ))}
          </div>
        ) : displayedApps.length === 0 ? (
          <EmptyState
            icon={Package}
            title={t('admin.marketplace.noApps')}
            description={t('admin.marketplace.noAppsDesc')}
          />
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedApps.map((app) => (
              <AppCard
                key={app.id}
                app={app}
                onSelect={() => openAppDetail(app)}
                onInstall={() => handleInstall(app.id)}
                onUninstall={() => handleUninstall(app.id)}
                installing={installing === app.id}
              />
            ))}
          </div>
        ) : (
          /* List View */
          <div className="flex flex-col gap-2">
            {displayedApps.map((app) => (
              <AppRow
                key={app.id}
                app={app}
                onSelect={() => openAppDetail(app)}
                onInstall={() => handleInstall(app.id)}
                onUninstall={() => handleUninstall(app.id)}
                installing={installing === app.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Panel (slide-over) */}
      {selectedApp && (
        <AppDetailPanel
          app={selectedApp}
          reviews={selectedAppReviews}
          installing={installing === selectedApp.id}
          onClose={() => { setSelectedApp(null); setShowReviewForm(false); }}
          onInstall={() => handleInstall(selectedApp.id)}
          onUninstall={() => handleUninstall(selectedApp.id)}
          showReviewForm={showReviewForm}
          onToggleReviewForm={() => setShowReviewForm(!showReviewForm)}
          reviewRating={reviewRating}
          onReviewRatingChange={setReviewRating}
          reviewTitle={reviewTitle}
          onReviewTitleChange={setReviewTitle}
          reviewContent={reviewContent}
          onReviewContentChange={setReviewContent}
          onSubmitReview={handleSubmitReview}
          submittingReview={submittingReview}
        />
      )}
    </div>
  );
}

// ── App Card (Grid) ───────────────────────────────────────────

function AppCard({
  app,
  onSelect,
  onInstall,
  onUninstall,
  installing,
}: {
  app: AppListing;
  onSelect: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  installing: boolean;
}) {
  const catConfig = CATEGORY_CONFIG[app.category];

  return (
    <div
      className="group relative rounded-xl border border-[var(--k-border)] bg-[var(--k-bg-primary)] p-5 hover:border-[var(--k-accent)]/40 hover:shadow-lg transition-all cursor-pointer"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      {/* Featured badge */}
      {app.isFeatured && (
        <div className="absolute top-3 right-3">
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
            <Sparkles className="w-3 h-3" /> Vedette
          </span>
        </div>
      )}

      {/* Icon + Name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-[var(--k-bg-secondary)] border border-[var(--k-border)] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {app.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={app.icon} alt={app.name} className="w-8 h-8 object-contain" />
          ) : (
            <Package className={`w-6 h-6 ${catConfig?.color || 'text-gray-400'}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[var(--k-text-primary)] truncate">
            {app.name}
            {app.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-blue-500 inline ml-1" />}
          </h3>
          <p className="text-xs text-[var(--k-text-muted)]">{app.developerName}</p>
        </div>
      </div>

      {/* Tagline */}
      <p className="text-xs text-[var(--k-text-secondary)] line-clamp-2 mb-3 min-h-[2rem]">
        {app.tagline}
      </p>

      {/* Category + Rating */}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--k-bg-secondary)] ${catConfig?.color || 'text-gray-500'}`}>
          {catConfig?.label || app.category}
        </span>
        <div className="flex items-center gap-1">
          <StarRating rating={app.rating} />
          <span className="text-[10px] text-[var(--k-text-muted)]">({app.reviewCount})</span>
        </div>
      </div>

      {/* Footer: Price + Install */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--k-border)]">
        <span className="text-xs font-medium text-[var(--k-text-secondary)]">
          {formatPrice(app.monthlyPrice, app.pricing)}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          {app.isInstalled ? (
            <button
              onClick={onUninstall}
              disabled={installing}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {installing ? (
                <span className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
              D\u00e9sinstaller
            </button>
          ) : (
            <button
              onClick={onInstall}
              disabled={installing}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[var(--k-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-colors"
            >
              {installing ? (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              Installer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── App Row (List) ────────────────────────────────────────────

function AppRow({
  app,
  onSelect,
  onInstall,
  onUninstall,
  installing,
}: {
  app: AppListing;
  onSelect: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  installing: boolean;
}) {
  const catConfig = CATEGORY_CONFIG[app.category];

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-lg border border-[var(--k-border)] bg-[var(--k-bg-primary)] hover:border-[var(--k-accent)]/40 hover:bg-[var(--k-bg-hover)] transition-all cursor-pointer"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-[var(--k-bg-secondary)] border border-[var(--k-border)] flex items-center justify-center flex-shrink-0 overflow-hidden">
        {app.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={app.icon} alt={app.name} className="w-7 h-7 object-contain" />
        ) : (
          <Package className={`w-5 h-5 ${catConfig?.color || 'text-gray-400'}`} />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--k-text-primary)] truncate">{app.name}</span>
          {app.isVerified && <ShieldCheck className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
          {app.isFeatured && (
            <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
              <Sparkles className="w-2.5 h-2.5" /> Vedette
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--k-text-secondary)] truncate">{app.tagline}</p>
      </div>

      {/* Category */}
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--k-bg-secondary)] ${catConfig?.color || 'text-gray-500'} flex-shrink-0 hidden sm:block`}>
        {catConfig?.label || app.category}
      </span>

      {/* Rating */}
      <div className="flex items-center gap-1 flex-shrink-0 hidden md:flex">
        <StarRating rating={app.rating} />
        <span className="text-[10px] text-[var(--k-text-muted)]">({app.reviewCount})</span>
      </div>

      {/* Downloads */}
      <span className="text-xs text-[var(--k-text-muted)] flex-shrink-0 hidden lg:block w-16 text-right">
        {app.installCount.toLocaleString()} <Download className="w-3 h-3 inline" />
      </span>

      {/* Price */}
      <span className="text-xs font-medium text-[var(--k-text-secondary)] flex-shrink-0 w-24 text-right hidden md:block">
        {formatPrice(app.monthlyPrice, app.pricing)}
      </span>

      {/* Install button */}
      <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {app.isInstalled ? (
          <button
            onClick={onUninstall}
            disabled={installing}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {installing ? (
              <span className="w-3 h-3 border-2 border-red-300 border-t-transparent rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            Install\u00e9e
          </button>
        ) : (
          <button
            onClick={onInstall}
            disabled={installing}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-[var(--k-accent)] text-white hover:opacity-90 disabled:opacity-50 transition-colors"
          >
            {installing ? (
              <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            Installer
          </button>
        )}
      </div>
    </div>
  );
}

// ── App Detail Panel (slide-over) ─────────────────────────────

function AppDetailPanel({
  app,
  reviews,
  installing,
  onClose,
  onInstall,
  onUninstall,
  showReviewForm,
  onToggleReviewForm,
  reviewRating,
  onReviewRatingChange,
  reviewTitle,
  onReviewTitleChange,
  reviewContent,
  onReviewContentChange,
  onSubmitReview,
  submittingReview,
}: {
  app: AppDetail;
  reviews: Review[];
  installing: boolean;
  onClose: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  showReviewForm: boolean;
  onToggleReviewForm: () => void;
  reviewRating: number;
  onReviewRatingChange: (r: number) => void;
  reviewTitle: string;
  onReviewTitleChange: (v: string) => void;
  reviewContent: string;
  onReviewContentChange: (v: string) => void;
  onSubmitReview: () => void;
  submittingReview: boolean;
}) {
  const catConfig = CATEGORY_CONFIG[app.category];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-label="Fermer"
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-[var(--k-bg-primary)] border-l border-[var(--k-border)] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--k-border)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[var(--k-bg-secondary)] border border-[var(--k-border)] flex items-center justify-center overflow-hidden">
              {app.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={app.icon} alt={app.name} className="w-8 h-8 object-contain" />
              ) : (
                <Package className={`w-6 h-6 ${catConfig?.color || 'text-gray-400'}`} />
              )}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--k-text-primary)] flex items-center gap-1.5">
                {app.name}
                {app.isVerified && <ShieldCheck className="w-4 h-4 text-blue-500" />}
              </h2>
              <p className="text-xs text-[var(--k-text-muted)]">{app.developerName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--k-bg-hover)] text-[var(--k-text-muted)]"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Tagline */}
          <p className="text-sm text-[var(--k-text-secondary)]">{app.tagline}</p>

          {/* Metadata */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <StarRating rating={app.rating} size="md" />
              </div>
              <p className="text-xs text-[var(--k-text-muted)]">{app.rating.toFixed(1)} ({app.reviewCount} avis)</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-[var(--k-text-primary)]">{app.installCount.toLocaleString()}</p>
              <p className="text-xs text-[var(--k-text-muted)]">Installations</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-[var(--k-text-primary)]">{formatPrice(app.monthlyPrice, app.pricing)}</p>
              <p className="text-xs text-[var(--k-text-muted)]">Prix</p>
            </div>
          </div>

          {/* Category & badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--k-bg-secondary)] ${catConfig?.color || 'text-gray-500'}`}>
              {catConfig?.label || app.category}
            </span>
            {app.isFeatured && (
              <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
                <Sparkles className="w-3 h-3" /> Vedette
              </span>
            )}
            {app.isInstalled && (
              <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="w-3 h-3" /> Install\u00e9e
              </span>
            )}
          </div>

          {/* Permissions */}
          {Array.isArray(app.permissions) && app.permissions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[var(--k-text-primary)] uppercase tracking-wider mb-2">
                Permissions requises
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(app.permissions as string[]).map((perm) => (
                  <span
                    key={perm}
                    className="text-[10px] px-2 py-0.5 rounded bg-[var(--k-bg-secondary)] text-[var(--k-text-muted)] border border-[var(--k-border)]"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Links */}
          <div className="flex flex-wrap gap-3">
            {app.websiteUrl && (
              <a
                href={app.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--k-accent)] hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Site web
              </a>
            )}
            {app.documentationUrl && (
              <a
                href={app.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[var(--k-accent)] hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Documentation
              </a>
            )}
          </div>

          {/* Reviews */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[var(--k-text-primary)] uppercase tracking-wider">
                Avis ({reviews.length})
              </h3>
              {app.isInstalled && (
                <button
                  onClick={onToggleReviewForm}
                  className="text-xs text-[var(--k-accent)] hover:underline"
                >
                  {showReviewForm ? 'Annuler' : 'Laisser un avis'}
                </button>
              )}
            </div>

            {/* Review form */}
            {showReviewForm && (
              <div className="mb-4 p-4 rounded-lg border border-[var(--k-border)] bg-[var(--k-bg-secondary)] space-y-3">
                <div>
                  <label className="text-xs text-[var(--k-text-secondary)] block mb-1">Note</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => onReviewRatingChange(n)}
                        className="p-0.5"
                        aria-label={`${n} \u00e9toile${n > 1 ? 's' : ''}`}
                      >
                        <Star
                          className={`w-5 h-5 ${n <= reviewRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-[var(--k-text-secondary)] block mb-1">Titre (optionnel)</label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => onReviewTitleChange(e.target.value)}
                    placeholder="R\u00e9sum\u00e9 de votre avis..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--k-border)] bg-[var(--k-bg-primary)] text-[var(--k-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--k-accent)]/30"
                    maxLength={200}
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--k-text-secondary)] block mb-1">Commentaire (optionnel)</label>
                  <textarea
                    value={reviewContent}
                    onChange={(e) => onReviewContentChange(e.target.value)}
                    placeholder="Partagez votre exp\u00e9rience..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--k-border)] bg-[var(--k-bg-primary)] text-[var(--k-text-primary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--k-accent)]/30"
                    maxLength={2000}
                  />
                </div>
                <Button
                  onClick={onSubmitReview}
                  disabled={submittingReview}
                  className="w-full"
                >
                  {submittingReview ? 'Envoi...' : 'Soumettre l\'avis'}
                </Button>
              </div>
            )}

            {/* Review list */}
            {reviews.length === 0 ? (
              <p className="text-xs text-[var(--k-text-muted)] italic">Aucun avis pour le moment</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="p-3 rounded-lg border border-[var(--k-border)] bg-[var(--k-bg-secondary)]">
                    <div className="flex items-center justify-between mb-1">
                      <StarRating rating={review.rating} />
                      <span className="text-[10px] text-[var(--k-text-muted)]">
                        {new Date(review.createdAt).toLocaleDateString('fr-CA')}
                      </span>
                    </div>
                    {review.title && (
                      <p className="text-xs font-medium text-[var(--k-text-primary)]">{review.title}</p>
                    )}
                    {review.content && (
                      <p className="text-xs text-[var(--k-text-secondary)] mt-1">{review.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Install/Uninstall action */}
        <div className="px-6 py-4 border-t border-[var(--k-border)]">
          {app.isInstalled ? (
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={onUninstall}
                disabled={installing}
                className="flex-1"
              >
                {installing ? 'D\u00e9sinstallation...' : 'D\u00e9sinstaller'}
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Fermer
              </Button>
            </div>
          ) : (
            <Button
              onClick={onInstall}
              disabled={installing}
              className="w-full"
            >
              {installing ? 'Installation...' : `Installer ${formatPrice(app.monthlyPrice, app.pricing) !== 'Gratuit' ? `\u2014 ${formatPrice(app.monthlyPrice, app.pricing)}` : '(Gratuit)'}`}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
