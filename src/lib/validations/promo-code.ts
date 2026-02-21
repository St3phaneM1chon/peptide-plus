/**
 * Promo Code Zod Validation Schemas
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
// ---------------------------------------------------------------------------

export const updatePromoCodeSchema = createPromoCodeSchema;

export type UpdatePromoCodeInput = z.infer<typeof updatePromoCodeSchema>;

// ---------------------------------------------------------------------------
// Partial update promo code (PATCH /api/admin/promo-codes/[id])
// ---------------------------------------------------------------------------

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
});

export type PatchPromoCodeInput = z.infer<typeof patchPromoCodeSchema>;
