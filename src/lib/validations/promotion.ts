/**
 * Promotion/Discount Zod Validation Schemas
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Discount type enum
// ---------------------------------------------------------------------------

export const discountTypeEnum = z.enum(['PERCENTAGE', 'FIXED_AMOUNT']);

// ---------------------------------------------------------------------------
// Create promotion (POST /api/admin/promotions)
// ---------------------------------------------------------------------------

export const createPromotionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).transform((v) => v.trim()),
  type: discountTypeEnum.optional().default('PERCENTAGE'),
  // FLAW-078 FIX: Minimum 0.01 to prevent zero-value discounts
  value: z.number().min(0.01, 'Value must be greater than zero').max(99999.99),
  appliesToAll: z.boolean().optional().default(false),
  categoryId: z.string().max(100).optional().nullable(),
  productId: z.string().max(100).optional().nullable(),
  badge: z.string().max(50).optional().nullable(),
  badgeColor: z.string().max(20).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
}).refine(
  (data) => {
    if (data.type === 'PERCENTAGE' && data.value > 100) return false;
    return true;
  },
  { message: 'Percentage discount cannot exceed 100%', path: ['value'] }
);

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;

// ---------------------------------------------------------------------------
// Update promotion (PATCH /api/admin/promotions/[id])
// ---------------------------------------------------------------------------

export const patchPromotionSchema = z.object({
  name: z.string().min(1).max(200).transform((v) => v.trim()).optional(),
  type: discountTypeEnum.optional(),
  // FLAW-078 FIX: Minimum 0.01 to prevent zero-value discounts
  value: z.number().min(0.01).max(99999.99).optional(),
  appliesToAll: z.boolean().optional(),
  categoryId: z.string().max(100).optional().nullable(),
  productId: z.string().max(100).optional().nullable(),
  badge: z.string().max(50).optional().nullable(),
  badgeColor: z.string().max(20).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type PatchPromotionInput = z.infer<typeof patchPromotionSchema>;
