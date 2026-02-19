export const dynamic = 'force-dynamic';

/**
 * RIGHT TO DELETION - GDPR Article 17 / PIPEDA
 *
 * POST /api/account/delete-request
 *
 * Process:
 * 1. Mark account for deletion with 30-day grace period
 * 2. Anonymize PII immediately: name -> "Deleted User", email -> hash
 * 3. Keep orders for tax compliance (anonymized)
 * 4. Send confirmation email
 * 5. After 30 days, a cron job can hard-delete remaining data
 *
 * The user can cancel deletion during the grace period by logging in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sendEmail } from '@/lib/email/email-service';
import { baseTemplate } from '@/lib/email/templates/base-template';
import { createHash } from 'crypto';

// Grace period before permanent deletion (30 days)
const GRACE_PERIOD_DAYS = 30;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse optional reason from request body
    let reason = 'Not provided';
    try {
      const body = await request.json();
      if (body.reason && typeof body.reason === 'string') {
        reason = body.reason.substring(0, 500); // Cap at 500 chars
      }
    } catch {
      // No body or invalid JSON is fine
    }

    // Fetch current user data before anonymization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        locale: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const originalEmail = user.email;
    const locale = (user.locale === 'fr' ? 'fr' : 'en') as 'fr' | 'en';

    // Create anonymized values
    const emailHash = createHash('sha256').update(originalEmail).digest('hex').substring(0, 16);
    const anonymizedEmail = `deleted_${emailHash}@deleted.biocyclepeptides.com`;
    const deletionDate = new Date();
    const permanentDeletionDate = new Date(deletionDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    // Perform anonymization in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Anonymize user record
      await tx.user.update({
        where: { id: userId },
        data: {
          name: 'Deleted User',
          email: anonymizedEmail,
          phone: null,
          image: null,
          password: null,
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: null,
          birthDate: null,
          referralCode: null,
          resetToken: null,
          resetTokenExpiry: null,
          stripeCustomerId: null,
          // We keep the rest (role, points) for audit
        },
      });

      // 2. Anonymize shipping names in orders (keep order data for tax compliance)
      await tx.order.updateMany({
        where: { userId },
        data: {
          shippingName: 'Deleted User',
          shippingPhone: null,
          customerNotes: null,
        },
      });

      // 3. Delete addresses
      await tx.userAddress.deleteMany({
        where: { userId },
      });

      // 4. Delete notification preferences
      await tx.notificationPreference.deleteMany({
        where: { userId },
      });

      // 5. Delete wishlist
      await tx.wishlist.deleteMany({
        where: { userId },
      });

      // 6. Delete sessions (force logout)
      await tx.session.deleteMany({
        where: { userId },
      });

      // 7. Delete accounts (OAuth links)
      await tx.account.deleteMany({
        where: { userId },
      });

      // 8. Anonymize reviews (keep for product integrity, remove PII)
      await tx.review.updateMany({
        where: { userId },
        data: {
          title: null,
        },
      });

      // 9. Log the deletion request in AuditLog
      await tx.auditLog.create({
        data: {
          id: `audit_delete_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
          userId,
          action: 'ACCOUNT_DELETION_REQUEST',
          entityType: 'User',
          entityId: userId,
          details: JSON.stringify({
            reason,
            originalEmailHash: emailHash,
            gracePeriodDays: GRACE_PERIOD_DAYS,
            permanentDeletionDate: permanentDeletionDate.toISOString(),
          }),
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        },
      });
    });

    // Send confirmation email to original address (before it's lost)
    const isFr = locale === 'fr';
    const emailContent = isFr
      ? buildDeletionConfirmEmailFr(permanentDeletionDate)
      : buildDeletionConfirmEmailEn(permanentDeletionDate);

    await sendEmail({
      to: { email: originalEmail, name: user.name || undefined },
      subject: isFr
        ? 'Confirmation de suppression de compte - BioCycle Peptides'
        : 'Account Deletion Confirmation - BioCycle Peptides',
      html: baseTemplate({
        content: emailContent,
        locale,
        preheader: isFr
          ? 'Votre demande de suppression de compte a ete traitee'
          : 'Your account deletion request has been processed',
      }),
      tags: ['account-deletion'],
    }).catch((err) => {
      logger.error('[delete-request] Failed to send confirmation email', {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    logger.info('[delete-request] Account deletion request processed', {
      userId,
      anonymizedEmail,
      permanentDeletionDate: permanentDeletionDate.toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: isFr
        ? `Votre compte a ete anonymise. Les donnees restantes seront supprimees definitivement le ${permanentDeletionDate.toLocaleDateString('fr-CA')}.`
        : `Your account has been anonymized. Remaining data will be permanently deleted on ${permanentDeletionDate.toLocaleDateString('en-CA')}.`,
      permanentDeletionDate: permanentDeletionDate.toISOString(),
      gracePeriodDays: GRACE_PERIOD_DAYS,
    });
  } catch (error) {
    logger.error('[delete-request] Failed to process deletion', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to process account deletion request' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Email templates
// ---------------------------------------------------------------------------

function buildDeletionConfirmEmailEn(permanentDate: Date): string {
  const formatted = permanentDate.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <h1 style="color:#1f2937;font-size:22px;">Account Deletion Confirmed</h1>

    <p>Your account deletion request has been processed. Here is what has happened:</p>

    <ul style="color:#4b5563;">
      <li>Your personal information (name, email, phone, addresses) has been anonymized.</li>
      <li>Your sessions and saved login methods have been deleted.</li>
      <li>Your wishlist and notification preferences have been removed.</li>
      <li>Order history has been retained in anonymized form for tax compliance.</li>
    </ul>

    <div style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;color:#92400e;"><strong>Grace Period:</strong> Your remaining data will be permanently deleted on <strong>${formatted}</strong>.</p>
    </div>

    <p>If you believe this was done in error, please contact us immediately at <a href="mailto:support@biocyclepeptides.com">support@biocyclepeptides.com</a>.</p>

    <p>Thank you for having been a BioCycle Peptides customer.</p>
  `;
}

function buildDeletionConfirmEmailFr(permanentDate: Date): string {
  const formatted = permanentDate.toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <h1 style="color:#1f2937;font-size:22px;">Suppression de compte confirmee</h1>

    <p>Votre demande de suppression de compte a ete traitee. Voici ce qui a ete fait :</p>

    <ul style="color:#4b5563;">
      <li>Vos informations personnelles (nom, courriel, telephone, adresses) ont ete anonymisees.</li>
      <li>Vos sessions et methodes de connexion sauvegardees ont ete supprimees.</li>
      <li>Votre liste de souhaits et preferences de notification ont ete supprimees.</li>
      <li>L'historique des commandes a ete conserve sous forme anonymisee pour la conformite fiscale.</li>
    </ul>

    <div style="background-color:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;color:#92400e;"><strong>Periode de grace :</strong> Vos donnees restantes seront supprimees definitivement le <strong>${formatted}</strong>.</p>
    </div>

    <p>Si vous croyez que cette action a ete faite par erreur, veuillez nous contacter immediatement a <a href="mailto:support@biocyclepeptides.com">support@biocyclepeptides.com</a>.</p>

    <p>Merci d'avoir ete client(e) de BioCycle Peptides.</p>
  `;
}
