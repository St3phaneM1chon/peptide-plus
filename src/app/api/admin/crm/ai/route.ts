export const dynamic = 'force-dynamic';

/**
 * CRM AI Assistant API
 * POST /api/admin/crm/ai - Perform AI-powered CRM actions
 *
 * Actions:
 * - score_lead:      Score a lead using AI analysis
 * - score_deal:      Score a deal using AI analysis
 * - email_suggestion: Generate an email suggestion for a lead/deal
 * - call_summary:    Summarize a call transcription
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  aiLeadScore,
  aiDealScore,
  generateEmailSuggestion,
  generateCallSummary,
} from '@/lib/crm/ai-assistant';

// ---------------------------------------------------------------------------
// POST: Dispatch AI action
// ---------------------------------------------------------------------------

const scoreLeadSchema = z.object({
  action: z.literal('score_lead'),
  leadId: z.string().min(1, 'leadId required'),
});

const scoreDealSchema = z.object({
  action: z.literal('score_deal'),
  dealId: z.string().min(1, 'dealId required'),
});

const emailSuggestionSchema = z.object({
  action: z.literal('email_suggestion'),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  purpose: z.enum(['follow_up', 'introduction', 'proposal', 'thank_you', 'meeting_request']).optional(),
  language: z.string().max(10).optional(),
}).refine(
  (d) => d.leadId || d.dealId,
  'Either leadId or dealId is required for email_suggestion'
);

const callSummarySchema = z.object({
  action: z.literal('call_summary'),
  transcriptionText: z.string().min(1, 'transcriptionText required').max(100000),
});

// Note: emailSuggestionSchema uses refine so can't be in discriminatedUnion.
// Individual schemas are validated per-action in the switch below.

export const POST = withAdminGuard(async (request: NextRequest) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError('Invalid JSON body', 'VALIDATION_ERROR', { status: 400, request });
  }

  // Try discriminated union first, then email_suggestion separately (has refine)
  const bodyObj = rawBody as Record<string, unknown>;
  const action = bodyObj?.action;

  if (!action || typeof action !== 'string') {
    return apiError('Missing action field', 'VALIDATION_ERROR', { status: 400, request });
  }

  switch (action) {
    case 'score_lead': {
      const parsed = scoreLeadSchema.safeParse(rawBody);
      if (!parsed.success) {
        return apiError(parsed.error.errors[0]?.message || 'Invalid data', 'VALIDATION_ERROR', { status: 400, request });
      }
      const result = await aiLeadScore(parsed.data.leadId);
      return apiSuccess(result, { request });
    }

    case 'score_deal': {
      const parsed = scoreDealSchema.safeParse(rawBody);
      if (!parsed.success) {
        return apiError(parsed.error.errors[0]?.message || 'Invalid data', 'VALIDATION_ERROR', { status: 400, request });
      }
      const result = await aiDealScore(parsed.data.dealId);
      return apiSuccess(result, { request });
    }

    case 'email_suggestion': {
      const parsed = emailSuggestionSchema.safeParse(rawBody);
      if (!parsed.success) {
        return apiError(parsed.error.errors[0]?.message || 'Invalid data', 'VALIDATION_ERROR', { status: 400, request });
      }
      const result = await generateEmailSuggestion({
        leadId: parsed.data.leadId,
        dealId: parsed.data.dealId,
        purpose: parsed.data.purpose ?? 'follow_up',
        language: parsed.data.language,
      });
      return apiSuccess(result, { request });
    }

    case 'call_summary': {
      const parsed = callSummarySchema.safeParse(rawBody);
      if (!parsed.success) {
        return apiError(parsed.error.errors[0]?.message || 'Invalid data', 'VALIDATION_ERROR', { status: 400, request });
      }
      const result = await generateCallSummary(parsed.data.transcriptionText);
      return apiSuccess(result, { request });
    }

    default:
      return apiError(
        `Unknown action: ${action}. Valid actions: score_lead, score_deal, email_suggestion, call_summary`,
        'VALIDATION_ERROR',
        { status: 400, request }
      );
  }
}, { requiredPermission: 'crm.ai.use' });
