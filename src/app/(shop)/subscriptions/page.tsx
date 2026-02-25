'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useI18n } from '@/i18n/client';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useCurrency } from '@/contexts/CurrencyContext';

interface SubscriptionProduct {
  id: string;
  name: string;
  slug: string;
  image: string;
  basePrice: number;
  description: string;
  popular: boolean;
}

interface Subscription {
  id: string;
  productId: string;
  formatId: string | null;
  productName: string;
  formatName: string | null;
  quantity: number;
  frequency: string;
  discountPercent: number;
  unitPrice: number;
  status: string;
  nextDelivery: string;
  lastDelivery: string | null;
  createdAt: string;
  cancelledAt: string | null;
}

const getFrequencies = (t: (key: string) => string) => [
  { id: 'EVERY_2_MONTHS', label: t('subscriptions.every2Months') || 'Every 2 Months', days: 60, discount: 15 },
  { id: 'EVERY_4_MONTHS', label: t('subscriptions.every4Months') || 'Every 4 Months', days: 120, discount: 12 },
  { id: 'EVERY_6_MONTHS', label: t('subscriptions.every6Months') || 'Every 6 Months', days: 180, discount: 10 },
  { id: 'EVERY_12_MONTHS', label: t('subscriptions.every12Months') || 'Every 12 Months', days: 365, discount: 5 },
];

const getFrequencyLabels = (t: (key: string) => string): Record<string, string> => ({
  EVERY_2_MONTHS: t('subscriptions.every2Months') || 'Every 2 Months',
  EVERY_4_MONTHS: t('subscriptions.every4Months') || 'Every 4 Months',
  EVERY_6_MONTHS: t('subscriptions.every6Months') || 'Every 6 Months',
  EVERY_12_MONTHS: t('subscriptions.every12Months') || 'Every 12 Months',
});

export default function SubscriptionsPage() {
  const { data: session } = useSession();
  const { t, locale } = useI18n();
  const { formatPrice } = useCurrency();

  const [activeTab, setActiveTab] = useState<'browse' | 'manage'>('browse');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subscriptionProducts, setSubscriptionProducts] = useState<SubscriptionProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<SubscriptionProduct | null>(null);
  const frequencies = getFrequencies(t);
  const frequencyLabels = getFrequencyLabels(t);
  const [selectedFrequency, setSelectedFrequency] = useState(frequencies[2]); // Monthly default
  const [quantity, setQuantity] = useState(1);
  const [subToCancel, setSubToCancel] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Load products from API
  useEffect(() => {
    fetch(`/api/products?limit=20&active=true&locale=${locale}`)
      .then(res => res.json())
      .then(data => {
        const products = (data.products || data || []).map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: p.name as string,
          slug: p.slug as string,
          image: (p.imageUrl as string) || '/images/products/default.jpg',
          basePrice: Number(p.price) || 0,
          description: (p.shortDescription as string) || (p.description as string) || '',
          popular: !!(p.isBestseller || p.isFeatured),
        }));
        setSubscriptionProducts(products);
      })
      .catch(() => {});
  }, []);

  // Load subscriptions from DB
  useEffect(() => {
    if (session?.user) {
      fetchSubscriptions();
    }
  }, [session]);

  const fetchSubscriptions = async () => {
    setLoadingSubs(true);
    try {
      const res = await fetch('/api/account/subscriptions');
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.subscriptions || []);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    } finally {
      setLoadingSubs(false);
    }
  };

  const calculatePrice = (basePrice: number, discount: number) => {
    return basePrice * (1 - discount / 100);
  };

  const handleCreateSubscription = async () => {
    if (!session || !selectedProduct) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/account/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedProduct.id,
          quantity,
          frequency: selectedFrequency.id,
        }),
      });

      if (res.ok) {
        await fetchSubscriptions();
        setSelectedProduct(null);
        setActiveTab('manage');
      }
    } catch (error) {
      console.error('Error creating subscription:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePauseSubscription = async (subId: string) => {
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) return;

    const action = sub.status === 'PAUSED' ? 'resume' : 'pause';
    try {
      const res = await fetch('/api/account/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subId, action }),
      });

      if (res.ok) {
        await fetchSubscriptions();
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
    }
  };

  const handleCancelSubscription = (subId: string) => {
    setSubToCancel(subId);
  };

  const confirmCancelSubscription = async () => {
    if (!subToCancel) return;
    const subId = subToCancel;
    setSubToCancel(null);

    try {
      const res = await fetch('/api/account/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subId, action: 'cancel' }),
      });

      if (res.ok) {
        await fetchSubscriptions();
      }
    } catch (error) {
      console.error('Error cancelling subscription:', error);
    }
  };

  const activeSubscriptions = subscriptions.filter(s => s.status !== 'CANCELLED');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-orange-500 to-orange-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="text-6xl mb-4 block">🔄</span>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t('subscriptions.title') || 'Subscribe & Save'}
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            {t('subscriptions.subtitle') || 'Never run out of your essential peptides. Set up automatic deliveries and save up to 20% on every order.'}
          </p>

          <div className="flex flex-wrap justify-center gap-6 mt-8">
            {[
              { icon: '💰', text: t('subscriptions.benefit1') || 'Save up to 20%' },
              { icon: '📦', text: t('subscriptions.benefit2') || 'Free Shipping' },
              { icon: '⏸️', text: t('subscriptions.benefit3') || 'Pause Anytime' },
              { icon: '🎁', text: t('subscriptions.benefit4') || 'Bonus Points' },
            ].map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full">
                <span>{benefit.icon}</span>
                <span className="text-sm font-medium">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('browse')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'browse'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            {t('subscriptions.browseProducts') || 'Browse Products'}
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'manage'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-neutral-200'
            }`}
          >
            {t('subscriptions.mySubscriptions') || 'My Subscriptions'}
            {activeSubscriptions.length > 0 && (
              <span className="ms-2 px-2 py-0.5 bg-white/20 rounded-full text-sm">
                {activeSubscriptions.length}
              </span>
            )}
          </button>
        </div>

        {/* Browse Products Tab */}
        {activeTab === 'browse' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Products List */}
            <div className="lg:col-span-2">
              <h2 className="text-xl font-bold mb-4">{t('subscriptions.availableProducts') || 'Available for Subscription'}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subscriptionProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
                      selectedProduct?.id === product.id
                        ? 'border-orange-500 shadow-lg'
                        : 'border-neutral-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="w-20 h-20 bg-neutral-100 rounded-lg flex items-center justify-center">
                        <span className="text-3xl">💊</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-bold">{product.name}</h3>
                            {product.popular && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                                {t('common.popular') || 'Popular'}
                              </span>
                            )}
                          </div>
                          <p className="font-bold">{formatPrice(product.basePrice)}</p>
                        </div>
                        <p className="text-sm text-neutral-500 mt-1">{product.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subscription Builder */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 sticky top-24">
                <h3 className="text-lg font-bold mb-4">{t('subscriptions.buildSubscription') || 'Build Your Subscription'}</h3>

                {selectedProduct ? (
                  <>
                    <div className="bg-neutral-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{selectedProduct.name}</p>
                          <p className="text-sm text-neutral-500">{formatPrice(selectedProduct.basePrice)} {t('common.each') || 'each'}</p>
                        </div>
                        <button
                          onClick={() => setSelectedProduct(null)}
                          className="text-neutral-400 hover:text-neutral-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">{t('subscriptions.deliveryFrequency') || 'Delivery Frequency'}</label>
                      <div className="space-y-2">
                        {frequencies.map((freq) => (
                          <label
                            key={freq.id}
                            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedFrequency.id === freq.id
                                ? 'border-orange-500 bg-orange-50'
                                : 'border-neutral-200 hover:border-neutral-300'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                name="frequency"
                                checked={selectedFrequency.id === freq.id}
                                onChange={() => setSelectedFrequency(freq)}
                                className="text-orange-500"
                              />
                              <span>{freq.label}</span>
                            </div>
                            <span className="text-green-600 font-medium text-sm">Save {freq.discount}%</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2">{t('subscriptions.quantity') || 'Quantity'}</label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-10 h-10 border border-neutral-300 rounded-lg flex items-center justify-center hover:bg-neutral-100"
                        >
                          -
                        </button>
                        <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                        <button
                          onClick={() => setQuantity(quantity + 1)}
                          className="w-10 h-10 border border-neutral-300 rounded-lg flex items-center justify-center hover:bg-neutral-100"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="border-t pt-4 mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-neutral-500">{t('subscriptions.regularPrice') || 'Regular Price'}</span>
                        <span className="line-through text-neutral-400">
                          {formatPrice(selectedProduct.basePrice * quantity)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-green-600">Subscription Discount ({selectedFrequency.discount}%)</span>
                        <span className="text-green-600">
                          -{formatPrice(selectedProduct.basePrice * quantity * selectedFrequency.discount / 100)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-lg">
                        <span>{t('subscriptions.youPay') || 'You Pay'}</span>
                        <span className="text-orange-600">
                          {formatPrice(calculatePrice(selectedProduct.basePrice * quantity, selectedFrequency.discount))}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-1">per delivery</p>
                    </div>

                    {session ? (
                      <button
                        onClick={handleCreateSubscription}
                        disabled={isCreating}
                        className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isCreating ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Creating...
                          </>
                        ) : (
                          <>
                            <span>🔄</span>
                            {t('subscriptions.startSubscription') || 'Start Subscription'}
                          </>
                        )}
                      </button>
                    ) : (
                      <Link
                        href="/auth/signin"
                        className="block w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors text-center"
                      >
                        {t('subscriptions.signInToSubscribe') || 'Sign In to Subscribe'}
                      </Link>
                    )}

                    <p className="text-xs text-neutral-500 text-center mt-3">
                      {t('subscriptions.cancelAnytime') || 'Cancel or modify anytime. No commitment.'}
                    </p>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <span className="text-5xl mb-4 block">👈</span>
                    <p className="text-neutral-500">
                      {t('subscriptions.selectProduct') || 'Select a product to start your subscription'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Manage Subscriptions Tab */}
        {activeTab === 'manage' && (
          <div>
            {!session ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <span className="text-6xl mb-4 block">🔐</span>
                <h3 className="text-xl font-bold mb-2">{t('subscriptions.signInRequired') || 'Sign In Required'}</h3>
                <p className="text-neutral-500 mb-6">{t('subscriptions.signInToManage') || 'Please sign in to view and manage your subscriptions.'}</p>
                <Link
                  href="/auth/signin"
                  className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                >
                  {t('subscriptions.signIn') || 'Sign In'}
                </Link>
              </div>
            ) : loadingSubs ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              </div>
            ) : activeSubscriptions.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center">
                <span className="text-6xl mb-4 block">📦</span>
                <h3 className="text-xl font-bold mb-2">{t('subscriptions.noSubscriptions') || 'No Active Subscriptions'}</h3>
                <p className="text-neutral-500 mb-6">{t('subscriptions.noSubscriptionsDesc') || 'Start saving with automatic deliveries of your favorite products.'}</p>
                <button
                  onClick={() => setActiveTab('browse')}
                  className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
                >
                  {t('subscriptions.browseProducts') || 'Browse Products'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {activeSubscriptions.map((sub) => (
                  <div key={sub.id} className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="p-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-neutral-100 rounded-lg flex items-center justify-center">
                            <span className="text-3xl">💊</span>
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">
                              {sub.productName}
                              {sub.formatName ? ` — ${sub.formatName}` : ''}
                            </h3>
                            <p className="text-sm text-neutral-500">
                              {sub.quantity}x • {frequencyLabels[sub.frequency] || sub.frequency}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                sub.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                sub.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {sub.status === 'ACTIVE' ? 'Actif' : sub.status === 'PAUSED' ? 'En pause' : 'Annule'}
                              </span>
                              <span className="text-xs text-green-600">Economisez {sub.discountPercent}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-end">
                            <p className="font-bold text-lg">
                              {formatPrice(sub.unitPrice * sub.quantity * (1 - sub.discountPercent / 100))}
                            </p>
                            <p className="text-sm text-neutral-500">par livraison</p>
                          </div>
                        </div>
                      </div>

                      {/* Next Delivery */}
                      <div className="mt-4 p-4 bg-neutral-50 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📅</span>
                          <div>
                            <p className="text-sm text-neutral-500">{t('subscriptions.nextDelivery') || 'Next Delivery'}</p>
                            <p className="font-medium">
                              {new Date(sub.nextDelivery).toLocaleDateString(locale, {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePauseSubscription(sub.id)}
                            className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-100"
                          >
                            {sub.status === 'PAUSED' ? t('subscriptions.resume') : t('subscriptions.pause')}
                          </button>
                          <button
                            onClick={() => handleCancelSubscription(sub.id)}
                            className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                          >
                            {t('subscriptions.cancel')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FAQ Section */}
        <div className="mt-12 bg-white rounded-xl shadow-sm border border-neutral-200 p-6">
          <h2 className="text-xl font-bold mb-6">{t('subscriptions.faqTitle') || 'Subscription FAQ'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                q: t('subscriptions.faq1Q') || 'Can I cancel anytime?',
                a: t('subscriptions.faq1A') || 'Yes! You can cancel, pause, or modify your subscription at any time with no penalties.',
              },
              {
                q: t('subscriptions.faq2Q') || 'How does the discount work?',
                a: t('subscriptions.faq2A') || 'The more frequently you order, the more you save. Weekly deliveries save 20%, monthly saves 10%.',
              },
              {
                q: t('subscriptions.faq3Q') || 'Can I skip a delivery?',
                a: t('subscriptions.faq3A') || 'Absolutely. You can skip individual deliveries or pause your subscription temporarily.',
              },
              {
                q: t('subscriptions.faq4Q') || 'Will I earn loyalty points?',
                a: t('subscriptions.faq4A') || 'Yes! You earn full loyalty points on subscription orders, plus 200 bonus points per delivery.',
              },
            ].map((faq, i) => (
              <div key={i}>
                <h4 className="font-medium mb-1">{faq.q}</h4>
                <p className="text-sm text-neutral-500">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cancel subscription ConfirmDialog (replaces native confirm()) */}
      <ConfirmDialog
        isOpen={subToCancel !== null}
        title={t('subscriptions.cancelTitle') || 'Cancel Subscription'}
        message={t('subscriptions.confirmCancel') || 'Are you sure you want to cancel this subscription?'}
        confirmLabel={t('subscriptions.confirmCancelButton') || 'Cancel Subscription'}
        cancelLabel={t('common.cancel')}
        onConfirm={confirmCancelSubscription}
        onCancel={() => setSubToCancel(null)}
        variant="danger"
      />
    </div>
  );
}
