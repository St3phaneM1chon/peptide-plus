import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/accounting/settings
 * Get accounting settings
 */
export async function GET() {
  try {
    let settings = await prisma.accountingSettings.findUnique({
      where: { id: 'default' },
    });

    // Auto-create default settings if not found
    if (!settings) {
      settings = await prisma.accountingSettings.create({
        data: { id: 'default' },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounting/settings
 * Update accounting settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Remove id from body to prevent overwriting
    const { id: _id, ...updateFields } = body;

    const settings = await prisma.accountingSettings.upsert({
      where: { id: 'default' },
      update: updateFields,
      create: { id: 'default', ...updateFields },
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des paramètres' },
      { status: 500 }
    );
  }
}
