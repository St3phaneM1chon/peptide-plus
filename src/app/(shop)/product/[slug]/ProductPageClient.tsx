// BUG-063 FIX: Decomposed monolith into sub-components. This file is now the orchestrator.
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
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import ShareButtons from '@/components/shop/ShareButtons';
import StickyAddToCart from '@/components/shop/StickyAddToCart';
import QuantityTiers from '@/components/shop/QuantityTiers';
import CountdownTimer from '@/components/ui/CountdownTimer';

// BUG-063: Extracted sub-components
import ProductGallerySection from './ProductGallerySection';
import ProductFormatSelector from './ProductFormatSelector';
import ProductQuantitySelector from './ProductQuantitySelector';
import ProductActions from './ProductActions';
import ProductTabs from './ProductTabs';

const ProductReviews = dynamic(() => import('@/components/shop/ProductReviews'), { ssr: false });
const ProductQA = dynamic(() => import('@/components/shop/ProductQA'), { ssr: false });
const RecentlyViewed = dynamic(() => import('@/components/shop/RecentlyViewed'), { ssr: false });
const VideoPlacementWidget = dynamic(() => import('@/components/content/VideoPlacementWidget'), { ssr: false });

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
  const [addedToCart, setAddedToCart] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>(
    product.productImage || '/images/products/peptide-default.png'
  );
  const addToCartButtonRef = useRef<HTMLButtonElement>(null);

  // Get enriched chemistry data if available
  const chemistryData = getPeptideChemistry(product.slug);

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

          {/* LEFT: Image Gallery */}
          <ProductGallerySection
            productName={productName}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            images={product.images}
            badgeData={{
              createdAt: product.createdAt,
              purchaseCount: product.purchaseCount,
              averageRating: product.averageRating,
              reviewCount: product.reviewCount,
              price: selectedFormat.price,
              compareAtPrice: selectedFormat.comparePrice,
              formats: availableFormats,
            }}
          />

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

            {/* Format Selector */}
            <ProductFormatSelector
              productName={productName}
              selectedFormat={selectedFormat}
              availableFormats={availableFormats}
              isDropdownOpen={isDropdownOpen}
              setIsDropdownOpen={setIsDropdownOpen}
              onFormatSelect={handleFormatSelect}
              getFormatName={getFormatName}
            />

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
              <ProductQuantitySelector
                productName={productName}
                quantity={quantity}
                setQuantity={setQuantity}
                maxQuantity={selectedFormat.stockQuantity}
              />

              {/* Add to Cart + Wishlist + Stock Alerts */}
              <ProductActions
                productId={product.id}
                productName={productName}
                selectedFormatId={selectedFormat.id}
                selectedFormatPrice={selectedFormat.price}
                selectedFormatInStock={selectedFormat.inStock}
                selectedFormatStockQuantity={selectedFormat.stockQuantity}
                selectedFormatName={getFormatName(selectedFormat)}
                effectivePrice={effectivePrice}
                quantity={quantity}
                addedToCart={addedToCart}
                onAddToCart={handleAddToCart}
                addToCartButtonRef={addToCartButtonRef}
              />
            </div>

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

        {/* Tabs: Description / Specifications / Research / Reconstitution / Video */}
        <ProductTabs product={product} chemistryData={chemistryData} />

        {/* Product Videos (self-hides when no videos found) */}
        <VideoPlacementWidget
          placement="PRODUCT_PAGE"
          contextId={product.id}
          title={t('product.videos') || 'Product Videos'}
          className="mt-12 border-t pt-8"
        />

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
