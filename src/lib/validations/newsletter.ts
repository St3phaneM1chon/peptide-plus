/**
 * Newsletter Zod Validation Schemas
 */

import { z } from 'zod';
import { emailSchema } from './shared';

// ---------------------------------------------------------------------------
// Campaign status enum
// ---------------------------------------------------------------------------

const campaignStatusEnum = z.enum(['DRAFT', 'SCHEDULED', 'SENT']);

// ---------------------------------------------------------------------------
// Create campaign (POST /api/admin/newsletter/campaigns)
// ---------------------------------------------------------------------------

export const createCampaignSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  content: z.string().min(1, 'Content is required').max(100000),
  status: campaignStatusEnum.optional().default('DRAFT'),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// ---------------------------------------------------------------------------
// Update campaign (PATCH /api/admin/newsletter/campaigns/[id])
// ---------------------------------------------------------------------------

export const updateCampaignSchema = z.object({
  status: campaignStatusEnum.optional(),
  subject: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(100000).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

// ---------------------------------------------------------------------------
// Add subscriber (POST /api/admin/newsletter/subscribers)
// ---------------------------------------------------------------------------

export const addSubscriberSchema = z.object({
  email: emailSchema,
  name: z.string().max(200).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
  locale: z.string().min(2).max(10).optional().nullable(),
});

export type AddSubscriberInput = z.infer<typeof addSubscriberSchema>;

// ---------------------------------------------------------------------------
// Update subscriber (PATCH /api/admin/newsletter/subscribers/[id])
// ---------------------------------------------------------------------------

export const patchSubscriberSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().max(200).optional().nullable(),
  locale: z.string().min(2).max(10).optional().nullable(),
  source: z.string().max(50).optional().nullable(),
});

export type PatchSubscriberInput = z.infer<typeof patchSubscriberSchema>;
