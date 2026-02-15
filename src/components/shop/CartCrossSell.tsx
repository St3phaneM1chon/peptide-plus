'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslations } from '@/hooks/useTranslations';
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
  const { t } = useTranslations();

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
      const response = await fetch(`/api/products/${product.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch product details');
      }

      const productData = await response.json();
      const availableFormat = productData.formats?.find(
        (f: any) => f.isActive && f.stockQuantity > 0
      );

      if (!availableFormat) {
        toast.error(t('shop.outOfStock'));
        return;
      }

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
    <div className="bg-neutral-50 rounded-lg p-4 my-4">
      <h3 className="font-bold text-lg text-neutral-900 mb-3">
        {t('cart.customersAlsoBought') || 'Customers Also Bought'}
      </h3>

      {isLoading ? (
        // Loading skeleton
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-40 bg-white rounded-lg p-3 animate-pulse"
            >
              <div className="aspect-square bg-neutral-200 rounded-lg mb-2" />
              <div className="h-4 bg-neutral-200 rounded mb-2" />
              <div className="h-6 bg-neutral-200 rounded mb-2" />
              <div className="h-9 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent">
          {recommendations.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 w-40 bg-white rounded-lg p-3 border border-neutral-200 hover:border-orange-300 transition-all duration-200 hover:shadow-md"
            >
              {/* Product Image */}
              <Link href={`/product/${product.slug}`}>
                <div className="relative aspect-square bg-neutral-100 rounded-lg overflow-hidden mb-2 group">
                  <Image
                    src={product.imageUrl || '/images/products/peptide-default.png'}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  {product.purity && (
                    <span className="absolute top-1 right-1 px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">
                      {product.purity}%
                    </span>
                  )}
                </div>
              </Link>

              {/* Product Name */}
              <Link href={`/product/${product.slug}`}>
                <h4 className="text-sm font-semibold text-neutral-900 line-clamp-2 hover:text-orange-600 transition-colors mb-1 min-h-[2.5rem]">
                  {product.name}
                </h4>
              </Link>

              {/* Price */}
              <div className="flex items-center gap-1 mb-2">
                <span className="text-orange-600 font-bold text-sm">
                  {formatPrice(product.price)}
                </span>
                {product.comparePrice && product.comparePrice > product.price && (
                  <span className="text-xs text-neutral-400 line-through">
                    {formatPrice(product.comparePrice)}
                  </span>
                )}
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={() => handleAddToCart(product)}
                disabled={addingProductId === product.id}
                className={`w-full py-2 px-3 rounded-lg font-semibold text-xs transition-all ${
                  addingProductId === product.id
                    ? 'bg-green-600 text-white'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                {addingProductId === product.id ? (
                  <span className="flex items-center justify-center gap-1">
                    <svg
                      className="w-3 h-3"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t('shop.added')}
                  </span>
                ) : (
                  t('shop.addToCart')
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
