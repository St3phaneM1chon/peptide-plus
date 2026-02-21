'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useI18n } from '@/i18n/client';

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  type: 'main' | 'vial' | 'cartridge' | 'kit' | 'capsule' | 'lifestyle';
}

interface ProductGalleryProps {
  images: ProductImage[];
  productName: string;
}

export default function ProductGallery({ images, productName }: ProductGalleryProps) {
  const { t } = useI18n();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // If no images, use default
  const displayImages = images.length > 0 ? images : [
    { id: '1', url: '/images/products/peptide-default.png', alt: productName, type: 'main' as const }
  ];

  const selectedImage = displayImages[selectedIndex];

  const handlePrevious = () => {
    setSelectedIndex((prev) => (prev === 0 ? displayImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === displayImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-square bg-neutral-100 rounded-2xl overflow-hidden group">
        <Image
          src={selectedImage.url}
          alt={selectedImage.alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className={`object-cover transition-transform duration-300 ${
            isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
          }`}
          onClick={() => setIsZoomed(!isZoomed)}
          priority
        />

        {/* Navigation Arrows */}
        {displayImages.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              aria-label={t('shop.aria.previousImage')}
              className="absolute start-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              aria-label={t('shop.aria.nextImage')}
              className="absolute end-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Image Counter */}
        {displayImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
            {selectedIndex + 1} / {displayImages.length}
          </div>
        )}

        {/* Zoom Hint */}
        <div className="absolute top-3 end-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          {t('shop.gallery.clickToZoom')}
        </div>
      </div>

      {/* Thumbnails */}
      {displayImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {displayImages.map((image, index) => (
            <button
              key={image.id}
              onClick={() => setSelectedIndex(index)}
              aria-label={t('shop.aria.thumbnailImage', { index: String(index + 1), total: String(displayImages.length), type: image.type })}
              aria-current={index === selectedIndex ? 'true' : undefined}
              className={`relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                index === selectedIndex
                  ? 'border-orange-500 ring-2 ring-orange-200'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                sizes="80px"
                className="object-cover"
              />
              {/* Type Label */}
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] text-center py-0.5 capitalize">
                {image.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
