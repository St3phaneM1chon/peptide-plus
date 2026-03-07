export const dynamic = 'force-dynamic';

/**
 * Agent Assist API
 *
 * POST /api/voip/agent-assist
 *   Body: { action, ... }
 *
 *   Actions:
 *     - "suggest": Feed transcript text + optional CRM context, return AI suggestions
 *       Body: { action: "suggest", speaker: "agent"|"customer", text: string, crmContext?: object }
 *     - "response": Get a suggested response for the current conversation
 *       Body: { action: "response" }
 *     - "knowledge": Search knowledge base for relevant info
 *       Body: { action: "knowledge", query: string }
 *     - "reset": Reset the conversation state
 *       Body: { action: "reset" }
 *
 * Authentication: Requires authenticated session (agent or supervisor).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { AgentAssist, type Suggestion } from '@/lib/voip/agent-assist';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Per-session AgentAssist instances (keyed by user ID)
// In production, consider a more persistent approach (Redis, etc.)
// ---------------------------------------------------------------------------

const assistInstances = new Map<string, AgentAssist>();

function getAssistForUser(userId: string): AgentAssist {
  let assist = assistInstances.get(userId);
  if (!assist) {
    assist = new AgentAssist();
    assistInstances.set(userId, assist);
  }
  return assist;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = z.object({
      action: z.enum(['suggest', 'response', 'knowledge', 'dismiss', 'reset']),
      speaker: z.enum(['agent', 'customer']).optional(),
      text: z.string().optional(),
      crmContext: z.record(z.unknown()).optional(),
      query: z.string().optional(),
      suggestionId: z.string().optional(),
    }).safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { action, speaker, text, crmContext, query, suggestionId } = parsed.data;

    const assist = getAssistForUser(session.user.id);

    switch (action) {
      case 'suggest': {
        if (!speaker || !text) {
          return NextResponse.json(
            { error: 'speaker and text are required' },
            { status: 400 }
          );
        }

        // Set CRM context if provided
        if (crmContext && typeof crmContext === 'object') {
          assist.setCrmContext(crmContext);
        }

        const suggestions: Suggestion[] = await assist.feedTranscript(speaker, text);

        return NextResponse.json({
          data: {
            suggestions,
            allActive: assist.getAllSuggestions(),
          },
        });
      }

      case 'response': {
        const suggestedResponse = await assist.getSuggestedResponse();
        return NextResponse.json({
          data: { suggestedResponse },
        });
      }

      case 'knowledge': {
        if (!query) {
          return NextResponse.json(
            { error: 'query is required' },
            { status: 400 }
          );
        }

        const results = await assist.searchKnowledge(query);
        return NextResponse.json({
          data: { results },
        });
      }

      case 'dismiss': {
        if (!suggestionId) {
          return NextResponse.json(
            { error: 'suggestionId is required' },
            { status: 400 }
          );
        }
        assist.dismissSuggestion(suggestionId);
        return NextResponse.json({ status: 'dismissed' });
      }

      case 'reset': {
        assist.reset();
        return NextResponse.json({ status: 'reset' });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('[agent-assist] POST error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
