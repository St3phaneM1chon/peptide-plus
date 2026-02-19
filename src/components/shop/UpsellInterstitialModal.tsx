'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Package, RefreshCw, ChevronRight, Sparkles, Check, Building2 } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';

interface CartItemParams {
  productId: string;
  formatId?: string;
  name: string;
  formatName?: string;
  price: number;
  comparePrice?: number;
  quantity?: number;
  image?: string;
  sku?: string;
  maxQuantity?: number;
  productType?: string;
}

interface UpsellData {
  enabled: boolean;
  showQuantityDiscount: boolean;
  showSubscription: boolean;
  displayRule: string;
  quantityTitle?: string;
  quantitySubtitle?: string;
  subscriptionTitle?: string;
  subscriptionSubtitle?: string;
  suggestedQuantity?: number;
  suggestedFrequency?: string;
  quantityDiscounts: Array<{ minQty: number; maxQty: number | null; discount: number }>;
  subscriptionOptions: Array<{ frequency: string; discountPercent: number }>;
}

// Re-export the type for CartContext
export type { CartItemParams };

interface UpsellInterstitialModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: CartItemParams | null;
  onAcceptQuantity: (item: CartItemParams, quantity: number) => void;
  onAcceptSubscription: (item: CartItemParams, frequency: string, discountPercent: number) => void;
  onDecline: (item: CartItemParams) => void;
}

const FREQUENCY_LABELS: Record<string, string> = {
  EVERY_2_MONTHS: 'upsell.subscription.every2months',
  EVERY_4_MONTHS: 'upsell.subscription.every4months',
  EVERY_6_MONTHS: 'upsell.subscription.every6months',
  EVERY_12_MONTHS: 'upsell.subscription.every12months',
};

export default function UpsellInterstitialModal({
  isOpen,
  onClose,
  item,
  onAcceptQuantity,
  onAcceptSubscription,
  onDecline,
}: UpsellInterstitialModalProps) {
  const { t } = useI18n();
  const { formatPrice } = useCurrency();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [upsellData, setUpsellData] = useState<UpsellData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(3);
  const [selectedFrequency, setSelectedFrequency] = useState<string>('MONTHLY');
  const [activeTab, setActiveTab] = useState<'quantity' | 'subscription'>('quantity');

  // Focus trap and Escape key handling
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (item) onDecline(item);
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [item, onDecline]
  );

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleKeyDown);

      requestAnimationFrame(() => {
        const focusable = dialogRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      });
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (!isOpen || !item) return;

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/upsell/${item.productId}`);
        const data = await res.json();

        // Check display rules before showing
        if (data.enabled && data.displayRule !== 'ALWAYS') {
          const shownKey = `biocycle-upsell-shown`;
          const shownData = JSON.parse(sessionStorage.getItem(shownKey) || '{}');

          if (data.displayRule === 'ONCE_PER_SESSION' && sessionStorage.getItem(shownKey + '-session') === 'true') {
            // Already shown once this session - skip
            onDecline(item);
            return;
          }
          if (data.displayRule === 'ONCE_PER_PRODUCT' && shownData[item.productId]) {
            // Already shown for this product - skip
            onDecline(item);
            return;
          }
        }

        setUpsellData(data);

        if (data.suggestedQuantity) setSelectedQuantity(data.suggestedQuantity);
        if (data.suggestedFrequency) setSelectedFrequency(data.suggestedFrequency);

        // Set default active tab based on what's available
        if (data.showQuantityDiscount) {
          setActiveTab('quantity');
        } else if (data.showSubscription) {
          setActiveTab('subscription');
        }
      } catch {
        setUpsellData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [isOpen, item]);

  // If upsell disabled or loading failed, auto-decline
  useEffect(() => {
    if (!loading && upsellData && !upsellData.enabled && item) {
      onDecline(item);
    }
  }, [loading, upsellData, item, onDecline]);

  if (!isOpen || !item) return null;

  const basePrice = item.price;

  const getDiscountForQty = (qty: number) => {
    if (!upsellData?.quantityDiscounts) return 0;
    const tier = upsellData.quantityDiscounts
      .filter((d) => qty >= d.minQty && (d.maxQty === null || qty <= d.maxQty))
      .sort((a, b) => b.discount - a.discount)[0];
    return tier?.discount || 0;
  };

  const selectedDiscount = getDiscountForQty(selectedQuantity);
  const discountedPrice = basePrice * (1 - selectedDiscount / 100);
  const totalSavings = (basePrice - discountedPrice) * selectedQuantity;

  const selectedSubOption = upsellData?.subscriptionOptions?.find(
    (o) => o.frequency === selectedFrequency
  );
  const subDiscountPercent = selectedSubOption?.discountPercent || 10;
  const subPrice = basePrice * (1 - subDiscountPercent / 100);

  // Find the best quantity tier
  const bestTier = upsellData?.quantityDiscounts?.length
    ? upsellData.quantityDiscounts.reduce((best, cur) =>
        cur.discount > best.discount ? cur : best
      )
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => item && onDecline(item)} />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('upsell.title')}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Close button */}
        <button
          onClick={() => item && onDecline(item)}
          className="absolute top-4 end-4 p-1.5 rounded-full hover:bg-neutral-100 transition-colors z-10"
          aria-label={t('common.aria.close')}
        >
          <X className="w-5 h-5 text-neutral-400" />
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-neutral-100">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            {t('upsell.title')}
          </div>
          <p className="text-sm text-neutral-500">{t('upsell.subtitle')}</p>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            <p className="text-sm text-neutral-500">{t('upsell.loading')}</p>
          </div>
        ) : upsellData?.enabled ? (
          <>
            {/* Tabs - only show if both options available */}
            {upsellData.showQuantityDiscount && upsellData.showSubscription && (
              <div className="flex border-b border-neutral-200">
                <button
                  onClick={() => setActiveTab('quantity')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'quantity'
                      ? 'text-orange-600 border-b-2 border-orange-500'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  {upsellData.quantityTitle || t('upsell.quantity.title')}
                </button>
                <button
                  onClick={() => setActiveTab('subscription')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                    activeTab === 'subscription'
                      ? 'text-orange-600 border-b-2 border-orange-500'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  {upsellData.subscriptionTitle || t('upsell.subscription.title')}
                </button>
              </div>
            )}

            <div className="p-6">
              {/* Quantity Discount Section */}
              {activeTab === 'quantity' && upsellData.showQuantityDiscount && (
                <div className="space-y-4">
                  {!upsellData.showSubscription && (
                    <h3 className="font-semibold text-lg text-neutral-900">
                      {upsellData.quantityTitle || t('upsell.quantity.title')}
                    </h3>
                  )}
                  <p className="text-sm text-neutral-500">
                    {upsellData.quantitySubtitle || t('upsell.quantity.subtitle')}
                  </p>

                  {/* Quantity tiers */}
                  <div className="space-y-2">
                    {upsellData.quantityDiscounts?.map((tier) => {
                      const qty = tier.minQty;
                      const tierPrice = basePrice * (1 - tier.discount / 100);
                      const isBest = bestTier && tier.discount === bestTier.discount;
                      const isSelected = selectedQuantity === qty;

                      return (
                        <button
                          key={qty}
                          onClick={() => setSelectedQuantity(qty)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-neutral-200 hover:border-orange-300'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'border-orange-500 bg-orange-500' : 'border-neutral-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 text-start">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-neutral-900">
                                {qty}x
                              </span>
                              <span className="text-sm text-neutral-500">
                                {t('upsell.quantity.perUnit').replace('{price}', formatPrice(tierPrice))}
                              </span>
                              {isBest && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                                  {t('upsell.quantity.bestDeal')}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-orange-600 font-medium">
                              {t('upsell.quantity.savePercent').replace('{percent}', String(tier.discount))}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-neutral-900">
                            {formatPrice(tierPrice * qty)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Research center CTA */}
                  <a
                    href="/contact?subject=research-volume"
                    className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 text-start">
                      <span className="font-semibold text-blue-900 text-sm">
                        {t('upsell.quantity.researchCenter')}
                      </span>
                      <p className="text-xs text-blue-600">
                        {t('upsell.quantity.researchCenterDesc')}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-400 group-hover:text-blue-600 transition-colors" />
                  </a>

                  {/* Savings summary */}
                  {selectedDiscount > 0 && (
                    <div className="flex items-center justify-center gap-2 p-3 bg-green-50 rounded-xl">
                      <Sparkles className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700">
                        {t('upsell.quantity.totalSavings').replace('{amount}', formatPrice(totalSavings))}
                      </span>
                    </div>
                  )}

                  {/* Accept button */}
                  <button
                    onClick={() => onAcceptQuantity(item, selectedQuantity)}
                    className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {t('upsell.quantity.accept')
                      .replace('{qty}', String(selectedQuantity))
                      .replace('{percent}', String(selectedDiscount))}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Subscription Section */}
              {activeTab === 'subscription' && upsellData.showSubscription && (
                <div className="space-y-4">
                  {!upsellData.showQuantityDiscount && (
                    <h3 className="font-semibold text-lg text-neutral-900">
                      {upsellData.subscriptionTitle || t('upsell.subscription.title')}
                    </h3>
                  )}
                  <p className="text-sm text-neutral-500">
                    {upsellData.subscriptionSubtitle || t('upsell.subscription.subtitle')}
                  </p>

                  {/* Frequency options */}
                  <div className="space-y-2">
                    {upsellData.subscriptionOptions?.map((opt) => {
                      const isSelected = selectedFrequency === opt.frequency;
                      const freqPrice = basePrice * (1 - opt.discountPercent / 100);

                      return (
                        <button
                          key={opt.frequency}
                          onClick={() => setSelectedFrequency(opt.frequency)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                            isSelected
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-neutral-200 hover:border-orange-300'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'border-orange-500 bg-orange-500' : 'border-neutral-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div className="flex-1 text-start">
                            <span className="font-medium text-neutral-900">
                              {t(FREQUENCY_LABELS[opt.frequency] || opt.frequency)}
                            </span>
                            <p className="text-xs text-orange-600 font-medium">
                              {t('upsell.subscription.savings').replace('{percent}', String(opt.discountPercent))}
                            </p>
                          </div>
                          <span className="text-lg font-bold text-neutral-900">
                            {formatPrice(freqPrice)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Cancel anytime reassurance */}
                  <p className="text-xs text-center text-neutral-400">
                    {t('upsell.subscription.cancelAnytime')}
                  </p>

                  {/* Accept button */}
                  <button
                    onClick={() => onAcceptSubscription(item, selectedFrequency, subDiscountPercent)}
                    className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {t('upsell.subscription.accept').replace('{percent}', String(subDiscountPercent))}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* Decline / No thanks button */}
        <div className="px-6 pb-6">
          <button
            onClick={() => item && onDecline(item)}
            className="w-full py-3 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50 font-medium rounded-xl transition-colors text-sm border border-neutral-200"
          >
            {t('upsell.decline')}
          </button>
          <p className="text-xs text-center text-neutral-400 mt-2">
            {t('upsell.reassurance')}
          </p>
        </div>
      </div>
    </div>
  );
}
