/**
 * Consent Zod Validation Schemas
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// ConsentFormTemplate
// ---------------------------------------------------------------------------

const questionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1).max(1000),
  type: z.enum(['checkbox', 'text', 'signature']),
  required: z.boolean().default(true),
});

export const createConsentTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(['VIDEO_APPEARANCE', 'TESTIMONIAL', 'PHOTO', 'CASE_STUDY', 'MARKETING', 'OTHER']).default('VIDEO_APPEARANCE'),
  questions: z.array(questionSchema).min(1, 'At least one question is required'),
  legalText: z.string().max(50000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  translations: z.array(z.object({
    locale: z.string().min(2).max(10),
    name: z.string().max(200).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    questions: z.array(questionSchema).optional().nullable(),
    legalText: z.string().max(50000).optional().nullable(),
  })).optional().nullable(),
});

export type CreateConsentTemplateInput = z.infer<typeof createConsentTemplateSchema>;

export const patchConsentTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(['VIDEO_APPEARANCE', 'TESTIMONIAL', 'PHOTO', 'CASE_STUDY', 'MARKETING', 'OTHER']).optional(),
  questions: z.array(questionSchema).optional(),
  legalText: z.string().max(50000).optional().nullable(),
  isActive: z.boolean().optional(),
  version: z.number().int().min(1).optional(),
  translations: z.array(z.object({
    locale: z.string().min(2).max(10),
    name: z.string().max(200).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    questions: z.array(questionSchema).optional().nullable(),
    legalText: z.string().max(50000).optional().nullable(),
    isApproved: z.boolean().optional(),
  })).optional().nullable(),
});

export type PatchConsentTemplateInput = z.infer<typeof patchConsentTemplateSchema>;

// ---------------------------------------------------------------------------
// Consent Request (admin sends to client)
// ---------------------------------------------------------------------------

export const createConsentRequestSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  videoId: z.string().optional().nullable(),
  formTemplateId: z.string().min(1, 'Template is required'),
  type: z.enum(['VIDEO_APPEARANCE', 'TESTIMONIAL', 'PHOTO', 'CASE_STUDY', 'MARKETING', 'OTHER']).default('VIDEO_APPEARANCE'),
});

export type CreateConsentRequestInput = z.infer<typeof createConsentRequestSchema>;

// ---------------------------------------------------------------------------
// Consent Submission (client fills form)
// ---------------------------------------------------------------------------

export const submitConsentSchema = z.object({
  responses: z.record(z.string(), z.union([z.string(), z.boolean()])),
});

export type SubmitConsentInput = z.infer<typeof submitConsentSchema>;

// ---------------------------------------------------------------------------
// Consent Revocation
// ---------------------------------------------------------------------------

export const revokeConsentSchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
});

export type RevokeConsentInput = z.infer<typeof revokeConsentSchema>;
