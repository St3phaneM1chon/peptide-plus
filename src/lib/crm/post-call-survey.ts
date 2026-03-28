/**
 * CRM Post-Call Survey - C39/D17
 *
 * Post-call CSAT surveys delivered via IVR (DTMF) or SMS.
 * After a call ends, the system can trigger a short satisfaction survey
 * to gather customer feedback. Results are stored in the CallSurvey model.
 *
 * Functions:
 * - triggerPostCallSurvey: Initiate a survey after a call ends
 * - handleSurveyIvrInput: Process DTMF input from an IVR survey
 * - handleSurveySmsReply: Process SMS reply to a survey
 * - getSurveyResults: Aggregate survey results for a campaign
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { telnyxFetch, getTelnyxConnectionId, getDefaultCallerId } from '@/lib/telnyx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SurveyMethod = 'ivr' | 'sms';

interface SurveyTriggerResult {
  triggered: boolean;
  method: SurveyMethod;
  callLogId: string;
  reason?: string;
}

interface SurveyAggregation {
  totalSurveys: number;
  completedSurveys: number;
  responseRate: number;        // 0-100
  averageOverallScore: number; // 1-5
  averageResolvedScore: number; // 1-5
  distribution: Record<number, number>; // score -> count
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** IVR survey prompt messages by language */
const SURVEY_PROMPTS: Record<string, string> = {
  fr: 'Merci pour votre appel. Sur une echelle de 1 a 5, comment evaluez-vous le service recu? Appuyez sur le chiffre correspondant.',
  en: 'Thank you for your call. On a scale of 1 to 5, how would you rate the service you received? Press the corresponding number.',
  es: 'Gracias por su llamada. En una escala del 1 al 5, como calificaria el servicio recibido? Presione el numero correspondiente.',
};

/** SMS survey message templates by language */
const SMS_TEMPLATES: Record<string, string> = {
  fr: 'Merci pour votre appel avec Attitudes VIP. Comment evaluez-vous le service? Repondez avec un chiffre de 1 (insatisfait) a 5 (excellent).',
  en: 'Thank you for calling Attitudes VIP. How would you rate our service? Reply with a number from 1 (poor) to 5 (excellent).',
  es: 'Gracias por llamar a Attitudes VIP. Como califica nuestro servicio? Responda con un numero del 1 (malo) al 5 (excelente).',
};

// ---------------------------------------------------------------------------
// In-memory pending survey tracker
// Maps callControlId or phone to callLogId for IVR/SMS reply correlation.
// In production, this should be backed by Redis.
// ---------------------------------------------------------------------------

const pendingSurveys = new Map<string, { callLogId: string; method: SurveyMethod }>();

// ---------------------------------------------------------------------------
// triggerPostCallSurvey
// ---------------------------------------------------------------------------

/**
 * Trigger a post-call satisfaction survey.
 *
 * For IVR: Places an outbound call and plays the survey prompt.
 * For SMS: Sends an SMS with the survey question.
 *
 * @param callLogId - The completed call's log ID
 * @param method - Survey delivery method: 'ivr' or 'sms'
 * @param language - Language for the survey prompt (default: 'fr')
 * @returns Result indicating whether the survey was triggered
 */
export async function triggerPostCallSurvey(
  callLogId: string,
  method: SurveyMethod = 'sms',
  language: string = 'fr'
): Promise<SurveyTriggerResult> {
  // Get the call details
  const callLog = await prisma.callLog.findUnique({
    where: { id: callLogId },
    select: {
      id: true,
      callerNumber: true,
      calledNumber: true,
      direction: true,
      status: true,
      clientId: true,
    },
  });

  if (!callLog) {
    return { triggered: false, method, callLogId, reason: 'Call log not found' };
  }

  if (callLog.status !== 'COMPLETED') {
    return { triggered: false, method, callLogId, reason: `Call not completed (${callLog.status})` };
  }

  // Determine the customer's phone number
  const customerPhone = callLog.direction === 'INBOUND'
    ? callLog.callerNumber
    : callLog.calledNumber;

  // Check if a survey already exists for this call
  const existing = await prisma.callSurvey.findUnique({
    where: { callLogId },
    select: { id: true },
  });

  if (existing) {
    return { triggered: false, method, callLogId, reason: 'Survey already exists' };
  }

  // Create pending survey record
  await prisma.callSurvey.create({
    data: {
      callLogId,
      method,
    },
  });

  const lang = language.split('-')[0].toLowerCase();

  if (method === 'ivr') {
    await triggerIvrSurvey(callLogId, customerPhone, lang);
  } else {
    await triggerSmsSurvey(callLogId, customerPhone, lang);
  }

  logger.info('Post-call survey: triggered', {
    event: 'survey_triggered',
    callLogId,
    method,
    customerPhone,
    language: lang,
  });

  return { triggered: true, method, callLogId };
}

// ---------------------------------------------------------------------------
// triggerIvrSurvey (internal)
// ---------------------------------------------------------------------------

async function triggerIvrSurvey(
  callLogId: string,
  phone: string,
  lang: string
): Promise<void> {
  const connectionId = getTelnyxConnectionId();
  const callerId = getDefaultCallerId();
  const prompt = SURVEY_PROMPTS[lang] ?? SURVEY_PROMPTS['fr'];

  const result = await telnyxFetch<{ call_control_id: string }>('/calls', {
    method: 'POST',
    body: {
      to: phone,
      from: callerId,
      connection_id: connectionId,
      timeout_secs: 20,
      client_state: Buffer.from(JSON.stringify({ type: 'survey', callLogId })).toString('base64'),
    },
  });

  const callControlId = result.data.call_control_id;

  // Track for DTMF correlation
  pendingSurveys.set(callControlId, { callLogId, method: 'ivr' });

  // After the call is answered, the webhook handler should call gather_using_speak
  // with the survey prompt. We store the prompt info for the webhook to use.
  logger.debug('Post-call survey: IVR call placed', {
    event: 'survey_ivr_dialed',
    callLogId,
    callControlId,
    phone,
    prompt: prompt.slice(0, 50),
  });
}

// ---------------------------------------------------------------------------
// triggerSmsSurvey (internal)
// ---------------------------------------------------------------------------

async function triggerSmsSurvey(
  callLogId: string,
  phone: string,
  lang: string
): Promise<void> {
  const callerId = getDefaultCallerId();
  const message = SMS_TEMPLATES[lang] ?? SMS_TEMPLATES['fr'];

  await telnyxFetch('/messages', {
    method: 'POST',
    body: {
      to: phone,
      from: callerId,
      text: message,
      type: 'SMS',
    },
  });

  // Track for SMS reply correlation
  pendingSurveys.set(phone, { callLogId, method: 'sms' });

  logger.debug('Post-call survey: SMS sent', {
    event: 'survey_sms_sent',
    callLogId,
    phone,
  });
}

// ---------------------------------------------------------------------------
// handleSurveyIvrInput
// ---------------------------------------------------------------------------

/**
 * Process DTMF input from an IVR survey call.
 *
 * Expected input: digit 1-5 representing the satisfaction score.
 *
 * @param callControlId - The Telnyx call control ID of the survey call
 * @param digit - The DTMF digit pressed by the caller
 */
export async function handleSurveyIvrInput(
  callControlId: string,
  digit: string
): Promise<void> {
  const pending = pendingSurveys.get(callControlId);

  if (!pending) {
    logger.warn('Post-call survey: IVR input for unknown survey', {
      event: 'survey_ivr_unknown',
      callControlId,
      digit,
    });
    return;
  }

  const score = parseInt(digit, 10);

  if (isNaN(score) || score < 1 || score > 5) {
    logger.warn('Post-call survey: invalid IVR score', {
      event: 'survey_ivr_invalid',
      callLogId: pending.callLogId,
      digit,
    });
    return;
  }

  await prisma.callSurvey.update({
    where: { callLogId: pending.callLogId },
    data: {
      overallScore: score,
      completedAt: new Date(),
    },
  });

  pendingSurveys.delete(callControlId);

  logger.info('Post-call survey: IVR response recorded', {
    event: 'survey_ivr_completed',
    callLogId: pending.callLogId,
    score,
  });
}

// ---------------------------------------------------------------------------
// handleSurveySmsReply
// ---------------------------------------------------------------------------

/**
 * Process an SMS reply to a survey.
 *
 * Expected reply: a number 1-5 representing the satisfaction score.
 *
 * @param phone - The phone number that replied
 * @param text - The SMS reply text
 */
export async function handleSurveySmsReply(
  phone: string,
  text: string
): Promise<void> {
  const pending = pendingSurveys.get(phone);

  if (!pending) {
    logger.debug('Post-call survey: SMS reply for unknown survey', {
      event: 'survey_sms_unknown',
      phone,
      text: text.slice(0, 50),
    });
    return;
  }

  // Extract a number 1-5 from the reply
  const match = text.trim().match(/^[1-5]$/);
  const score = match ? parseInt(match[0], 10) : null;

  if (score === null) {
    logger.warn('Post-call survey: invalid SMS score', {
      event: 'survey_sms_invalid',
      callLogId: pending.callLogId,
      phone,
      text: text.slice(0, 50),
    });
    return;
  }

  await prisma.callSurvey.update({
    where: { callLogId: pending.callLogId },
    data: {
      overallScore: score,
      method: 'sms',
      completedAt: new Date(),
    },
  });

  pendingSurveys.delete(phone);

  logger.info('Post-call survey: SMS response recorded', {
    event: 'survey_sms_completed',
    callLogId: pending.callLogId,
    phone,
    score,
  });
}

// ---------------------------------------------------------------------------
// getSurveyResults
// ---------------------------------------------------------------------------

/**
 * Get aggregated survey results, optionally filtered by date range.
 *
 * @param options - Filter options (startDate, endDate)
 * @returns Aggregated survey statistics
 */
export async function getSurveyResults(options?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<SurveyAggregation> {
  const where: Record<string, unknown> = {};

  if (options?.startDate || options?.endDate) {
    where.createdAt = {};
    if (options?.startDate) {
      (where.createdAt as Record<string, Date>).gte = options.startDate;
    }
    if (options?.endDate) {
      (where.createdAt as Record<string, Date>).lte = options.endDate;
    }
  }

  const surveys = await prisma.callSurvey.findMany({
    where,
    select: {
      overallScore: true,
      resolvedScore: true,
      completedAt: true,
    },
  });

  const totalSurveys = surveys.length;
  const completedSurveys = surveys.filter((s) => s.completedAt !== null).length;
  const responseRate = totalSurveys > 0
    ? Math.round((completedSurveys / totalSurveys) * 100)
    : 0;

  const scored = surveys.filter((s) => s.overallScore !== null);
  const averageOverallScore = scored.length > 0
    ? Math.round(
        (scored.reduce((sum, s) => sum + (s.overallScore ?? 0), 0) / scored.length) * 10
      ) / 10
    : 0;

  const resolved = surveys.filter((s) => s.resolvedScore !== null);
  const averageResolvedScore = resolved.length > 0
    ? Math.round(
        (resolved.reduce((sum, s) => sum + (s.resolvedScore ?? 0), 0) / resolved.length) * 10
      ) / 10
    : 0;

  // Build score distribution
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const s of scored) {
    if (s.overallScore && s.overallScore >= 1 && s.overallScore <= 5) {
      distribution[s.overallScore]++;
    }
  }

  logger.debug('Post-call survey: results aggregated', {
    event: 'survey_results',
    totalSurveys,
    completedSurveys,
    responseRate: `${responseRate}%`,
    averageOverallScore,
  });

  return {
    totalSurveys,
    completedSurveys,
    responseRate,
    averageOverallScore,
    averageResolvedScore,
    distribution,
  };
}
