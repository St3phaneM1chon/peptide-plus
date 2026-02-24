export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { stripHtml, isValidPhone, isValidName } from '@/lib/validation';
import { validateCsrf } from '@/lib/csrf-middleware';
import { apiSuccess, apiError, validateContentType } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { updateProfileSchema } from '@/lib/validations/user';
import { logger } from '@/lib/logger';

// Status codes: 200 OK, 401 Unauthorized, 404 Not Found, 500 Internal Error
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return apiError('Unauthorized', ErrorCode.UNAUTHORIZED);
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { name: true, email: true, phone: true },
    });

    if (!user) {
      return apiError('User not found', ErrorCode.NOT_FOUND);
    }

    return apiSuccess({ user });
  } catch (error) {
    logger.error('Error fetching profile', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to fetch profile', ErrorCode.INTERNAL_ERROR);
  }
}

// Status codes: 200 OK, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 415 Unsupported Media Type, 500 Internal Error
export async function PUT(request: NextRequest) {
  try {
    // Item 12: Content-Type validation
    const ctError = validateContentType(request);
    if (ctError) return ctError;

    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return apiError('Invalid CSRF token', ErrorCode.CSRF_INVALID, { request });
    }

    const session = await auth();

    if (!session?.user?.email) {
      return apiError('Unauthorized', ErrorCode.UNAUTHORIZED, { request });
    }

    const body = await request.json();

    // Item 17: Zod validation (includes E.164 phone validation from Item 20)
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        validation.error.errors[0]?.message || 'Invalid profile data',
        ErrorCode.VALIDATION_ERROR,
        { details: validation.error.errors.map(e => ({ path: e.path.join('.'), message: e.message })), request }
      );
    }

    const rawName = body.name;
    const rawPhone = body.phone;

    // SECURITY FIX (BE-SEC-05): Validate and sanitize profile fields
    // Strip HTML from name to prevent stored XSS
    const name = rawName !== undefined ? stripHtml(String(rawName)).trim() : undefined;
    const phone = rawPhone !== undefined ? (rawPhone ? String(rawPhone).trim() : null) : undefined;

    if (name !== undefined) {
      if (!name || !isValidName(name, 2, 100)) {
        return apiError('Name must be 2-100 characters, letters/spaces/hyphens/apostrophes only', ErrorCode.VALIDATION_ERROR, { request });
      }
    }

    if (phone !== undefined && phone !== null) {
      if (!isValidPhone(phone)) {
        return apiError('Invalid phone number format', ErrorCode.VALIDATION_ERROR, { request });
      }
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    const updatedUser = await db.user.update({
      where: { email: session.user.email },
      data: updateData,
    });

    return apiSuccess({
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        phone: updatedUser.phone,
      },
    }, { request });
  } catch (error) {
    logger.error('Error updating profile', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Failed to update profile', ErrorCode.INTERNAL_ERROR, { request });
  }
}
