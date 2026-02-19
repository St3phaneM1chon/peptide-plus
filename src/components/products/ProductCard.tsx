/**
 * PRODUCT CARD COMPONENT
 * Carte de produit pour le catalogue
 */

import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const hasDiscount = product.compareAtPrice && product.compareAtPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - product.price / product.compareAtPrice!) * 100)
    : 0;

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return null;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group">
      {/* Image */}
      <div className="relative aspect-video bg-gray-100">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-16 h-16 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </div>
        )}

        {/* Badge Discount */}
        {hasDiscount && (
          <div className="absolute top-3 start-3 bg-red-500 text-white px-2 py-1 rounded-md text-sm font-semibold">
            -{discountPercent}%
          </div>
        )}

        {/* Badge Niveau */}
        {product.level && (
          <div className="absolute top-3 end-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-sm font-medium text-gray-700">
            {product.level}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-5">
        {/* Titre */}
        <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">
          <Link href={`/cours/${product.slug}`} className="hover:text-blue-600">
            {product.name}
          </Link>
        </h3>

        {/* Description */}
        {product.shortDescription && (
          <p className="text-gray-600 text-sm mb-4 line-clamp-2">
            {product.shortDescription}
          </p>
        )}

        {/* Métadonnées */}
        <div className="flex items-center space-x-4 text-sm text-gray-500 mb-4">
          {product.duration && (
            <div className="flex items-center">
              <svg
                className="w-4 h-4 me-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatDuration(product.duration)}
            </div>
          )}

          {product.averageRating && (
            <div className="flex items-center">
              <svg
                className="w-4 h-4 me-1 text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {product.averageRating.toFixed(1)}
            </div>
          )}

          {product.purchaseCount > 0 && (
            <div className="flex items-center">
              <svg
                className="w-4 h-4 me-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {product.purchaseCount}
            </div>
          )}
        </div>

        {/* Prix et Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-gray-900">
              {product.price.toFixed(2)} $
            </span>
            {hasDiscount && (
              <span className="text-sm text-gray-400 line-through">
                {product.compareAtPrice!.toFixed(2)} $
              </span>
            )}
          </div>

          <div className="flex space-x-2">
            <Link
              href={`/cours/${product.slug}`}
              className="px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-medium transition-colors"
            >
              En savoir plus
            </Link>
            <Link
              href={`/checkout/${product.slug}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Acheter
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
