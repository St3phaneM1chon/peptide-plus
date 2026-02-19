'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface BundleItem {
  id: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
    price: number;
    purity?: number | null;
    formats: Array<{
      id: string;
      name: string;
      price: number;
    }>;
  };
  formatId?: string | null;
  itemPrice: number;
  itemTotal: number;
}

interface Bundle {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  discount: number;
  itemCount: number;
  originalPrice: number;
  bundlePrice: number;
  savings: number;
  items: BundleItem[];
}

export default function BundleDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { t } = useI18n();
  const { addItem } = useCart();

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);

  useEffect(() => {
    async function fetchBundle() {
      try {
        const response = await fetch(`/api/bundles/${slug}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Bundle not found');
          } else {
            throw new Error('Failed to fetch bundle');
          }
          return;
        }
        const data = await response.json();
        setBundle(data);
      } catch (err) {
        console.error('Error fetching bundle:', err);
        setError('Failed to load bundle');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchBundle();
    }
  }, [slug]);

  const handleAddBundleToCart = () => {
    if (!bundle) return;

    setAddingToCart(true);
    try {
      // Add each item in the bundle to the cart
      bundle.items.forEach((item) => {
        const format = item.formatId
          ? item.product.formats.find((f) => f.id === item.formatId)
          : null;

        addItem({
          productId: item.product.id,
          formatId: item.formatId || undefined,
          name: item.product.name,
          formatName: format?.name,
          price: item.itemPrice,
          quantity: item.quantity,
          image: item.product.imageUrl || undefined,
        });
      });

      toast.success(`${bundle.name} added to cart!`);
    } catch (err) {
      console.error('Error adding bundle to cart:', err);
      toast.error('Failed to add bundle to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'Bundle not found'}
          </h2>
          <Link
            href="/bundles"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Bundles
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-6 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-700">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/bundles" className="hover:text-gray-700">Bundles</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{bundle.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Column - Image */}
        <div>
          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {bundle.image ? (
              <Image
                src={bundle.image}
                alt={bundle.name}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-32 h-32"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                  />
                </svg>
              </div>
            )}

            {/* Savings Badge */}
            {bundle.discount > 0 && (
              <div className="absolute top-4 end-4 bg-red-500 text-white px-4 py-2 rounded-full text-lg font-bold shadow-lg">
                Save {bundle.discount}%
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Info */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{bundle.name}</h1>

          {bundle.description && (
            <p className="text-lg text-gray-600 mb-6">{bundle.description}</p>
          )}

          {/* Price Summary */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-gray-600">Original Price:</span>
              <span className="text-xl text-gray-500 line-through">
                ${bundle.originalPrice.toFixed(2)}
              </span>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-gray-600">Bundle Discount:</span>
              <span className="text-lg font-semibold text-red-600">
                -{bundle.discount}%
              </span>
            </div>
            <div className="border-t pt-3 mt-3">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-xl font-semibold text-gray-900">Bundle Price:</span>
                <span className="text-3xl font-bold text-blue-600">
                  ${bundle.bundlePrice.toFixed(2)}
                </span>
              </div>
              <div className="text-end text-green-600 font-medium">
                You save ${bundle.savings.toFixed(2)}!
              </div>
            </div>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddBundleToCart}
            disabled={addingToCart}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {addingToCart ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Adding to Cart...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                  />
                </svg>
                Add Bundle to Cart
              </>
            )}
          </button>

          {/* What's Included */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              What&apos;s Included ({bundle.itemCount} {bundle.itemCount === 1 ? 'Product' : 'Products'})
            </h2>
            <div className="space-y-4">
              {bundle.items.map((item) => {
                const selectedFormat = item.formatId
                  ? item.product.formats.find((f) => f.id === item.formatId)
                  : null;

                return (
                  <div
                    key={item.id}
                    className="flex gap-4 border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                  >
                    {/* Product Image */}
                    <div className="w-20 h-20 flex-shrink-0 relative bg-gray-100 rounded">
                      {item.product.imageUrl ? (
                        <Image
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          fill
                          className="object-cover rounded"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-8 h-8"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5"
                            />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {item.product.name}
                      </h3>
                      {selectedFormat && (
                        <p className="text-sm text-gray-600 mb-1">
                          Format: {selectedFormat.name}
                        </p>
                      )}
                      {item.product.purity && (
                        <p className="text-sm text-gray-600">
                          Purity: {item.product.purity}%
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm text-gray-600">Qty: {item.quantity}</span>
                        <span className="text-sm text-gray-400">×</span>
                        <span className="text-sm font-semibold text-gray-900">
                          ${item.itemPrice.toFixed(2)}
                        </span>
                        <span className="text-sm text-gray-400">=</span>
                        <span className="text-sm font-semibold text-blue-600">
                          ${item.itemTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* View Product Link */}
                    <Link
                      href={`/products/${item.product.slug}`}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium self-start"
                    >
                      View →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Back to Bundles */}
      <div className="mt-12 text-center">
        <Link
          href="/bundles"
          className="inline-block text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back to All Bundles
        </Link>
      </div>
    </div>
  );
}
