/**
 * POST /api/admin/ai/copilot
 * AI Copilot endpoint - context-aware assistant for admin users.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
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
  type CopilotRequest,
} from '@/lib/ai/copilot-service';

const ALLOWED_ROLES = ['ADMIN', 'OWNER', 'MANAGER', 'EMPLOYEE'];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.role || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as CopilotRequest;
    const { action, context, message, locale = 'en' } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action' }, { status: 400 });
    }

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
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
