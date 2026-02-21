'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/i18n/client';
import CartCrossSell from './CartCrossSell';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { data: session } = useSession();
  const { items, removeItem, updateQuantity, subtotal, itemCount } = useCart();
  const { formatPrice } = useCurrency();
  const { t } = useI18n();

  // Extract unique product IDs for cross-sell recommendations
  const cartProductIds = useMemo(() => {
    return [...new Set(items.map(item => item.productId))];
  }, [items]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('cart.aria.shoppingCart')}
        aria-hidden={!isOpen}
        className={`fixed end-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <h2 className="text-lg font-bold">{t('cart.titleWithCount', { count: itemCount })}</h2>
          <button
            onClick={onClose}
            aria-label={t('cart.aria.closeCart')}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-neutral-500 mb-4">{t('cart.emptyTitle')}</p>
              <button
                onClick={onClose}
                className="text-orange-600 font-medium hover:underline"
              >
                {t('cart.continueShopping')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={`${item.productId}-${item.formatId}`}
                  className="flex gap-4 bg-neutral-50 rounded-xl p-3 transition-all duration-300"
                  style={index === items.length - 1 ? { animation: 'pulse-highlight 1s ease-out' } : undefined}
                >
                  {/* Image */}
                  <div className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0 relative">
                    <Image
                      src={item.image || '/images/products/peptide-default.png'}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-neutral-900 truncate">
                      {item.name}
                    </h3>
                    {item.formatName && (
                      <p className="text-sm text-neutral-500">{item.formatName}</p>
                    )}
                    <p className="font-bold text-orange-600 mt-1">
                      {formatPrice(item.price)}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-neutral-300 rounded-lg" role="group" aria-label={`Quantity for ${item.name}`}>
                        <button
                          onClick={() => updateQuantity(item.productId, item.formatId, item.quantity - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm" aria-live="polite" aria-atomic="true">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.formatId, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId, item.formatId)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="text-red-500 text-sm hover:underline"
                      >
                        {t('cart.remove')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cross-sell Recommendations */}
          {items.length > 0 && (
            <CartCrossSell cartProductIds={cartProductIds} />
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-neutral-200 p-4 space-y-3" aria-live="polite" aria-atomic="true">
            {/* Free Shipping Progress Bar */}
            {(() => {
              const FREE_SHIPPING_THRESHOLD = 150;
              const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
              const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
              return (
                <div className="bg-neutral-50 rounded-lg p-3">
                  {remaining > 0 ? (
                    <>
                      <p className="text-xs text-neutral-600 mb-2">
                        {t('cart.freeShippingProgress', { amount: formatPrice(remaining) })}
                      </p>
                      <div className="w-full bg-neutral-200 rounded-full h-1.5">
                        <div
                          className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                          role="progressbar"
                          aria-valuenow={Math.round(progress)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={t('cart.freeShippingProgress', { amount: formatPrice(remaining) })}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-green-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs font-medium">{t('cart.freeShippingUnlocked')}</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Order Summary */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">{t('cart.subtotal')}</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">{t('cart.shippingEstimate')}</span>
                <span className="text-neutral-500 text-xs">{t('cart.shippingCalculatedAtCheckout')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-600">{t('cart.taxEstimate')}</span>
                <span className="text-neutral-500 text-xs">{t('cart.shippingCalculatedAtCheckout')}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                <span className="font-bold text-neutral-900">{t('cart.estimatedTotal')}</span>
                <span className="text-lg font-bold text-neutral-900">{formatPrice(subtotal)}</span>
              </div>
            </div>

            {/* Checkout Button */}
            <Link
              href={session ? '/checkout' : '/auth/signin?callbackUrl=/checkout'}
              onClick={onClose}
              className="block w-full py-3 bg-orange-500 text-white font-semibold text-center rounded-lg hover:bg-orange-600 transition-colors"
            >
              {t('cart.proceedToCheckout')}
            </Link>

            {/* Continue Shopping */}
            <button
              onClick={onClose}
              className="block w-full py-2 text-orange-600 font-medium text-center text-sm hover:underline transition-colors"
            >
              {t('cart.continueShopping')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
