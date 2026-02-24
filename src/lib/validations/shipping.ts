/**
 * Shipping Zone Zod Validation Schemas
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Create shipping zone (POST /api/admin/shipping/zones)
// ---------------------------------------------------------------------------

export const createShippingZoneSchema = z.object({
  name: z.string().min(1, 'Zone name is required').max(200),
  countries: z.array(z.string().min(1).max(10)).min(1, 'At least one country is required'),
  baseFee: z.number().min(0, 'Base fee must be non-negative').max(99999.99),
  perItemFee: z.number().min(0).max(99999.99).optional().default(0),
  freeShippingThreshold: z.number().min(0).max(99999.99).optional().nullable(),
  estimatedDaysMin: z.number().int().min(0).max(365).optional().default(3),
  estimatedDaysMax: z.number().int().min(0).max(365).optional().default(7),
  maxWeight: z.number().min(0).max(999999).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  notes: z.string().max(1000).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

export type CreateShippingZoneInput = z.infer<typeof createShippingZoneSchema>;

// ---------------------------------------------------------------------------
// Update shipping zone (PATCH /api/admin/shipping/zones/[id])
// ---------------------------------------------------------------------------

export const patchShippingZoneSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  countries: z.array(z.string().min(1).max(10)).min(1).optional(),
  baseFee: z.number().min(0).max(99999.99).optional(),
  perItemFee: z.number().min(0).max(99999.99).optional(),
  freeShippingThreshold: z.number().min(0).max(99999.99).optional().nullable(),
  estimatedDaysMin: z.number().int().min(0).max(365).optional(),
  estimatedDaysMax: z.number().int().min(0).max(365).optional(),
  maxWeight: z.number().min(0).max(999999).optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional().nullable(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
});

export type PatchShippingZoneInput = z.infer<typeof patchShippingZoneSchema>;
