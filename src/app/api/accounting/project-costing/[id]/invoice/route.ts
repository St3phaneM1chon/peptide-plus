export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const generateInvoiceSchema = z.object({
  // For T&M billing: array of cost entry IDs to bill
  costEntryIds: z.array(z.string()).optional(),
  // For fixed price / milestone billing: milestone ID to bill
  milestoneId: z.string().optional(),
  // Override customer info
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional().nullable(),
  customerAddress: z.string().optional().nullable(),
  // Invoice details
  dueDate: z.string().min(1, 'La date d\'echeance est requise'),
  notes: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// POST /api/accounting/project-costing/[id]/invoice
// Generate invoice from unbilled cost entries (T&M) or milestone (fixed price)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  try {
    const projectId = params?.id;
    if (!projectId) {
      return NextResponse.json({ error: 'ID projet requis' }, { status: 400 });
    }

    const project = await prisma.costProject.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    if (!project) {
      return NextResponse.json({ error: 'Projet non trouve' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = generateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const customerName = data.customerName || project.clientName || 'Client';
    const customerEmail = data.customerEmail || project.clientEmail || null;
    const dueDateObj = new Date(data.dueDate);
    if (isNaN(dueDateObj.getTime())) {
      return NextResponse.json({ error: 'Date d\'echeance invalide' }, { status: 400 });
    }

    let invoiceItems: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      lineTotal: number;
    }> = [];
    let subtotal = 0;
    let costEntryIdsToMark: string[] = [];

    if (project.billingMethod === 'TIME_AND_MATERIALS' && data.costEntryIds?.length) {
      // T&M: Bill selected unbilled cost entries
      const entries = await prisma.projectCostEntry.findMany({
        where: {
          id: { in: data.costEntryIds },
          projectId,
          isBillable: true,
          invoiceId: null,
        },
      });

      if (entries.length === 0) {
        return NextResponse.json(
          { error: 'Aucune entree facturable trouvee' },
          { status: 400 }
        );
      }

      invoiceItems = entries.map((e) => ({
        description: `${e.type}: ${e.description}${e.employeeName ? ` (${e.employeeName})` : ''}`,
        quantity: Number(e.quantity),
        unitPrice: Number(e.billableAmount) / Math.max(Number(e.quantity), 1),
        discount: 0,
        lineTotal: Number(e.billableAmount),
      }));

      subtotal = entries.reduce((sum, e) => sum + Number(e.billableAmount), 0);
      costEntryIdsToMark = entries.map((e) => e.id);
    } else if (data.milestoneId) {
      // Fixed price / milestone billing
      const milestone = await prisma.projectMilestone.findFirst({
        where: { id: data.milestoneId, projectId },
      });

      if (!milestone) {
        return NextResponse.json({ error: 'Jalon non trouve' }, { status: 404 });
      }

      if (milestone.status !== 'COMPLETED') {
        return NextResponse.json(
          { error: 'Le jalon doit etre complete avant facturation' },
          { status: 400 }
        );
      }

      const amount = milestone.amount ? Number(milestone.amount) : 0;
      if (amount <= 0) {
        return NextResponse.json(
          { error: 'Le jalon n\'a pas de montant de facturation' },
          { status: 400 }
        );
      }

      invoiceItems = [{
        description: `${project.name} - Jalon: ${milestone.name}`,
        quantity: 1,
        unitPrice: amount,
        discount: 0,
        lineTotal: amount,
      }];

      subtotal = amount;
    } else {
      return NextResponse.json(
        { error: 'Specifiez costEntryIds (T&M) ou milestoneId (prix fixe)' },
        { status: 400 }
      );
    }

    subtotal = Math.round(subtotal * 100) / 100;

    // Generate invoice number and create invoice
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;

    const invoice = await prisma.$transaction(async (tx) => {
      // Get next invoice number
      const [maxRow] = await tx.$queryRaw<{ max_num: string | null }[]>`
        SELECT MAX("invoiceNumber") as max_num
        FROM "CustomerInvoice"
        WHERE "invoiceNumber" LIKE ${prefix + '%'}
        FOR UPDATE
      `;

      let nextNum = 1;
      if (maxRow?.max_num) {
        const num = parseInt(maxRow.max_num.split('-').pop() || '0');
        if (!isNaN(num)) nextNum = num + 1;
      }
      const invoiceNumber = `${prefix}${String(nextNum).padStart(4, '0')}`;

      // Create the invoice with items
      const inv = await tx.customerInvoice.create({
        data: {
          invoiceNumber,
          customerName,
          customerEmail,
          customerAddress: data.customerAddress || null,
          subtotal,
          total: subtotal, // Taxes can be added later
          balance: subtotal,
          invoiceDate: new Date(),
          dueDate: dueDateObj,
          status: 'DRAFT',
          notes: data.notes || `Projet: ${project.name} (${project.code})`,
          items: {
            create: invoiceItems.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              total: item.lineTotal,
            })),
          },
        },
        include: { items: true },
      });

      // Mark cost entries as billed
      if (costEntryIdsToMark.length > 0) {
        await tx.projectCostEntry.updateMany({
          where: { id: { in: costEntryIdsToMark } },
          data: { invoiceId: inv.id },
        });
      }

      return inv;
    });

    logger.info('Invoice generated from project costing', {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      projectId,
      projectCode: project.code,
      subtotal,
      itemCount: invoiceItems.length,
      userId: session.user.id || session.user.email,
    });

    return NextResponse.json(
      {
        success: true,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customerName,
          subtotal: Number(invoice.subtotal),
          total: Number(invoice.total),
          balance: Number(invoice.balance),
          dueDate: invoice.dueDate.toISOString(),
          status: invoice.status,
          itemCount: invoice.items.length,
        },
        markedEntries: costEntryIdsToMark.length,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Generate project invoice error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la generation de la facture' },
      { status: 500 }
    );
  }
});
