export const dynamic = 'force-dynamic';

/**
 * Power Dialer Action API
 *
 * POST /api/admin/crm/dialer/action
 *
 * Body:
 *   { action: 'pause' | 'resume' | 'stop' | 'disposition' | 'skip', data?: {...} }
 *
 * Actions:
 *   pause       — Pause the current dialer session
 *   resume      — Resume a paused session and dial next contact
 *   stop        — Stop the session entirely (hangs up active call if any)
 *   disposition — Submit a call outcome:
 *                   data: { type: DialerDispositionType, notes?: string, callbackAt?: string }
 *   skip        — Skip the current lead and dial next
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import {
  pauseSession,
  resumeSession,
  stopSession,
  submitDisposition,
  getSessionState,
} from '@/lib/voip/power-dialer';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const dispositionDataSchema = z.object({
  type: z.enum([
    'INTERESTED',
    'NOT_INTERESTED',
    'CALLBACK',
    'VOICEMAIL',
    'DO_NOT_CALL',
    'WRONG_NUMBER',
    'NO_ANSWER',
  ]),
  notes: z.string().max(2000).optional(),
  callbackAt: z.string().datetime().optional(),
});

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
  z.object({ action: z.literal('stop') }),
  z.object({ action: z.literal('skip') }),
  z.object({
    action: z.literal('disposition'),
    data: dispositionDataSchema,
  }),
]);

// ---------------------------------------------------------------------------
// POST — Dispatch a dialer action
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(
  async (request: NextRequest, { session }) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiError('Invalid JSON body', 'INVALID_BODY', { status: 400 });
    }

    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        parsed.error.errors[0]?.message || 'Invalid action',
        'VALIDATION_ERROR',
        { status: 400 }
      );
    }

    const agentUserId = session.user.id as string;

    // Verify an active session exists for actions that require one
    const currentSession = getSessionState(agentUserId);
    const requiresSession = ['pause', 'resume', 'stop', 'disposition', 'skip'];
    if (requiresSession.includes(parsed.data.action) && !currentSession) {
      return apiError(
        'No active dialer session found',
        'NO_ACTIVE_SESSION',
        { status: 409 }
      );
    }

    switch (parsed.data.action) {
      case 'pause': {
        pauseSession(agentUserId);
        return apiSuccess({ action: 'pause', state: 'PAUSED' });
      }

      case 'resume': {
        await resumeSession(agentUserId);
        return apiSuccess({ action: 'resume', state: 'IDLE' });
      }

      case 'stop': {
        await stopSession(agentUserId);
        return apiSuccess({ action: 'stop', state: 'IDLE' });
      }

      case 'disposition': {
        const result = await submitDisposition(agentUserId, parsed.data.data);
        if (result.status === 'no_active_call') {
          return apiError(
            'No active call to disposition',
            'NO_ACTIVE_CALL',
            { status: 409 }
          );
        }
        return apiSuccess({ action: 'disposition', result });
      }

      case 'skip': {
        // "Skip" = stop current call cleanly, then let the engine dial next.
        // If in WRAP_UP or CONNECTED state, we call stopSession which hangs up
        // and cleans state, then re-start. However the cleaner approach is to
        // submit a dummy disposition that moves the engine forward without
        // recording a meaningful outcome.
        const state = currentSession?.state;

        if (state === 'RINGING' || state === 'DIALING' || state === 'CONNECTED') {
          // Stop the current call without saving a disposition; the engine
          // will advance automatically via dialNextContact after stop.
          // We use submitDisposition with NO_ANSWER to cleanly mark and advance.
          const skipResult = await submitDisposition(agentUserId, {
            type: 'NO_ANSWER',
            notes: 'Skipped by agent',
          });
          if (skipResult.status === 'no_active_call') {
            // Session may have already advanced; that's fine.
          }
        } else if (state === 'WRAP_UP') {
          // Already in wrap-up — advance without recording a disposition
          const skipResult = await submitDisposition(agentUserId, {
            type: 'NO_ANSWER',
            notes: 'Skipped by agent',
          });
          if (skipResult.status === 'no_active_call') {
            // Already advanced — ignore
          }
        }
        // For IDLE or PAUSED states, skip is a no-op (engine advances on next dial)

        return apiSuccess({ action: 'skip', state: 'IDLE' });
      }
    }
  }, { requiredPermission: 'crm.leads.edit' });
