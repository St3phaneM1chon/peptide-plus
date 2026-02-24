'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/i18n/client';

export type FormatType = 
  | 'VIAL_2ML' 
  | 'VIAL_10ML' 
  | 'CARTRIDGE_3ML' 
  | 'KIT_12' 
  | 'CAPSULE_60' 
  | 'CAPSULE_120' 
  | 'PACK_5' 
  | 'PACK_10' 
  | 'BUNDLE' 
  | 'ACCESSORY' 
  | 'NASAL_SPRAY' 
  | 'CREAM';

export interface FormatOption {
  id: string;
  name: string;
  formatType: FormatType;
  price: number;
  comparePrice?: number | null;
  imageUrl?: string | null;
  inStock: boolean;
  stockQuantity: number;
  availability: string;
  dosageMg?: number | null;
  unitCount?: number | null;
  isDefault?: boolean;
}

interface FormatDropdownProps {
  formats: FormatOption[];
  selectedFormat: FormatOption;
  onSelect: (format: FormatOption) => void;
  variant?: 'default' | 'compact' | 'visual';
  showImages?: boolean;
  showPrices?: boolean;
  className?: string;
}

// Icons and images for each format type (labels come from i18n)
const FORMAT_DEFAULTS: Record<FormatType, { icon: string; labelKey: string; image: string }> = {
  VIAL_2ML: { icon: '💉', labelKey: 'formats.vial2ml', image: '/images/formats/vial-2ml.png' },
  VIAL_10ML: { icon: '🧪', labelKey: 'formats.vial10ml', image: '/images/formats/vial-10ml.png' },
  CARTRIDGE_3ML: { icon: '💊', labelKey: 'formats.cartridge3ml', image: '/images/formats/cartridge.png' },
  KIT_12: { icon: '📦', labelKey: 'formats.kit12', image: '/images/formats/kit-12.png' },
  CAPSULE_60: { icon: '💊', labelKey: 'formats.capsules60', image: '/images/formats/capsules-60.png' },
  CAPSULE_120: { icon: '💊', labelKey: 'formats.capsules120', image: '/images/formats/capsules-120.png' },
  PACK_5: { icon: '📦', labelKey: 'formats.pack5', image: '/images/formats/pack-5.png' },
  PACK_10: { icon: '📦', labelKey: 'formats.pack10', image: '/images/formats/pack-10.png' },
  BUNDLE: { icon: '🎁', labelKey: 'formats.bundle', image: '/images/formats/bundle.png' },
  ACCESSORY: { icon: '🔧', labelKey: 'formats.accessory', image: '/images/formats/accessory.png' },
  NASAL_SPRAY: { icon: '💨', labelKey: 'formats.nasalSpray', image: '/images/formats/nasal-spray.png' },
  CREAM: { icon: '🧴', labelKey: 'formats.cream', image: '/images/formats/cream.png' },
};

const AVAILABILITY_COLORS: Record<string, { labelKey: string; color: string }> = {
  IN_STOCK: { labelKey: 'shop.inStock', color: 'text-green-600' },
  OUT_OF_STOCK: { labelKey: 'shop.outOfStock', color: 'text-red-600' },
  DISCONTINUED: { labelKey: 'shop.discontinued', color: 'text-gray-500' },
  COMING_SOON: { labelKey: 'shop.comingSoon', color: 'text-blue-600' },
  PRE_ORDER: { labelKey: 'shop.preOrder', color: 'text-purple-600' },
  LIMITED: { labelKey: 'shop.limitedStock', color: 'text-orange-600' },
};

export default function FormatDropdown({
  formats,
  selectedFormat,
  onSelect,
  variant = 'default',
  showImages = true,
  showPrices = true,
  className = '',
}: FormatDropdownProps) {
  const { formatPrice } = useCurrency();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter out formats with stockQuantity <= 0
  const visibleFormats = formats.filter(f => f.stockQuantity > 0);

  const getFormatInfo = (format: FormatOption) => {
    return FORMAT_DEFAULTS[format.formatType] || FORMAT_DEFAULTS.ACCESSORY;
  };

  const getAvailabilityInfo = (availability: string) => {
    const info = AVAILABILITY_COLORS[availability] || AVAILABILITY_COLORS.IN_STOCK;
    return { label: t(info.labelKey), color: info.color };
  };

  const isAvailable = (format: FormatOption) => {
    return format.inStock && format.availability !== 'OUT_OF_STOCK' && format.availability !== 'DISCONTINUED';
  };

  // Visual grid variant (for product page)
  if (variant === 'visual') {
    return (
      <div className={`space-y-3 ${className}`}>
        <label className="text-sm text-neutral-500 uppercase tracking-wider block">
          {t('shop.selectFormat')}:
        </label>
        <div className="grid grid-cols-2 gap-3">
          {visibleFormats.map((format) => {
            const formatInfo = getFormatInfo(format);
            const availInfo = getAvailabilityInfo(format.availability);
            const available = isAvailable(format);
            const isSelected = selectedFormat.id === format.id;

            return (
              <button
                key={format.id}
                onClick={() => available && onSelect(format)}
                disabled={!available}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50 shadow-sm'
                    : available
                    ? 'border-neutral-200 hover:border-orange-300 bg-white hover:bg-neutral-50'
                    : 'border-neutral-200 bg-neutral-100 opacity-60 cursor-not-allowed'
                }`}
              >
                {/* Format Image */}
                <div className="w-16 h-16 relative rounded-lg overflow-hidden bg-neutral-100">
                  {format.imageUrl ? (
                    <Image
                      src={format.imageUrl}
                      alt={format.name}
                      fill
                      sizes="64px"
                      className="object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      {formatInfo.icon}
                    </div>
                  )}
                </div>

                {/* Format Name */}
                <p className="font-medium text-neutral-900 text-sm">{format.name}</p>

                {/* Price */}
                {showPrices && (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-orange-600">{formatPrice(format.price)}</span>
                    {format.comparePrice && (
                      <span className="text-xs text-neutral-400 line-through">
                        {formatPrice(format.comparePrice)}
                      </span>
                    )}
                  </div>
                )}

                {/* Availability */}
                {!available && (
                  <span className={`text-xs font-medium ${availInfo.color}`}>
                    {availInfo.label}
                  </span>
                )}

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-2 end-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="text-xs text-neutral-500 uppercase tracking-wider">{t('shop.packaging')}:</label>
      
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full mt-1 flex items-center justify-between gap-2 px-3 py-2.5 border border-neutral-300 rounded-lg bg-white hover:border-orange-400 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Selected Format Image/Icon */}
          {showImages && (
            <div className="w-10 h-10 bg-neutral-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
              {selectedFormat.imageUrl ? (
                <Image
                  src={selectedFormat.imageUrl}
                  alt={selectedFormat.name}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              ) : (
                <span className="text-xl">{getFormatInfo(selectedFormat).icon}</span>
              )}
            </div>
          )}
          
          {/* Selected Format Info */}
          <div className="text-start min-w-0">
            <p className="text-sm font-medium text-neutral-900 truncate">{selectedFormat.name}</p>
            {showPrices && (
              <p className="text-sm text-orange-600 font-bold">{formatPrice(selectedFormat.price)}</p>
            )}
          </div>
        </div>

        <svg 
          className={`w-4 h-4 text-neutral-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-30 top-full inset-x-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl overflow-hidden max-h-80 overflow-y-auto">
          {visibleFormats.map((format) => {
            const formatInfo = getFormatInfo(format);
            const availInfo = getAvailabilityInfo(format.availability);
            const available = isAvailable(format);
            const isSelected = selectedFormat.id === format.id;

            return (
              <button
                key={format.id}
                onClick={() => {
                  if (available) {
                    onSelect(format);
                    setIsOpen(false);
                  }
                }}
                disabled={!available}
                className={`w-full flex items-center gap-3 px-3 py-3 text-start transition-colors border-b border-neutral-100 last:border-0 ${
                  isSelected
                    ? 'bg-orange-50'
                    : available
                    ? 'hover:bg-neutral-50'
                    : 'opacity-50 cursor-not-allowed bg-neutral-50'
                }`}
              >
                {/* Format Image/Icon */}
                {showImages && (
                  <div className="w-12 h-12 bg-neutral-100 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                    {format.imageUrl ? (
                      <Image
                        src={format.imageUrl}
                        alt={format.name}
                        width={48}
                        height={48}
                        className="object-contain"
                      />
                    ) : (
                      <span className="text-2xl">{formatInfo.icon}</span>
                    )}
                  </div>
                )}
                
                {/* Format Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900">{format.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {showPrices && (
                      <>
                        <span className="text-sm text-orange-600 font-bold">{formatPrice(format.price)}</span>
                        {format.comparePrice && (
                          <span className="text-xs text-neutral-400 line-through">
                            {formatPrice(format.comparePrice)}
                          </span>
                        )}
                      </>
                    )}
                    {format.dosageMg && (
                      <span className="text-xs text-neutral-500">{format.dosageMg}mg</span>
                    )}
                  </div>
                </div>

                {/* Right Side - Stock Status or Check */}
                <div className="flex-shrink-0">
                  {isSelected ? (
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  ) : !available ? (
                    <span className={`text-xs font-medium ${availInfo.color}`}>
                      {availInfo.label}
                    </span>
                  ) : format.stockQuantity <= 10 ? (
                    <span className="text-xs text-orange-600 font-medium">
                      {t('shop.stockLeft').replace('{count}', String(format.stockQuantity))}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
