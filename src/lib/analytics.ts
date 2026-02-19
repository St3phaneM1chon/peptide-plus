/**
 * GA4 E-commerce event helpers
 * https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */

type GtagEvent = {
  action: string;
  params: Record<string, unknown>;
};

function sendEvent({ action, params }: GtagEvent) {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as unknown as { gtag: (...args: unknown[]) => void }).gtag(
      'event',
      action,
      params,
    );
  }
}

export interface AnalyticsItem {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price: number;
  quantity: number;
}

/** User views a product page */
export function trackViewItem(item: AnalyticsItem) {
  sendEvent({
    action: 'view_item',
    params: { currency: 'CAD', value: item.price, items: [item] },
  });
}

/** User adds item to cart */
export function trackAddToCart(item: AnalyticsItem) {
  sendEvent({
    action: 'add_to_cart',
    params: {
      currency: 'CAD',
      value: item.price * item.quantity,
      items: [item],
    },
  });
}

/** User removes item from cart */
export function trackRemoveFromCart(item: AnalyticsItem) {
  sendEvent({
    action: 'remove_from_cart',
    params: {
      currency: 'CAD',
      value: item.price * item.quantity,
      items: [item],
    },
  });
}

/** User starts checkout */
export function trackBeginCheckout(items: AnalyticsItem[], value: number) {
  sendEvent({
    action: 'begin_checkout',
    params: { currency: 'CAD', value, items },
  });
}

/** Purchase completed */
export function trackPurchase(
  transactionId: string,
  value: number,
  tax: number,
  shipping: number,
  items: AnalyticsItem[],
) {
  sendEvent({
    action: 'purchase',
    params: {
      transaction_id: transactionId,
      currency: 'CAD',
      value,
      tax,
      shipping,
      items,
    },
  });
}
