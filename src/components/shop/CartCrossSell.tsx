'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface RecommendedProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  comparePrice?: number;
  imageUrl?: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  purity?: number;
}

interface CartCrossSellProps {
  cartProductIds: string[];
}

export default function CartCrossSell({ cartProductIds }: CartCrossSellProps) {
  const [recommendations, setRecommendations] = useState<RecommendedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();
  const { t, locale } = useI18n();

  useEffect(() => {
    if (cartProductIds.length === 0) {
      setRecommendations([]);
      setIsLoading(false);
      return;
    }

    const fetchRecommendations = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/products/recommendations?productIds=${cartProductIds.join(',')}&limit=4`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch recommendations');
        }

        const data = await response.json();
        setRecommendations(data.recommendations || []);
      } catch (error) {
        console.error('Error fetching recommendations:', error);
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [cartProductIds]);

  const handleAddToCart = async (product: RecommendedProduct) => {
    setAddingProductId(product.id);

    try {
      // Fetch product details to get first available format
      const response = await fetch(`/api/products/${product.id}?locale=${locale}`);
      if (!response.ok) {
        throw new Error('Failed to fetch product details');
      }

      const productData = await response.json();
      const availableFormat = productData.product?.formats?.find(
        (f: { isActive: boolean; stockQuantity: number }) => f.isActive && f.stockQuantity > 0
      ) || productData.formats?.find(
        (f: { isActive: boolean; stockQuantity: number }) => f.isActive && f.stockQuantity > 0
      );

      if (!availableFormat) {
        toast.error(t('shop.outOfStock'));
        return;
      }

      // Direct add to cart (no upsell interstitial for cross-sell items)
      addItem({
        productId: product.id,
        formatId: availableFormat.id,
        name: product.name,
        formatName: availableFormat.name,
        price: Number(availableFormat.price),
        comparePrice: availableFormat.comparePrice
          ? Number(availableFormat.comparePrice)
          : undefined,
        image: product.imageUrl || '/images/products/peptide-default.png',
        maxQuantity: availableFormat.stockQuantity || 99,
        quantity: 1,
      });

      toast.success(`${product.name} ${t('shop.addedToCart')}`);
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error(t('shop.addToCartError') || 'Failed to add to cart');
    } finally {
      setTimeout(() => setAddingProductId(null), 1000);
    }
  };

  // Don't render if no recommendations
  if (!isLoading && recommendations.length === 0) {
    return null;
  }

  return (
    <div className="bg-orange-50/60 border-t border-orange-100 rounded-b-lg px-4 py-3">
      <h3 className="font-semibold text-sm text-neutral-700 mb-2">
        {t('cart.customersAlsoBought') || 'Customers Also Bought'}
      </h3>

      {isLoading ? (
        // Loading skeleton - compact
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-14 h-14 bg-orange-100 rounded-lg flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-3 bg-orange-100 rounded w-3/4 mb-1.5" />
                <div className="h-3 bg-orange-100 rounded w-1/3" />
              </div>
              <div className="h-7 w-20 bg-orange-100 rounded-lg flex-shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {recommendations.map((product) => (
            <div
              key={product.id}
              className="flex items-center gap-3 bg-white/70 rounded-lg p-2 border border-orange-100/50"
            >
              {/* Product Image - compact, same or smaller than cart items */}
              <Link href={`/product/${product.slug}`} className="flex-shrink-0">
                <div className="relative w-14 h-14 bg-neutral-100 rounded-lg overflow-hidden">
                  <Image
                    src={product.imageUrl || '/images/products/peptide-default.png'}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
              </Link>

              {/* Product Info - compact */}
              <div className="flex-1 min-w-0">
                <Link href={`/product/${product.slug}`}>
                  <p className="text-xs font-medium text-neutral-900 truncate hover:text-orange-600 transition-colors">
                    {product.name}
                  </p>
                </Link>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-bold text-orange-600">
                    {formatPrice(product.price)}
                  </span>
                  {product.comparePrice && product.comparePrice > product.price && (
                    <span className="text-xs text-neutral-400 line-through">
                      {formatPrice(product.comparePrice)}
                    </span>
                  )}
                </div>
              </div>

              {/* Add button - compact */}
              <button
                onClick={() => handleAddToCart(product)}
                disabled={addingProductId === product.id}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg font-medium text-xs transition-all whitespace-nowrap ${
                  addingProductId === product.id
                    ? 'bg-green-600 text-white'
                    : 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                }`}
              >
                {addingProductId === product.id ? (
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t('shop.added')}
                  </span>
                ) : (
                  t('cart.addThis')
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
