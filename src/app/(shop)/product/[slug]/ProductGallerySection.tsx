'use client';

import Image from 'next/image';
import ProductBadges from '@/components/shop/ProductBadges';
import { useI18n } from '@/i18n/client';

interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}

interface ProductGallerySectionProps {
  productName: string;
  selectedImage: string;
  setSelectedImage: (url: string) => void;
  images?: ProductImage[];
  badgeData: {
    createdAt?: Date | string;
    purchaseCount?: number;
    averageRating?: number;
    reviewCount?: number;
    price: number;
    compareAtPrice?: number;
    formats: Array<{ stockQuantity: number; inStock: boolean }>;
  };
}

export default function ProductGallerySection({
  productName,
  selectedImage,
  setSelectedImage,
  images,
  badgeData,
}: ProductGallerySectionProps) {
  const { t } = useI18n();

  return (
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
          product={badgeData}
          maxBadges={3}
          className="top-3 start-3"
        />
      </div>
      {/* Thumbnail gallery */}
      {images && images.length > 1 && (
        <div className="flex gap-2 mt-3 max-w-md mx-auto overflow-x-auto" role="group" aria-label={t('shop.aria.productImageGallery')}>
          {images.map((img, index) => (
            <button
              key={img.id}
              onClick={() => setSelectedImage(img.url)}
              aria-label={`View image ${index + 1} of ${images.length}${img.alt ? `: ${img.alt}` : ''}`}
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
  );
}
