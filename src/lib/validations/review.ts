/**
 * Review Zod Validation Schemas (Backend Round 2 - Items 16, 18, 22, 24, 25)
 */

import { z } from 'zod';
import { ratingSchema, sanitizedString, uuidSchema } from './shared';

// ---------------------------------------------------------------------------
// Create review (customer)
// ---------------------------------------------------------------------------

export const createReviewSchema = z.object({
  productId: uuidSchema,
  rating: ratingSchema,
  title: sanitizedString({ max: 200 }).optional().nullable(),
  comment: sanitizedString(20, 5000),
  imageUrls: z.array(z.string().max(500)).max(10).optional(),
}).strict(); // Item 25: reject unknown fields

export type CreateReviewInput = z.infer<typeof createReviewSchema>;

// ---------------------------------------------------------------------------
// Admin review actions
// ---------------------------------------------------------------------------

export const adminReviewActionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']).optional(),
  reply: z.string().max(5000).optional(),
}).strict(); // Item 25
