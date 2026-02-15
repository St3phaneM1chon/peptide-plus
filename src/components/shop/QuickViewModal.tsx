'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTranslations } from '@/hooks/useTranslations';
import { toast } from 'sonner';

type FormatType = 'vial_2ml' | 'vial_10ml' | 'cartridge_3ml' | 'cartridge_kit_12' | 'capsule' | 'pack_10' | 'syringe' | 'accessory' | 'powder' | 'gummies' | 'capsules_30' | 'capsules_60' | 'capsules_120' | 'pack_2' | 'pack_5' | 'box_50' | 'box_100' | 'kit';

interface ProductFormat {
  id: string;
  name: string;
  type?: FormatType;
  price: number;
  comparePrice?: number;
  inStock: boolean;
  stockQuantity: number;
  image?: string;
}

interface Product {
  id: string;
  name: string;
  subtitle?: string;
  slug: string;
  shortDescription: string;
  price: number;
  purity?: number;
  avgMass?: string;
  categoryName?: string;
  productImage: string;
  formats: ProductFormat[];
}

interface QuickViewModalProps {
  slug: string;
  isOpen: boolean;
  onClose: () => void;
}

// Format type icons - same as ProductCard
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

export default function QuickViewModal({ slug, isOpen, onClose }: QuickViewModalProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ProductFormat | undefined>();
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();
  const { t } = useTranslations();

  // Fetch product data when modal opens
  useEffect(() => {
    if (!isOpen || !slug) return;

    const fetchProduct = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/products/by-slug/${slug}`);
        if (res.ok) {
          const data = await res.json();
          setProduct(data.product);
          // Auto-select first available format
          const availableFormat = data.product.formats?.find((f: ProductFormat) => f.inStock && f.stockQuantity > 0);
          setSelectedFormat(availableFormat || data.product.formats?.[0]);
        } else {
          toast.error('Failed to load product');
          onClose();
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product');
        onClose();
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [isOpen, slug, onClose]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProduct(null);
      setSelectedFormat(undefined);
      setQuantity(1);
    }
  }, [isOpen]);

  // Get product name (no translation for now since nameKey is not in DB)
  const getProductName = () => {
    if (!product) return '';
    return product.name;
  };

  // Get category name (no translation for now since categoryKey is not in DB)
  const getCategoryName = () => {
    if (!product?.categoryName) return '';
    return product.categoryName;
  };

  // Get format name (no translation for now since nameKey is not in DB)
  const getFormatName = (format: ProductFormat) => {
    return format.name;
  };

  const handleAddToCart = () => {
    if (!product || !selectedFormat) return;

    setIsAdding(true);

    const formatName = getFormatName(selectedFormat);
    const fullProductName = `${getProductName()} ${formatName}`;

    addItem({
      productId: product.id,
      formatId: selectedFormat.id,
      name: fullProductName,
      formatName: formatName,
      price: selectedFormat.price,
      comparePrice: selectedFormat.comparePrice,
      image: selectedFormat.image || product.productImage,
      maxQuantity: selectedFormat.stockQuantity || 99,
      quantity,
    });

    setTimeout(() => {
      setIsAdding(false);
      onClose();
    }, 1000);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quick view product details"
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-4xl bg-white rounded-2xl shadow-2xl z-50 overflow-hidden animate-slide-up"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute top-4 right-4 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all"
        >
          <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : product ? (
          <div className="flex flex-col md:flex-row max-h-[90vh] overflow-y-auto">
            {/* Left: Image */}
            <div className="md:w-1/2 bg-neutral-50 flex items-center justify-center p-8">
              <div className="relative w-full aspect-square max-w-md">
                <Image
                  src={product.productImage}
                  alt={getProductName()}
                  fill
                  className="object-contain"
                  priority
                />
                {/* Category Badge */}
                {getCategoryName() && (
                  <span className="absolute top-4 left-4 px-3 py-1 bg-black/80 text-white text-xs font-medium rounded-full">
                    {getCategoryName()}
                  </span>
                )}
              </div>
            </div>

            {/* Right: Details */}
            <div className="md:w-1/2 p-6 md:p-8 flex flex-col">
              {/* Product Name */}
              <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-2">
                {getProductName()}
              </h2>

              {/* Subtitle */}
              {product.subtitle && (
                <p className="text-neutral-600 mb-4">{product.subtitle}</p>
              )}

              {/* Price */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl font-bold text-orange-600">
                  {formatPrice(selectedFormat?.price || product.price)}
                </span>
                {selectedFormat?.comparePrice && selectedFormat.comparePrice > selectedFormat.price && (
                  <span className="text-lg text-neutral-400 line-through">
                    {formatPrice(selectedFormat.comparePrice)}
                  </span>
                )}
              </div>

              {/* Purity & Mass */}
              {(product.purity || product.avgMass) && (
                <div className="flex items-center gap-4 mb-4 text-sm text-neutral-600">
                  {product.purity && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span>{t('shop.purity')} {product.purity}%</span>
                    </div>
                  )}
                  {product.avgMass && (
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span>{t('shop.avgMass')} {product.avgMass}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Short Description */}
              {product.shortDescription && (
                <p className="text-neutral-700 mb-6 line-clamp-3">
                  {product.shortDescription}
                </p>
              )}

              {/* Format Selector */}
              {product.formats && product.formats.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    {t('shop.packaging')}:
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {product.formats
                      .filter(f => f.stockQuantity > 0)
                      .map((format) => (
                        <button
                          key={format.id}
                          onClick={() => setSelectedFormat(format)}
                          className={`flex items-center gap-3 p-3 border-2 rounded-lg transition-all ${
                            selectedFormat?.id === format.id
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-neutral-200 hover:border-orange-300'
                          }`}
                        >
                          <span className="text-2xl">
                            {format.type ? formatIcons[format.type] || '📦' : '📦'}
                          </span>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-neutral-900">{getFormatName(format)}</p>
                            <p className="text-sm text-orange-600 font-bold">{formatPrice(format.price)}</p>
                          </div>
                          {selectedFormat?.id === format.id && (
                            <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  {t('shop.quantity')}:
                </label>
                <div className="flex items-center border border-neutral-300 rounded-lg w-fit">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease quantity"
                    className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
                  >
                    −
                  </button>
                  <span className="w-12 text-center text-lg font-medium">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    aria-label="Increase quantity"
                    className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-auto space-y-3">
                <button
                  onClick={handleAddToCart}
                  disabled={!selectedFormat?.inStock || isAdding}
                  className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                    isAdding
                      ? 'bg-green-600'
                      : selectedFormat?.inStock
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-neutral-300 cursor-not-allowed'
                  }`}
                >
                  {isAdding ? `✓ ${t('shop.added')}` : selectedFormat?.inStock ? t('shop.addToCart') : t('shop.outOfStock')}
                </button>

                <Link
                  href={`/product/${product.slug}`}
                  onClick={onClose}
                  className="block w-full py-3 px-6 text-center border-2 border-orange-500 text-orange-500 rounded-lg font-semibold hover:bg-orange-50 transition-all"
                >
                  {t('shop.viewFullDetails')}
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px) translateX(-50%);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(-50%);
          }
        }

        @media (max-width: 768px) {
          @keyframes slide-up {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(-50%);
            }
          }
        }

        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null;
}
