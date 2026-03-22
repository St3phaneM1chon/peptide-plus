'use client';

/**
 * SharedCartBanner
 *
 * Reads the `?share=<token>` URL parameter, calls GET /api/cart/shared/[code]
 * to resolve items with current prices, then offers to add those items to the
 * visitor's cart.
 *
 * Mount this component on any page that can receive a share link (e.g. checkout,
 * shop home). It renders nothing when no `share` param is present.
 *
 * The banner dismisses after the user adds items or clicks "dismiss".
 * The `share` param is stripped from the URL after resolution to keep it clean.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { useI18n } from '@/i18n/client';

interface ResolvedItem {
  productId: string;
  optionId: string | null;
  name: string;
  optionName: string | null;
  quantity: number;
  currentPrice: number | null;
  image: string | null;
  available: boolean;
  unavailableReason: string | null;
}

interface SharedCartResponse {
  success: boolean;
  items: ResolvedItem[];
  itemCount: number;
  availableCount: number;
}

export default function SharedCartBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { addItem } = useCart();
  const { t, formatCurrency } = useI18n();

  const [items, setItems] = useState<ResolvedItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareToken = searchParams.get('share');

  // Resolve the shared cart when we have a token
  useEffect(() => {
    if (!shareToken || dismissed || added) return;

    setLoading(true);
    setError(null);

    fetch(`/api/cart/shared/${encodeURIComponent(shareToken)}`)
      .then((res) => res.json() as Promise<SharedCartResponse | { error: string }>)
      .then((data) => {
        if ('error' in data) {
          setError(data.error);
        } else if (data.success && data.items.length > 0) {
          setItems(data.items);
        } else {
          setError('No items found in shared cart');
        }
      })
      .catch(() => setError('Failed to load shared cart'))
      .finally(() => setLoading(false));
  }, [shareToken, dismissed, added]);

  // Strip the `share` param from the URL so it doesn't persist on refresh
  const stripShareParam = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('share');
    const newUrl = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  const handleAddItems = useCallback(() => {
    if (!items) return;

    const availableItems = items.filter((i) => i.available && i.currentPrice !== null);
    availableItems.forEach((item) => {
      addItem({
        productId: item.productId,
        optionId: item.optionId ?? undefined,
        name: item.name,
        optionName: item.optionName ?? undefined,
        price: item.currentPrice as number,
        quantity: item.quantity,
        image: item.image ?? undefined,
      });
    });

    setAdded(true);
    stripShareParam();
  }, [items, addItem, stripShareParam]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    stripShareParam();
  }, [stripShareParam]);

  // Nothing to show
  if (!shareToken || dismissed || added) return null;

  if (loading) {
    return (
      <div className="shared-cart-banner shared-cart-banner--loading" role="status" aria-live="polite">
        <div className="shared-cart-banner__inner">
          <span className="shared-cart-banner__spinner" aria-hidden="true" />
          <span>{t('cart.loadingShared')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="shared-cart-banner shared-cart-banner--error" role="alert">
        <div className="shared-cart-banner__inner">
          <span>{t('cart.shareError')}</span>
          <button
            type="button"
            className="shared-cart-banner__dismiss"
            onClick={handleDismiss}
            aria-label={t('cart.dismissShared')}
          >
            &times;
          </button>
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  const availableItems = items.filter((i) => i.available && i.currentPrice !== null);
  const unavailableItems = items.filter((i) => !i.available || i.currentPrice === null);

  return (
    <div className="shared-cart-banner" role="region" aria-label={t('cart.sharedCartBanner')}>
      <div className="shared-cart-banner__inner">
        {/* Header */}
        <div className="shared-cart-banner__header">
          <div className="shared-cart-banner__title-row">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
              />
            </svg>
            <span className="shared-cart-banner__title">{t('cart.sharedCartBanner')}</span>
          </div>
          <button
            type="button"
            className="shared-cart-banner__dismiss"
            onClick={handleDismiss}
            aria-label={t('cart.dismissShared')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              width="16"
              height="16"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Item previews */}
        <div className="shared-cart-banner__items">
          {availableItems.map((item) => (
            <div key={`${item.productId}-${item.optionId ?? 'default'}`} className="shared-cart-banner__item">
              {item.image && (
                <div className="shared-cart-banner__item-image">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                </div>
              )}
              <div className="shared-cart-banner__item-info">
                <span className="shared-cart-banner__item-name">{item.name}</span>
                {item.optionName && (
                  <span className="shared-cart-banner__item-format">{item.optionName}</span>
                )}
              </div>
              <div className="shared-cart-banner__item-meta">
                <span className="shared-cart-banner__item-qty">x{item.quantity}</span>
                {item.currentPrice !== null && (
                  <span className="shared-cart-banner__item-price">
                    {formatCurrency(item.currentPrice)}
                  </span>
                )}
              </div>
            </div>
          ))}

          {unavailableItems.length > 0 && (
            <p className="shared-cart-banner__unavailable">
              {unavailableItems.length} {unavailableItems.length === 1 ? t('cart.item') : t('cart.items')}{' '}
              {t('cart.unavailable')}
            </p>
          )}
        </div>

        {/* Actions */}
        {availableItems.length > 0 && (
          <div className="shared-cart-banner__actions">
            <button
              type="button"
              className="btn btn-primary shared-cart-banner__add"
              onClick={handleAddItems}
            >
              {t('cart.addSharedItems', { count: availableItems.reduce((s, i) => s + i.quantity, 0) })}
            </button>
            <button
              type="button"
              className="btn btn-ghost shared-cart-banner__skip"
              onClick={handleDismiss}
            >
              {t('cart.dismissShared')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
