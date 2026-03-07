export const dynamic = 'force-dynamic';

/**
 * VoIP Softphone Failure Alert API
 * POST /api/admin/voip/alert-failure
 *
 * When a softphone line fails to auto-initialize on session start,
 * this endpoint sends an email alert to all OWNER users.
 * Rate-limited to 1 alert per user per 30 minutes to prevent spam.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

const alertSchema = z.object({
  errorMessage: z.string().max(1000),
  checks: z.record(z.object({
    ok: z.boolean(),
    detail: z.string().optional(),
  })).optional(),
});

// In-memory rate limit: userId -> last alert timestamp
const alertCooldown = new Map<string, number>();
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  // Rate limit check
  const lastAlert = alertCooldown.get(session.user.id);
  if (lastAlert && Date.now() - lastAlert < COOLDOWN_MS) {
    const remainingMin = Math.ceil((COOLDOWN_MS - (Date.now() - lastAlert)) / 60000);
    return NextResponse.json({
      sent: false,
      reason: `Alert cooldown active. Next alert allowed in ${remainingMin} min.`,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = alertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  try {
    // Get all OWNER users
    const owners = await prisma.user.findMany({
      where: { role: 'OWNER' },
      select: { id: true, email: true, name: true },
    });

    if (owners.length === 0) {
      return NextResponse.json({ sent: false, reason: 'No owners found' });
    }

    // Get the failing user's info
    const failingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, role: true },
    });

    const userName = failingUser?.name || failingUser?.email || session.user.id;
    const userRole = failingUser?.role || 'UNKNOWN';
    const errorMessage = parsed.data.errorMessage;
    const timestamp = new Date().toLocaleString('fr-CA', { timeZone: 'America/Montreal' });

    // Build checks summary
    let checksHtml = '';
    if (parsed.data.checks) {
      checksHtml = '<table style="border-collapse:collapse;margin:12px 0;font-size:14px;">';
      for (const [name, check] of Object.entries(parsed.data.checks)) {
        const icon = check.ok ? '&#9989;' : '&#10060;';
        checksHtml += `<tr><td style="padding:4px 12px 4px 0;">${icon} <strong>${name}</strong></td><td style="padding:4px 0;color:#666;">${check.detail || (check.ok ? 'OK' : 'Failed')}</td></tr>`;
      }
      checksHtml += '</table>';
    }

    // Build email HTML
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#dc2626;color:white;padding:16px 24px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0;font-size:18px;">&#9888; Alerte Softphone - Ligne non initialis&eacute;e</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px;">
    <p style="margin:0 0 16px;font-size:15px;">
      La ligne t&eacute;l&eacute;phonique de <strong>${userName}</strong> (${userRole}) n'a pas pu &ecirc;tre initialis&eacute;e automatiquement lors de sa connexion.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 16px;margin:0 0 16px;">
      <strong style="color:#dc2626;">Erreur:</strong>
      <p style="margin:4px 0 0;color:#991b1b;">${errorMessage}</p>
    </div>
    ${checksHtml ? `<div style="margin:0 0 16px;"><strong>D&eacute;tail des v&eacute;rifications:</strong>${checksHtml}</div>` : ''}
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
      <strong>Date:</strong> ${timestamp}<br>
      <strong>Utilisateur:</strong> ${failingUser?.email || session.user.id}
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      V&eacute;rifiez la configuration dans Administration &gt; T&eacute;l&eacute;phonie &gt; Extensions.
      Cette alerte est limit&eacute;e &agrave; 1 par utilisateur toutes les 30 minutes.
    </p>
  </div>
</body>
</html>`;

    // Send email to each owner using the email service
    let sentCount = 0;
    try {
      const { sendEmail } = await import('@/lib/email/email-service');
      const results = await Promise.allSettled(
        owners.map((owner) =>
          sendEmail({
            to: { email: owner.email!, name: owner.name || undefined },
            subject: `[ALERTE] Softphone - Ligne non initialisée pour ${userName}`,
            html,
          })
        )
      );
      sentCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    } catch (emailErr) {
      console.error('[VoIP Alert] Email sending failed:', emailErr);
    }

    // Update cooldown
    alertCooldown.set(session.user.id, Date.now());

    return NextResponse.json({
      sent: true,
      recipientCount: owners.length,
      sentCount,
    });
  } catch (error) {
    console.error('[VoIP Alert] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send alert' },
      { status: 500 }
    );
  }
}, { skipCsrf: true });
