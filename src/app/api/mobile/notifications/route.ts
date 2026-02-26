export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';

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
    const prefs = { ...defaultPrefs, ...body };
    return NextResponse.json(prefs);
  } catch {
    return NextResponse.json({ error: 'Erreur mise à jour préférences' }, { status: 500 });
  }
});
