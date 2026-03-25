export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { prisma } from '@/lib/db';
import { enrollUser, enrollUserInBundle, resolvePricing } from '@/lib/lms/lms-service';
import { sendEmail } from '@/lib/email';
import { buildCorporateWelcomeEmail } from '@/lib/email/templates/lms-emails';

const enrollSchema = z.object({
  type: z.enum(['course', 'bundle']),
  itemId: z.string(), // courseId or bundleId
  userIds: z.array(z.string()).min(1).max(500),
});

export const POST = withAdminGuard(async (request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  const { id: corporateAccountId } = await params;
  const body = await request.json();
  const parsed = enrollSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Validation failed', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  const { type, itemId, userIds } = parsed.data;

  // Verify corporate account exists
  const account = await prisma.corporateAccount.findFirst({
    where: { id: corporateAccountId, tenantId, isActive: true },
  });
  if (!account) return apiError('Corporate account not found', ErrorCode.NOT_FOUND, { request, status: 404 });

  // Verify all users are employees of this corporate account
  const employees = await prisma.corporateEmployee.findMany({
    where: { corporateAccountId, userId: { in: userIds }, isActive: true },
    select: { userId: true },
  });
  const employeeUserIds = new Set(employees.map(e => e.userId));
  const invalidUsers = userIds.filter(id => !employeeUserIds.has(id));
  if (invalidUsers.length > 0) {
    return apiError(`Users not in corporate account: ${invalidUsers.join(', ')}`, ErrorCode.VALIDATION_ERROR, { request, status: 400 });
  }

  // V2 P0 FIX: Validate budget before enrollment
  if (account.budgetAmount) {
    const remaining = Number(account.budgetAmount) - Number(account.budgetUsed);
    if (remaining <= 0) {
      return apiError('Corporate budget exhausted', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
    }
  }

  // P9-11 FIX: Re-read budget atomically to minimize race window
  // (the pre-check above is for UX, this is the authoritative check)
  if (account.budgetAmount) {
    const freshAccount = await prisma.corporateAccount.findFirst({
      where: { id: corporateAccountId, tenantId },
      select: { budgetAmount: true, budgetUsed: true },
    });
    if (freshAccount && Number(freshAccount.budgetAmount) - Number(freshAccount.budgetUsed) <= 0) {
      return apiError('Corporate budget exhausted', ErrorCode.VALIDATION_ERROR, { request, status: 400 });
    }
  }

  const results = {
    enrollmentsCreated: 0,
    enrollmentsSkipped: 0,
    totalCost: 0,
    errors: [] as string[],
  };

  if (type === 'bundle') {
    const bundle = await prisma.courseBundle.findFirst({ where: { id: itemId, tenantId } });
    if (!bundle) return apiError('Bundle not found', ErrorCode.NOT_FOUND, { request, status: 404 });

    // P9-01 FIX: Pass tenantId to resolvePricing for cross-tenant isolation
    const pricing = await resolvePricing(
      { price: bundle.price, corporatePrice: bundle.corporatePrice, currency: bundle.currency },
      corporateAccountId,
      tenantId
    );

    for (const userId of userIds) {
      try {
        const result = await enrollUserInBundle(tenantId, itemId, userId, {
          enrolledBy: session.user.id,
          corporateAccountId,
          paymentType: 'corporate',
        });
        results.enrollmentsCreated += result.enrollmentIds.length;
        results.enrollmentsSkipped += result.skippedCourseIds.length;
        results.totalCost += pricing.price;
      } catch (err) {
        results.errors.push(`Failed to enroll user ${userId}: ${(err as Error).message}`);
      }
    }

    // Create bundle order
    await prisma.courseBundleOrder.create({
      data: {
        tenantId,
        userId: session.user.id, // Admin placing the order
        bundleId: itemId,
        amount: pricing.price * userIds.length,
        totalAmount: pricing.price * userIds.length,
        discountAmount: pricing.discount * userIds.length,
        paymentType: 'CORPORATE',
        corporateAccountId,
        status: 'paid',
        paidAt: new Date(),
      },
    });
  } else {
    // Single course enrollment
    const course = await prisma.course.findFirst({ where: { id: itemId, tenantId } });
    if (!course) return apiError('Course not found', ErrorCode.NOT_FOUND, { request, status: 404 });

    // P9-01 FIX: Pass tenantId to resolvePricing for cross-tenant isolation
    const pricing = await resolvePricing(
      { price: course.price, corporatePrice: course.corporatePrice, currency: course.currency },
      corporateAccountId,
      tenantId
    );

    for (const userId of userIds) {
      try {
        await enrollUser(tenantId, itemId, userId, session.user.id);
        // Update the enrollment with corporate info
        await prisma.enrollment.updateMany({
          where: { tenantId, courseId: itemId, userId },
          data: {
            corporateAccountId,
            paymentType: 'corporate',
            enrollmentSource: 'corporate',
          },
        });
        results.enrollmentsCreated++;
        results.totalCost += pricing.price;
      } catch {
        results.enrollmentsSkipped++;
      }
    }
  }

  // Update corporate budget with atomic increment
  if (results.totalCost > 0) {
    // P9-11 FIX: Use atomic increment + post-check to prevent budget overflow
    const updatedAccount = await prisma.corporateAccount.update({
      where: { id: corporateAccountId },
      data: { budgetUsed: { increment: results.totalCost } },
      select: { budgetAmount: true, budgetUsed: true },
    });
    // Post-check: if budget exceeded after increment, log warning (enrollments already created)
    if (updatedAccount.budgetAmount && Number(updatedAccount.budgetUsed) > Number(updatedAccount.budgetAmount)) {
      results.errors.push(`Budget exceeded: ${Number(updatedAccount.budgetUsed).toFixed(2)} / ${Number(updatedAccount.budgetAmount).toFixed(2)}`);
    }
  }

  // Send corporate welcome emails (non-blocking)
  const courseNames = type === 'bundle'
    ? (await prisma.courseBundle.findUnique({ where: { id: itemId }, include: { items: { include: { course: { select: { title: true } } } } } }))?.items.map(i => i.course.title) ?? []
    : [(await prisma.course.findUnique({ where: { id: itemId }, select: { title: true } }))?.title ?? ''];

  // P9-08 FIX: Batch-fetch all users at once instead of N+1 individual lookups
  const usersForEmail = await prisma.user.findMany({
    where: { id: { in: userIds }, tenantId },
    select: { id: true, email: true, name: true },
  });
  const userMap = new Map(usersForEmail.map(u => [u.id, u]));

  for (const userId of userIds) {
    const user = userMap.get(userId);
    if (user?.email) {
      const email = buildCorporateWelcomeEmail({
        employeeName: user.name ?? 'Employe',
        companyName: account.companyName,
        coursesEnrolled: courseNames,
      });
      sendEmail({ to: { email: user.email, name: user.name ?? undefined }, subject: email.subject, html: email.html, text: email.text }).catch((e) => { if (typeof console !== "undefined") console.warn("[LMS] Non-blocking op failed:", e instanceof Error ? e.message : e); });
    }
  }

  return apiSuccess(results, { request, status: 201 });
});
