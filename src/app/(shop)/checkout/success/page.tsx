'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { useI18n } from '@/i18n/client';
import { useCart } from '@/contexts/CartContext';

function CheckoutSuccessContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const { clearCart } = useCart();
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const hasCleared = useRef(false);
  // A-043: Track points earned on this order
  const [pointsEarned, setPointsEarned] = useState<number | null>(null);
  const [currentTier, setCurrentTier] = useState<string>('');

  const fetchOrderInfo = useCallback(async () => {
    // Clear cart only once, silently (no toast)
    if (!hasCleared.current) {
      hasCleared.current = true;
      clearCart();
    }

    // Fetch real order info from session_id
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      try {
        const res = await fetch(`/api/orders/by-session?session_id=${sessionId}`);
        const data = res.ok ? await res.json() : null;
        if (data?.orderNumber) {
          setOrderNumber(data.orderNumber);
          setOrderId(data.orderId || '');
        } else {
          // Fallback: use session_id suffix
          setOrderNumber(`PP-${new Date().getFullYear()}-${sessionId.slice(-6).toUpperCase()}`);
        }
      } catch (error) {
        console.warn('ISR build fallback: DB unavailable for order lookup (checkout/success):', error);
        setOrderNumber(`PP-${new Date().getFullYear()}-${sessionId.slice(-6).toUpperCase()}`);
      }
    } else {
      setOrderNumber(`PP-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase().slice(-6)}`);
    }

    // A-043: Fetch loyalty data to show points earned on this order
    try {
      const loyaltyRes = await fetch('/api/loyalty');
      if (loyaltyRes.ok) {
        const loyaltyData = await loyaltyRes.json();
        setCurrentTier(loyaltyData.tier || '');
        // Check if there's a recent EARN_PURCHASE transaction (within last 5 min)
        if (loyaltyData.transactions?.length > 0) {
          const recentTx = loyaltyData.transactions[0];
          const txDate = new Date(recentTx.date || recentTx.createdAt);
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
          if (txDate > fiveMinAgo && recentTx.type?.startsWith('EARN')) {
            setPointsEarned(recentTx.points);
          }
        }
      }
    } catch {
      // A-043: Non-critical - don't break the success page if loyalty fetch fails
    }
  }, [searchParams, clearCart]);

  useEffect(() => {
    fetchOrderInfo();
  }, [fetchOrderInfo]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t('nav.home') || 'Home', href: '/' },
          { label: t('checkout.orderConfirmed') || 'Order Confirmed' },
        ]}
      />

      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6" aria-hidden="true">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('checkout.orderConfirmed')}
          </h1>
          <p className="text-gray-600 mb-6">
            {t('checkout.thankYou')}
          </p>

          {/* Order Number */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">{t('checkout.orderNumber')}</p>
            <p className="text-xl font-mono font-bold text-gray-900">{orderNumber || '...'}</p>
          </div>

          {/* A-043: Loyalty points earned on this order */}
          {pointsEarned !== null && pointsEarned > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 mb-6 text-start">
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">🎉</span>
                <div>
                  <p className="font-semibold text-amber-900">
                    {t('checkout.pointsEarned') || 'You earned'} <span className="text-orange-600">{pointsEarned} {t('customerRewards.points') || 'points'}</span> {t('checkout.withThisOrder') || 'with this order'}!
                  </p>
                  {currentTier && (
                    <p className="text-sm text-amber-700">
                      {t('customerRewards.currentLevel') || 'Current level'}: {currentTier}
                    </p>
                  )}
                  <Link href="/account/rewards" className="text-sm text-orange-600 hover:underline font-medium">
                    {t('checkout.viewRewards') || 'View your rewards'} →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Email Confirmation */}
          <p className="text-sm text-gray-500 mb-8">
            {t('checkout.confirmationEmail')}
          </p>

          {/* What's Next */}
          <div className="bg-orange-50 rounded-lg p-6 mb-8 text-start">
            <h3 className="font-semibold text-orange-900 mb-3">{t('checkout.whatNext')}</h3>
            <ul className="space-y-2 text-sm text-orange-800">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('checkout.step1Email')}</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span>{t('checkout.step2Processing')}</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{t('checkout.step3Tracking')}</span>
              </li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="bg-gray-100 rounded-lg p-4 mb-8 text-xs text-gray-500">
            <strong className="text-orange-600">{t('common.researchOnly')}:</strong> {t('common.researchDisclaimer')}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {orderId && (
              <Link
                href={`/account/orders`}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('checkout.viewOrders') || 'View My Orders'}
              </Link>
            )}
            <Link
              href="/"
              className="px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              {t('checkout.backToHome')}
            </Link>
          </div>
        </div>

        {/* Support */}
        <p className="text-center text-sm text-gray-500 mt-8">
          {t('checkout.questionsContact')}{' '}
          <a href="mailto:support@biocyclepeptides.com" className="text-orange-600 hover:underline">
            support@biocyclepeptides.com
          </a>
        </p>
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div className="animate-pulse">
            <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-6"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}
