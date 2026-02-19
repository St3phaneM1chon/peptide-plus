'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useUpsell } from '@/contexts/UpsellContext';
import SubscriptionOfferModal from '@/components/SubscriptionOfferModal';
import { useI18n } from '@/i18n/client';

interface ProductHistoryItem {
  productId: string;
  formatId: string | null;
  productName: string;
  formatName: string | null;
  imageUrl: string | null;
  slug: string;
  currentPrice: number;
  lastOrderedPrice: number;
  totalOrdered: number;
  orderCount: number;
  lastOrderDate: string;
  inStock: boolean;
  isActive: boolean;
}

interface CategoryGroup {
  id: string;
  name: string;
  products: ProductHistoryItem[];
}

export default function ProductHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { addItem } = useCart();
  const { addItemWithUpsell } = useUpsell();
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionOffer, setSubscriptionOffer] = useState<ProductHistoryItem | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/products');
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchProductHistory();
    }
  }, [session]);

  const fetchProductHistory = async () => {
    try {
      const res = await fetch('/api/account/product-history');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch product history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: ProductHistoryItem) => {
    // Show subscription offer modal
    setSubscriptionOffer(product);
  };

  const handleSubscriptionAccept = async (frequency: string, discountPercent: number) => {
    if (!subscriptionOffer) return;

    setAddingToCart(`${subscriptionOffer.productId}__${subscriptionOffer.formatId}`);

    try {
      // Create subscription in DB
      await fetch('/api/account/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: subscriptionOffer.productId,
          formatId: subscriptionOffer.formatId,
          quantity: 1,
          frequency,
        }),
      });

      // Add to cart (subscription already created, bypass upsell)
      addItem({
        productId: subscriptionOffer.productId,
        formatId: subscriptionOffer.formatId || undefined,
        name: subscriptionOffer.productName,
        formatName: subscriptionOffer.formatName || undefined,
        price: subscriptionOffer.currentPrice * (1 - discountPercent / 100),
        image: subscriptionOffer.imageUrl || undefined,
      });
    } catch (error) {
      console.error('Error creating subscription:', error);
    } finally {
      setSubscriptionOffer(null);
      setAddingToCart(null);
    }
  };

  const handleSubscriptionDecline = () => {
    if (!subscriptionOffer) return;

    // Add to cart without subscription (use upsell for potential volume discount)
    addItemWithUpsell({
      productId: subscriptionOffer.productId,
      formatId: subscriptionOffer.formatId || undefined,
      name: subscriptionOffer.productName,
      formatName: subscriptionOffer.formatName || undefined,
      price: subscriptionOffer.currentPrice,
      image: subscriptionOffer.imageUrl || undefined,
    });

    setSubscriptionOffer(null);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) return null;

  const totalProducts = categories.reduce((sum, cat) => sum + cat.products.length, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">{t('account.home')}</Link>
            <span className="mx-2">/</span>
            <Link href="/account" className="hover:text-orange-600">{t('account.myAccount')}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{t('account.myProducts')}</span>
          </nav>
          <h1 className="text-3xl font-bold text-gray-900">{t('account.myProducts')}</h1>
          <p className="text-gray-500 mt-1">
            {t('account.myProductsDesc')}
          </p>
        </div>

        {/* Content */}
        {totalProducts === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('account.noProductsOrdered')}</h2>
            <p className="text-gray-600 mb-6">
              {t('account.noProductsOrderedDesc')}
            </p>
            <Link
              href="/shop"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {t('account.discoverProducts')}
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {categories.map((category) => (
              <div key={category.id}>
                {/* Category Header */}
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
                  <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {category.products.length} {category.products.length > 1 ? t('account.products') : t('account.product')}
                  </span>
                </div>

                {/* Products Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.products.map((product) => {
                    const isAvailable = product.isActive && product.inStock;
                    const loadingKey = `${product.productId}__${product.formatId}`;
                    const isAdding = addingToCart === loadingKey;

                    return (
                      <div
                        key={loadingKey}
                        className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="p-5">
                          {/* Product header */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {product.imageUrl ? (
                                <Image
                                  src={product.imageUrl}
                                  alt={product.productName}
                                  width={56}
                                  height={56}
                                  className="w-full h-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/shop/${product.slug}`}
                                className="font-semibold text-gray-900 hover:text-orange-600 line-clamp-1"
                              >
                                {product.productName}
                              </Link>
                              {product.formatName && (
                                <p className="text-sm text-gray-500">{product.formatName}</p>
                              )}
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-lg font-bold text-gray-900">{product.totalOrdered}</p>
                              <p className="text-xs text-gray-500">{t('account.totalQty')}</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2 text-center">
                              <p className="text-lg font-bold text-gray-900">{product.orderCount}</p>
                              <p className="text-xs text-gray-500">{product.orderCount > 1 ? t('account.orders') : t('account.order')}</p>
                            </div>
                          </div>

                          {/* Price + last order */}
                          <div className="flex items-center justify-between mb-4 text-sm">
                            <div>
                              <p className="font-bold text-gray-900">${product.currentPrice.toFixed(2)}</p>
                              <p className="text-xs text-gray-400">{t('account.currentPrice')}</p>
                            </div>
                            <div className="text-end">
                              <p className="text-gray-600">
                                {new Date(product.lastOrderDate).toLocaleDateString(locale, {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                              <p className="text-xs text-gray-400">{t('account.lastOrder')}</p>
                            </div>
                          </div>

                          {/* Status badges + action */}
                          <div className="flex items-center gap-2">
                            {!product.isActive && (
                              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                                {t('account.unavailable')}
                              </span>
                            )}
                            {product.isActive && !product.inStock && (
                              <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-600 rounded-full">
                                {t('account.outOfStock')}
                              </span>
                            )}
                            <button
                              onClick={() => handleAddToCart(product)}
                              disabled={!isAvailable || isAdding}
                              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                isAvailable
                                  ? 'bg-orange-500 text-white hover:bg-orange-600'
                                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              {isAdding ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                                </svg>
                              )}
                              {t('account.addToCart')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subscription Offer Modal */}
        {subscriptionOffer && (
          <SubscriptionOfferModal
            productId={subscriptionOffer.productId}
            formatId={subscriptionOffer.formatId}
            productName={subscriptionOffer.productName}
            formatName={subscriptionOffer.formatName}
            currentPrice={subscriptionOffer.currentPrice}
            onAccept={handleSubscriptionAccept}
            onDecline={handleSubscriptionDecline}
          />
        )}
      </div>
    </div>
  );
}
