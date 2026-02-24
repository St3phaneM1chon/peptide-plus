'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCompare } from '@/hooks/useCompare';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { useUpsell } from '@/contexts/UpsellContext';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';

interface CompareProduct {
  id: string;
  name: string;
  subtitle: string | null;
  slug: string;
  price: number;
  compareAtPrice: number | null;
  imageUrl: string | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  productType: string;
  shortDescription: string | null;
  specifications: string | null;
  manufacturer: string | null;
  origin: string | null;
  weight: number | null;
  sku: string | null;
  barcode: string | null;
  certificateUrl: string | null;
  dataSheetUrl: string | null;
  formats: Array<{
    id: string;
    name: string;
    formatType: string;
    price: number;
    inStock: boolean;
    stockQuantity: number;
  }>;
  averageRating: number;
  reviewCount: number;
}

function ComparePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { productSlugs, removeFromCompare, clearCompare } = useCompare();
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const { addItem: _addItem } = useCart();
  const { addItemWithUpsell } = useUpsell();

  const [products, setProducts] = useState<CompareProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get slugs from URL or localStorage
  const slugsFromUrl = searchParams.get('products')?.split(',').filter(Boolean) || [];
  const slugsToFetch = slugsFromUrl.length > 0 ? slugsFromUrl : productSlugs;
  const slugsKey = slugsToFetch.join(',');

  const fetchProducts = useCallback(async () => {
    if (slugsToFetch.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const locale = typeof window !== 'undefined' ? localStorage.getItem('locale') || 'en' : 'en';
      const response = await fetch(`/api/products/compare?slugs=${slugsKey}&locale=${locale}`);

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(t('compare.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [slugsKey, slugsToFetch.length, t]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleRemoveProduct = (slug: string) => {
    removeFromCompare(slug);
    setProducts(prev => prev.filter(p => p.slug !== slug));

    // Sync URL params with remaining products
    const remainingSlugs = slugsToFetch.filter(s => s !== slug);
    const currentLang = typeof window !== 'undefined' ? localStorage.getItem('locale') || 'en' : 'en';
    if (remainingSlugs.length > 0) {
      router.replace(`/compare?products=${remainingSlugs.join(',')}&lang=${currentLang}`);
    } else {
      router.push('/shop');
    }
  };

  const handleAddToCart = (product: CompareProduct) => {
    const defaultFormat = product.formats.find(f => f.inStock) || product.formats[0];

    if (!defaultFormat || !defaultFormat.inStock) {
      toast.error(t('shop.outOfStock'));
      return;
    }

    addItemWithUpsell({
      productId: product.id,
      formatId: defaultFormat.id,
      name: `${product.name} ${defaultFormat.name}`,
      formatName: defaultFormat.name,
      price: defaultFormat.price,
      image: product.imageUrl || '/images/products/peptide-default.png',
      maxQuantity: defaultFormat.stockQuantity || 99,
      quantity: 1,
    });

    toast.success(t('shop.added'), {
      description: product.name,
    });
  };

  const handleClearAll = () => {
    clearCompare();
    router.push('/shop');
  };

  // Find best value (lowest price per format)
  const getBestValue = () => {
    if (products.length === 0) return null;

    let lowestPrice = Infinity;
    let bestProductSlug = '';

    products.forEach(product => {
      const minPrice = Math.min(...product.formats.map(f => f.price));
      if (minPrice < lowestPrice) {
        lowestPrice = minPrice;
        bestProductSlug = product.slug;
      }
    });

    return bestProductSlug;
  };

  // TODO: Re-enable highestPurity comparison highlight when UI is wired up
  // const getHighestPurity = () => {
  //   if (products.length === 0) return null;
  //   let highestPurity = 0;
  //   let bestProductSlug = '';
  //   products.forEach(product => {
  //     const specs = product.specifications;
  //     if (specs) {
  //       const purityMatch = specs.match(/purity[:\s]+(\d+(?:\.\d+)?)/i);
  //       if (purityMatch) {
  //         const purity = parseFloat(purityMatch[1]);
  //         if (purity > highestPurity) {
  //           highestPurity = purity;
  //           bestProductSlug = product.slug;
  //         }
  //       }
  //     }
  //   });
  //   return bestProductSlug || null;
  // };

  const bestValue = getBestValue();

  // Empty state
  if (!isLoading && products.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-neutral-100 rounded-full mx-auto mb-6 flex items-center justify-center">
            <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-2">{t('compare.noProducts')}</h1>
          <p className="text-neutral-600 mb-8">{t('compare.noProductsDesc')}</p>
          <Link
            href="/shop"
            className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors"
          >
            {t('compare.browseProducts')}
          </Link>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-64 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-neutral-100 rounded-lg h-96" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-orange-500 hover:text-orange-600 font-medium"
          >
            {t('common.tryAgain')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            {t('compare.compareProducts')}
          </h1>
          <p className="text-neutral-600">
            {t('compare.comparingProducts', { count: products.length.toString() })}
          </p>
        </div>
        <button
          onClick={handleClearAll}
          className="text-red-500 hover:text-red-600 font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {t('compare.clearAll')}
        </button>
      </div>

      {/* Comparison Table - Desktop */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-neutral-200">
              <th className="text-start py-4 px-4 font-semibold text-neutral-700 w-1/5">
                {t('compare.feature')}
              </th>
              {products.map((product) => (
                <th key={product.slug} className="py-4 px-4 w-1/5">
                  <div className="relative">
                    <button
                      onClick={() => handleRemoveProduct(product.slug)}
                      className="absolute -top-2 -end-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md z-10"
                      aria-label={`Remove ${product.name}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <Link href={`/product/${product.slug}`}>
                      <div className="aspect-square bg-neutral-100 rounded-lg overflow-hidden mb-3">
                        <Image
                          src={product.imageUrl || '/images/products/peptide-default.png'}
                          alt={product.name}
                          width={200}
                          height={200}
                          className="object-cover w-full h-full hover:scale-105 transition-transform"
                        />
                      </div>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Product Name */}
            <tr className="border-b border-neutral-200 hover:bg-neutral-50">
              <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.productName')}</td>
              {products.map((product) => (
                <td key={product.slug} className="py-3 px-4 text-center">
                  <Link
                    href={`/product/${product.slug}`}
                    className="font-semibold text-neutral-900 hover:text-orange-600"
                  >
                    {product.name}
                  </Link>
                  {product.subtitle && (
                    <p className="text-sm text-neutral-500 mt-1">{product.subtitle}</p>
                  )}
                </td>
              ))}
            </tr>

            {/* Price */}
            <tr className="border-b border-neutral-200 hover:bg-neutral-50">
              <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.price')}</td>
              {products.map((product) => (
                <td key={product.slug} className="py-3 px-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-orange-600 font-bold text-lg">
                      {formatPrice(product.price)}
                    </span>
                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                      <span className="text-sm text-neutral-400 line-through">
                        {formatPrice(product.compareAtPrice)}
                      </span>
                    )}
                    {product.slug === bestValue && (
                      <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        {t('compare.bestValue')}
                      </span>
                    )}
                  </div>
                </td>
              ))}
            </tr>

            {/* Category */}
            <tr className="border-b border-neutral-200 hover:bg-neutral-50">
              <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.category')}</td>
              {products.map((product) => (
                <td key={product.slug} className="py-3 px-4 text-center">
                  <Link
                    href={`/shop?category=${product.category.slug}`}
                    className="text-neutral-600 hover:text-orange-600"
                  >
                    {product.category.name}
                  </Link>
                </td>
              ))}
            </tr>

            {/* Rating */}
            <tr className="border-b border-neutral-200 hover:bg-neutral-50">
              <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.rating')}</td>
              {products.map((product) => (
                <td key={product.slug} className="py-3 px-4 text-center">
                  {product.reviewCount > 0 ? (
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-500">★</span>
                        <span className="font-medium">{product.averageRating.toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-neutral-500">
                        ({product.reviewCount} {t('compare.reviews')})
                      </span>
                    </div>
                  ) : (
                    <span className="text-neutral-400 text-sm">{t('compare.noReviews')}</span>
                  )}
                </td>
              ))}
            </tr>

            {/* Stock Status */}
            <tr className="border-b border-neutral-200 hover:bg-neutral-50">
              <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.stock')}</td>
              {products.map((product) => {
                const hasStock = product.formats.some(f => f.inStock && f.stockQuantity > 0);
                return (
                  <td key={product.slug} className="py-3 px-4 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      hasStock
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {hasStock ? t('shop.inStock') : t('shop.outOfStock')}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Available Formats */}
            <tr className="border-b border-neutral-200 hover:bg-neutral-50">
              <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.formats')}</td>
              {products.map((product) => (
                <td key={product.slug} className="py-3 px-4">
                  <div className="flex flex-col gap-1 text-sm text-neutral-600">
                    {product.formats.slice(0, 3).map((format) => (
                      <div key={format.id}>
                        {format.name} - {formatPrice(format.price)}
                      </div>
                    ))}
                    {product.formats.length > 3 && (
                      <div className="text-xs text-neutral-400">
                        +{product.formats.length - 3} {t('compare.more')}
                      </div>
                    )}
                  </div>
                </td>
              ))}
            </tr>

            {/* Manufacturer */}
            {products.some(p => p.manufacturer) && (
              <tr className="border-b border-neutral-200 hover:bg-neutral-50">
                <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.manufacturer')}</td>
                {products.map((product) => (
                  <td key={product.slug} className="py-3 px-4 text-center text-neutral-600">
                    {product.manufacturer || '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Origin */}
            {products.some(p => p.origin) && (
              <tr className="border-b border-neutral-200 hover:bg-neutral-50">
                <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.origin')}</td>
                {products.map((product) => (
                  <td key={product.slug} className="py-3 px-4 text-center text-neutral-600">
                    {product.origin || '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* SKU */}
            {products.some(p => p.sku) && (
              <tr className="border-b border-neutral-200 hover:bg-neutral-50">
                <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.sku')}</td>
                {products.map((product) => (
                  <td key={product.slug} className="py-3 px-4 text-center text-neutral-600 font-mono text-sm">
                    {product.sku || '—'}
                  </td>
                ))}
              </tr>
            )}

            {/* Documents */}
            <tr className="border-b border-neutral-200 hover:bg-neutral-50">
              <td className="py-3 px-4 font-medium text-neutral-700">{t('compare.documents')}</td>
              {products.map((product) => (
                <td key={product.slug} className="py-3 px-4">
                  <div className="flex flex-col gap-2 items-center">
                    {product.certificateUrl && (
                      <a
                        href={product.certificateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-600 hover:underline flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {t('compare.certificate')}
                      </a>
                    )}
                    {product.dataSheetUrl && (
                      <a
                        href={product.dataSheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-600 hover:underline flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {t('compare.dataSheet')}
                      </a>
                    )}
                    {!product.certificateUrl && !product.dataSheetUrl && (
                      <span className="text-neutral-400 text-sm">—</span>
                    )}
                  </div>
                </td>
              ))}
            </tr>

            {/* Add to Cart */}
            <tr>
              <td className="py-4 px-4"></td>
              {products.map((product) => {
                const hasStock = product.formats.some(f => f.inStock && f.stockQuantity > 0);
                return (
                  <td key={product.slug} className="py-4 px-4 text-center">
                    <button
                      onClick={() => handleAddToCart(product)}
                      disabled={!hasStock}
                      className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
                        hasStock
                          ? 'bg-orange-500 text-white hover:bg-orange-600'
                          : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                      }`}
                    >
                      {hasStock ? t('shop.addToCart') : t('shop.outOfStock')}
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile View - Stacked Cards */}
      <div className="lg:hidden space-y-6">
        {products.map((product) => {
          const hasStock = product.formats.some(f => f.inStock && f.stockQuantity > 0);
          return (
            <div key={product.slug} className="bg-white border border-neutral-200 rounded-lg p-4 relative">
              <button
                onClick={() => handleRemoveProduct(product.slug)}
                className="absolute top-2 end-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md"
                aria-label={`Remove ${product.name}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <Link href={`/product/${product.slug}`}>
                <div className="aspect-square bg-neutral-100 rounded-lg overflow-hidden mb-4">
                  <Image
                    src={product.imageUrl || '/images/products/peptide-default.png'}
                    alt={product.name}
                    width={300}
                    height={300}
                    className="object-cover w-full h-full"
                  />
                </div>
              </Link>

              <h3 className="font-bold text-lg text-neutral-900 mb-2">{product.name}</h3>
              {product.subtitle && (
                <p className="text-sm text-neutral-500 mb-3">{product.subtitle}</p>
              )}

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-neutral-600">{t('compare.price')}:</span>
                  <span className="font-bold text-orange-600">{formatPrice(product.price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">{t('compare.category')}:</span>
                  <span className="text-neutral-900">{product.category.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">{t('compare.rating')}:</span>
                  <span className="text-neutral-900">
                    {product.reviewCount > 0
                      ? `★ ${product.averageRating.toFixed(1)} (${product.reviewCount})`
                      : t('compare.noReviews')
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-600">{t('compare.stock')}:</span>
                  <span className={hasStock ? 'text-green-600' : 'text-red-600'}>
                    {hasStock ? t('shop.inStock') : t('shop.outOfStock')}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleAddToCart(product)}
                disabled={!hasStock}
                className={`w-full py-3 px-4 rounded-lg font-semibold transition-colors ${
                  hasStock
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                }`}
              >
                {hasStock ? t('shop.addToCart') : t('shop.outOfStock')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-64 mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-neutral-100 rounded-lg h-96" />
            ))}
          </div>
        </div>
      </div>
    }>
      <ComparePageContent />
    </Suspense>
  );
}
