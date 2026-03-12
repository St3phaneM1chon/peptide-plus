export const dynamic = 'force-dynamic';

/**
 * Admin VoIP Post-Call Survey Configuration
 *
 * GET    /api/admin/voip/surveys — List survey configurations
 * POST   /api/admin/voip/surveys — Create a new survey config
 * PUT    /api/admin/voip/surveys — Update an existing survey config
 * DELETE /api/admin/voip/surveys — Deactivate a survey config
 *
 * Note: Survey configs are stored as JSON in a VoipSetting record
 * since there is no dedicated SurveyConfig model in the Prisma schema.
 * The CallSurvey model stores individual survey responses per call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  createSurveyTemplate,
  validateSurveyQuestions,
  getDefaultSurveyTemplates,
  type SurveyQuestion as PostCallSurveyQuestion,
} from '@/lib/voip/post-call-survey';

interface SurveyQuestion {
  text: string;
  type: 'rating' | 'yes_no' | 'open_text' | 'dtmf';
}

interface SurveyConfig {
  id: string;
  name: string;
  questions: SurveyQuestion[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const SURVEY_CONFIG_KEY = 'voip:survey_configs';

/**
 * Load survey configs from SiteSetting JSON store.
 */
async function loadSurveyConfigs(): Promise<SurveyConfig[]> {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: SURVEY_CONFIG_KEY },
  });
  if (!setting?.value) return getDefaultSurveyConfigs();

  try {
    const parsed = JSON.parse(setting.value);
    return Array.isArray(parsed) ? parsed : getDefaultSurveyConfigs();
  } catch {
    return getDefaultSurveyConfigs();
  }
}

/**
 * Save survey configs to SiteSetting JSON store.
 */
async function saveSurveyConfigs(configs: SurveyConfig[]): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: SURVEY_CONFIG_KEY },
    create: {
      key: SURVEY_CONFIG_KEY,
      value: JSON.stringify(configs),
      type: 'json',
      module: 'voip',
      description: 'Post-call survey configurations',
    },
    update: {
      value: JSON.stringify(configs),
    },
  });
}

/**
 * Return reasonable default survey configurations.
 * Delegates to the post-call-survey lib for consistent defaults.
 */
function getDefaultSurveyConfigs(): SurveyConfig[] {
  return getDefaultSurveyTemplates() as SurveyConfig[];
}

/**
 * GET - List all survey configurations.
 */
export const GET = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let configs = await loadSurveyConfigs();

    if (activeOnly) {
      configs = configs.filter((c) => c.isActive);
    }

    return NextResponse.json({ data: configs });
  } catch (error) {
    logger.error('[VoIP Surveys] Failed to list survey configs', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to list survey configs' }, { status: 500 });
  }
});

const surveyQuestionSchema = z.object({
  text: z.string().min(1).max(500).trim(),
  type: z.enum(['rating', 'yes_no', 'open_text', 'dtmf']),
});

const createSurveySchema = z.object({
  name: z.string().min(1).max(200).trim(),
  questions: z.array(surveyQuestionSchema).min(1).max(20),
  isActive: z.boolean().optional(),
});

const updateSurveySchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200).trim().optional(),
  questions: z.array(surveyQuestionSchema).min(1).max(20).optional(),
  isActive: z.boolean().optional(),
});

/**
 * POST - Create a new survey configuration.
 */
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = createSurveySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { name, questions, isActive } = parsed.data;

    // Validate questions using post-call-survey lib
    const validationErrors = validateSurveyQuestions(questions as PostCallSurveyQuestion[]);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: validationErrors.join('; ') },
        { status: 400 }
      );
    }

    const configs = await loadSurveyConfigs();

    // Create template using post-call-survey lib
    const template = createSurveyTemplate(name, questions, isActive !== false);
    const newConfig: SurveyConfig = template as SurveyConfig;

    configs.push(newConfig);
    await saveSurveyConfigs(configs);

    return NextResponse.json({ data: newConfig }, { status: 201 });
  } catch (error) {
    logger.error('[VoIP Surveys] Failed to create survey config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create survey config' }, { status: 500 });
  }
});

/**
 * PUT - Update an existing survey configuration.
 */
export const PUT = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const parsed = updateSurveySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { id, name, questions, isActive } = parsed.data;

    const configs = await loadSurveyConfigs();
    const idx = configs.findIndex((c) => c.id === id);

    if (idx === -1) {
      return NextResponse.json(
        { error: 'Survey config not found' },
        { status: 404 }
      );
    }

    if (name !== undefined) configs[idx].name = name;
    if (questions !== undefined) configs[idx].questions = questions;
    if (isActive !== undefined) configs[idx].isActive = isActive;
    configs[idx].updatedAt = new Date().toISOString();

    await saveSurveyConfigs(configs);

    return NextResponse.json({ data: configs[idx] });
  } catch (error) {
    logger.error('[VoIP Surveys] Failed to update survey config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update survey config' }, { status: 500 });
  }
});

/**
 * DELETE - Deactivate a survey configuration (soft delete).
 */
export const DELETE = withAdminGuard(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 }
      );
    }

    const configs = await loadSurveyConfigs();
    const idx = configs.findIndex((c) => c.id === id);

    if (idx === -1) {
      return NextResponse.json(
        { error: 'Survey config not found' },
        { status: 404 }
      );
    }

    configs[idx].isActive = false;
    configs[idx].updatedAt = new Date().toISOString();

    await saveSurveyConfigs(configs);

    return NextResponse.json({ data: configs[idx] });
  } catch (error) {
    logger.error('[VoIP Surveys] Failed to deactivate survey config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to deactivate survey config' }, { status: 500 });
  }
});
