/**
 * Zod validation schemas for API request bodies.
 * Used with withApiHandler({ schema: ... }) for automatic validation.
 */

import { z } from 'zod';

// ============================================================
// Products
// ============================================================

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  subtitle: z.string().max(300).optional().nullable(),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  shortDescription: z.string().max(500).optional().nullable(),
  description: z.string().optional().nullable(),
  fullDetails: z.string().optional().nullable(),
  specifications: z.string().optional().nullable(),
  productType: z.enum(['PEPTIDE', 'SUPPLEMENT', 'ACCESSORY', 'BUNDLE', 'CAPSULE']).default('PEPTIDE'),
  price: z.number().min(0, 'Price must be positive'),
  compareAtPrice: z.number().min(0).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  certificateUrl: z.string().url().optional().nullable(),
  technicalSheetUrl: z.string().url().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  availability: z.enum(['IN_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER', 'DISCONTINUED', 'COMING_SOON', 'LIMITED']).default('IN_STOCK'),
  formats: z.array(z.object({
    name: z.string().min(1),
    formatType: z.string().optional(),
    volume: z.number().min(0).optional().nullable(),
    concentration: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    price: z.number().min(0),
    costPrice: z.number().min(0).optional().nullable(),
    compareAtPrice: z.number().min(0).optional().nullable(),
    stockQuantity: z.number().int().min(0).default(0),
    lowStockThreshold: z.number().int().min(0).default(5),
    isActive: z.boolean().default(true),
  })).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().uuid().optional(),
});

// ============================================================
// Categories
// ============================================================

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

// ============================================================
// Orders
// ============================================================

export const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
  trackingNumber: z.string().max(100).optional().nullable(),
  carrier: z.string().max(100).optional().nullable(),
  adminNotes: z.string().max(2000).optional().nullable(),
});

export const createRefundSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive('Refund amount must be positive'),
  reason: z.string().min(1, 'Reason is required').max(500),
});

// ============================================================
// Promo Codes
// ============================================================

export const createPromoCodeSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(50)
    .transform(val => val.toUpperCase()),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.number().min(0),
  minOrderAmount: z.number().min(0).optional().nullable(),
  maxUses: z.number().int().min(1).optional().nullable(),
  maxUsesPerUser: z.number().int().min(1).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updatePromoCodeSchema = createPromoCodeSchema.partial();

// ============================================================
// Users / Clients
// ============================================================

export const updateUserSchema = z.object({
  role: z.enum(['PUBLIC', 'CUSTOMER', 'CLIENT_B2B', 'EMPLOYEE', 'OWNER']).optional(),
  loyaltyTier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']).optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const adjustPointsSchema = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().refine(val => val !== 0, 'Amount cannot be zero'),
  reason: z.string().min(1, 'Reason is required').max(200),
});

// ============================================================
// Newsletter
// ============================================================

export const createNewsletterSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  content: z.string().min(1, 'Content is required'),
  scheduledAt: z.string().datetime().optional().nullable(),
});

// ============================================================
// Contact / Chat
// ============================================================

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1, 'Message cannot be empty').max(5000),
});

// ============================================================
// Accounting entries
// ============================================================

export const createEntrySchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1, 'Description is required').max(500),
  lines: z.array(z.object({
    accountCode: z.string().min(1),
    debit: z.number().min(0).default(0),
    credit: z.number().min(0).default(0),
    description: z.string().optional(),
  })).min(2, 'At least 2 lines required'),
  status: z.enum(['DRAFT', 'POSTED']).default('DRAFT'),
});

// ============================================================
// Content pages
// ============================================================

export const createPageSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional().nullable(),
  metaTitle: z.string().max(70).optional().nullable(),
  description: z.string().max(160).optional().nullable(),
  template: z.enum(['default', 'full-width', 'with-sidebar']).default('default'),
  isPublished: z.boolean().default(false),
});

// ============================================================
// SEO
// ============================================================

export const updateSeoSchema = z.object({
  pageId: z.string(),
  title: z.string().max(70).optional(),
  description: z.string().max(160).optional(),
  keywords: z.string().max(500).optional(),
  ogImage: z.string().url().optional().nullable(),
  noIndex: z.boolean().optional(),
});
