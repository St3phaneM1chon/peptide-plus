'use client';

import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';
import WishlistButton from '@/components/shop/WishlistButton';
import PriceDropButton from '@/components/shop/PriceDropButton';
import StockAlertButton from '@/components/shop/StockAlertButton';

interface ProductActionsProps {
  productId: string;
  productName: string;
  selectedFormatId: string;
  selectedFormatPrice: number;
  selectedFormatInStock: boolean;
  selectedFormatStockQuantity: number;
  selectedFormatName: string;
  effectivePrice: number;
  quantity: number;
  addedToCart: boolean;
  onAddToCart: () => void;
  addToCartButtonRef: React.Ref<HTMLButtonElement>;
}

export default function ProductActions({
  productId,
  productName,
  selectedFormatId,
  selectedFormatPrice,
  selectedFormatInStock,
  selectedFormatStockQuantity,
  selectedFormatName,
  effectivePrice,
  quantity,
  addedToCart,
  onAddToCart,
  addToCartButtonRef,
}: ProductActionsProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();

  return (
    <>
      {/* Add to Cart Button */}
      <button
        ref={addToCartButtonRef}
        onClick={onAddToCart}
        disabled={!selectedFormatInStock}
        aria-label={`Add ${productName} to cart`}
        className={`flex-1 py-3 px-6 rounded-lg font-bold text-lg transition-all ${
          addedToCart
            ? 'bg-green-600 text-white'
            : selectedFormatInStock
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
        }`}
      >
        {addedToCart
          ? `✓ ${t('shop.added')}`
          : selectedFormatInStock
            ? `${t('shop.addToCart')} - ${formatPrice(effectivePrice * quantity)}`
            : t('shop.outOfStock')
        }
      </button>

      {/* Research Disclaimer - LEGAL REQUIREMENT */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4 mb-4">
        <p className="text-amber-800 text-xs leading-relaxed">
          <strong className="text-amber-900">{t('disclaimer.title').toUpperCase()}:</strong>{' '}
          {t('shop.researchDisclaimer')}
        </p>
      </div>

      {/* Wishlist & Price Alert Buttons */}
      <div className="mb-6 flex gap-3">
        <WishlistButton productId={productId} variant="button" />
        <PriceDropButton
          productId={productId}
          currentPrice={selectedFormatPrice}
          variant="button"
        />
      </div>

      {/* Stock Warning */}
      {selectedFormatInStock && selectedFormatStockQuantity <= 10 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
          <p className="text-amber-700 text-sm font-medium">
            ⚠️ {t('shop.onlyLeft')} {selectedFormatStockQuantity} {t('shop.left')}!
          </p>
        </div>
      )}

      {/* Back-in-Stock Alert */}
      {!selectedFormatInStock && (
        <div className="mb-6">
          <StockAlertButton
            productId={productId}
            formatId={selectedFormatId}
            productName={productName}
            formatName={selectedFormatName}
          />
        </div>
      )}
    </>
  );
}
