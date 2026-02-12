import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import { runMonthEndChecklist, lockPeriod } from '@/lib/accounting/period-close.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { code } = await params;
    const checklist = await runMonthEndChecklist(code);
    return NextResponse.json({ code, checklist });
  } catch (error) {
    console.error('Error running checklist:', error);
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const { code } = await params;
    const body = await request.json();
    const { closedBy = 'system' } = body;

    await lockPeriod(code, closedBy);

    return NextResponse.json({ success: true, code, status: 'LOCKED' });
  } catch (error) {
    console.error('Error locking period:', error);
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 400 });
  }
}
