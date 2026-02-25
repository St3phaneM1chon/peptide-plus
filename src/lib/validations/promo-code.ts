/**
 * Promo Code Zod Validation Schemas
 *
 * FIXED: F-058 - PATCH schema now has refine for percentage <= 100 (see patchPromoCodeSchema below)
 * FIXED: F-089 - promotion.ts now imports promoCodeTypeEnum from this file instead of duplicating
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Promo code type enum
// ---------------------------------------------------------------------------

export const promoCodeTypeEnum = z.enum(['PERCENTAGE', 'FIXED_AMOUNT']);

// ---------------------------------------------------------------------------
// Create promo code (POST /api/admin/promo-codes)
// ---------------------------------------------------------------------------

export const createPromoCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50),
  description: z.string().max(500).optional().nullable(),
  type: promoCodeTypeEnum,
  value: z.number().positive('Value must be a positive number').max(99999.99),
  // FIX: FLAW-098 - 0 means "no minimum order amount"; null/undefined also means no minimum
  minOrderAmount: z.number().min(0).max(99999.99).optional().nullable(),
  maxDiscount: z.number().min(0).max(99999.99).optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  usageLimitPerUser: z.number().int().min(1).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  firstOrderOnly: z.boolean().optional(),
  productIds: z.string().max(5000).optional().nullable(),
  categoryIds: z.string().max(5000).optional().nullable(),
}).refine(
  (data) => {
    if (data.type === 'PERCENTAGE' && data.value > 100) return false;
    return true;
  },
  { message: 'Percentage value cannot exceed 100', path: ['value'] }
);

export type CreatePromoCodeInput = z.infer<typeof createPromoCodeSchema>;

// ---------------------------------------------------------------------------
// Update promo code (PUT /api/admin/promo-codes/[id])
// FIX: F-070 - Use .partial() so update does not require all fields to be re-submitted
// ---------------------------------------------------------------------------

export const updatePromoCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  type: promoCodeTypeEnum.optional(),
  value: z.number().positive('Value must be a positive number').max(99999.99).optional(),
  minOrderAmount: z.number().min(0).max(99999.99).optional().nullable(),
  maxDiscount: z.number().min(0).max(99999.99).optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  usageLimitPerUser: z.number().int().min(1).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  firstOrderOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
  productIds: z.string().max(5000).optional().nullable(),
  categoryIds: z.string().max(5000).optional().nullable(),
}).refine(
  (data) => !(data.type === 'PERCENTAGE' && data.value !== undefined && data.value > 100),
  { message: 'Percentage value cannot exceed 100', path: ['value'] }
);

export type UpdatePromoCodeInput = z.infer<typeof updatePromoCodeSchema>;

// ---------------------------------------------------------------------------
// Partial update promo code (PATCH /api/admin/promo-codes/[id])
// ---------------------------------------------------------------------------

// FLOW-099 FIX: Add percentage max validation to patch schema (same as create)
export const patchPromoCodeSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional().nullable(),
  type: promoCodeTypeEnum.optional(),
  value: z.number().positive().max(99999.99).optional(),
  minOrderAmount: z.number().min(0).max(99999.99).optional().nullable(),
  maxDiscount: z.number().min(0).max(99999.99).optional().nullable(),
  usageLimit: z.number().int().min(1).optional().nullable(),
  usageLimitPerUser: z.number().int().min(1).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  firstOrderOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
  productIds: z.string().max(5000).optional().nullable(),
  categoryIds: z.string().max(5000).optional().nullable(),
}).refine(
  (data) => !(data.type === 'PERCENTAGE' && data.value !== undefined && data.value > 100),
  { message: 'Percentage discount cannot exceed 100%', path: ['value'] }
);

export type PatchPromoCodeInput = z.infer<typeof patchPromoCodeSchema>;
