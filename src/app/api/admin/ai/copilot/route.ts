export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ai/copilot
 * AI Copilot endpoint - context-aware assistant for admin users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  summarizeCustomer,
  getDashboardInsights,
  draftEmail,
  copilotChat,
  getNextBestActionAI,
  getSeoSuggestions,
  summarizeNotes,
  getMorningBriefing,
  generateReport,
  generateVariants,
  extractInvoice,
  predictStock,
  getChurnAlerts,
  nliSearch,
  type CopilotAction,
} from '@/lib/ai/copilot-service';

const copilotSchema = z.object({
  action: z.enum([
    'summarize_customer', 'dashboard_insights', 'draft_email',
    'next_best_action', 'seo_suggestions', 'summarize_notes',
    'morning_briefing', 'generate_report', 'generate_variants',
    'extract_invoice', 'predict_stock', 'churn_alerts',
    'nli_search', 'explain_anomaly', 'chat',
  ]),
  context: z.object({
    entityId: z.string().max(200).optional(),
    entityType: z.string().max(100).optional(),
  }).passthrough().optional(),
  message: z.string().max(10000).optional(),
  locale: z.string().max(10).default('en'),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = copilotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { action, context, message, locale } = parsed.data;

    let result;

    switch (action as CopilotAction) {
      case 'summarize_customer':
        if (!context?.entityId) {
          return NextResponse.json({ error: 'Missing entityId for customer summary' }, { status: 400 });
        }
        result = await summarizeCustomer(context.entityId, locale);
        break;

      case 'dashboard_insights':
        result = await getDashboardInsights(locale);
        break;

      case 'draft_email':
        if (!message) {
          return NextResponse.json({ error: 'Missing message for email draft' }, { status: 400 });
        }
        result = await draftEmail(context || {}, message, locale);
        break;

      case 'next_best_action':
        if (!context?.entityId || !context?.entityType) {
          return NextResponse.json({ error: 'Missing entityId/entityType for next best action' }, { status: 400 });
        }
        result = await getNextBestActionAI(context.entityType, context.entityId, locale);
        break;

      case 'seo_suggestions':
        if (!context?.entityId || !context?.entityType) {
          return NextResponse.json({ error: 'Missing entityId/entityType for SEO suggestions' }, { status: 400 });
        }
        result = await getSeoSuggestions(context.entityType, context.entityId, locale);
        break;

      case 'summarize_notes':
        if (!context?.entityId || !context?.entityType) {
          return NextResponse.json({ error: 'Missing entityId/entityType for notes summary' }, { status: 400 });
        }
        result = await summarizeNotes(context.entityId, context.entityType, locale);
        break;

      case 'morning_briefing':
        result = await getMorningBriefing(locale);
        break;

      case 'generate_report':
        if (!message) {
          return NextResponse.json({ error: 'Missing message for report generation' }, { status: 400 });
        }
        result = await generateReport(message, locale);
        break;

      case 'generate_variants':
        if (!context?.entityId) {
          return NextResponse.json({ error: 'Missing entityId for variant generation' }, { status: 400 });
        }
        result = await generateVariants(context.entityId, locale);
        break;

      case 'extract_invoice':
        if (!message) {
          return NextResponse.json({ error: 'Missing invoice text for extraction' }, { status: 400 });
        }
        result = await extractInvoice(message, locale);
        break;

      case 'predict_stock':
        result = await predictStock(locale);
        break;

      case 'churn_alerts':
        result = await getChurnAlerts(locale);
        break;

      case 'nli_search':
        if (!message) {
          return NextResponse.json({ error: 'Missing search query' }, { status: 400 });
        }
        result = await nliSearch(message, locale);
        break;

      case 'explain_anomaly':
      case 'chat':
        if (!message) {
          return NextResponse.json({ error: 'Missing message' }, { status: 400 });
        }
        result = await copilotChat(message, context || {}, locale);
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    logger.error('[AI Copilot] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
});
