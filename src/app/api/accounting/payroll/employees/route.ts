export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'Prenom requis').max(100),
  lastName: z.string().min(1, 'Nom requis').max(100),
  email: z.string().email('Email invalide'),
  sin: z.string().max(11).nullable().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'SEASONAL']).default('FULL_TIME'),
  province: z.string().min(2).max(2).default('QC'),
  country: z.string().min(2).max(2).default('CA'),
  annualSalary: z.number().min(0).nullable().optional(),
  hourlyRate: z.number().min(0).nullable().optional(),
  payFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY']).default('BIWEEKLY'),
  bankTransitNumber: z.string().max(20).nullable().optional(),
  bankInstitution: z.string().max(10).nullable().optional(),
  bankAccountNumber: z.string().max(20).nullable().optional(),
  federalTdCredit: z.number().min(0).default(0),
  provincialTdCredit: z.number().min(0).default(0),
  vacationPayRate: z.number().min(4).max(100).default(4),
  notes: z.string().max(2000).nullable().optional(),
  userId: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/accounting/payroll/employees
// List employees with pagination and filters
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50') || 50), 200);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { deletedAt: null };

    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    const mapped = employees.map((e) => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      hireDate: e.hireDate.toISOString().split('T')[0],
      terminationDate: e.terminationDate?.toISOString().split('T')[0] ?? null,
      employmentType: e.employmentType,
      province: e.province,
      country: e.country,
      annualSalary: e.annualSalary ? Number(e.annualSalary) : null,
      hourlyRate: e.hourlyRate ? Number(e.hourlyRate) : null,
      payFrequency: e.payFrequency,
      vacationPayRate: Number(e.vacationPayRate),
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json({
      employees: mapped,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching employees', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la recuperation des employes' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/payroll/employees
// Create a new employee
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createEmployeeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Donnees invalides', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check for duplicate email
    const existingEmail = await prisma.employee.findFirst({
      where: { email: data.email, deletedAt: null },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Un employe avec cet email existe deja' },
        { status: 409 }
      );
    }

    // Must have either annual salary or hourly rate
    if (!data.annualSalary && !data.hourlyRate) {
      return NextResponse.json(
        { error: 'Un salaire annuel ou un taux horaire est requis' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        sin: data.sin || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        hireDate: new Date(data.hireDate),
        employmentType: data.employmentType,
        province: data.province,
        country: data.country,
        annualSalary: data.annualSalary ?? null,
        hourlyRate: data.hourlyRate ?? null,
        payFrequency: data.payFrequency,
        bankTransitNumber: data.bankTransitNumber || null,
        bankInstitution: data.bankInstitution || null,
        bankAccountNumber: data.bankAccountNumber || null,
        federalTdCredit: data.federalTdCredit,
        provincialTdCredit: data.provincialTdCredit,
        vacationPayRate: data.vacationPayRate,
        notes: data.notes || null,
        userId: data.userId || null,
      },
    });

    logger.info('Employee created', {
      employeeId: employee.id,
      name: `${employee.firstName} ${employee.lastName}`,
      email: employee.email,
    });

    return NextResponse.json(
      {
        success: true,
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          hireDate: employee.hireDate.toISOString().split('T')[0],
          employmentType: employee.employmentType,
          province: employee.province,
          annualSalary: employee.annualSalary ? Number(employee.annualSalary) : null,
          hourlyRate: employee.hourlyRate ? Number(employee.hourlyRate) : null,
          payFrequency: employee.payFrequency,
          status: employee.status,
          createdAt: employee.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating employee', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Erreur lors de la creation de l\'employe' },
      { status: 500 }
    );
  }
});
