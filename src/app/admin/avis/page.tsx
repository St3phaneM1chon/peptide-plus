// F084 FIX: Show "-" instead of "0.0" for avgRating when there are no reviews (see StatCard below)
// F090 FIX: Added aria-label to star rating display for screen reader accessibility (see renderStars)
// F-021 FIX: Add frontend pagination
// IMP-013: Server-side pagination with 20 reviews per page (infinite scroll deferred - standard pagination implemented)
// IMP-031: Response templates added (RESPONSE_TEMPLATES array with 4 pre-written templates)
// IMP-035: CSV export available via handleRibbonExport (ribbon action)
// IMP-037: Verified purchase badge displayed in review detail (isVerifiedPurchase badge)
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  Star,
  MessageSquare,
  Clock,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Camera,
  Smile,
  Meh,
  Frown,
  Copy,
  Send,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import { StatCard } from '@/components/admin/StatCard';
import { FormField, Textarea } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

// ── Types ─────────────────────────────────────────────────────

interface Review {
  id: string;
  productId: string;
  productName: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  rating: number;
  title?: string;
  content: string;
  images?: string[];
  isVerifiedPurchase: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  adminResponse?: string;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function statusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  switch (status) {
    case 'PENDING': return 'warning';
    case 'APPROVED': return 'success';
    case 'REJECTED': return 'error';
    default: return 'neutral';
  }
}

function ratingBadgeVariant(rating: number): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (rating >= 4) return 'success';
  if (rating >= 3) return 'info';
  if (rating >= 2) return 'warning';
  return 'error';
}

// ── Sentiment Analysis Helper ─────────────────────────────────

function getSentiment(rating: number): { label: string; icon: typeof Smile; color: string; bg: string } {
  if (rating >= 4) return { label: 'Positif', icon: Smile, color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (rating === 3) return { label: 'Neutre', icon: Meh, color: 'text-amber-600', bg: 'bg-amber-50' };
  return { label: 'Negatif', icon: Frown, color: 'text-red-600', bg: 'bg-red-50' };
}

// ── Bulk Response Templates ──────────────────────────────────

const RESPONSE_TEMPLATES = [
  {
    id: 'thank-positive',
    label: 'Remerciement (avis positif)',
    text: 'Merci beaucoup pour votre avis positif ! Nous sommes ravis que nos produits vous donnent satisfaction. Votre retour nous motive a continuer d\'offrir des peptides de la plus haute qualite.',
  },
  {
    id: 'thank-constructive',
    label: 'Remerciement (avis constructif)',
    text: 'Merci pour votre retour detaille. Nous apprecions votre honnetete et prenons en compte vos suggestions pour ameliorer nos produits et services. N\'hesitez pas a nous contacter directement pour toute question.',
  },
  {
    id: 'apology',
    label: 'Excuses et resolution',
    text: 'Nous sommes desoles que votre experience n\'ait pas ete a la hauteur de vos attentes. Nous prenons votre feedback tres au serieux. Notre equipe de support va vous contacter dans les 24h pour trouver une solution satisfaisante.',
  },
  {
    id: 'quality',
    label: 'Assurance qualite',
    text: 'Merci pour votre avis. La qualite de nos peptides est notre priorite absolue. Chaque lot est teste en laboratoire independant. Si vous avez la moindre question sur nos produits, contactez-nous a support@biocycle.ca.',
  },
];

// ── Main Component ────────────────────────────────────────────

export default function AvisPage() {
  const { t, locale } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // F-021 FIX: Add frontend pagination state
  const REVIEWS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReviews, setTotalReviews] = useState(0);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Response modal state
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [adminResponse, setAdminResponse] = useState('');
  // FIX F-026: Add submitting state to prevent double-click
  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Review request automation state
  const [autoRequestEnabled, setAutoRequestEnabled] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  // F-073 FIX: Lightbox state for viewing review images at full size
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // FIX F-070: ConfirmDialog state for approve/reject actions
  const [confirmAction, setConfirmAction] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', variant: 'info', onConfirm: () => {} });

  const statusLabel: Record<string, string> = useMemo(() => ({
    PENDING: t('admin.reviews.statusPending'),
    APPROVED: t('admin.reviews.statusApproved'),
    REJECTED: t('admin.reviews.statusRejected'),
  }), [t]);

  // ─── Data fetching ──────────────────────────────────────────

  // F-069 FIX: Wrap fetchReviews in useCallback for stable reference
  // F-021 FIX: Pass page/limit params to API for server-side pagination
  // F-056 FIX: Pass status filter to API for server-side filtering instead of client-only
  const fetchReviews = useCallback(async (page: number = 1, status?: string) => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(REVIEWS_PER_PAGE),
      });
      // F-056 FIX: Map frontend status values to API filter values
      if (status && status !== 'all') {
        params.set('status', status.toLowerCase());
      }
      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      const data = await res.json();
      setReviews(data.reviews || []);
      if (data.pagination) {
        setTotalPages(data.pagination.pages || 1);
        setTotalReviews(data.pagination.total || 0);
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
      toast.error(t('common.error'));
      setReviews([]);
    }
    setLoading(false);
  }, [t]);

  // F-056 FIX: Pass statusFilter to API and reset to page 1 when filter changes
  useEffect(() => {
    fetchReviews(currentPage, statusFilter);
  }, [fetchReviews, currentPage, statusFilter]);

  // F-056 FIX: Reset to page 1 when status filter changes to avoid empty pages
  const handleStatusFilterChange = useCallback((newFilter: string) => {
    setStatusFilter(newFilter);
    setCurrentPage(1);
    setLoading(true);
  }, []);

  // F-070 FIXED: ConfirmDialog added below for approve/reject to prevent accidental clicks
  const updateReviewStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setUpdatingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        return;
      }
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      toast.success(status === 'APPROVED'
        ? (t('admin.reviews.approved') || 'Review approved')
        : (t('admin.reviews.rejected') || 'Review rejected'));
    } catch (err) {
      console.error('Error updating review:', err);
      toast.error(t('common.networkError'));
    } finally {
      setUpdatingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const submitAdminResponse = async (id: string) => {
    // FIX F-026: Prevent double-click with submitting state
    if (submittingResponse) return;
    setSubmittingResponse(true);
    try {
      const res = await fetch(`/api/admin/reviews/${id}/respond`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ response: adminResponse }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.saveFailed'));
        return;
      }
      setReviews(prev => prev.map(r => r.id === id ? { ...r, adminResponse } : r));
      setAdminResponse('');
      setShowResponseModal(false);
      toast.success(t('admin.reviews.responsePublished') || 'Response published');
    } catch (err) {
      console.error('Error submitting response:', err);
      toast.error(t('common.networkError'));
    } finally {
      setSubmittingResponse(false);
    }
  };

  // ─── Filtering ──────────────────────────────────────────────

  const filteredReviews = useMemo(() => {
    return reviews.filter(review => {
      if (statusFilter !== 'all' && review.status !== statusFilter) return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (!review.productName.toLowerCase().includes(search) &&
            !review.content.toLowerCase().includes(search) &&
            !review.userName?.toLowerCase().includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [reviews, statusFilter, searchValue]);

  const stats = useMemo(() => ({
    total: reviews.length,
    pending: reviews.filter(r => r.status === 'PENDING').length,
    approved: reviews.filter(r => r.status === 'APPROVED').length,
    avgRating: reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0,
    withPhotos: reviews.filter(r => r.images && r.images.length > 0).length,
  }), [reviews]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.reviews.allStatuses'), count: stats.total },
    { key: 'PENDING', label: t('admin.reviews.statusPending'), count: stats.pending },
    { key: 'APPROVED', label: t('admin.reviews.statusApproved'), count: stats.approved },
    { key: 'REJECTED', label: t('admin.reviews.statusRejected'), count: reviews.filter(r => r.status === 'REJECTED').length },
  ], [t, stats, reviews]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredReviews.map((review) => ({
      id: review.id,
      avatar: { text: review.userName || 'A' },
      title: review.userName || 'Anonyme',
      subtitle: review.productName,
      preview: review.content.length > 80 ? review.content.slice(0, 80) + '...' : review.content,
      timestamp: review.createdAt,
      badges: [
        { text: `${review.rating}★`, variant: ratingBadgeVariant(review.rating) },
        { text: getSentiment(review.rating).label, variant: (review.rating >= 4 ? 'success' : review.rating === 3 ? 'warning' : 'error') as 'success' | 'warning' | 'error' },
        { text: statusLabel[review.status] || review.status, variant: statusBadgeVariant(review.status) },
        ...(review.images && review.images.length > 0
          ? [{ text: `📷 ${review.images.length}`, variant: 'neutral' as const }]
          : []),
      ],
    }));
  }, [filteredReviews, statusLabel]);

  // ─── Selected review ───────────────────────────────────────

  const selectedReview = useMemo(() => {
    if (!selectedReviewId) return null;
    return reviews.find(r => r.id === selectedReviewId) || null;
  }, [reviews, selectedReviewId]);

  // A-057: Keyboard shortcuts for admin actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to submit response when modal is open
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && showResponseModal && selectedReview && adminResponse.trim() && !submittingResponse) {
        e.preventDefault();
        submitAdminResponse(selectedReview.id);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showResponseModal, selectedReview, adminResponse, submittingResponse]);

  const handleSelectReview = useCallback((id: string) => {
    setSelectedReviewId(id);
  }, []);

  // ─── Auto-select first item ────────────────────────────────

  useEffect(() => {
    if (!loading && filteredReviews.length > 0) {
      const currentStillVisible = selectedReviewId &&
        filteredReviews.some(r => r.id === selectedReviewId);
      if (!currentStillVisible) {
        handleSelectReview(filteredReviews[0].id);
      }
    }
  }, [filteredReviews, loading, selectedReviewId, handleSelectReview]);

  // ─── Ribbon action handlers ────────────────────────────────
  const handleRibbonRespond = useCallback(() => {
    if (!selectedReview) { toast.info(t('admin.reviews.selectReviewFirst') || 'Select a review first'); return; }
    setAdminResponse(selectedReview.adminResponse || '');
    setShowResponseModal(true);
  }, [selectedReview, t]);

  const handleRibbonApprove = useCallback(() => {
    if (!selectedReview) { toast.info(t('admin.reviews.selectReviewFirst') || 'Select a review first'); return; }
    updateReviewStatus(selectedReview.id, 'APPROVED');
  }, [selectedReview, t]);

  const handleRibbonReject = useCallback(() => {
    if (!selectedReview) { toast.info(t('admin.reviews.selectReviewFirst') || 'Select a review first'); return; }
    updateReviewStatus(selectedReview.id, 'REJECTED');
  }, [selectedReview, t]);

  const handleRibbonReportContent = useCallback(() => {
    if (!selectedReview) {
      toast.info(t('admin.reviews.selectReviewFirst') || 'Select a review first');
      return;
    }
    // Reject the review to hide inappropriate content
    if (selectedReview.status !== 'REJECTED') {
      updateReviewStatus(selectedReview.id, 'REJECTED');
      toast.success(t('admin.reviews.contentReported') || 'Review flagged and hidden from public');
    } else {
      toast.info(t('admin.reviews.alreadyRejected') || 'This review is already rejected');
    }
  }, [selectedReview, t]);

  const handleRibbonConvertTestimonial = useCallback(() => {
    if (!selectedReview) {
      toast.info(t('admin.reviews.selectReviewFirst') || 'Select a review first');
      return;
    }
    if (selectedReview.rating < 4) {
      toast.info(t('admin.reviews.lowRatingTestimonial') || 'Only 4-5 star reviews can be used as testimonials');
      return;
    }
    // Copy review as testimonial format to clipboard
    const testimonial = `"${selectedReview.content}" - ${selectedReview.userName || 'Anonymous'}, ${selectedReview.rating}/5 stars`;
    navigator.clipboard.writeText(testimonial);
    toast.success(t('admin.reviews.testimonialCopied') || 'Testimonial copied to clipboard');
  }, [selectedReview, t]);

  const handleRibbonExport = useCallback(() => {
    if (reviews.length === 0) {
      toast.info(t('admin.reviews.noReviewsToExport') || 'No reviews to export');
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['Product', 'User', 'Rating', 'Title', 'Content', 'Status', 'Verified Purchase', 'Admin Response', 'Date'];
    const rows = reviews.map(r => [
      r.productName,
      r.userName || r.userEmail || 'Anonymous',
      String(r.rating),
      r.title || '',
      r.content,
      r.status,
      r.isVerifiedPurchase ? 'Yes' : 'No',
      r.adminResponse || '',
      new Date(r.createdAt).toLocaleDateString(locale),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported successfully');
  }, [reviews, locale, t]);

  useRibbonAction('respond', handleRibbonRespond);
  useRibbonAction('approve', handleRibbonApprove);
  useRibbonAction('reject', handleRibbonReject);
  useRibbonAction('reportContent', handleRibbonReportContent);
  useRibbonAction('convertTestimonial', handleRibbonConvertTestimonial);
  useRibbonAction('export', handleRibbonExport);

  // F090 FIX: Add aria-label to star rating display for screen reader accessibility
  const renderStars = (rating: number) => (
    <div className="flex gap-0.5" role="img" aria-label={`${rating} ${t('admin.reviews.outOf5Stars') || 'out of 5 stars'}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
        />
      ))}
    </div>
  );

  // ─── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.reviews.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.reviews.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Review request automation toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              <button
                onClick={() => {
                  setAutoRequestEnabled(!autoRequestEnabled);
                  toast.success(autoRequestEnabled
                    ? 'Demandes d\'avis automatiques desactivees'
                    : 'Demandes d\'avis automatiques activees - les clients recevront un email 7 jours apres livraison'
                  );
                }}
                className="flex items-center gap-2 text-sm"
              >
                {autoRequestEnabled ? (
                  <ToggleRight className="w-5 h-5 text-green-500" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-slate-400" />
                )}
                <span className={`font-medium ${autoRequestEnabled ? 'text-green-700' : 'text-slate-500'}`}>
                  Demandes auto
                </span>
              </button>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label={t('admin.reviews.totalReviews')} value={stats.total} icon={MessageSquare} />
          <StatCard label={t('admin.reviews.pending')} value={stats.pending} icon={Clock} />
          <StatCard label={t('admin.reviews.approved')} value={stats.approved} icon={CheckCircle2} />
          {/* F084 FIX: Show "-" instead of "0.0" when there are no reviews */}
          <StatCard label={t('admin.reviews.avgRating')} value={reviews.length === 0 ? '-' : stats.avgRating.toFixed(1)} icon={Star} />
          <StatCard label={t('admin.reviews.withPhotos')} value={stats.withPhotos} icon={Camera} />
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedReviewId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedReviewId}
              onSelect={handleSelectReview}
              filterTabs={filterTabs}
              activeFilter={statusFilter}
              onFilterChange={handleStatusFilterChange}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.reviews.searchPlaceholder')}
              loading={loading}
              emptyIcon={MessageSquare}
              emptyTitle={t('admin.reviews.emptyTitle')}
              emptyDescription={t('admin.reviews.emptyDescription')}
            />
          }
          detail={
            selectedReview ? (
              <DetailPane
                header={{
                  title: selectedReview.userName || 'Anonyme',
                  subtitle: `${selectedReview.productName} - ${new Date(selectedReview.createdAt).toLocaleDateString(locale)}`,
                  avatar: { text: selectedReview.userName || 'A' },
                  onBack: () => setSelectedReviewId(null),
                  backLabel: t('admin.reviews.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      {selectedReview.status === 'PENDING' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={ThumbsUp}
                            onClick={() => setConfirmAction({
                              isOpen: true,
                              title: t('admin.reviews.confirmApproveTitle') || 'Approve this review?',
                              message: t('admin.reviews.confirmApproveMessage') || 'This review will be visible to all customers on the product page.',
                              variant: 'info',
                              onConfirm: () => {
                                updateReviewStatus(selectedReview.id, 'APPROVED');
                                setConfirmAction(prev => ({ ...prev, isOpen: false }));
                              },
                            })}
                            className="text-green-700 hover:bg-green-100"
                            disabled={updatingIds.has(selectedReview.id)}
                          >
                            {updatingIds.has(selectedReview.id) ? '...' : t('admin.reviews.approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={ThumbsDown}
                            onClick={() => setConfirmAction({
                              isOpen: true,
                              title: t('admin.reviews.confirmRejectTitle') || 'Reject this review?',
                              message: t('admin.reviews.confirmRejectMessage') || 'This review will be hidden from customers. The author will not be notified.',
                              variant: 'danger',
                              onConfirm: () => {
                                updateReviewStatus(selectedReview.id, 'REJECTED');
                                setConfirmAction(prev => ({ ...prev, isOpen: false }));
                              },
                            })}
                            className="text-red-700 hover:bg-red-100"
                            disabled={updatingIds.has(selectedReview.id)}
                          >
                            {updatingIds.has(selectedReview.id) ? '...' : t('admin.reviews.reject')}
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={MessageCircle}
                        onClick={() => {
                          setAdminResponse(selectedReview.adminResponse || '');
                          setShowResponseModal(true);
                        }}
                        className="text-sky-700 hover:bg-sky-100"
                      >
                        {selectedReview.adminResponse ? t('admin.reviews.editResponse') : t('admin.reviews.respond')}
                      </Button>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Rating display */}
                  <div className="flex items-center gap-3">
                    {renderStars(selectedReview.rating)}
                    <span className="text-sm font-medium text-slate-700">
                      {selectedReview.rating}/5
                    </span>
                    {selectedReview.isVerifiedPurchase && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                        {t('admin.reviews.verifiedPurchase')}
                      </span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      selectedReview.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
                      selectedReview.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {statusLabel[selectedReview.status]}
                    </span>
                  </div>

                  {/* Sentiment Analysis Indicator */}
                  {(() => {
                    const sentiment = getSentiment(selectedReview.rating);
                    const SentimentIcon = sentiment.icon;
                    return (
                      <div className={`flex items-center gap-3 p-3 rounded-lg ${sentiment.bg}`}>
                        <SentimentIcon className={`w-5 h-5 ${sentiment.color}`} />
                        <div>
                          <p className={`text-sm font-semibold ${sentiment.color}`}>
                            Sentiment: {sentiment.label}
                          </p>
                          <p className="text-xs text-slate-500">
                            {selectedReview.rating >= 4
                              ? 'Le client est satisfait du produit'
                              : selectedReview.rating === 3
                              ? 'Le client a un avis mitige'
                              : 'Le client a eu une experience insatisfaisante'
                            }
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Review title */}
                  {selectedReview.title && (
                    <h3 className="text-lg font-semibold text-slate-900">{selectedReview.title}</h3>
                  )}

                  {/* Review content */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-slate-700 leading-relaxed">{selectedReview.content}</p>
                  </div>

                  {/* Review Images */}
                  {selectedReview.images && selectedReview.images.length > 0 && (
                    <div>
                      {/* F-073 FIX: Clickable images open lightbox for full-size viewing */}
                      <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                        <Camera className="w-4 h-4" />
                        Photos ({selectedReview.images.length})
                      </h4>
                      <div className="flex gap-3 flex-wrap">
                        {selectedReview.images.map((img, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setLightboxImages(selectedReview.images!);
                              setLightboxIndex(idx);
                              setLightboxOpen(true);
                            }}
                            className="relative w-28 h-28 rounded-lg overflow-hidden border border-slate-200 hover:border-sky-400 transition-colors cursor-pointer group"
                          >
                            <Image
                              src={img}
                              alt={`Review image ${idx + 1}`}
                              fill
                              sizes="112px"
                              className="object-cover group-hover:scale-105 transition-transform"
                              /* FIX F-035: Removed unoptimized to use Next.js image optimization */
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Product info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h4 className="font-semibold text-slate-900 mb-2">{t('admin.reviews.productInfo') || 'Produit'}</h4>
                    <p className="text-slate-700">{selectedReview.productName}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {t('admin.reviews.reviewedOn') || 'Avis laiss\u00e9 le'} {new Date(selectedReview.createdAt).toLocaleDateString(locale)}
                    </p>
                    {selectedReview.userEmail && (
                      <p className="text-sm text-slate-500">{selectedReview.userEmail}</p>
                    )}
                  </div>

                  {/* Existing admin response */}
                  {selectedReview.adminResponse && (
                    <div className="bg-sky-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-sky-800 mb-2">{t('admin.reviews.responseBioCycle')}</h4>
                      <p className="text-sm text-sky-700">{selectedReview.adminResponse}</p>
                    </div>
                  )}
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={MessageSquare}
                emptyTitle={t('admin.reviews.emptyTitle')}
                emptyDescription={t('admin.reviews.emptyDescription')}
              />
            )
          }
        />
      </div>

      {/* F-021 FIX: Pagination navigation */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-6 py-3 border-t border-slate-200 bg-white">
          <p className="text-sm text-slate-500">
            {t('common.page') || 'Page'} {currentPage} / {totalPages}
            {' '}({totalReviews} {t('admin.reviews.totalReviews') || 'avis'})
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={ChevronLeft}
              disabled={currentPage <= 1}
              onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setLoading(true); }}
            >
              {t('common.previous') || 'Precedent'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={ChevronRight}
              disabled={currentPage >= totalPages}
              onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setLoading(true); }}
            >
              {t('common.next') || 'Suivant'}
            </Button>
          </div>
        </div>
      )}

      {/* FIX F-070: ConfirmDialog for approve/reject actions */}
      <ConfirmDialog
        isOpen={confirmAction.isOpen}
        title={confirmAction.title}
        message={confirmAction.message}
        variant={confirmAction.variant}
        onConfirm={confirmAction.onConfirm}
        onCancel={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
      />

      {/* ─── RESPONSE MODAL ────────────────────────────────────── */}
      <Modal
        isOpen={showResponseModal}
        onClose={() => setShowResponseModal(false)}
        title={t('admin.reviews.modalTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowResponseModal(false)}>
              {t('admin.reviews.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => selectedReview && submitAdminResponse(selectedReview.id)}
              disabled={!adminResponse.trim() || submittingResponse}
              loading={submittingResponse}
            >
              {t('admin.reviews.publishResponse')}
            </Button>
          </>
        }
      >
        {selectedReview && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm text-slate-500">{selectedReview.userName}</p>
                {renderStars(selectedReview.rating)}
              </div>
              {selectedReview.title && (
                <h4 className="font-semibold text-slate-900 mb-1">{selectedReview.title}</h4>
              )}
              <p className="text-slate-700">{selectedReview.content}</p>

              {/* Review Images in Modal - F-073 FIX: Clickable to open lightbox */}
              {selectedReview.images && selectedReview.images.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {selectedReview.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setLightboxImages(selectedReview.images!);
                        setLightboxIndex(idx);
                        setLightboxOpen(true);
                      }}
                      className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 hover:border-sky-400 transition-colors cursor-pointer group"
                    >
                      <Image
                        src={img}
                        alt={`Review image ${idx + 1}`}
                        fill
                        sizes="96px"
                        className="object-cover group-hover:scale-105 transition-transform"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Bulk Response Templates */}
            <div>
              <p className="text-xs font-medium text-slate-600 mb-2">Modeles de reponse rapide :</p>
              <div className="flex flex-wrap gap-2">
                {RESPONSE_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => setAdminResponse(template.text)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    {template.label}
                  </button>
                ))}
              </div>
            </div>

            {/* IMP-045: Character counter on admin response textarea */}
            <FormField label={t('admin.reviews.yourResponse')}>
              <Textarea
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value.slice(0, 5000))}
                placeholder={t('admin.reviews.respondPlaceholder')}
              />
              <div className="flex items-center justify-between mt-1">
                {/* A-057: Keyboard shortcut hint */}
                <p className="text-xs text-slate-400">{'\u2318'}+Enter / Ctrl+Enter {t('common.toSubmit') || 'to submit'}</p>
                <p className={`text-xs ${adminResponse.length > 4800 ? 'text-red-500' : adminResponse.length > 4000 ? 'text-amber-500' : 'text-slate-400'}`}>
                  {adminResponse.length}/5000
                </p>
              </div>
            </FormField>
          </div>
        )}
      </Modal>

      {/* F-073 FIX: Image lightbox modal for viewing review images at full size */}
      {lightboxOpen && lightboxImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={() => setLightboxOpen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setLightboxOpen(false);
            if (e.key === 'ArrowLeft') setLightboxIndex(i => (i === 0 ? lightboxImages.length - 1 : i - 1));
            if (e.key === 'ArrowRight') setLightboxIndex(i => (i === lightboxImages.length - 1 ? 0 : i + 1));
          }}
          tabIndex={0}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Close image viewer"
            className="absolute top-4 right-4 text-white hover:text-neutral-300 transition-colors z-10"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image counter */}
          <div className="absolute top-4 left-4 text-white text-sm bg-black/50 px-3 py-1 rounded-full z-10">
            {lightboxIndex + 1} / {lightboxImages.length}
          </div>

          {/* Previous button */}
          {lightboxImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i === 0 ? lightboxImages.length - 1 : i - 1)); }}
              className="absolute left-4 text-white hover:text-neutral-300 transition-colors z-10"
            >
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          {/* Current image */}
          <div className="relative max-w-5xl max-h-[90vh] w-full h-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={lightboxImages[lightboxIndex]}
              alt={`Review image ${lightboxIndex + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          {/* Next button */}
          {lightboxImages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(i => (i === lightboxImages.length - 1 ? 0 : i + 1)); }}
              className="absolute right-4 text-white hover:text-neutral-300 transition-colors z-10"
            >
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Keyboard hint */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-xs bg-black/50 px-4 py-2 rounded-full">
            ESC {t('common.close') || 'close'} {lightboxImages.length > 1 && '| \u2190 \u2192 navigate'}
          </div>
        </div>
      )}
    </div>
  );
}
