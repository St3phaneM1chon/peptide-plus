export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  sin: z.string().max(11).nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'SEASONAL']).optional(),
  province: z.string().min(2).max(2).optional(),
  country: z.string().min(2).max(2).optional(),
  annualSalary: z.number().min(0).nullable().optional(),
  hourlyRate: z.number().min(0).nullable().optional(),
  payFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY']).optional(),
  bankTransitNumber: z.string().max(20).nullable().optional(),
  bankInstitution: z.string().max(10).nullable().optional(),
  bankAccountNumber: z.string().max(20).nullable().optional(),
  federalTdCredit: z.number().min(0).optional(),
  provincialTdCredit: z.number().min(0).optional(),
  vacationPayRate: z.number().min(4).max(100).optional(),
  status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/payroll/employees/[id]
// Get a single employee
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        payrollEntries: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            payrollRun: {
              select: { periodStart: true, periodEnd: true, payDate: true, status: true },
            },
          },
        },
      },
    });

    if (!employee || employee.deletedAt) {
      return NextResponse.json({ error: 'Employe non trouve' }, { status: 404 });
    }

    return NextResponse.json({
      employee: {
        id: employee.id,
        userId: employee.userId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        sin: employee.sin ? `***-***-${employee.sin.slice(-3)}` : null, // Mask SIN
        dateOfBirth: employee.dateOfBirth?.toISOString().split('T')[0] ?? null,
        hireDate: employee.hireDate.toISOString().split('T')[0],
        terminationDate: employee.terminationDate?.toISOString().split('T')[0] ?? null,
        employmentType: employee.employmentType,
        province: employee.province,
        country: employee.country,
        annualSalary: employee.annualSalary ? Number(employee.annualSalary) : null,
        hourlyRate: employee.hourlyRate ? Number(employee.hourlyRate) : null,
        payFrequency: employee.payFrequency,
        bankTransitNumber: employee.bankTransitNumber ? '***' : null, // Mask bank info
        bankInstitution: employee.bankInstitution ?? null,
        bankAccountNumber: employee.bankAccountNumber ? `***${employee.bankAccountNumber.slice(-4)}` : null,
        federalTdCredit: Number(employee.federalTdCredit),
        provincialTdCredit: Number(employee.provincialTdCredit),
        vacationPayRate: Number(employee.vacationPayRate),
        status: employee.status,
        notes: employee.notes,
        createdAt: employee.createdAt.toISOString(),
        updatedAt: employee.updatedAt.toISOString(),
        recentPayroll: employee.payrollEntries.map((pe) => ({
          id: pe.id,
          periodStart: pe.payrollRun.periodStart.toISOString().split('T')[0],
          periodEnd: pe.payrollRun.periodEnd.toISOString().split('T')[0],
          payDate: pe.payrollRun.payDate.toISOString().split('T')[0],
          runStatus: pe.payrollRun.status,
          grossPay: Number(pe.grossPay),
          netPay: Number(pe.netPay),
          totalDeductions: Number(pe.totalDeductions),
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching employee', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation de l\'employe' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// PUT /api/accounting/payroll/employees/[id]
// Update an employee
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (request, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Employe non trouve' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    const d = parsed.data;

    if (d.firstName !== undefined) data.firstName = d.firstName;
    if (d.lastName !== undefined) data.lastName = d.lastName;
    if (d.email !== undefined) {
      // Check for duplicate email
      if (d.email !== existing.email) {
        const dup = await prisma.employee.findFirst({
          where: { email: d.email, deletedAt: null, id: { not: id } },
        });
        if (dup) {
          return NextResponse.json({ error: 'Cet email est deja utilise' }, { status: 409 });
        }
      }
      data.email = d.email;
    }
    if (d.sin !== undefined) data.sin = d.sin;
    if (d.dateOfBirth !== undefined) data.dateOfBirth = d.dateOfBirth ? new Date(d.dateOfBirth) : null;
    if (d.hireDate !== undefined) data.hireDate = new Date(d.hireDate);
    if (d.terminationDate !== undefined) data.terminationDate = d.terminationDate ? new Date(d.terminationDate) : null;
    if (d.employmentType !== undefined) data.employmentType = d.employmentType;
    if (d.province !== undefined) data.province = d.province;
    if (d.country !== undefined) data.country = d.country;
    if (d.annualSalary !== undefined) data.annualSalary = d.annualSalary;
    if (d.hourlyRate !== undefined) data.hourlyRate = d.hourlyRate;
    if (d.payFrequency !== undefined) data.payFrequency = d.payFrequency;
    if (d.bankTransitNumber !== undefined) data.bankTransitNumber = d.bankTransitNumber;
    if (d.bankInstitution !== undefined) data.bankInstitution = d.bankInstitution;
    if (d.bankAccountNumber !== undefined) data.bankAccountNumber = d.bankAccountNumber;
    if (d.federalTdCredit !== undefined) data.federalTdCredit = d.federalTdCredit;
    if (d.provincialTdCredit !== undefined) data.provincialTdCredit = d.provincialTdCredit;
    if (d.vacationPayRate !== undefined) data.vacationPayRate = d.vacationPayRate;
    if (d.status !== undefined) data.status = d.status;
    if (d.notes !== undefined) data.notes = d.notes;

    const updated = await prisma.employee.update({
      where: { id },
      data,
    });

    logger.info('Employee updated', {
      employeeId: id,
      name: `${updated.firstName} ${updated.lastName}`,
    });

    return NextResponse.json({
      success: true,
      employee: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Error updating employee', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la mise a jour de l\'employe' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/payroll/employees/[id]
// Soft-delete an employee
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 });
    }

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: 'Employe non trouve' }, { status: 404 });
    }

    // Check for active payroll entries
    const activeEntries = await prisma.payrollEntry.count({
      where: {
        employeeId: id,
        payrollRun: {
          status: { in: ['DRAFT', 'CALCULATED'] },
          deletedAt: null,
        },
      },
    });

    if (activeEntries > 0) {
      return NextResponse.json(
        { error: `Cet employe a ${activeEntries} entree(s) de paie en cours. Completez ou supprimez les cycles de paie d'abord.` },
        { status: 409 }
      );
    }

    await prisma.employee.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'TERMINATED',
        terminationDate: existing.terminationDate || new Date(),
      },
    });

    logger.info('Employee soft-deleted', {
      employeeId: id,
      name: `${existing.firstName} ${existing.lastName}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting employee', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'employe' },
      { status: 500 }
    );
  }
});
