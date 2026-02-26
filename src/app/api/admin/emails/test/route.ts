export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email/email-service';

export const POST = withAdminGuard(async (request: NextRequest, { session }: { session: { user?: { email?: string | null } } }) => {
  const body = await request.json().catch(() => ({}));
  const testEmail = body.testEmail || session.user?.email;

  if (!testEmail) {
    return NextResponse.json({ error: 'No email address available' }, { status: 400 });
  }

  const result = await sendEmail({
    to: { email: testEmail },
    subject: 'BioCycle Peptides - Test de connexion email',
    html: '<h2>Configuration email r\u00e9ussie!</h2><p>Si vous recevez ce message, votre syst\u00e8me email fonctionne correctement.</p>',
    tags: ['admin-test'],
  });

  if (result.success) {
    return NextResponse.json({ success: true, messageId: result.messageId });
  }
  return NextResponse.json({ error: result.error || 'Email delivery failed' }, { status: 500 });
});
