// TODO: BUG-063 - Decompose this 1000+ line monolith into sub-components (ProductHeader, ProductFormats, ProductQuantity, ProductActions, etc.)
'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useCart } from '@/contexts/CartContext';
import { useUpsell } from '@/contexts/UpsellContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/i18n/client';
import { getPeptideChemistry } from '@/data/peptideChemistry';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import WishlistButton from '@/components/shop/WishlistButton';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import ShareButtons from '@/components/shop/ShareButtons';
import StickyAddToCart from '@/components/shop/StickyAddToCart';
import StockAlertButton from '@/components/shop/StockAlertButton';
import QuantityTiers from '@/components/shop/QuantityTiers';
import ProductBadges from '@/components/shop/ProductBadges';
import PriceDropButton from '@/components/shop/PriceDropButton';
import CountdownTimer from '@/components/ui/CountdownTimer';
import { getFormatIcon } from '@/lib/format-icons';

const ProductReviews = dynamic(() => import('@/components/shop/ProductReviews'), { ssr: false });
const ProductQA = dynamic(() => import('@/components/shop/ProductQA'), { ssr: false });
const RecentlyViewed = dynamic(() => import('@/components/shop/RecentlyViewed'), { ssr: false });
const ProductVideo = dynamic(() => import('@/components/shop/ProductVideo'), { ssr: false });

interface ProductFormat {
  id: string;
  name: string;
  nameKey?: string;
  type: string;
  dosageMg?: number;
  price: number;
  comparePrice?: number;
  sku: string;
  inStock: boolean;
  stockQuantity: number;
  image?: string;
}

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}

interface RelatedProduct {
  id: string;
  name: string;
  nameKey?: string;
  slug: string;
  price: number;
  purity?: number;
  image?: string;
}

interface QuantityDiscount {
  id: string;
  minQty: number;
  maxQty: number | null;
  discount: number;
}

interface Promotion {
  id: string;
  name: string;
  endsAt: string | null;
  badge: string | null;
}

interface Product {
  id: string;
  name: string;
  nameKey?: string;
  subtitle: string;
  slug: string;
  shortDescription: string;
  description: string;
  specifications: string;
  price: number;
  purity?: number;
  avgMass?: string;
  molecularWeight?: number;
  casNumber?: string;
  molecularFormula?: string;
  storageConditions?: string;
  productType?: string;
  categoryName: string;
  categoryKey?: string;
  categorySlug: string;
  isNew?: boolean;
  isBestseller?: boolean;
  productImage?: string;
  videoUrl?: string;
  images?: ProductImage[];
  formats: ProductFormat[];
  relatedProducts: RelatedProduct[];
  quantityDiscounts?: QuantityDiscount[];
  createdAt?: Date | string;
  purchaseCount?: number;
  averageRating?: number;
  reviewCount?: number;
  promotion?: Promotion | null;
}

interface ProductPageClientProps {
  product: Product;
}

// Format icons imported from shared utility: @/lib/format-icons

export default function ProductPageClient({ product }: ProductPageClientProps) {
  const { addItem: _addItem } = useCart();
  const { addItemWithUpsell } = useUpsell();
  const { formatPrice } = useCurrency();
  const { t } = useI18n();
  const { addViewed } = useRecentlyViewed();

  // Track this product as recently viewed
  useEffect(() => {
    addViewed(product.slug);
  }, [product.slug, addViewed]);

  // FIX: BUG-089 - Show ALL formats (including out-of-stock) but mark out-of-stock as disabled/grayed
  const availableFormats = product.formats;

  // Fallback format when product has no formats (e.g. single-price products)
  const fallbackFormat: ProductFormat = {
    id: 'default',
    name: product.name,
    type: 'vial_2ml',
    price: product.price,
    sku: '',
    // BUG-042 FIX: Don't hardcode stockQuantity to 99; use 0 and inStock: false for safety
    inStock: false,
    stockQuantity: 0,
  };

  const [selectedFormat, setSelectedFormat] = useState<ProductFormat>(
    availableFormats.find(f => f.inStock) || availableFormats[0] || product.formats[0] || fallbackFormat
  );
  const [quantity, setQuantity] = useState(1);
  const validTabs = ['description', 'specs', 'research', 'reconstitution', 'video'] as const;
  type TabType = typeof validTabs[number];
  const getInitialTab = (): TabType => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as TabType;
      if (validTabs.includes(hash)) return hash;
    }
    return 'description';
  };
  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${tab}`);
    }
  };
  const [addedToCart, setAddedToCart] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>(
    product.productImage || '/images/products/peptide-default.png'
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addToCartButtonRef = useRef<HTMLButtonElement>(null);
  
  // Get enriched chemistry data if available
  const chemistryData = getPeptideChemistry(product.slug);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get translated product name
  const productName = product.nameKey ? t(`products.${product.nameKey}`) : product.name;
  
  // Get translated category
  const categoryName = product.categoryKey ? t(`categories.${product.categoryKey}`) : product.categoryName;

  // Get translated format name
  const getFormatName = (format: ProductFormat) => {
    if (format.nameKey) {
      return t(`formats.${format.nameKey}`);
    }
    return format.name;
  };

  // Get translated related product name
  const getRelatedProductName = (related: RelatedProduct) => {
    if (related.nameKey) {
      return t(`products.${related.nameKey}`);
    }
    return related.name;
  };

  // Calculate effective price based on quantity discounts
  const getEffectivePrice = (basePrice: number, qty: number) => {
    if (!product.quantityDiscounts || product.quantityDiscounts.length === 0) {
      return basePrice;
    }

    // Find the applicable discount tier
    const applicableTier = product.quantityDiscounts
      .filter(tier => qty >= tier.minQty && (tier.maxQty === null || qty <= tier.maxQty))
      .sort((a, b) => b.discount - a.discount)[0]; // Get highest discount

    if (applicableTier) {
      return basePrice * (1 - applicableTier.discount / 100);
    }

    return basePrice;
  };

  // Get the effective price per unit
  // FIX: BUG-064 - Use JSON-serialized quantityDiscounts to avoid unstable object reference in deps
  const quantityDiscountsKey = JSON.stringify(product.quantityDiscounts);
  const effectivePrice = useMemo(
    () => getEffectivePrice(selectedFormat.price, quantity),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFormat.price, quantity, quantityDiscountsKey]
  );

  const handleFormatSelect = (format: ProductFormat) => {
    setSelectedFormat(format);
    setQuantity(1);
    setIsDropdownOpen(false);
    // Switch main image to format-specific image if available
    if (format.image) {
      setSelectedImage(format.image);
    }
  };

  const handleAddToCart = () => {
    if (!selectedFormat.inStock) return;

    const formatName = getFormatName(selectedFormat);
    const fullProductName = `${productName} ${formatName}`;

    addItemWithUpsell({
      productId: product.id,
      formatId: selectedFormat.id,
      name: fullProductName,
      formatName: formatName,
      price: effectivePrice, // Use the discounted price
      comparePrice: effectivePrice < selectedFormat.price ? selectedFormat.price : selectedFormat.comparePrice,
      sku: selectedFormat.sku,
      image: product.productImage || '/images/products/peptide-default.png',
      maxQuantity: selectedFormat.stockQuantity,
      productType: product.productType,
      quantity,
    });

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <>
      {/* Sticky Add to Cart Bar */}
      <StickyAddToCart
        productName={productName}
        price={effectivePrice}
        formattedPrice={formatPrice(effectivePrice)}
        selectedFormat={getFormatName(selectedFormat)}
        onAddToCart={handleAddToCart}
        isOutOfStock={!selectedFormat.inStock}
        addedToCart={addedToCart}
        targetRef={addToCartButtonRef}
      />

    <div className="min-h-screen bg-white">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t('nav.home') || 'Home', href: '/' },
          { label: t('shop.shop') || 'Shop', href: '/shop' },
          { label: categoryName, href: `/category/${product.categorySlug}` },
          { label: productName },
        ]}
      />

      {/* Product Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* LEFT: Image */}
          <div>
            <div className="aspect-square max-w-md mx-auto bg-neutral-100 rounded-lg overflow-hidden relative">
              <Image
                src={selectedImage}
                alt={productName}
                fill
                sizes="(max-width: 1024px) 100vw, 448px"
                className="object-contain"
                priority
              />

              {/* Product Badges */}
              <ProductBadges
                product={{
                  createdAt: product.createdAt,
                  purchaseCount: product.purchaseCount,
                  averageRating: product.averageRating,
                  reviewCount: product.reviewCount,
                  price: selectedFormat.price,
                  compareAtPrice: selectedFormat.comparePrice,
                  formats: availableFormats,
                }}
                maxBadges={3}
                className="top-3 start-3"
              />
            </div>
            {/* Thumbnail gallery */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-2 mt-3 max-w-md mx-auto overflow-x-auto" role="group" aria-label={t('shop.aria.productImageGallery')}>
                {product.images.map((img, index) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img.url)}
                    aria-label={`View image ${index + 1} of ${product.images!.length}${img.alt ? `: ${img.alt}` : ''}`}
                    aria-current={selectedImage === img.url ? 'true' : undefined}
                    className={`w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors cursor-pointer ${
                      selectedImage === img.url ? 'border-orange-500' : 'border-neutral-200 hover:border-orange-400'
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt}
                      width={64}
                      height={64}
                      className="object-cover w-full h-full"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Product Info */}
          <div>
            {/* Category Badge */}
            <span className="inline-block px-3 py-1 bg-black/80 text-white text-xs font-medium rounded-full mb-3">
              {categoryName}
            </span>

            {/* Title - adapts with selected format */}
            <h1 className="text-2xl lg:text-3xl font-bold text-black mb-2">
              {productName} {getFormatName(selectedFormat)}
            </h1>

            {/* Subtitle */}
            {product.subtitle && (
              <p className="text-lg text-neutral-600 mb-4">
                {product.subtitle}
              </p>
            )}

            {/* Price - adapts with selected format and quantity discounts */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl font-bold text-orange-600">
                {formatPrice(effectivePrice)}
              </span>
              {effectivePrice < selectedFormat.price && (
                <span className="text-xl text-neutral-400 line-through">
                  {formatPrice(selectedFormat.price)}
                </span>
              )}
              {effectivePrice == null && selectedFormat.comparePrice && selectedFormat.comparePrice > selectedFormat.price && (
                <span className="text-xl text-neutral-400 line-through">
                  {formatPrice(selectedFormat.comparePrice)}
                </span>
              )}
            </div>

            {/* Flash Sale Countdown Timer */}
            {product.promotion?.endsAt && (
              <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">⚡</span>
                  <h3 className="font-bold text-orange-800">
                    {product.promotion.name} {t('promotion.endsIn') || 'Ends In'}
                  </h3>
                </div>
                <CountdownTimer
                  endDate={product.promotion.endsAt}
                  variant="compact"
                  showDays={true}
                />
              </div>
            )}

            {/* Purity & Mass Badges */}
            {(product.purity || product.avgMass) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {product.purity && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                    {t('shop.purity')} {product.purity}%
                  </span>
                )}
                {product.avgMass && (
                  <span className="bg-neutral-100 text-neutral-700 px-3 py-1 rounded-full text-sm font-medium">
                    {t('shop.avgMass')} {product.avgMass}
                  </span>
                )}
              </div>
            )}

            {/* Short Description */}
            <p className="text-neutral-700 mb-6 leading-relaxed">
              {product.shortDescription}
            </p>

            {/* Format Selector - Dropdown like ProductCard */}
            <div className="mb-6 relative" ref={dropdownRef}>
              <label className="block text-xs text-neutral-500 uppercase tracking-wider mb-2">
                {t('shop.packaging')}:
              </label>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-label={`Select format for ${productName}`}
                aria-expanded={isDropdownOpen}
                aria-haspopup="listbox"
                className="w-full flex items-center justify-between gap-3 px-4 py-3 border-2 border-neutral-300 rounded-lg bg-white hover:border-orange-400 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {getFormatIcon(selectedFormat?.type)}
                  </span>
                  <div className="text-start">
                    <p className="font-semibold text-black">
                      {getFormatName(selectedFormat)}
                    </p>
                    <p className="text-sm text-orange-600 font-bold">
                      {formatPrice(selectedFormat.price)}
                    </p>
                  </div>
                </div>
                <svg 
                  className={`w-5 h-5 text-neutral-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-2xl max-h-80 overflow-y-auto" role="listbox" aria-label={t('shop.aria.availableFormats')}>
                  {availableFormats.map((format) => (
                    <button
                      key={format.id}
                      role="option"
                      aria-selected={selectedFormat.id === format.id}
                      onClick={() => handleFormatSelect(format)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-start transition-colors border-b border-neutral-100 last:border-b-0 ${
                        selectedFormat.id === format.id
                          ? 'bg-orange-50'
                          : format.inStock
                          ? 'hover:bg-neutral-50'
                          : 'opacity-50 bg-neutral-50 hover:bg-neutral-100'
                      }`}
                    >
                      {/* Format Icon */}
                      <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center">
                        {format.image ? (
                          <Image src={format.image} alt={getFormatName(format)} width={48} height={48} className="object-cover rounded-lg" />
                        ) : (
                          <span className="text-2xl">{getFormatIcon(format.type)}</span>
                        )}
                      </div>
                      
                      {/* Format Info */}
                      <div className="flex-1">
                        <p className="font-medium text-black">{getFormatName(format)}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-orange-600 font-bold">{formatPrice(format.price)}</span>
                          {format.comparePrice && format.comparePrice > format.price && (
                            <span className="text-sm text-neutral-400 line-through">{formatPrice(format.comparePrice)}</span>
                          )}
                        </div>
                        {!format.inStock && (
                          <span className="text-xs text-red-500">{t('shop.outOfStock')}</span>
                        )}
                        {format.inStock && format.stockQuantity <= 10 && (
                          <span className="text-xs text-amber-600">{t('shop.onlyLeft')} {format.stockQuantity} {t('shop.left')}</span>
                        )}
                      </div>

                      {/* Selected Check */}
                      {selectedFormat.id === format.id && (
                        <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity Discounts / Bulk Pricing */}
            {product.quantityDiscounts && product.quantityDiscounts.length > 0 && (
              <div className="mb-6">
                <QuantityTiers
                  tiers={product.quantityDiscounts}
                  basePrice={selectedFormat.price}
                  currentQuantity={quantity}
                />
              </div>
            )}

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-4 mb-4">
              {/* Quantity Selector */}
              <div className="flex items-center border border-neutral-300 rounded-lg" role="group" aria-label={`Quantity for ${productName}`}>
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label={t('shop.aria.decreaseQuantity')}
                  className="w-12 h-12 flex items-center justify-center text-xl hover:bg-neutral-100 transition-colors"
                >
                  −
                </button>
                <span className="w-14 text-center font-bold text-lg" aria-live="polite" aria-atomic="true">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(selectedFormat.stockQuantity, quantity + 1))}
                  aria-label={t('shop.aria.increaseQuantity')}
                  className="w-12 h-12 flex items-center justify-center text-xl hover:bg-neutral-100 transition-colors"
                >
                  +
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                ref={addToCartButtonRef}
                onClick={handleAddToCart}
                disabled={!selectedFormat.inStock}
                aria-label={`Add ${productName} to cart`}
                className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all ${
                  addedToCart
                    ? 'bg-green-600 text-white'
                    : selectedFormat.inStock
                    ? 'bg-orange-500 text-white hover:bg-orange-600'
                    : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                }`}
              >
                {addedToCart
                  ? `✓ ${t('shop.added')}`
                  : selectedFormat.inStock
                    ? `${t('shop.addToCart')} - ${formatPrice(effectivePrice * quantity)}`
                    : t('shop.outOfStock')
                }
              </button>
            </div>

            {/* Research Disclaimer - LEGAL REQUIREMENT */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-amber-800 text-xs leading-relaxed">
                <strong className="text-amber-900">{t('disclaimer.title').toUpperCase()}:</strong>{' '}
                {t('shop.researchDisclaimer')}
              </p>
            </div>

            {/* Wishlist & Price Alert Buttons */}
            <div className="mb-6 flex gap-3">
              <WishlistButton productId={product.id} variant="button" />
              <PriceDropButton
                productId={product.id}
                currentPrice={selectedFormat.price}
                variant="button"
              />
            </div>

            {/* Stock Warning */}
            {selectedFormat.inStock && selectedFormat.stockQuantity <= 10 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <p className="text-amber-700 text-sm font-medium">
                  ⚠️ {t('shop.onlyLeft')} {selectedFormat.stockQuantity} {t('shop.left')}!
                </p>
              </div>
            )}

            {/* Back-in-Stock Alert */}
            {!selectedFormat.inStock && (
              <div className="mb-6">
                <StockAlertButton
                  productId={product.id}
                  formatId={selectedFormat.id}
                  productName={productName}
                  formatName={getFormatName(selectedFormat)}
                />
              </div>
            )}

            {/* Trust badges */}
            <div className="flex flex-wrap gap-4 text-sm text-neutral-600 border-t pt-4">
              <span className="flex items-center gap-1">✅ {t('shop.labTested')}</span>
              <span className="flex items-center gap-1">🚚 {t('shop.fastShipping')}</span>
              <span className="flex items-center gap-1">🔒 {t('shop.securePayment')}</span>
              <span className="flex items-center gap-1">📦 {t('shop.freeShipping')}</span>
            </div>

            {/* Share Buttons */}
            <div className="border-t pt-4 mt-4">
              <ShareButtons
                url={`/product/${product.slug}`}
                title={productName}
                description={product.shortDescription}
              />
            </div>
          </div>
        </div>

        {/* Tabs: Description / Specifications / Research / Reconstitution */}
        <div className="mt-12 border-t pt-8">
          <div className="flex flex-nowrap overflow-x-auto gap-4 md:gap-6 border-b mb-6" role="tablist" aria-label={t('shop.aria.productInfoTabs')}>
            <button
              role="tab"
              id="tab-description"
              aria-selected={activeTab === 'description'}
              aria-controls="tabpanel-description"
              onClick={() => handleTabChange('description')}
              className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
                activeTab === 'description'
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-neutral-500 hover:text-black'
              }`}
            >
              {t('shop.description')}
            </button>
            <button
              role="tab"
              id="tab-specs"
              aria-selected={activeTab === 'specs'}
              aria-controls="tabpanel-specs"
              onClick={() => handleTabChange('specs')}
              className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
                activeTab === 'specs'
                  ? 'text-orange-600 border-b-2 border-orange-600'
                  : 'text-neutral-500 hover:text-black'
              }`}
            >
              {t('shop.specifications')}
            </button>
            {chemistryData?.researchSummary && (
              <button
                role="tab"
                id="tab-research"
                aria-selected={activeTab === 'research'}
                aria-controls="tabpanel-research"
                onClick={() => handleTabChange('research')}
                className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
                  activeTab === 'research'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-neutral-500 hover:text-black'
                }`}
              >
                🔬 {t('shop.research') || 'Research'}
              </button>
            )}
            {chemistryData?.reconstitution && (
              <button
                role="tab"
                id="tab-reconstitution"
                aria-selected={activeTab === 'reconstitution'}
                aria-controls="tabpanel-reconstitution"
                onClick={() => handleTabChange('reconstitution')}
                className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
                  activeTab === 'reconstitution'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-neutral-500 hover:text-black'
                }`}
              >
                💉 {t('shop.reconstitution') || 'Reconstitution'}
              </button>
            )}
            {product.videoUrl && (
              <button
                role="tab"
                id="tab-video"
                aria-selected={activeTab === 'video'}
                aria-controls="tabpanel-video"
                onClick={() => handleTabChange('video')}
                className={`pb-3 font-medium text-base md:text-lg whitespace-nowrap ${
                  activeTab === 'video'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-neutral-500 hover:text-black'
                }`}
              >
                🎥 {t('shop.video') || 'Video'}
              </button>
            )}
          </div>

          {/* Description Tab */}
          {activeTab === 'description' && (
            <div role="tabpanel" id="tabpanel-description" aria-labelledby="tab-description" className="prose max-w-none animate-tab-fade">
              {(product.description || product.shortDescription) ? (
                (product.description || product.shortDescription).split('\n').map((p, i) => (
                  <p key={i} className="mb-4 text-neutral-700 leading-relaxed">{p}</p>
                ))
              ) : (
                <p className="text-neutral-400 italic">{t('shop.noDescription') || 'Description coming soon.'}</p>
              )}
              {/* Chemistry enrichment from local data */}
              {chemistryData?.researchSummary && !product.description && (
                <div className="mt-6 p-4 bg-neutral-50 rounded-lg border">
                  <h3 className="font-semibold text-neutral-800 mb-2">{t('shop.researchContext') || 'Research Context'}</h3>
                  {chemistryData.researchSummary.split('\n').map((p, i) => (
                    <p key={`rc-${i}`} className="mb-2 text-neutral-600 text-sm leading-relaxed">{p}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Specifications Tab */}
          {activeTab === 'specs' && (
            <div role="tabpanel" id="tabpanel-specs" aria-labelledby="tab-specs" className="bg-neutral-50 rounded-lg p-6 animate-tab-fade">
              {/* COA Download Button */}
              {chemistryData?.coaAvailable && (
                <div className="mb-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      window.open(`/lab-results?product=${product.slug}`, '_blank');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {t('shop.downloadCOA') || 'Download COA (PDF)'}
                  </button>
                  <button
                    onClick={() => {
                      window.open(`/lab-results?product=${product.slug}#hplc`, '_blank');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {t('shop.viewHPLC') || 'View HPLC Results'}
                  </button>
                </div>
              )}

              {/* Chemical Properties Grid */}
              <h3 className="font-semibold text-lg mb-4">{t('shop.chemicalProperties') || 'Chemical Properties'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {(product.purity || chemistryData?.hplcPurity) && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.hplcPurity') || 'HPLC Purity'}</span>
                    <span className="font-bold text-green-600">{chemistryData?.hplcPurity || product.purity}%</span>
                  </div>
                )}
                {product.avgMass && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.avgMass')}</span>
                    <span className="font-medium">{product.avgMass}</span>
                  </div>
                )}
                {(product.casNumber || chemistryData?.casNumber) && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.casNumber') || 'CAS Number'}</span>
                    <span className="font-mono text-sm">{chemistryData?.casNumber || product.casNumber}</span>
                  </div>
                )}
                {(product.molecularWeight || chemistryData?.molecularWeight) && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.molecularWeight') || 'Molecular Weight'}</span>
                    <span className="font-mono">{chemistryData?.molecularWeight || product.molecularWeight} Da</span>
                  </div>
                )}
                {(product.molecularFormula || chemistryData?.molecularFormula) && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.molecularFormula') || 'Molecular Formula'}</span>
                    <span className="font-mono text-sm">{chemistryData?.molecularFormula || product.molecularFormula}</span>
                  </div>
                )}
                {chemistryData?.appearance && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.appearance') || 'Appearance'}</span>
                    <span className="font-medium">{chemistryData.appearance}</span>
                  </div>
                )}
                {chemistryData?.solubility && (
                  <div className="flex justify-between border-b border-neutral-200 pb-3">
                    <span className="text-neutral-500">{t('shop.solubility') || 'Solubility'}</span>
                    <span className="font-medium text-sm">{chemistryData.solubility}</span>
                  </div>
                )}
              </div>

              {/* Amino Acid Sequence */}
              {chemistryData?.sequence && (
                <div className="mb-6">
                  <h4 className="font-medium text-neutral-700 mb-2">{t('shop.sequence') || 'Amino Acid Sequence'}</h4>
                  <code className="block bg-white p-3 rounded-lg border font-mono text-sm text-neutral-600 break-all">
                    {chemistryData.sequence}
                  </code>
                </div>
              )}

              {/* Synonyms */}
              {chemistryData?.synonyms && chemistryData.synonyms.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-neutral-700 mb-2">{t('shop.synonyms') || 'Also Known As'}</h4>
                  <div className="flex flex-wrap gap-2">
                    {chemistryData.synonyms.map((syn, i) => (
                      <span key={i} className="px-3 py-1 bg-white rounded-full text-sm text-neutral-600 border">
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Storage Conditions */}
              {chemistryData?.storage && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <span>❄️</span> {t('shop.storageInstructions') || 'Storage Instructions'}
                  </h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li><strong>Lyophilized:</strong> {chemistryData.storage.lyophilized}</li>
                    <li><strong>Reconstituted:</strong> {chemistryData.storage.reconstituted}</li>
                  </ul>
                </div>
              )}

              {product.specifications && (
                <div className="mt-6">
                  <h4 className="font-medium text-neutral-700 mb-2">{t('shop.additionalSpecs') || 'Additional Specifications'}</h4>
                  <pre className="whitespace-pre-wrap text-sm text-neutral-600 bg-white p-4 rounded-lg border">
                    {product.specifications}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Research Tab */}
          {activeTab === 'research' && chemistryData?.researchSummary && (
            <div role="tabpanel" id="tabpanel-research" aria-labelledby="tab-research" className="bg-neutral-50 rounded-lg p-6 animate-tab-fade">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">🔬</span>
                <h3 className="font-bold text-xl">{t('shop.researchOverview') || 'Research Overview'}</h3>
              </div>
              
              <div className="prose max-w-none mb-6">
                {chemistryData.researchSummary.split('\n').map((p, i) => (
                  <p key={i} className="mb-3 text-neutral-700 leading-relaxed">{p}</p>
                ))}
              </div>

              {chemistryData.mechanism && (
                <div className="bg-white border rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-neutral-800 mb-2">{t('shop.mechanism') || 'Mechanism of Action'}</h4>
                  <p className="text-neutral-600 text-sm">{chemistryData.mechanism}</p>
                </div>
              )}

              {chemistryData.references && chemistryData.references.length > 0 && (
                <div>
                  <h4 className="font-semibold text-neutral-800 mb-3">{t('shop.references') || 'Scientific References'}</h4>
                  <ul className="space-y-2">
                    {chemistryData.references.map((ref, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-orange-500 mt-1">📄</span>
                        <span className="text-neutral-600">
                          {ref.title}
                          {ref.pubmedId && (
                            <a 
                              href={`https://pubmed.ncbi.nlm.nih.gov/${ref.pubmedId}/`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ms-2 text-blue-600 hover:underline"
                            >
                              [PubMed: {ref.pubmedId}]
                            </a>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  <strong>{t('disclaimer.title')}:</strong> {t('disclaimer.educationalPurposes') || 'This information is for educational purposes only. All products are sold for research use only and are not intended for human consumption.'}
                </p>
              </div>
            </div>
          )}

          {/* Reconstitution Tab */}
          {activeTab === 'reconstitution' && chemistryData?.reconstitution && (
            <div role="tabpanel" id="tabpanel-reconstitution" aria-labelledby="tab-reconstitution" className="bg-neutral-50 rounded-lg p-6 animate-tab-fade">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-xl">💉</span>
                <h3 className="font-bold text-xl">{t('shop.reconstitutionGuide') || 'Reconstitution Guide'}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-sm text-neutral-500 mb-1">{t('shop.recommendedSolvent') || 'Recommended Solvent'}</p>
                  <p className="font-semibold text-neutral-800">{chemistryData.reconstitution.solvent}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-sm text-neutral-500 mb-1">{t('shop.recommendedVolume') || 'Recommended Volume'}</p>
                  <p className="font-semibold text-neutral-800">{chemistryData.reconstitution.volume}</p>
                </div>
                <div className="bg-white rounded-lg p-4 border">
                  <p className="text-sm text-neutral-500 mb-1">{t('shop.stability') || 'Stability After Reconstitution'}</p>
                  <p className="font-semibold text-neutral-800">{chemistryData.storage?.reconstituted.split('for ')[1] || '14-30 days at 2-8°C'}</p>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border mb-6">
                <h4 className="font-semibold text-neutral-800 mb-3">{t('shop.reconstitutionSteps') || 'Step-by-Step Instructions'}</h4>
                <ol className="space-y-3 text-sm text-neutral-600">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                    <span>{t('shop.reconstitutionStep1') || 'Allow the vial to reach room temperature before reconstitution.'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                    <span>{t('shop.reconstitutionStep2') || 'Wipe the rubber stopper with an alcohol swab and let it dry.'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                    <span>{(t('shop.reconstitutionStep3') || 'Draw {volume} of {solvent} into a sterile syringe.').replace('{volume}', chemistryData.reconstitution.volume).replace('{solvent}', chemistryData.reconstitution.solvent)}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                    <span>{t('shop.reconstitutionStep4') || 'Insert needle through stopper and slowly release water along the inside wall of the vial.'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                    <span>{t('shop.reconstitutionStep5') || 'Do NOT shake. Gently swirl or let sit until fully dissolved.'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">6</span>
                    <span>{t('shop.reconstitutionStep6') || 'Store reconstituted peptide in refrigerator (2-8°C).'}</span>
                  </li>
                </ol>
              </div>

              {chemistryData.reconstitution.notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <h4 className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
                    <span>⚠️</span> {t('shop.importantNotes') || 'Important Notes'}
                  </h4>
                  <p className="text-sm text-yellow-700">{chemistryData.reconstitution.notes}</p>
                </div>
              )}

              {/* Calculator Link */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <p className="text-sm text-orange-700 mb-3">
                  {t('shop.needHelpCalculating') || 'Need help calculating your reconstitution? Use our peptide calculator.'}
                </p>
                <Link
                  href="/#calculator"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                >
                  🧮 {t('shop.openPeptideCalculator') || 'Open Peptide Calculator'}
                </Link>
              </div>
            </div>
          )}

          {/* Video Tab */}
          {activeTab === 'video' && product.videoUrl && (
            <div role="tabpanel" id="tabpanel-video" aria-labelledby="tab-video" className="bg-neutral-50 rounded-lg p-6 animate-tab-fade">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-xl">🎥</span>
                <h3 className="font-bold text-xl">{t('shop.productVideo') || 'Product Video'}</h3>
              </div>

              <ProductVideo videoUrl={product.videoUrl} />

              <p className="mt-4 text-sm text-neutral-600">
                {t('shop.videoDescription') || 'Watch this video to learn more about this product, its benefits, and how to use it properly.'}
              </p>
            </div>
          )}
        </div>

        {/* Related Products */}
        {product.relatedProducts.length > 0 && (
          <div className="mt-12 border-t pt-8">
            <h2 className="text-2xl font-bold mb-6">{t('shop.relatedProducts')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {product.relatedProducts.map((related) => (
                <Link
                  key={related.id}
                  href={`/product/${related.slug}`}
                  className="bg-white border rounded-lg overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  <div className="aspect-square bg-neutral-100 relative">
                    <Image
                      src={related.image || '/images/products/peptide-default.png'}
                      alt={getRelatedProductName(related)}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-black group-hover:text-orange-600 transition-colors">
                      {getRelatedProductName(related)}
                    </h3>
                    {related.purity && (
                      <p className="text-xs text-neutral-500">{t('shop.purity')} {related.purity}%</p>
                    )}
                    <p className="text-orange-600 font-bold mt-1">{formatPrice(related.price)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recently Viewed Products */}
        <RecentlyViewed excludeSlug={product.slug} />

        {/* Reviews Section */}
        <div className="mt-12 border-t pt-8">
          <ProductReviews productId={product.id} productName={product.name} />
        </div>

        {/* Q&A Section */}
        <div className="mt-12 border-t pt-8">
          <ProductQA productId={product.id} productName={product.name} />
        </div>

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong className="text-amber-900">{t('disclaimer.title').toUpperCase()}:</strong>{' '}
            {t('disclaimer.text')} {t('disclaimer.notForConsumption')}
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
