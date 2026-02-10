'use client';

import { useState, useEffect } from 'react';

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

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Avis clients</h1>
          <p className="text-gray-500">Modérez les avis et répondez aux clients</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total avis</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">En attente</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Approuvés</p>
          <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">Note moyenne</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-amber-700">{stats.avgRating.toFixed(1)}</p>
            {renderStars(Math.round(stats.avgRating))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Rechercher..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <option value="">Tous les statuts</option>
            <option value="PENDING">En attente</option>
            <option value="APPROVED">Approuvé</option>
            <option value="REJECTED">Rejeté</option>
          </select>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.rating}
            onChange={(e) => setFilter({ ...filter, rating: e.target.value })}
          >
            <option value="">Toutes les notes</option>
            <option value="5">5 étoiles</option>
            <option value="4">4 étoiles</option>
            <option value="3">3 étoiles</option>
            <option value="2">2 étoiles</option>
            <option value="1">1 étoile</option>
          </select>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {filteredReviews.map((review) => (
          <div key={review.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-medium text-gray-900">{review.userName}</span>
                  {review.isVerifiedPurchase && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                      Achat vérifié
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[review.status]}`}>
                    {review.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  {review.productName} • {new Date(review.createdAt).toLocaleDateString('fr-CA')}
                </p>
              </div>
              {renderStars(review.rating)}
            </div>

            {review.title && (
              <h4 className="font-semibold text-gray-900 mb-1">{review.title}</h4>
            )}
            <p className="text-gray-700 mb-3">{review.content}</p>

            {review.adminResponse && (
              <div className="bg-amber-50 rounded-lg p-3 mb-3">
                <p className="text-sm font-medium text-amber-800 mb-1">Réponse BioCycle:</p>
                <p className="text-sm text-amber-700">{review.adminResponse}</p>
              </div>
            )}

            <div className="flex gap-2 pt-3 border-t border-gray-100">
              {review.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => updateReviewStatus(review.id, 'APPROVED')}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                  >
                    Approuver
                  </button>
                  <button
                    onClick={() => updateReviewStatus(review.id, 'REJECTED')}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                  >
                    Rejeter
                  </button>
                </>
              )}
              <button
                onClick={() => { setSelectedReview(review); setAdminResponse(review.adminResponse || ''); }}
                className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
              >
                {review.adminResponse ? 'Modifier réponse' : 'Répondre'}
              </button>
            </div>
          </div>
        ))}

        {filteredReviews.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            Aucun avis trouvé
          </div>
        )}
      </div>

      {/* Response Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Répondre à l'avis</h3>
              <button onClick={() => setSelectedReview(null)} className="p-1 hover:bg-gray-100 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500 mb-1">{selectedReview.userName} - {renderStars(selectedReview.rating)}</p>
                <p className="text-gray-700">{selectedReview.content}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Votre réponse</label>
                <textarea
                  rows={4}
                  value={adminResponse}
                  onChange={(e) => setAdminResponse(e.target.value)}
                  placeholder="Répondez au client..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedReview(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button
                  onClick={() => submitAdminResponse(selectedReview.id)}
                  disabled={!adminResponse.trim()}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  Publier la réponse
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
