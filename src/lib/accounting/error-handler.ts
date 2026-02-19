import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

/**
 * Centralized Prisma error handler for accounting API routes.
 * Returns a NextResponse for known Prisma errors, or null if the error
 * is not a Prisma error (letting the caller handle it).
 */
export function handlePrismaError(error: unknown): NextResponse | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        return NextResponse.json(
          { error: 'Cet enregistrement existe d\u00e9j\u00e0' },
          { status: 409 }
        );
      case 'P2025': // Record not found
        return NextResponse.json(
          { error: 'Enregistrement non trouv\u00e9' },
          { status: 404 }
        );
      case 'P2003': // Foreign key constraint failure
        return NextResponse.json(
          { error: 'Impossible de supprimer: des enregistrements d\u00e9pendants existent' },
          { status: 400 }
        );
      default:
        return NextResponse.json(
          { error: `Erreur base de donn\u00e9es: ${error.code}` },
          { status: 500 }
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return NextResponse.json(
      { error: 'Donn\u00e9es invalides pour la requ\u00eate' },
      { status: 400 }
    );
  }

  return null; // Not a Prisma error, let caller handle
}

/**
 * Safely parse JSON from a request body.
 * Returns the parsed data or a 400 NextResponse on malformed JSON.
 */
export async function safeJsonParse(
  request: Request
): Promise<{ data: Record<string, unknown>; error: null } | { data: null; error: NextResponse }> {
  try {
    const data = await request.json();
    return { data, error: null };
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { error: 'Corps de requ\u00eate invalide (JSON malform\u00e9)' },
        { status: 400 }
      ),
    };
  }
}
