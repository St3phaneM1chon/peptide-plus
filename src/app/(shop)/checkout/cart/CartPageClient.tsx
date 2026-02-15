'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { useCart } from '@/contexts/CartContext';
import { useTranslations } from '@/hooks/useTranslations';
import { useCurrency } from '@/contexts/CurrencyContext';
import { calculateTaxes, getProvincesList, type TaxBreakdown } from '@/lib/canadianTaxes';
import { toast } from 'sonner';
import CartCrossSell from '@/components/shop/CartCrossSell';

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem, clearCart } = useCart();
  const { t, locale } = useTranslations();
  const { formatPrice } = useCurrency();
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [selectedProvince, setSelectedProvince] = useState('QC');

  // Get provinces list
  const provinces = useMemo(() => {
    return getProvincesList(locale?.startsWith('fr') ? 'fr' : 'en');
  }, [locale]);

  // Calculate taxes based on selected province
  const taxBreakdown: TaxBreakdown = useMemo(() => {
    const taxableAmount = subtotal - promoDiscount;
    return calculateTaxes(taxableAmount > 0 ? taxableAmount : 0, selectedProvince);
  }, [subtotal, promoDiscount, selectedProvince]);

  // Calculs
  const shipping = subtotal >= 200 ? 0 : 15;
  const total = taxBreakdown.grandTotal + shipping;

  // Extract unique product IDs for cross-sell recommendations
  const cartProductIds = useMemo(() => {
    return [...new Set(items.map(item => item.productId))];
  }, [items]);

  const handleApplyPromo = () => {
    // Codes promo de test
    const promoCodes: Record<string, number> = {
      'WELCOME10': 0.10,
      'PEPTIDE20': 0.20,
      'VIP25': 0.25,
    };
    
    const discount = promoCodes[promoCode.toUpperCase()];
    if (discount) {
      setPromoDiscount(subtotal * discount);
      setPromoApplied(true);
      toast.success('Promo code applied successfully');
    } else {
      toast.error('Invalid promo code');
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
            <svg
              className="w-24 h-24 mx-auto text-gray-300 mb-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {t('cart.emptyTitle')}
            </h1>
            <p className="text-gray-500 mb-8">
              {t('cart.emptyMessage')}
            </p>
            <Link
              href="/"
              className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
            >
              {t('cart.continueShopping')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: t('nav.home') || 'Home', href: '/' },
          { label: t('cart.title') || 'Cart' },
        ]}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('cart.title')}</h1>
          <p className="text-gray-500 mt-1">
            {items.length} {items.length === 1 ? t('cart.item') : t('cart.items')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => (
              <div
                key={`${item.productId}-${item.formatId || 'default'}`}
                className="bg-white rounded-xl shadow-sm p-4 flex gap-4"
              >
                {/* Image */}
                <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {item.name}
                  </h3>
                  {item.formatName && (
                    <p className="text-sm text-gray-500">{item.formatName}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-orange-600 font-bold">
                      {formatPrice(item.price)}
                    </span>
                    {item.comparePrice && item.comparePrice > item.price && (
                      <span className="text-sm text-gray-400 line-through">
                        {formatPrice(item.comparePrice)}
                      </span>
                    )}
                  </div>

                  {/* Quantity & Remove */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-gray-200 rounded-lg">
                      <button
                        onClick={() => updateQuantity(item.productId, item.formatId, item.quantity - 1)}
                        className="px-3 py-1 text-gray-500 hover:text-gray-700"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 font-medium">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.formatId, item.quantity + 1)}
                        className="px-3 py-1 text-gray-500 hover:text-gray-700"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId, item.formatId)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      {t('cart.remove')}
                    </button>
                  </div>
                </div>

                {/* Subtotal */}
                <div className="text-right">
                  <span className="font-bold text-gray-900">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))}

            {/* Clear Cart */}
            <button
              onClick={clearCart}
              className="text-sm text-gray-500 hover:text-red-500 transition-colors"
            >
              {t('cart.clearCart')}
            </button>

            {/* Cross-sell Recommendations */}
            <CartCrossSell cartProductIds={cartProductIds} />
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {t('cart.orderSummary')}
              </h2>

              {/* Promo Code */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">
                  {t('cart.promoCode')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="WELCOME10"
                    disabled={promoApplied}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoApplied || !promoCode}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                  >
                    {promoApplied ? '✓' : t('cart.apply')}
                  </button>
                </div>
              </div>

              {/* Province Selector for Tax Estimate */}
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2">
                  {t('cart.estimateProvince')}
                </label>
                <select
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {provinces.map((p) => (
                    <option key={p.code} value={p.code}>{p.name} ({p.taxRate})</option>
                  ))}
                </select>
              </div>

              {/* Summary Lines */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('cart.subtotal')}</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                
                {promoApplied && (
                  <div className="flex justify-between text-green-600">
                    <span>{t('cart.promoDiscount')}</span>
                    <span>-{formatPrice(promoDiscount)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-gray-600">{t('cart.shipping')}</span>
                  <span className="font-medium">
                    {shipping === 0 ? (
                      <span className="text-green-600">{t('cart.free')}</span>
                    ) : (
                      formatPrice(shipping)
                    )}
                  </span>
                </div>
                
                {/* Taxes - Separated by type based on province */}
                <div className="pt-2 border-t border-gray-100 space-y-1">
                  {/* Federal Tax (GST or HST) */}
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {taxBreakdown.federalTaxLabel} ({taxBreakdown.federalTaxRate})
                    </span>
                    <span className="font-medium">
                      {formatPrice(taxBreakdown.hstAmount > 0 ? taxBreakdown.hstAmount : taxBreakdown.gstAmount)}
                    </span>
                  </div>
                  
                  {/* Provincial Tax (PST/QST/RST if applicable) */}
                  {taxBreakdown.provincialTaxLabel && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {taxBreakdown.provincialTaxLabel} ({taxBreakdown.provincialTaxRate})
                      </span>
                      <span className="font-medium">
                        {formatPrice(
                          taxBreakdown.pstAmount || taxBreakdown.qstAmount || taxBreakdown.rstAmount
                        )}
                      </span>
                    </div>
                  )}
                </div>
                
                {subtotal < 200 && (
                  <p className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                    {t('cart.freeShippingMessage', { amount: formatPrice(200 - subtotal) })}
                  </p>
                )}
              </div>

              <hr className="my-4" />

              {/* Total */}
              <div className="flex justify-between items-center mb-6">
                <span className="text-lg font-bold">{t('cart.total')}</span>
                <span className="text-2xl font-bold text-orange-600">
                  {formatPrice(total)}
                </span>
              </div>

              {/* Checkout Button */}
              <Link
                href="/checkout"
                className="block w-full py-3 bg-orange-500 text-white text-center font-semibold rounded-lg hover:bg-orange-600 transition-colors"
              >
                {t('cart.proceedToCheckout')}
              </Link>

              {/* Continue Shopping */}
              <Link
                href="/"
                className="block w-full py-3 mt-3 text-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                {t('cart.continueShopping')}
              </Link>

              {/* Security Badge */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>{t('cart.secureCheckout')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
