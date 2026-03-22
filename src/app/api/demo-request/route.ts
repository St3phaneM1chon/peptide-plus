/**
 * POST /api/demo-request
 * Receives demo request form submissions from the platform landing page.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, company, phone, employees, message } = body;

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Prénom, nom et courriel sont requis' },
        { status: 400 }
      );
    }

    // Log the demo request for now (will integrate with CRM later)
    logger.info('Demo request received', {
      firstName,
      lastName,
      email,
      company: company || 'N/A',
      phone: phone || 'N/A',
      employees: employees || 'N/A',
      message: message || 'N/A',
      timestamp: new Date().toISOString(),
    });

    // TODO: Send notification email to team
    // TODO: Create CRM lead
    // TODO: Schedule follow-up

    return NextResponse.json({
      success: true,
      message: 'Votre demande de démonstration a été reçue. Notre équipe vous contactera sous 24h.',
    });
  } catch (error) {
    logger.error('Demo request error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi de la demande' },
      { status: 500 }
    );
  }
}
