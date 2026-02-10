'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { useTranslations } from '@/hooks/useTranslations';

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
}

// Format type icons
const formatIcons: Record<string, string> = {
  vial_2ml: '💉',
  vial_10ml: '🧪',
  cartridge_3ml: '💊',
  cartridge_kit_12: '📦',
  capsule: '💊',
  capsules_30: '💊',
  capsules_60: '💊',
  capsules_120: '💊',
  pack_2: '📦',
  pack_5: '📦',
  pack_10: '📦',
  box_50: '📦',
  box_100: '📦',
  syringe: '💉',
  accessory: '🔧',
  powder: '🥤',
  gummies: '🍬',
  kit: '🎁',
};

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
}: ProductCardProps) {
  const { formatPrice } = useCurrency();
  const { addItem } = useCart();
  const { t } = useTranslations();
  
  const [selectedFormat, setSelectedFormat] = useState<ProductFormat | undefined>(
    formats?.find((f) => f.inStock) || formats?.[0]
  );
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const displayPrice = selectedFormat?.price || price;
  const displayComparePrice = selectedFormat?.comparePrice || comparePrice;

  // Track if format has been manually selected
  const [hasSelectedFormat, setHasSelectedFormat] = useState(false);

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
    setHasSelectedFormat(true);
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
    
    addItem({
      productId: id,
      formatId: selectedFormat.id,
      name: fullProductName,
      formatName: formatName,
      price: displayPrice,
      comparePrice: displayComparePrice,
      image: imageUrl || '/images/products/peptide-default.png',
      maxQuantity: selectedFormat.stockQuantity || 99,
      quantity,
    });

    setTimeout(() => setIsAdding(false), 1000);
  };

  return (
    <div className="bg-white rounded-xl border border-neutral-200 hover:shadow-lg transition-all duration-300 relative overflow-visible flex flex-col h-full">
      {/* Image */}
      <Link href={`/product/${slug}`}>
        <div className="relative aspect-square bg-neutral-100 overflow-hidden rounded-t-xl">
          <Image
            src={imageUrl || '/images/products/peptide-default.png'}
            alt={productName}
            fill
            className="object-cover hover:scale-105 transition-transform duration-300"
          />
          {/* Category Badge */}
          {categoryName && (
            <span className="absolute top-3 left-3 px-3 py-1 bg-black/80 text-white text-xs font-medium rounded-full">
              {categoryName}
            </span>
          )}
        </div>
      </Link>

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

        {/* Bottom Section - Packaging + Actions (aligned across all cards) */}
        <div className="mt-auto pt-4">
          {/* Format Selector Dropdown */}
          {formats && formats.length > 1 && (
            <div className="relative mb-4" ref={dropdownRef}>
              <label className="text-xs text-neutral-500 uppercase tracking-wider">{t('shop.packaging')}:</label>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                className="w-full mt-1 flex items-center justify-between gap-2 px-3 py-2 border border-neutral-300 rounded-lg bg-white hover:border-orange-400 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {selectedFormat?.type ? formatIcons[selectedFormat.type] || '📦' : '📦'}
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
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                  {formats.map((format) => (
                    <button
                      key={format.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleFormatSelect(format);
                      }}
                      disabled={!format.inStock}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
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
                          <span className="text-xl">{format.type ? formatIcons[format.type] || '📦' : '📦'}</span>
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
          <div className="flex items-center border border-neutral-300 rounded-lg">
            <button
              onClick={(e) => {
                e.preventDefault();
                setQuantity(Math.max(1, quantity - 1));
              }}
              className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-medium">{quantity}</span>
            <button
              onClick={(e) => {
                e.preventDefault();
                setQuantity(quantity + 1);
              }}
              className="w-8 h-8 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
            >
              +
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={!inStock || isAdding}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold text-sm transition-all ${
              isAdding
                ? 'bg-green-600 text-white'
                : inStock
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
            }`}
          >
            {isAdding ? `✓ ${t('shop.added')}` : inStock ? t('shop.addToCart') : t('shop.outOfStock')}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
