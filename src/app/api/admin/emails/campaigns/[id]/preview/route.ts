export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/emails/campaigns/[id]/preview
 * Render campaign HTML with sample variable substitution for preview
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { escapeHtml } from '@/lib/email/templates/base-template';
import { logger } from '@/lib/logger';

const SAMPLE_VARS: Record<string, string> = {
  prenom: 'Jean',
  email: 'jean.dupont@example.com',
  nom: 'Dupont',
  company: 'BioCycle Peptides',
};

export const GET = withAdminGuard(
  async (_request: NextRequest, { session: _session, params }: { session: unknown; params: { id: string } }) => {
    try {
      const campaign = await prisma.emailCampaign.findUnique({
        where: { id: params.id },
        select: { id: true, subject: true, htmlContent: true, textContent: true },
      });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
      }

      // Substitute template variables with sample values
      let previewHtml = campaign.htmlContent;
      let previewSubject = campaign.subject;
      for (const [key, value] of Object.entries(SAMPLE_VARS)) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        previewHtml = previewHtml.replace(pattern, escapeHtml(value));
        previewSubject = previewSubject.replace(pattern, value);
      }

      return NextResponse.json({
        subject: previewSubject,
        html: previewHtml,
        text: campaign.textContent,
        variables: Object.keys(SAMPLE_VARS),
      });
    } catch (error) {
      logger.error('[Campaign Preview] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
