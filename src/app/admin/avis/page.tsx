'use client';

import { useState, useEffect } from 'react';
import {
  Star,
  MessageSquare,
  Clock,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Search,
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

const statusLabel: Record<string, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuve',
  REJECTED: 'Rejete',
};

export default function AvisPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', rating: '', search: '' });
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [adminResponse, setAdminResponse] = useState('');

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
        title="Avis clients"
        subtitle="Moderez les avis et repondez aux clients"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total avis" value={stats.total} icon={MessageSquare} />
        <StatCard label="En attente" value={stats.pending} icon={Clock} />
        <StatCard label="Approuves" value={stats.approved} icon={CheckCircle2} />
        <StatCard label="Note moyenne" value={stats.avgRating.toFixed(1)} icon={Star} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(v) => setFilter({ ...filter, search: v })}
        searchPlaceholder="Rechercher..."
      >
        <SelectFilter
          label="Tous les statuts"
          value={filter.status}
          onChange={(v) => setFilter({ ...filter, status: v })}
          options={[
            { value: 'PENDING', label: 'En attente' },
            { value: 'APPROVED', label: 'Approuve' },
            { value: 'REJECTED', label: 'Rejete' },
          ]}
        />
        <SelectFilter
          label="Toutes les notes"
          value={filter.rating}
          onChange={(v) => setFilter({ ...filter, rating: v })}
          options={[
            { value: '5', label: '5 etoiles' },
            { value: '4', label: '4 etoiles' },
            { value: '3', label: '3 etoiles' },
            { value: '2', label: '2 etoiles' },
            { value: '1', label: '1 etoile' },
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
                    <StatusBadge variant="success">Achat verifie</StatusBadge>
                  )}
                  <StatusBadge variant={statusVariant[review.status]} dot>
                    {statusLabel[review.status]}
                  </StatusBadge>
                </div>
                <p className="text-sm text-slate-500">
                  {review.productName} &bull; {new Date(review.createdAt).toLocaleDateString('fr-CA')}
                </p>
              </div>
              {renderStars(review.rating)}
            </div>

            {review.title && (
              <h4 className="font-semibold text-slate-900 mb-1">{review.title}</h4>
            )}
            <p className="text-slate-700 mb-3">{review.content}</p>

            {review.adminResponse && (
              <div className="bg-sky-50 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium text-sky-800 mb-1">Reponse BioCycle:</p>
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
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={ThumbsDown}
                    onClick={() => updateReviewStatus(review.id, 'REJECTED')}
                    className="text-red-700 hover:bg-red-100"
                  >
                    Rejeter
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
                {review.adminResponse ? 'Modifier reponse' : 'Repondre'}
              </Button>
            </div>
          </div>
        ))}

        {filteredReviews.length === 0 && (
          <EmptyState
            icon={MessageSquare}
            title="Aucun avis trouve"
            description="Aucun avis ne correspond aux filtres selectionnes"
          />
        )}
      </div>

      {/* Response Modal */}
      <Modal
        isOpen={!!selectedReview}
        onClose={() => setSelectedReview(null)}
        title="Repondre a l'avis"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelectedReview(null)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => selectedReview && submitAdminResponse(selectedReview.id)}
              disabled={!adminResponse.trim()}
            >
              Publier la reponse
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
              <p className="text-slate-700">{selectedReview.content}</p>
            </div>
            <FormField label="Votre reponse">
              <Textarea
                value={adminResponse}
                onChange={(e) => setAdminResponse(e.target.value)}
                placeholder="Repondez au client..."
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
