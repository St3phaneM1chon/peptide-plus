'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { useUpsell } from '@/contexts/UpsellContext';
import { useI18n } from '@/i18n/client';
import WishlistButton from './WishlistButton';
import QuickViewButton from './QuickViewButton';
import QuickViewModal from './QuickViewModal';
import CompareButton from './CompareButton';
import ProductBadges from './ProductBadges';
import { getFormatIcon } from '@/lib/format-icons';

type FormatType = 'vial_2ml' | 'vial_10ml' | 'cartridge_3ml' | 'cartridge_kit_12' | 'capsule' | 'pack_10' | 'syringe' | 'accessory' | 'powder' | 'gummies' | 'capsules_30' | 'capsules_60' | 'capsules_120' | 'pack_2' | 'pack_5' | 'box_50' | 'box_100' | 'kit';

interface ProductFormat {
  id: string;
  name: string;
  nameKey?: string; // Translation key for format name
  type?: FormatType;
  price: number;
  comparePrice?: number;
  inStock: boolean;
  stockQuantity: number;
  image?: string;
}

interface ProductCardProps {
  id: string;
  name: string;
  nameKey?: string; // Translation key for product name
  subtitle?: string;
  slug: string;
  price: number;
  comparePrice?: number;
  purity?: number;
  imageUrl?: string;
  category?: string;
  categoryKey?: string; // Translation key for category
  isNew?: boolean;
  isBestseller?: boolean;
  inStock?: boolean;
  formats?: ProductFormat[];
  avgMass?: string;
  createdAt?: Date | string;
  purchaseCount?: number;
  averageRating?: number;
  reviewCount?: number;
}

// Format icons imported from shared utility: @/lib/format-icons

export default function ProductCard({
  id,
  name,
  nameKey,
  subtitle: _subtitle,
  slug,
  price,
  comparePrice,
  purity,
  imageUrl,
  category,
  categoryKey,
  isNew: _isNew,
  isBestseller: _isBestseller,
  inStock = true,
  formats,
  avgMass,
  createdAt,
  purchaseCount,
  averageRating,
  reviewCount,
}: ProductCardProps) {
  const { formatPrice } = useCurrency();
  const { addItem: _addItem } = useCart();
  const { addItemWithUpsell } = useUpsell();
  const { t } = useI18n();
  
  // Filter out formats with stockQuantity <= 0
  const availableFormats = formats?.filter(f => f.stockQuantity > 0);

  const [selectedFormat, setSelectedFormat] = useState<ProductFormat | undefined>(
    availableFormats?.find((f) => f.inStock) || availableFormats?.[0]
  );
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayPrice = selectedFormat?.price || price;
  const displayComparePrice = selectedFormat?.comparePrice || comparePrice;

  // Derive if format has been manually selected by comparing with initial default
  const initialFormat = availableFormats?.find((f) => f.inStock) || availableFormats?.[0];
  const hasSelectedFormat = selectedFormat !== undefined && initialFormat !== undefined && selectedFormat.id !== initialFormat.id;

  // Get translated product name
  const productName = nameKey ? t(`products.${nameKey}`) : name;
  
  // Get translated category
  const categoryName = categoryKey ? t(`categories.${categoryKey}`) : category;

  // Get translated format name
  const getFormatName = (format: ProductFormat) => {
    if (format.nameKey) {
      return t(`formats.${format.nameKey}`);
    }
    return format.name;
  };

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

  const handleFormatSelect = (format: ProductFormat) => {
    setSelectedFormat(format);
    setIsDropdownOpen(false);
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!inStock || !selectedFormat) return;

    setIsAdding(true);
    
    // Full product name with format
    const formatName = getFormatName(selectedFormat);
    const fullProductName = `${productName} ${formatName}`;
    
    addItemWithUpsell({
      productId: id,
      formatId: selectedFormat.id,
      name: fullProductName,
      formatName: formatName,
      price: displayPrice,
      comparePrice: displayComparePrice,
      image: selectedFormat?.image || imageUrl || '/images/products/peptide-default.png',
      maxQuantity: selectedFormat.stockQuantity || 99,
      quantity,
    });

    setTimeout(() => setIsAdding(false), 1000);
  };

  return (
    <>
      <article className="bg-white rounded-xl border border-neutral-200 hover:shadow-lg transition-all duration-300 relative overflow-visible flex flex-col h-full group" aria-label={productName}>
        {/* Image */}
        <div className="relative">
          <Link href={`/product/${slug}`} aria-label={`View ${productName} details`}>
            <div className="relative aspect-square bg-neutral-100 overflow-hidden rounded-t-xl">
              <Image
                src={imageUrl || '/images/products/peptide-default.png'}
                alt={`${productName} - ${categoryName || 'product'} image`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover hover:scale-105 transition-transform duration-300"
              />

              {/* Product Badges - Top Left */}
              <ProductBadges
                product={{
                  createdAt,
                  purchaseCount,
                  averageRating,
                  reviewCount,
                  price: displayPrice,
                  compareAtPrice: displayComparePrice,
                  formats: availableFormats,
                }}
                maxBadges={2}
              />

              {/* Category Badge - Bottom Left */}
              {categoryName && (
                <span className="absolute bottom-3 start-3 px-3 py-1 bg-black/80 text-white text-xs font-medium rounded-full">
                  {categoryName}
                </span>
              )}
            </div>
          </Link>
          {/* Action Buttons Container */}
          <div className="absolute top-3 end-3 flex flex-col gap-2 z-10">
            {/* Wishlist Heart Button */}
            <WishlistButton productId={id} variant="icon" />
            {/* Quick View Button - appears on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <QuickViewButton onClick={() => setIsQuickViewOpen(true)} />
            </div>
            {/* Compare Button - appears on hover */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <CompareButton productSlug={slug} productName={productName} variant="icon" />
            </div>
          </div>
        </div>

      {/* Content */}
      <div className="p-4 overflow-visible flex flex-col flex-grow">
        {/* Product Name - adapts with selected format */}
        <Link href={`/product/${slug}`}>
          <h3 className="font-bold text-lg text-neutral-900 hover:text-orange-600 transition-colors line-clamp-2">
            {hasSelectedFormat && selectedFormat 
              ? `${productName} ${getFormatName(selectedFormat)}` 
              : productName}
          </h3>
        </Link>

        {/* Star Rating & Reviews */}
        {(averageRating !== undefined && averageRating > 0) && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex gap-0.5" aria-label={t('common.starRating', { rating: averageRating.toFixed(1) })}>
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className={`w-3.5 h-3.5 ${star <= Math.round(averageRating) ? 'text-orange-400' : 'text-neutral-300'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            {reviewCount !== undefined && reviewCount > 0 && (
              <span className="text-xs text-neutral-500">
                {t('common.reviewsCount', { count: reviewCount })}
              </span>
            )}
          </div>
        )}

        {/* Price - adapts with selected format (show discount always) */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-orange-600 font-bold text-lg">{formatPrice(displayPrice)}</span>
          {displayComparePrice && displayComparePrice > displayPrice && (
            <span className="text-sm text-neutral-400 line-through">{formatPrice(displayComparePrice)}</span>
          )}
        </div>

        {/* Purity & Mass Info */}
        {(purity || avgMass) && (
          <p className="text-sm text-neutral-500 mt-1">
            {purity && `${t('shop.purity')} ${purity}%`}
            {purity && avgMass && ' / '}
            {avgMass && `${t('shop.avgMass')} ${avgMass}`}
          </p>
        )}

        {/* Stock Status Indicator */}
        <div className="mt-1">
          {!inStock ? (
            <span className="text-xs font-medium text-red-600">{t('shop.outOfStock')}</span>
          ) : selectedFormat && selectedFormat.stockQuantity <= 5 && selectedFormat.stockQuantity > 0 ? (
            <span className="text-xs font-medium text-amber-600">
              {t('shop.lowStock')} - {t('shop.stockLeft', { count: selectedFormat.stockQuantity })}
            </span>
          ) : (
            <span className="text-xs font-medium text-green-600">{t('shop.inStock')}</span>
          )}
        </div>

        {/* Bottom Section - Packaging + Actions (aligned across all cards) */}
        <div className="mt-auto pt-4">
          {/* Format Selector Dropdown */}
          {availableFormats && availableFormats.length > 1 && (
            <div className="relative mb-4" ref={dropdownRef}>
              <label className="text-xs text-neutral-500 uppercase tracking-wider">{t('shop.packaging')}:</label>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                aria-label={`Select format for ${productName}`}
                aria-expanded={isDropdownOpen}
                aria-haspopup="listbox"
                className="w-full mt-1 flex items-center justify-between gap-2 px-3 py-2 border border-neutral-300 rounded-lg bg-white hover:border-orange-400 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {getFormatIcon(selectedFormat?.type)}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {selectedFormat ? getFormatName(selectedFormat) : t('shop.selectFormat')}
                  </span>
                </div>
                <svg 
                  className={`w-4 h-4 text-neutral-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu - Overlays card with scroll */}
              {isDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-2xl max-h-64 overflow-y-auto" role="listbox" aria-label={t('shop.aria.availableFormats')}>
                  {availableFormats.map((format) => (
                    <button
                      key={format.id}
                      role="option"
                      aria-selected={selectedFormat?.id === format.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleFormatSelect(format);
                      }}
                      disabled={!format.inStock}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-start transition-colors ${
                        selectedFormat?.id === format.id
                          ? 'bg-orange-50'
                          : format.inStock
                          ? 'hover:bg-neutral-50'
                          : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      {/* Format Image/Icon */}
                      <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center overflow-hidden">
                        {format.image ? (
                          <Image src={format.image} alt={getFormatName(format)} width={40} height={40} className="object-cover" />
                        ) : (
                          <span className="text-xl">{getFormatIcon(format.type)}</span>
                        )}
                      </div>
                      
                      {/* Format Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900 truncate">{getFormatName(format)}</p>
                        <p className="text-sm text-orange-600 font-bold">{formatPrice(format.price)}</p>
                      </div>

                      {/* Selected Check */}
                      {selectedFormat?.id === format.id && (
                        <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}

                      {/* Out of Stock */}
                      {!format.inStock && (
                        <span className="text-xs text-red-500">{t('shop.outOfStock')}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Quantity & Add to Cart */}
          <div className="flex items-center gap-2">
          {/* Quantity Selector */}
          <div className="flex items-center border border-neutral-300 rounded-lg" role="group" aria-label={`Quantity for ${productName}`}>
            <button
              onClick={(e) => {
                e.preventDefault();
                setQuantity(Math.max(1, quantity - 1));
              }}
              aria-label={t('shop.aria.decreaseQuantity')}
              className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium" aria-live="polite" aria-atomic="true">{quantity}</span>
            <button
              onClick={(e) => {
                e.preventDefault();
                // BUG-053 FIX: Cap quantity at stock level
                const maxQty = selectedFormat?.stockQuantity || 99;
                setQuantity(Math.min(quantity + 1, maxQty));
              }}
              aria-label={t('shop.aria.increaseQuantity')}
              className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
            >
              +
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={!inStock || isAdding}
            aria-label={`Add ${productName} to cart`}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
              isAdding
                ? 'bg-green-600 text-white scale-105'
                : inStock
                ? 'bg-orange-500 text-white hover:bg-orange-600 active:scale-95'
                : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
            }`}
          >
            {isAdding ? `✓ ${t('shop.added')}` : inStock ? t('shop.addToCart') : t('shop.outOfStock')}
          </button>
        </div>
        </div>
      </div>
      </article>

      {/* Quick View Modal - only mount when open to avoid unnecessary rendering */}
      {isQuickViewOpen && (
        <QuickViewModal
          slug={slug}
          isOpen={isQuickViewOpen}
          onClose={() => setIsQuickViewOpen(false)}
        />
      )}
    </>
  );
}
