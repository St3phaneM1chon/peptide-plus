/**
 * Order Zod Validation Schemas (Backend Round 2 - Items 16, 18, 20, 21, 22, 24, 25)
 */

import { z } from 'zod';
import { sanitizedString, phoneSchema, uuidSchema, priceSchema, quantitySchema } from './shared';

// ---------------------------------------------------------------------------
// Order status enum (Item 21)
// ---------------------------------------------------------------------------

export const orderStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
  'REFUNDED',
]);

export const paymentStatusEnum = z.enum([
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
  'PARTIAL_REFUND',
]);

// ---------------------------------------------------------------------------
// Create order (customer checkout)
// ---------------------------------------------------------------------------

const orderItemSchema = z.object({
  productId: uuidSchema,
  formatId: uuidSchema.optional().nullable(),
  quantity: quantitySchema,
}).strict(); // Item 25

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'At least one item is required').max(50),
  shippingName: sanitizedString(2, 200),
  shippingAddress1: sanitizedString(5, 500),
  shippingAddress2: z.string().max(500).optional().nullable(),
  shippingCity: sanitizedString(2, 100),
  shippingState: sanitizedString(2, 100),
  shippingPostal: sanitizedString(2, 20),
  shippingCountry: z.string().length(2, 'Country must be ISO 3166-1 alpha-2'),
  shippingPhone: phoneSchema,
  promoCode: z.string().max(50).optional().nullable(),
  currencyCode: z.string().max(3).default('CAD'),
  notes: z.string().max(2000).optional().nullable(),
}).strict(); // Item 25

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ---------------------------------------------------------------------------
// Update order status (admin)
// ---------------------------------------------------------------------------

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum.optional(),
  paymentStatus: paymentStatusEnum.optional(),
  trackingNumber: z.string().max(100).optional().nullable(),
  carrier: z.string().max(100).optional().nullable(),
  adminNotes: sanitizedString({ max: 2000 }).optional().nullable(),
}).strict(); // Item 25

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// ---------------------------------------------------------------------------
// Batch order update
// ---------------------------------------------------------------------------

const batchOrderEntrySchema = z.object({
  orderId: uuidSchema,
  status: orderStatusEnum.optional(),
  trackingNumber: z.string().max(100).optional(),
  carrier: z.string().max(100).optional(),
  adminNotes: z.string().max(2000).optional(),
});

export const batchOrderUpdateSchema = z.object({
  orders: z.array(batchOrderEntrySchema).min(1).max(50),
}).strict(); // Item 25

// ---------------------------------------------------------------------------
// Refund
// ---------------------------------------------------------------------------

export const createRefundSchema = z.object({
  amount: priceSchema.refine((v) => v > 0, 'Refund amount must be positive'),
  reason: sanitizedString(1, 500),
}).strict(); // Item 25

export type CreateRefundInput = z.infer<typeof createRefundSchema>;
