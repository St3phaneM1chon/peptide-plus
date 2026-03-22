'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import CartCrossSell from './CartCrossSell';
import { useDiscountCode } from '@/hooks/useDiscountCode';
import { fetchWithCSRF } from '@/lib/csrf';

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

  // Promo code section
  const [promoExpanded, setPromoExpanded] = useState(false);

  const [promoState, promoActions] = useDiscountCode({
    validateFn: async (code: string) => {
      const res = await fetchWithCSRF('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          subtotal,
          cartItems: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await res.json();
      return {
        valid: !!data.valid,
        discount: data.discount ?? 0,
        code: data.code,
        error: data.error,
      };
    },
    onSuccess: () => {
      toast.success(t('cart.promoApplied'));
    },
    onError: () => {
      toast.error(t('cart.promoInvalid'));
    },
    defaultErrorMessage: t('cart.promoInvalid'),
    failureErrorMessage: t('cart.promoInvalid'),
  });

  // Save for Later & Share Cart state
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Save all current cart items for later (requires auth)
  const handleSaveForLater = useCallback(async () => {
    if (!session?.user) {
      toast.error(t('cart.saveRequiresLogin'));
      return;
    }
    setIsSaving(true);
    try {
      // Save each item individually via the API
      const results = await Promise.all(
        items.map(item =>
          fetch('/api/cart/saved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: item.productId,
              optionId: item.optionId || null,
            }),
          })
        )
      );
      const allOk = results.every(r => r.ok);
      if (allOk) {
        toast.success(t('cart.savedSuccess'));
      } else {
        toast.error(t('cart.savedError'));
      }
    } catch {
      toast.error(t('cart.savedError'));
    } finally {
      setIsSaving(false);
    }
  }, [items, session, t]);

  // Share cart via shareable link
  const handleShareCart = useCallback(async () => {
    setIsSharing(true);
    setShareUrl(null);
    try {
      const response = await fetch('/api/cart/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            productId: item.productId,
            optionId: item.optionId || null,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image: item.image || null,
          })),
        }),
      });
      if (!response.ok) {
        throw new Error('Share failed');
      }
      const data = await response.json();
      const url = data.shareUrl || `${window.location.origin}/cart/shared?token=${data.token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success(t('cart.shareCopied'));
    } catch {
      toast.error(t('cart.shareError'));
    } finally {
      setIsSharing(false);
    }
  }, [items, t]);

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
          {/* Free Shipping Progress Bar */}
          {items.length > 0 && (() => {
            const FREE_SHIPPING_THRESHOLD = 150;
            const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
            const progress = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
            const qualified = remaining <= 0;
            return (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  backgroundColor: qualified ? '#f0fdf4' : '#fff7ed',
                  border: qualified ? '1px solid #bbf7d0' : '1px solid #fed7aa',
                }}
              >
                <p style={{ fontSize: '11px', color: qualified ? '#15803d' : '#9a3412', marginBottom: qualified ? '0' : '8px', fontWeight: 500 }}>
                  {qualified
                    ? t('cart.freeShippingQualified')
                    : t('cart.freeShippingRemaining', { amount: formatPrice(remaining) })}
                </p>
                {!qualified && (
                  <div
                    style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '9999px', height: '6px' }}
                    role="progressbar"
                    aria-valuenow={Math.round(progress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={t('cart.freeShippingThreshold')}
                  >
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '6px',
                        borderRadius: '9999px',
                        backgroundColor: '#f97316',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                )}
                {qualified && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg style={{ width: '14px', height: '14px', color: '#16a34a', flexShrink: 0 }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <div
                      style={{ width: '100%', backgroundColor: '#bbf7d0', borderRadius: '9999px', height: '6px' }}
                      role="progressbar"
                      aria-valuenow={100}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t('cart.freeShippingQualified')}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '6px',
                          borderRadius: '9999px',
                          backgroundColor: '#16a34a',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

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
                className="text-primary-600 font-medium hover:underline"
              >
                {t('cart.continueShopping')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={`${item.productId}-${item.optionId}`}
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
                    {item.optionName && (
                      <p className="text-sm text-neutral-500">{item.optionName}</p>
                    )}
                    <p className="font-bold text-primary-600 mt-1">
                      {formatPrice(item.price)}
                    </p>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center border border-neutral-300 rounded-lg" role="group" aria-label={`Quantity for ${item.name}`}>
                        <button
                          onClick={() => updateQuantity(item.productId, item.optionId, item.quantity - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm" aria-live="polite" aria-atomic="true">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.optionId, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="w-10 h-10 flex items-center justify-center text-neutral-600 hover:bg-neutral-100"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.productId, item.optionId)}
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

          {/* Promo Code Section */}
          {items.length > 0 && (
            <div className="mt-4 border-t border-neutral-200 pt-3">
              {promoState.appliedCode ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-green-700">{t('cart.promoApplied')}</p>
                      <p className="text-xs text-green-600">{promoState.appliedCode} &mdash; -{formatPrice(promoState.discount)}</p>
                    </div>
                  </div>
                  <button
                    onClick={promoActions.remove}
                    className="text-xs text-red-500 hover:underline font-medium"
                  >
                    {t('cart.promoRemove')}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setPromoExpanded(!promoExpanded)}
                    className="flex items-center gap-1 text-sm text-primary-600 font-medium hover:underline"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${promoExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {t('cart.havePromoCode')}
                  </button>
                  {promoExpanded && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={promoState.code}
                        onChange={(e) => promoActions.setCode(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') promoActions.apply(); }}
                        placeholder={t('cart.promoPlaceholder')}
                        aria-label={t('cart.promoPlaceholder') || 'Promo code'}
                        className="flex-1 px-3 py-2 text-sm border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                      />
                      <button
                        onClick={promoActions.apply}
                        disabled={promoState.loading || !promoState.code.trim()}
                        className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {promoState.loading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          t('cart.promoApply')
                        )}
                      </button>
                    </div>
                  )}
                  {promoState.error && (
                    <p className="mt-1.5 text-xs text-red-500">{promoState.error}</p>
                  )}
                </>
              )}
            </div>
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
                          className="bg-primary-500 h-1.5 rounded-full transition-all duration-500"
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
              {promoState.appliedCode && promoState.discount > 0 && (
                <div className="flex items-center justify-between text-green-600">
                  <span>{t('cart.discount')}</span>
                  <span className="font-medium">-{formatPrice(promoState.discount)}</span>
                </div>
              )}
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
                <span className="text-lg font-bold text-neutral-900">
                  {formatPrice(Math.max(0, subtotal - promoState.discount))}
                </span>
              </div>
            </div>

            {/* Checkout Button */}
            <Link
              href={session ? '/checkout' : '/auth/signin?callbackUrl=/checkout'}
              onClick={onClose}
              className="block w-full py-3 bg-primary-500 text-white font-semibold text-center rounded-lg hover:bg-primary-600 transition-colors"
            >
              {t('cart.proceedToCheckout')}
            </Link>

            {/* Save for Later & Share Cart */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveForLater}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                )}
                {t('cart.saveForLater')}
              </button>
              <button
                onClick={handleShareCart}
                disabled={isSharing}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                {isSharing ? (
                  <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
                {t('cart.shareCart')}
              </button>
            </div>

            {/* Share URL display */}
            {shareUrl && (
              <div className="p-2 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-700 font-medium mb-1">{t('cart.shareLinkReady')}</p>
                <div className="flex gap-1">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    aria-label={t('cart.shareLinkReady') || 'Shareable cart link'}
                    className="flex-1 text-xs bg-white border border-green-300 rounded px-2 py-1 text-neutral-600 truncate"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shareUrl);
                      toast.success(t('cart.shareCopied'));
                    }}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                  >
                    {t('cart.copyLink')}
                  </button>
                </div>
              </div>
            )}

            {/* Continue Shopping */}
            <button
              onClick={onClose}
              className="block w-full py-2 text-primary-600 font-medium text-center text-sm hover:underline transition-colors"
            >
              {t('cart.continueShopping')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
