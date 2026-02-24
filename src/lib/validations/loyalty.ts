/**
 * Loyalty validation schemas (Audit Item)
 */

import { z } from 'zod';

export const earnPointsSchema = z.object({
  type: z.enum(['PURCHASE', 'SIGNUP', 'REVIEW', 'REFERRAL', 'BIRTHDAY', 'BONUS']),
  amount: z.number().positive().optional(),
  orderId: z.string().optional(),
  description: z.string().max(500).optional(),
  productId: z.string().optional(),
});

export const redeemRewardSchema = z.object({
  rewardId: z.string().min(1, 'Reward ID is required'),
});

export type EarnPointsInput = z.infer<typeof earnPointsSchema>;
export type RedeemRewardInput = z.infer<typeof redeemRewardSchema>;

// ---------------------------------------------------------------------------
// Loyalty tier schema
// ---------------------------------------------------------------------------

const loyaltyTierSchema = z.object({
  name: z.string().min(1, 'Tier name is required').max(100),
  minPoints: z.number().int().min(0),
  multiplier: z.number().min(0).max(100),
  perks: z.array(z.string().max(500)).optional().default([]),
  color: z.string().max(50).optional().default('#000000'),
});

// ---------------------------------------------------------------------------
// Update loyalty config (PUT /api/admin/loyalty/config)
// ---------------------------------------------------------------------------

export const updateLoyaltyConfigSchema = z.object({
  pointsPerDollar: z.number().min(0).max(10000),
  pointsValue: z.number().min(0).max(10000),
  minRedemption: z.number().int().min(0).max(1000000),
  referralBonus: z.number().int().min(0).max(1000000),
  birthdayBonus: z.number().int().min(0).max(1000000),
  tiers: z.array(loyaltyTierSchema).min(1, 'At least one tier is required'),
});

export type UpdateLoyaltyConfigInput = z.infer<typeof updateLoyaltyConfigSchema>;
