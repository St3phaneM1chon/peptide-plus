'use client';

import { useI18n } from '@/i18n/client';

interface ProductQuantitySelectorProps {
  productName: string;
  quantity: number;
  setQuantity: (qty: number) => void;
  maxQuantity: number;
}

export default function ProductQuantitySelector({
  productName,
  quantity,
  setQuantity,
  maxQuantity,
}: ProductQuantitySelectorProps) {
  const { t } = useI18n();

  return (
    <div className="flex items-center border border-neutral-300 rounded-lg" role="group" aria-label={`Quantity for ${productName}`}>
      <button
        onClick={() => setQuantity(Math.max(1, quantity - 1))}
        aria-label={t('shop.aria.decreaseQuantity')}
        className="w-12 h-12 flex items-center justify-center text-xl hover:bg-neutral-100 transition-colors"
      >
        −
      </button>
      <span className="w-14 text-center font-bold text-lg" aria-live="polite" aria-atomic="true">{quantity}</span>
      <button
        onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
        aria-label={t('shop.aria.increaseQuantity')}
        className="w-12 h-12 flex items-center justify-center text-xl hover:bg-neutral-100 transition-colors"
      >
        +
      </button>
    </div>
  );
}
