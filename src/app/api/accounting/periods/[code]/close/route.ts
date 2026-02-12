import { NextRequest, NextResponse } from 'next/server';
import { runMonthEndChecklist, lockPeriod } from '@/lib/accounting/period-close.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const checklist = await runMonthEndChecklist(code);
    return NextResponse.json({ code, checklist });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error running checklist:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const { closedBy = 'system' } = body;

    await lockPeriod(code, closedBy);

    return NextResponse.json({ success: true, code, status: 'LOCKED' });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error locking period:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
