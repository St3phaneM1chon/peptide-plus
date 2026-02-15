'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatCard,
  EmptyState,
  StatusBadge,
  FilterBar,
  SelectFilter,
  FormField,
  Textarea,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';

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

const statusVariant: Record<string, 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

export default function AvisPage() {
  const { t, locale } = useI18n();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', rating: '', search: '' });
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [adminResponse, setAdminResponse] = useState('');

  const statusLabel: Record<string, string> = {
    PENDING: t('admin.reviews.statusPending'),
    APPROVED: t('admin.reviews.statusApproved'),
    REJECTED: t('admin.reviews.statusRejected'),
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await fetch('/api/admin/reviews');
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setReviews([]);
    }
    setLoading(false);
  };

  const updateReviewStatus = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await fetch(`/api/admin/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setReviews(reviews.map(r => r.id === id ? { ...r, status } : r));
      if (selectedReview?.id === id) {
        setSelectedReview({ ...selectedReview, status });
      }
    } catch (err) {
      console.error('Error updating review:', err);
    }
  };

  const submitAdminResponse = async (id: string) => {
    try {
      await fetch(`/api/admin/reviews/${id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: adminResponse }),
      });
      setReviews(reviews.map(r => r.id === id ? { ...r, adminResponse } : r));
      if (selectedReview?.id === id) {
        setSelectedReview({ ...selectedReview, adminResponse });
      }
      setAdminResponse('');
    } catch (err) {
      console.error('Error submitting response:', err);
    }
  };

  const filteredReviews = reviews.filter(review => {
    if (filter.status && review.status !== filter.status) return false;
    if (filter.rating && review.rating !== parseInt(filter.rating)) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!review.productName.toLowerCase().includes(search) &&
          !review.content.toLowerCase().includes(search) &&
          !review.userName?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: reviews.length,
    pending: reviews.filter(r => r.status === 'PENDING').length,
    approved: reviews.filter(r => r.status === 'APPROVED').length,
    avgRating: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length || 0,
    withPhotos: reviews.filter(r => r.images && r.images.length > 0).length,
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
          />
        ))}
      </div>
    );
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
        title={t('admin.reviews.title')}
        subtitle={t('admin.reviews.subtitle')}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label={t('admin.reviews.totalReviews')} value={stats.total} icon={MessageSquare} />
        <StatCard label={t('admin.reviews.pending')} value={stats.pending} icon={Clock} />
        <StatCard label={t('admin.reviews.approved')} value={stats.approved} icon={CheckCircle2} />
        <StatCard label={t('admin.reviews.avgRating')} value={stats.avgRating.toFixed(1)} icon={Star} />
        <StatCard label="With Photos" value={stats.withPhotos} icon={Camera} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(v) => setFilter({ ...filter, search: v })}
        searchPlaceholder={t('admin.reviews.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.reviews.allStatuses')}
          value={filter.status}
          onChange={(v) => setFilter({ ...filter, status: v })}
          options={[
            { value: 'PENDING', label: t('admin.reviews.statusPending') },
            { value: 'APPROVED', label: t('admin.reviews.statusApproved') },
            { value: 'REJECTED', label: t('admin.reviews.statusRejected') },
          ]}
        />
        <SelectFilter
          label={t('admin.reviews.allRatings')}
          value={filter.rating}
          onChange={(v) => setFilter({ ...filter, rating: v })}
          options={[
            { value: '5', label: t('admin.reviews.stars5') },
            { value: '4', label: t('admin.reviews.stars4') },
            { value: '3', label: t('admin.reviews.stars3') },
            { value: '2', label: t('admin.reviews.stars2') },
            { value: '1', label: t('admin.reviews.stars1') },
          ]}
        />
      </FilterBar>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.map((review) => (
          <div key={review.id} className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-medium text-slate-900">{review.userName}</span>
                  {review.isVerifiedPurchase && (
                    <StatusBadge variant="success">{t('admin.reviews.verifiedPurchase')}</StatusBadge>
                  )}
                  <StatusBadge variant={statusVariant[review.status]} dot>
                    {statusLabel[review.status]}
                  </StatusBadge>
                </div>
                <p className="text-sm text-slate-500">
                  {review.productName} &bull; {new Date(review.createdAt).toLocaleDateString(locale)}
                </p>
              </div>
              {renderStars(review.rating)}
            </div>

            {review.title && (
              <h4 className="font-semibold text-slate-900 mb-1">{review.title}</h4>
            )}
            <p className="text-slate-700 mb-3">{review.content}</p>

            {/* Review Images */}
            {review.images && review.images.length > 0 && (
              <div className="flex gap-2 mb-3">
                {review.images.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-200">
                    <Image
                      src={img}
                      alt={`Review image ${idx + 1}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
                <div className="flex items-center gap-1 px-2 text-xs text-slate-500">
                  <Camera className="w-3 h-3" />
                  {review.images.length}
                </div>
              </div>
            )}

            {review.adminResponse && (
              <div className="bg-sky-50 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium text-sky-800 mb-1">{t('admin.reviews.responseBioCycle')}</p>
                <p className="text-sm text-sky-700">{review.adminResponse}</p>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-slate-100">
              {review.status === 'PENDING' && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={ThumbsUp}
                    onClick={() => updateReviewStatus(review.id, 'APPROVED')}
                    className="text-green-700 hover:bg-green-100"
                  >
                    {t('admin.reviews.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={ThumbsDown}
                    onClick={() => updateReviewStatus(review.id, 'REJECTED')}
                    className="text-red-700 hover:bg-red-100"
                  >
                    {t('admin.reviews.reject')}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={MessageCircle}
                onClick={() => { setSelectedReview(review); setAdminResponse(review.adminResponse || ''); }}
                className="text-sky-700 hover:bg-sky-100"
              >
                {review.adminResponse ? t('admin.reviews.editResponse') : t('admin.reviews.respond')}
              </Button>
            </div>
          </div>
        ))}

        {filteredReviews.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title={t('admin.reviews.emptyTitle')}
            description={t('admin.reviews.emptyDescription')}
          />
        )}
      </div>

      {/* Response Modal */}
      <Modal
        isOpen={!!selectedReview}
        onClose={() => setSelectedReview(null)}
        title={t('admin.reviews.modalTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedReview(null)}>
              {t('admin.reviews.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => selectedReview && submitAdminResponse(selectedReview.id)}
              disabled={!adminResponse.trim()}
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

              {/* Review Images in Modal */}
              {selectedReview.images && selectedReview.images.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {selectedReview.images.map((img, idx) => (
                    <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
                      <Image
                        src={img}
                        alt={`Review image ${idx + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <FormField label={t('admin.reviews.yourResponse')}>
              <Textarea
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder={t('admin.reviews.respondPlaceholder')}
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
