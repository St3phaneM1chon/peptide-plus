'use client';

import { useEffect, useState, useRef } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

interface StickyAddToCartProps {
  productName: string;
  price: number;
  formattedPrice: string;
  selectedFormat: string;
  onAddToCart: () => void;
  isOutOfStock: boolean;
  addedToCart: boolean;
  targetRef: React.RefObject<HTMLElement>;
  currencySymbol?: string;
}

export default function StickyAddToCart({
  productName,
  price,
  formattedPrice,
  selectedFormat,
  onAddToCart,
  isOutOfStock,
  addedToCart,
  targetRef,
}: StickyAddToCartProps) {
  const { t } = useTranslations();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!targetRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky bar when main button is NOT visible (scrolled out of view)
        setIsVisible(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: '-60px 0px 0px 0px', // Account for header height
      }
    );

    observer.observe(targetRef.current);

    return () => {
      observer.disconnect();
    };
  }, [targetRef]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 md:hidden transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      role="region"
      aria-label="Sticky add to cart bar"
      aria-hidden={!isVisible}
    >
      <div className="bg-white/95 backdrop-blur-md border-t border-neutral-200 shadow-2xl">
        <div className="px-4 py-3 flex items-center gap-3">
          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-black truncate">
              {productName}
            </p>
            <p className="text-xs text-neutral-500 truncate">
              {selectedFormat}
            </p>
          </div>

          {/* Price */}
          <div className="text-right">
            <p className="text-lg font-bold text-orange-600">
              {formattedPrice}
            </p>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={onAddToCart}
            disabled={isOutOfStock}
            aria-label={`Add ${productName} to cart`}
            className={`px-6 py-3 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
              addedToCart
                ? 'bg-green-600 text-white'
                : isOutOfStock
                ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                : 'bg-orange-500 text-white active:bg-orange-600'
            }`}
          >
            {addedToCart ? `✓ ${t('shop.added')}` : isOutOfStock ? t('shop.outOfStock') : t('shop.addToCart')}
          </button>
        </div>
      </div>
    </div>
  );
}
