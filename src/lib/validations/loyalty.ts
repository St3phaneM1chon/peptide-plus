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
