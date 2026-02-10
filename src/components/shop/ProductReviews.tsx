'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from '@/hooks/useTranslations';
import Link from 'next/link';

interface Review {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  images?: string[];
  verified: boolean;
  helpful: number;
  createdAt: string;
  response?: {
    content: string;
    createdAt: string;
  };
}

interface ProductReviewsProps {
  productId: string;
  productName: string;
}

// Reviews loaded from API (empty by default until review system is implemented)

export default function ProductReviews({ productId: _productId, productName }: ProductReviewsProps) {
  const { data: session } = useSession();
  const { t } = useTranslations();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showWriteReview, setShowWriteReview] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'helpful' | 'highest' | 'lowest'>('helpful');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  
  // New review form state
  const [newReview, setNewReview] = useState({
    rating: 5,
    title: '',
    content: '',
    images: [] as File[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Calculate stats
  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
    : 0;
  const ratingCounts = [5, 4, 3, 2, 1].map(rating => 
    reviews.filter(r => r.rating === rating).length
  );

  // Sort and filter reviews
  const sortedReviews = [...reviews]
    .filter(r => filterRating === null || r.rating === filterRating)
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'helpful': return b.helpful - a.helpful;
        case 'highest': return b.rating - a.rating;
        case 'lowest': return a.rating - b.rating;
        default: return 0;
      }
    });

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const review: Review = {
      id: Date.now().toString(),
      userId: session.user?.email || '',
      userName: session.user?.name || 'Anonymous',
      rating: newReview.rating,
      title: newReview.title,
      content: newReview.content,
      verified: true,
      helpful: 0,
      createdAt: new Date().toISOString(),
    };
    
    setReviews(prev => [review, ...prev]);
    setIsSubmitting(false);
    setSubmitSuccess(true);
    setShowWriteReview(false);
    setNewReview({ rating: 5, title: '', content: '', images: [] });
    
    setTimeout(() => setSubmitSuccess(false), 3000);
  };

  const handleHelpful = (reviewId: string) => {
    setReviews(prev => prev.map(r => 
      r.id === reviewId ? { ...r, helpful: r.helpful + 1 } : r
    ));
  };

  const StarRating = ({ rating, size = 'md', interactive = false, onChange }: { 
    rating: number; 
    size?: 'sm' | 'md' | 'lg'; 
    interactive?: boolean;
    onChange?: (rating: number) => void;
  }) => {
    const sizes = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-7 h-7' };
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type={interactive ? 'button' : undefined}
            onClick={() => interactive && onChange?.(star)}
            disabled={!interactive}
            className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}
          >
            <svg
              className={`${sizes[size]} ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-12 border-t pt-12">
      {/* Success Message */}
      {submitSuccess && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          {t('reviews.thankYou') || 'Thank you for your review! +100 loyalty points earned.'}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold">{t('reviews.customerReviews') || 'Customer Reviews'}</h2>
          <div className="flex items-center gap-2 mt-1">
            <StarRating rating={Math.round(averageRating)} />
            <span className="font-bold">{averageRating.toFixed(1)}</span>
            <span className="text-neutral-500">({reviews.length} {t('reviews.reviews') || 'reviews'})</span>
          </div>
        </div>
        
        <button
          onClick={() => setShowWriteReview(true)}
          className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
        >
          {t('reviews.writeReview') || 'Write a Review'}
        </button>
      </div>

      {/* Rating Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="md:col-span-1">
          <div className="bg-neutral-50 rounded-xl p-6">
            <div className="text-center mb-4">
              <p className="text-5xl font-bold">{averageRating.toFixed(1)}</p>
              <StarRating rating={Math.round(averageRating)} size="lg" />
              <p className="text-sm text-neutral-500 mt-1">{reviews.length} {t('reviews.totalReviews') || 'total reviews'}</p>
            </div>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((rating, i) => (
                <button
                  key={rating}
                  onClick={() => setFilterRating(filterRating === rating ? null : rating)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                    filterRating === rating ? 'bg-orange-100' : 'hover:bg-neutral-100'
                  }`}
                >
                  <span className="text-sm w-3">{rating}</span>
                  <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-400"
                      style={{ width: `${reviews.length > 0 ? (ratingCounts[i] / reviews.length) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm text-neutral-500 w-8">{ratingCounts[i]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Reviews List */}
        <div className="md:col-span-2">
          {/* Sort Options */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-neutral-500">
              {filterRating ? `Showing ${filterRating}-star reviews` : `Showing all ${sortedReviews.length} reviews`}
              {filterRating && (
                <button onClick={() => setFilterRating(null)} className="ml-2 text-orange-500 hover:underline">
                  Clear filter
                </button>
              )}
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm"
            >
              <option value="helpful">{t('reviews.mostHelpful') || 'Most Helpful'}</option>
              <option value="recent">{t('reviews.mostRecent') || 'Most Recent'}</option>
              <option value="highest">{t('reviews.highestRated') || 'Highest Rated'}</option>
              <option value="lowest">{t('reviews.lowestRated') || 'Lowest Rated'}</option>
            </select>
          </div>

          {/* Reviews */}
          <div className="space-y-6">
            {sortedReviews.map((review) => (
              <div key={review.id} className="border-b border-neutral-200 pb-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {review.userAvatar ? (
                      <img src={review.userAvatar} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 font-bold">{review.userName.charAt(0)}</span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{review.userName}</p>
                      <div className="flex items-center gap-2">
                        <StarRating rating={review.rating} size="sm" />
                        {review.verified && (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Verified Purchase
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-sm text-neutral-500">
                    {new Date(review.createdAt).toLocaleDateString('en-CA', { 
                      year: 'numeric', month: 'short', day: 'numeric' 
                    })}
                  </span>
                </div>
                
                <h4 className="font-semibold mt-3">{review.title}</h4>
                <p className="text-neutral-600 mt-2">{review.content}</p>
                
                {review.images && review.images.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {review.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                    ))}
                  </div>
                )}

                {/* Response from store */}
                {review.response && (
                  <div className="mt-4 ml-6 p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                    <p className="text-sm font-medium text-orange-800">Response from BioCycle Peptides+</p>
                    <p className="text-sm text-neutral-600 mt-1">{review.response.content}</p>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-4">
                  <button
                    onClick={() => handleHelpful(review.id)}
                    className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    Helpful ({review.helpful})
                  </button>
                  <button className="text-sm text-neutral-500 hover:text-neutral-700">
                    Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Write Review Modal */}
      {showWriteReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">{t('reviews.writeReviewFor') || 'Write a Review for'} {productName}</h3>
                <button onClick={() => setShowWriteReview(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {!session ? (
              <div className="p-6 text-center">
                <p className="text-neutral-600 mb-4">{t('reviews.signInRequired') || 'Please sign in to write a review'}</p>
                <Link
                  href="/auth/signin"
                  className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                >
                  {t('reviews.signIn') || 'Sign In'}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmitReview} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('reviews.yourRating') || 'Your Rating'}</label>
                  <StarRating 
                    rating={newReview.rating} 
                    size="lg" 
                    interactive 
                    onChange={(rating) => setNewReview(prev => ({ ...prev, rating }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('reviews.reviewTitle') || 'Review Title'}</label>
                  <input
                    type="text"
                    value={newReview.title}
                    onChange={(e) => setNewReview(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Summarize your experience"
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('reviews.yourReview') || 'Your Review'}</label>
                  <textarea
                    value={newReview.content}
                    onChange={(e) => setNewReview(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Tell us about your experience with this product..."
                    rows={5}
                    className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    required
                    minLength={20}
                  />
                  <p className="text-xs text-neutral-500 mt-1">Minimum 20 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">{t('reviews.addPhotos') || 'Add Photos (Optional)'}</label>
                  <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-orange-500 transition-colors cursor-pointer">
                    <input type="file" multiple accept="image/*" className="hidden" id="review-images" />
                    <label htmlFor="review-images" className="cursor-pointer">
                      <svg className="w-8 h-8 mx-auto text-neutral-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-neutral-500">Click to upload images</p>
                    </label>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 flex items-center gap-3">
                  <span className="text-2xl">🎁</span>
                  <div>
                    <p className="font-medium text-orange-800">{t('reviews.earnPoints') || 'Earn 100 Loyalty Points!'}</p>
                    <p className="text-sm text-orange-600">{t('reviews.earnPointsDesc') || 'Submit a verified review and earn bonus points'}</p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {t('reviews.submitting') || 'Submitting...'}
                    </>
                  ) : (
                    t('reviews.submitReview') || 'Submit Review'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
