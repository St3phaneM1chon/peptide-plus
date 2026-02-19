'use client';

import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/i18n/client';

export interface QuantityTier {
  id: string;
  minQty: number;
  maxQty: number | null;
  discount: number; // percentage (e.g., 10 = 10% off)
}

interface QuantityTiersProps {
  tiers: QuantityTier[];
  basePrice: number;
  currentQuantity?: number;
}

export default function QuantityTiers({
  tiers,
  basePrice,
  currentQuantity = 1
}: QuantityTiersProps) {
  const { formatPrice } = useCurrency();
  const { t } = useI18n();

  // Sort tiers by minQty
  const sortedTiers = [...tiers].sort((a, b) => a.minQty - b.minQty);

  // No tiers to display
  if (sortedTiers.length === 0) {
    return null;
  }

  // Calculate discounted price for a tier
  const calculatePrice = (discount: number) => {
    return basePrice * (1 - discount / 100);
  };

  // Check if a tier is currently active
  const isTierActive = (tier: QuantityTier) => {
    if (currentQuantity < tier.minQty) return false;
    if (tier.maxQty === null) return true;
    return currentQuantity <= tier.maxQty;
  };

  // Find the best value tier (highest discount)
  const bestTier = sortedTiers.reduce((best, current) =>
    current.discount > best.discount ? current : best
  , sortedTiers[0]);

  return (
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200 p-4">
      <h3 className="font-semibold text-neutral-800 mb-3 flex items-center gap-2">
        <span className="text-lg">💰</span>
        {t('shop.bulkPricing') || 'Bulk Pricing'}
      </h3>

      <div className="space-y-2">
        {/* Add base tier (1 unit) if not already in tiers */}
        {sortedTiers[0]?.minQty > 1 && (
          <div className={`bg-white rounded-lg p-3 border transition-all ${
            currentQuantity === 1
              ? 'border-orange-500 ring-2 ring-orange-200 shadow-sm'
              : 'border-neutral-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-neutral-700">
                  1 {t('shop.unit') || 'unit'}
                </p>
                <p className="text-xs text-neutral-500">
                  {t('shop.basePrice') || 'Base price'}
                </p>
              </div>
              <div className="text-end">
                <p className="font-bold text-neutral-800">
                  {formatPrice(basePrice)}
                </p>
              </div>
            </div>
          </div>
        )}

        {sortedTiers.map((tier, index) => {
          const isActive = isTierActive(tier);
          const isBestValue = tier.id === bestTier.id;
          const discountedPrice = calculatePrice(tier.discount);

          return (
            <div
              key={tier.id}
              className={`bg-white rounded-lg p-3 border transition-all ${
                isActive
                  ? 'border-orange-500 ring-2 ring-orange-200 shadow-sm'
                  : 'border-neutral-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm text-neutral-700">
                      {tier.minQty}
                      {tier.maxQty ? `-${tier.maxQty}` : '+'} {t('shop.units') || 'units'}
                    </p>
                    {isBestValue && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        ⭐ {t('shop.bestValue') || 'Best Value'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-green-600 font-medium mt-0.5">
                    {t('shop.save') || 'Save'} {tier.discount}%
                  </p>
                </div>
                <div className="text-end">
                  <p className="font-bold text-orange-600">
                    {formatPrice(discountedPrice)}
                  </p>
                  <p className="text-xs text-neutral-400 line-through">
                    {formatPrice(basePrice)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-orange-200">
        <p className="text-xs text-neutral-600 text-center">
          💡 {t('shop.bulkPricingNote') || 'Buy more to save more! Discounts apply automatically.'}
        </p>
      </div>
    </div>
  );
}
