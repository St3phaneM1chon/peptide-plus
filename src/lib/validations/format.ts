/**
 * ProductFormat Zod Validation Schemas
 *
 * Extracted from:
 *   - src/app/api/products/[id]/formats/route.ts (createFormatSchema)
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Create product format (admin - standalone endpoint)
// ---------------------------------------------------------------------------

export const createFormatSchema = z.object({
  formatType: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional().nullable(),
  dosageMg: z.number().positive().optional().nullable(),
  volumeMl: z.number().positive().optional().nullable(),
  unitCount: z.number().int().positive().optional().nullable(),
  costPrice: z.number().min(0).optional().nullable(),
  price: z.number().min(0, 'Price is required'),
  comparePrice: z.number().min(0).optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  availability: z.string().optional(),
  availableDate: z.string().optional().nullable(),
  weightGrams: z.number().min(0).optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type CreateFormatInput = z.infer<typeof createFormatSchema>;
