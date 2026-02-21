/**
 * User/Profile Zod Validation Schemas (Backend Round 2 - Items 16, 20, 22, 23, 24, 25)
 */

import { z } from 'zod';
import { nameSchema, phoneSchema, emailSchema } from './shared';

// ---------------------------------------------------------------------------
// Update profile (customer)
// ---------------------------------------------------------------------------

export const updateProfileSchema = z.object({
  name: nameSchema.optional(),
  phone: phoneSchema,
  email: emailSchema.optional(),
}).strict(); // Item 25: reject unknown fields

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---------------------------------------------------------------------------
// Admin update user
// ---------------------------------------------------------------------------

export const adminUpdateUserSchema = z.object({
  role: z.enum(['PUBLIC', 'CUSTOMER', 'CLIENT_B2B', 'EMPLOYEE', 'OWNER']).optional(),
  name: nameSchema.optional(),
  phone: phoneSchema,
  locale: z.string().min(2).max(10).optional(),
  loyaltyTier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND']).optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
}).strict(); // Item 25

export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;
