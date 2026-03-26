'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, DataTable, StatusBadge, EmptyState, type Column } from '@/components/admin';
import { FilterBar, SelectFilter } from '@/components/admin';
import { Star, MessageSquare, Check, X, Trash2 } from 'lucide-react';
import { ConfirmProvider, useConfirm } from '@/components/lms/ConfirmDialog';

type ReviewStatus = 'pending' | 'approved' | 'rejected';
type StatusFilter = '' | ReviewStatus;

interface ReviewRow {
  id: string;
  studentName: string;
  courseTitle: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  createdAt: string;
}

const statusVariants: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export default function ReviewsPage() {
  return <ConfirmProvider><ReviewsPageInner /></ConfirmProvider>;
}
function ReviewsPageInner() {
  const { confirm: confirmDialog } = useConfirm();
  const { t } = useTranslations();

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [stats, setStats] = useState({ total: 0, avgRating: 0 });

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/lms/reviews?${params}`);
      const data = await res.json();
      const list = data.data?.reviews ?? data.reviews ?? data.data ?? data;
      const reviewList = Array.isArray(list) ? list : [];
      setReviews(reviewList);

      const total = data.data?.total ?? data.total ?? reviewList.length;
      const avg = data.data?.avgRating ?? data.avgRating ?? (
        reviewList.length > 0
          ? reviewList.reduce((sum: number, r: ReviewRow) => sum + r.rating, 0) / reviewList.length
          : 0
      );
      setStats({ total, avgRating: avg });
    } catch {
      setReviews([]);
      setStats({ total: 0, avgRating: 0 });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleAction = async (id: string, action: 'approve' | 'reject' | 'delete') => {
    if (action === 'delete') { const ok = await confirmDialog({ title: t('admin.lms.reviews.deleteConfirm'), message: t('admin.lms.reviews.deleteConfirm'), destructive: true }); if (!ok) return; }

    try {
      if (action === 'delete') {
        await fetch(`/api/admin/lms/reviews?id=${id}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/admin/lms/reviews?id=${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action === 'approve' ? 'approved' : 'rejected' }),
        });
      }
      fetchReviews();
    } catch {
      // silently fail
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5" aria-label={`${rating}/5`}>
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const columns: Column<ReviewRow>[] = [
    {
      key: 'studentName',
      header: t('admin.lms.reviews.student'),
      render: (row) => (
        <span className="font-medium text-[var(--k-text-primary)]">{row.studentName}</span>
      ),
    },
    {
      key: 'courseTitle',
      header: t('admin.lms.reviews.course'),
      render: (row) => (
        <span className="text-slate-700">{row.courseTitle}</span>
      ),
    },
    {
      key: 'rating',
      header: t('admin.lms.reviews.rating'),
      render: (row) => renderStars(row.rating),
    },
    {
      key: 'comment',
      header: t('admin.lms.reviews.comment'),
      render: (row) => (
        <p className="text-sm text-slate-600 max-w-xs truncate">
          {row.comment || <span className="italic text-slate-400">{t('admin.lms.reviews.noComment')}</span>}
        </p>
      ),
    },
    {
      key: 'createdAt',
      header: t('admin.lms.reviews.date'),
      render: (row) => (
        <span className="text-sm text-slate-500">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <StatusBadge variant={statusVariants[row.status] ?? 'neutral'}>
          {t(`admin.lms.reviews.status_${row.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: 'id',
      header: t('admin.lms.reviews.actions'),
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.status !== 'approved' && (
            <button
              onClick={() => handleAction(row.id, 'approve')}
              className="p-1.5 rounded hover:bg-green-50 text-slate-400 hover:text-green-600 transition-colors"
              title={t('admin.lms.reviews.approve')}
              aria-label={t('admin.lms.reviews.approve')}
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {row.status !== 'rejected' && (
            <button
              onClick={() => handleAction(row.id, 'reject')}
              className="p-1.5 rounded hover:bg-orange-50 text-slate-400 hover:text-orange-600 transition-colors"
              title={t('admin.lms.reviews.reject')}
              aria-label={t('admin.lms.reviews.reject')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleAction(row.id, 'delete')}
            className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
            title={t('admin.lms.reviews.delete')}
            aria-label={t('admin.lms.reviews.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const filterOptions = [
    { value: 'pending', label: t('admin.lms.reviews.status_pending') },
    { value: 'approved', label: t('admin.lms.reviews.status_approved') },
    { value: 'rejected', label: t('admin.lms.reviews.status_rejected') },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.reviews.title')}
        subtitle={`${stats.total} ${t('admin.lms.reviews.total')}`}
        backHref="/admin/formation"
      />

      {/* Average rating card */}
      {!loading && stats.total > 0 && (
        <div className="bg-[var(--k-glass-thin)] border border-[var(--k-border-subtle)] rounded-xl p-5 flex items-center gap-4 w-fit">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50">
            <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
          </div>
          <div>
            <p className="text-sm text-slate-500">{t('admin.lms.reviews.averageRating')}</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-[var(--k-text-primary)] tabular-nums">
                {stats.avgRating.toFixed(1)}
              </span>
              {renderStars(Math.round(stats.avgRating))}
              <span className="text-sm text-slate-400">
                ({stats.total} {t('admin.lms.reviews.total')})
              </span>
            </div>
          </div>
        </div>
      )}

      <FilterBar>
        <SelectFilter
          label={t('admin.lms.reviews.allStatuses')}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={filterOptions}
        />
      </FilterBar>

      {!loading && reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t('admin.lms.reviews.noReviews')}
          description={t('admin.lms.reviews.noReviewsDesc')}
        />
      ) : (
        <DataTable
          columns={columns}
          data={reviews}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyTitle={t('admin.lms.reviews.noReviews')}
        />
      )}
    </div>
  );
}
