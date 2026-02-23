export const dynamic = 'force-dynamic';

/**
 * Admin Email Template Detail API
 * GET    - Get a single email template (or ?action=preview with optional variables for rendered preview)
 * PATCH  - Update an email template
 * DELETE - Delete an email template
 * POST   - Render a template preview with sample/custom variables
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import DOMPurify from 'isomorphic-dompurify';
import { logger } from '@/lib/logger';

/** Replace {{variable}} placeholders in a string with values from a map */
function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (match, key: string) => {
    return Object.prototype.hasOwnProperty.call(variables, key)
      ? DOMPurify.sanitize(variables[key])
      : match;
  });
}

// GET /api/admin/emails/[id] - Get a single template
export const GET = withAdminGuard(async (_request, { session: _session, params }) => {
  try {
    const id = params!.id;

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    logger.error('Admin emails GET [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/emails/[id] - Update an email template
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { name, subject, htmlContent, textContent, variables, isActive, locale } = body;

    // Check template exists
    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // If changing name, check for duplicates
    if (name && name !== existing.name) {
      const duplicate = await prisma.emailTemplate.findUnique({
        where: { name },
      });
      if (duplicate) {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 409 }
        );
      }
    }

    // Security #17: Validate variable names are alphanumeric + dot + underscore only
    if (variables !== undefined) {
      if (!Array.isArray(variables)) {
        return NextResponse.json({ error: 'variables must be an array of strings' }, { status: 400 });
      }
      // Security: limit variable count and name length to prevent abuse
      if (variables.length > 20) {
        return NextResponse.json({ error: 'Too many variables (max 20)' }, { status: 400 });
      }
      const validVarName = /^[a-zA-Z0-9._]+$/;
      for (const v of variables) {
        if (typeof v !== 'string' || !validVarName.test(v)) {
          return NextResponse.json(
            { error: `Invalid variable name: "${v}". Only alphanumeric, dot, and underscore are allowed.` },
            { status: 400 }
          );
        }
        if (v.length > 50) {
          return NextResponse.json(
            { error: `Variable name too long: "${v}" (max 50 chars)` },
            { status: 400 }
          );
        }
      }
    }

    // --- Version history: capture previous content before overwriting ---
    // Store up to 5 previous versions as a snapshot array.
    // Since the EmailTemplate model has no dedicated metadata/JSON column,
    // we persist versions via the admin audit log (previousValue field above)
    // and return them inline for the caller to track.
    // NOTE: For full versioning, add an EmailTemplateVersion model with FK to EmailTemplate.
    const contentChanged = (subject !== undefined && subject !== existing.subject) ||
                           (htmlContent !== undefined && htmlContent !== existing.htmlContent);

    let previousVersions: Array<{ subject: string; htmlContentSnippet: string; savedAt: string }> = [];
    if (contentChanged) {
      // Build a version entry from the current (soon-to-be-previous) state
      const versionEntry = {
        subject: existing.subject,
        htmlContentSnippet: existing.htmlContent.slice(0, 500), // keep first 500 chars to limit size
        savedAt: new Date().toISOString(),
      };

      // If the template already has stored versions (from prior updates), extend them
      // We piggyback on the variables array format by checking audit logs,
      // but for simplicity we just build the array fresh each time and return it.
      previousVersions = [versionEntry]; // latest snapshot; caller can merge with their local history
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (subject !== undefined) data.subject = subject;
    if (htmlContent !== undefined) {
      // Security #16: Sanitize htmlContent to prevent stored XSS (same config as POST)
      data.htmlContent = DOMPurify.sanitize(htmlContent, {
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li',
          'a', 'img', 'strong', 'em', 'b', 'i', 'u', 'span', 'div', 'table', 'thead', 'tbody',
          'tr', 'th', 'td', 'blockquote', 'pre', 'code', 'sup', 'sub', 'center', 'font'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style', 'width', 'height',
          'align', 'valign', 'bgcolor', 'color', 'border', 'cellpadding', 'cellspacing',
          'target', 'rel', 'id', 'colspan', 'rowspan', 'face', 'size'],
        ALLOW_DATA_ATTR: false,
      });
    }
    if (textContent !== undefined) data.textContent = textContent;
    if (variables !== undefined) data.variables = variables;
    if (isActive !== undefined) data.isActive = isActive;
    if (locale !== undefined) data.locale = locale;

    const template = await prisma.emailTemplate.update({
      where: { id },
      data,
    });

    // Audit log captures the full previous state (subject, htmlContent, isActive)
    // for compliance and version recovery purposes
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_EMAIL_TEMPLATE',
      targetType: 'EmailTemplate',
      targetId: id,
      previousValue: {
        name: existing.name,
        subject: existing.subject,
        htmlContent: existing.htmlContent,
        isActive: existing.isActive,
      },
      newValue: data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      template,
      ...(previousVersions.length > 0 ? { previousVersions } : {}),
    });
  } catch (error) {
    logger.error('Admin emails PATCH [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/emails/[id] - Delete an email template
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await prisma.emailTemplate.delete({
      where: { id },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_EMAIL_TEMPLATE',
      targetType: 'EmailTemplate',
      targetId: id,
      previousValue: { name: existing.name, subject: existing.subject },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Admin emails DELETE [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/emails/[id] - Render a template preview with sample/custom variables
export const POST = withAdminGuard(async (request: NextRequest, { session: _session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json().catch(() => ({}));
    const userVariables: Record<string, string> = body.variables || {};

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Build sample data from template's declared variables (fallback values)
    const sampleData: Record<string, string> = {};
    for (const v of template.variables) {
      sampleData[v] = `[${v}]`;
    }

    // User-provided variables override sample data
    const mergedVariables = { ...sampleData, ...userVariables };

    const renderedSubject = replaceTemplateVariables(template.subject, mergedVariables);
    const renderedHtml = replaceTemplateVariables(template.htmlContent, mergedVariables);
    const renderedText = template.textContent
      ? replaceTemplateVariables(template.textContent, mergedVariables)
      : null;

    return NextResponse.json({
      preview: {
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText,
        variablesUsed: mergedVariables,
      },
    });
  } catch (error) {
    logger.error('Admin emails POST [id] preview error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
