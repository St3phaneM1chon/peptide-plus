'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function TrackOrderPage() {
  const { t } = useI18n();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [trackingResult, setTrackingResult] = useState<null | {
    found: boolean;
    status?: string;
    trackingNumber?: string;
    carrier?: string;
    estimatedDelivery?: string;
    steps?: { status: string; date: string; location: string; completed: boolean }[];
  }>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch(`/api/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (res.ok && data.found) {
        setTrackingResult(data);
      } else {
        setTrackingResult({ found: false });
      }
    } catch (error) {
      console.error('[TrackOrderPage] Failed to track order:', error);
      setTrackingResult({ found: false });
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            {t('track.title') || 'Track Your Order'}
          </h1>
          <p className="text-xl text-neutral-300 max-w-2xl mx-auto">
            {t('track.subtitle') || 'Enter your order details to see real-time shipping updates.'}
          </p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Tracking Form */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <form onSubmit={handleTrack} className="space-y-6">
            <div>
              <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-2">
                {t('track.orderNumber') || 'Order Number'}
              </label>
              <input
                type="text"
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder={t('shop.trackOrder.placeholderOrderNumber')}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t('track.email') || 'Email Address'}
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('shop.trackOrder.placeholderEmail')}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <p className="mt-1 text-sm text-gray-500">
                {t('track.emailHint') || 'Use the email address associated with your order.'}
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('track.searching') || 'Searching...'}
                </span>
              ) : (
                t('track.button') || 'Track Order'
              )}
            </button>
          </form>
        </div>

        {/* Tracking Result */}
        {trackingResult && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {trackingResult.found ? (
              <>
                {/* Order Summary */}
                <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-b">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('track.status') || 'Status'}</p>
                      <p className="text-lg font-semibold text-green-700">{trackingResult.status}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">{t('track.trackingNumber') || 'Tracking Number'}</p>
                      <p className="font-medium">{trackingResult.trackingNumber}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('track.carrier') || 'Carrier'}</p>
                      <p className="font-medium">{trackingResult.carrier}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('track.estimatedDelivery') || 'Est. Delivery'}</p>
                      <p className="font-medium text-orange-600">{trackingResult.estimatedDelivery}</p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{t('track.shippingProgress') || 'Shipping Progress'}</h3>
                  <div className="space-y-4">
                    {trackingResult.steps?.map((step, index) => (
                      <div key={index} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-4 h-4 rounded-full ${step.completed ? 'bg-green-500' : 'bg-gray-200'}`} />
                          {index < (trackingResult.steps?.length || 0) - 1 && (
                            <div className={`w-0.5 h-full ${step.completed ? 'bg-green-300' : 'bg-gray-200'}`} />
                          )}
                        </div>
                        <div className={`pb-4 ${step.completed ? '' : 'opacity-50'}`}>
                          <p className={`font-medium ${step.completed ? 'text-gray-900' : 'text-gray-400'}`}>
                            {step.status}
                          </p>
                          {step.date && (
                            <p className="text-sm text-gray-500">{step.date}</p>
                          )}
                          {step.location && (
                            <p className="text-sm text-gray-400">{step.location}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Track on Carrier */}
                <div className="px-6 pb-6">
                  <a
                    href={`https://www.canadapost-postescanada.ca/track-reperage/en#/details/${trackingResult.trackingNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-orange-600 hover:underline focus:outline-none focus:ring-2 focus:ring-orange-500 rounded"
                    aria-label={`${t('track.trackOnCarrier') || 'Track on'} ${trackingResult.carrier} (${t('common.opensInNewTab') || 'opens in new tab'})`}
                  >
                    {t('track.trackOnCarrier') || 'Track on'} {trackingResult.carrier}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </>
            ) : (
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('track.orderNotFound') || 'Order Not Found'}</h3>
                <p className="text-gray-600 mb-4">
                  {t('track.orderNotFoundDesc') || "We couldn't find an order with those details. Please check your order number and email."}
                </p>
                <Link href="/contact" className="text-orange-600 hover:underline">
                  {t('track.contactSupport') || 'Contact support for help'}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">{t('track.needHelp') || 'Need Help?'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/faq"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
            >
              <span className="text-2xl">❓</span>
              <div>
                <p className="font-medium text-gray-900">{t('nav.faq') || 'FAQ'}</p>
                <p className="text-sm text-gray-500">{t('track.commonShippingQuestions') || 'Common shipping questions'}</p>
              </div>
            </Link>
            <Link
              href="/contact"
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors"
            >
              <span className="text-2xl">💬</span>
              <div>
                <p className="font-medium text-gray-900">{t('nav.contact') || 'Contact Us'}</p>
                <p className="text-sm text-gray-500">{t('track.getSupport') || 'Get support from our team'}</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
