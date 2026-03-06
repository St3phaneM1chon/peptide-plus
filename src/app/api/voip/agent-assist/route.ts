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
    const body = await request.json();
    const { action } = body;

    const assist = getAssistForUser(session.user.id);

    switch (action) {
      case 'suggest': {
        const { speaker, text, crmContext } = body;
        if (!speaker || !text) {
          return NextResponse.json(
            { error: 'speaker and text are required' },
            { status: 400 }
          );
        }
        if (!['agent', 'customer'].includes(speaker)) {
          return NextResponse.json(
            { error: 'speaker must be "agent" or "customer"' },
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
        const { query } = body;
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
        const { suggestionId } = body;
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
