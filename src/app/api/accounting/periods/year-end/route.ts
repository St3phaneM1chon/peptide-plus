import { NextRequest, NextResponse } from 'next/server';
import { runYearEndClose } from '@/lib/accounting/period-close.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, closedBy = 'system' } = body;

    if (!year) {
      return NextResponse.json({ error: 'year is required' }, { status: 400 });
    }

    const result = await runYearEndClose(year, closedBy);

    return NextResponse.json({
      success: true,
      year,
      netIncome: result.netIncome,
      closingEntryId: result.closingEntryId,
      periodsCreated: result.periodsCreated,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error running year-end close:', msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
