/**
 * WEBHOOK EVENT CATALOG
 * Defines all outgoing webhook events that external systems can subscribe to.
 *
 * Usage:
 *   import { WEBHOOK_EVENTS, type WebhookEventType } from '@/lib/webhooks/events';
 */

export const WEBHOOK_EVENTS = {
  'order.created': { description: 'New order placed' },
  'order.paid': { description: 'Order payment confirmed' },
  'order.shipped': { description: 'Order shipped' },
  'order.delivered': { description: 'Order delivered' },
  'order.cancelled': { description: 'Order cancelled' },
  'product.created': { description: 'New product added' },
  'product.updated': { description: 'Product updated' },
  'product.deleted': { description: 'Product deleted' },
  'customer.created': { description: 'New customer registered' },
  'customer.updated': { description: 'Customer profile updated' },
  'inventory.low': { description: 'Product inventory below threshold' },
  'payment.received': { description: 'Payment received' },
  'payment.refunded': { description: 'Payment refunded' },
  'review.created': { description: 'New product review' },
  'subscription.created': { description: 'New subscription' },
  'subscription.cancelled': { description: 'Subscription cancelled' },
} as const;

export type WebhookEventType = keyof typeof WEBHOOK_EVENTS;

/**
 * Check whether a string is a valid webhook event type.
 */
export function isValidWebhookEvent(event: string): event is WebhookEventType {
  return event in WEBHOOK_EVENTS;
}
