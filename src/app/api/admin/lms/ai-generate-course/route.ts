export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { generateCourseFromDocument } from '@/lib/lms/ai-course-generator';

const generateSchema = z.object({
  documentText: z.string().min(100, 'Document must have at least 100 characters'),
  domain: z.string().optional(),
  targetAudience: z.string().optional(),
  maxChapters: z.number().int().min(1).max(20).optional(),
  language: z.enum(['fr', 'en']).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = generateSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(parsed.error.message, ErrorCode.VALIDATION_ERROR, { request });
  }

  try {
    const outline = await generateCourseFromDocument(parsed.data.documentText, {
      language: parsed.data.language,
      domain: parsed.data.domain,
      targetAudience: parsed.data.targetAudience,
      maxChapters: parsed.data.maxChapters,
    });

    return apiSuccess(outline, { request });
  } catch (err) {
    return apiError(`Generation failed: ${(err as Error).message}`, ErrorCode.INTERNAL_ERROR, { request, status: 500 });
  }
});
