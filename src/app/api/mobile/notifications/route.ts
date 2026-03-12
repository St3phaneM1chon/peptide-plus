export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { validateBody } from '@/lib/api-validation';

const notificationPrefsSchema = z.object({
  overdueInvoices: z.boolean().optional(),
  taxReminders: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
  paymentReceived: z.boolean().optional(),
}).strict();

// Notification preferences stored in-memory (would be DB in production)
const defaultPrefs = {
  overdueInvoices: true,
  taxReminders: true,
  dailySummary: false,
  paymentReceived: true,
};

export const GET = withAdminGuard(async () => {
  return NextResponse.json(defaultPrefs);
});

export const PUT = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const validation = validateBody(notificationPrefsSchema, body);
    if (!validation.success) return validation.response;
    const prefs = { ...defaultPrefs, ...validation.data };
    return NextResponse.json(prefs);
  } catch {
    return NextResponse.json({ error: 'Erreur mise à jour préférences' }, { status: 500 });
  }
});
