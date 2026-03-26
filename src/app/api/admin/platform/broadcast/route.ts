/**
 * API: /api/admin/platform/broadcast
 * Super-admin only — Broadcast notifications to multiple tenants.
 * POST: Send notification to all matching tenants + email to owners.
 * GET: List past broadcasts (notifications created by super-admin without specific tenant filter).
 */

export const dynamic = 'force-dynamic';

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email';

function isSuperAdmin(session: { user: { role?: string; tenantId?: string } }): boolean {
  return session.user.role === 'OWNER' && session.user.tenantId === process.env.PLATFORM_TENANT_ID;
}

/** Escape HTML special characters to prevent XSS in email templates (P1-34 fix) */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// POST — Broadcast notification to multiple tenants
// ---------------------------------------------------------------------------

const broadcastSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  type: z.enum(['info', 'warning', 'urgent']).default('info'),
  filter: z.object({
    plan: z.array(z.string()).optional(),
    status: z.array(z.string()).optional(),
  }).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Super-admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = broadcastSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 400 });
    }

    const { title, message, type, filter } = parsed.data;

    // Build where clause from filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (filter?.plan && filter.plan.length > 0) {
      where.plan = { in: filter.plan };
    }
    if (filter?.status && filter.status.length > 0) {
      where.status = { in: filter.status };
    }

    // Exclude the platform tenant itself
    if (process.env.PLATFORM_TENANT_ID) {
      where.id = { not: process.env.PLATFORM_TENANT_ID };
    }

    // Find matching tenants with their owners
    const tenants = await prisma.tenant.findMany({
      where,
      select: {
        id: true,
        name: true,
        ownerUserId: true,
      },
    });

    // Batch-load all owners to avoid N+1 queries (P1-10 fix)
    const ownerIds = tenants.map(t => t.ownerUserId).filter((id): id is string => Boolean(id));
    const owners = await prisma.user.findMany({
      where: { id: { in: ownerIds } },
      select: { id: true, email: true, name: true },
    });
    const ownerMap = new Map(owners.map(o => [o.id, o]));

    let sent = 0;
    let failed = 0;

    // Process tenants in batches of 5
    const batchSize = 5;
    for (let i = 0; i < tenants.length; i += batchSize) {
      const batch = tenants.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (tenant) => {
          // Create notification in DB
          await prisma.tenantNotification.create({
            data: {
              tenantId: tenant.id,
              title,
              message,
              type,
              createdBy: session.user.email || 'super-admin',
            },
          });

          // Log event
          await prisma.tenantEvent.create({
            data: {
              tenantId: tenant.id,
              type: 'NOTIFICATION_SENT',
              actor: session.user.email || 'super-admin',
              details: { title, type, broadcast: true },
            },
          });

          // Send email to owner (from pre-loaded ownerMap)
          if (tenant.ownerUserId) {
            const owner = ownerMap.get(tenant.ownerUserId);
            if (owner?.email) {
              const typeLabel = type === 'urgent' ? 'URGENT' : type === 'warning' ? 'Avertissement' : 'Information';
              await sendEmail({
                to: { email: owner.email, name: owner.name || undefined },
                subject: `[Koraline] ${title}`,
                html: `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #6366f1 0%, #818cf8 100%); padding: 24px; border-radius: 12px 12px 0 0;">
                      <h1 style="color: white; margin: 0; font-size: 20px;">Koraline</h1>
                    </div>
                    <div style="background: #1a1a2e; padding: 24px; border-radius: 0 0 12px 12px; color: #e2e8f0;">
                      <div style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px; ${
                        type === 'urgent'
                          ? 'background: rgba(244,63,94,0.15); color: #fb7185;'
                          : type === 'warning'
                          ? 'background: rgba(245,158,11,0.15); color: #fbbf24;'
                          : 'background: rgba(59,130,246,0.15); color: #60a5fa;'
                      }">${typeLabel}</div>
                      <h2 style="color: #f1f5f9; margin: 0 0 12px 0; font-size: 18px;">${escapeHtml(title)}</h2>
                      <p style="color: #94a3b8; margin: 0; line-height: 1.6;">${escapeHtml(message)}</p>
                      <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0;" />
                      <p style="color: #64748b; font-size: 12px; margin: 0;">Ce message a ete envoye par Koraline pour ${tenant.name}.</p>
                    </div>
                  </div>
                `,
                emailType: 'transactional',
              });
            }
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') sent++;
        else {
          failed++;
          logger.error('Broadcast to tenant failed', {
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      }
    }

    logger.info('Broadcast completed', { sent, failed, total: tenants.length });

    return NextResponse.json({ sent, failed, total: tenants.length }, { status: 201 });
  } catch (error) {
    logger.error('Broadcast failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// GET — Count tenants that would be affected by a broadcast filter
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest, { session }) => {
  if (!isSuperAdmin(session)) {
    return NextResponse.json({ error: 'Super-admin access required' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const plans = url.searchParams.get('plans')?.split(',').filter(Boolean) || [];
    const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    if (plans.length > 0) where.plan = { in: plans };
    if (statuses.length > 0) where.status = { in: statuses };
    if (process.env.PLATFORM_TENANT_ID) {
      where.id = { not: process.env.PLATFORM_TENANT_ID };
    }

    const count = await prisma.tenant.count({ where });

    return NextResponse.json({ count });
  } catch (error) {
    logger.error('Failed to count broadcast targets', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { skipCsrf: true });
