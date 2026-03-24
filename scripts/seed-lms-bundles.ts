/**
 * Seed PQAP Course Bundles + Sample Corporate Account
 * Run: npx tsx scripts/seed-lms-bundles.ts
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { status: 'ACTIVE' } });
  if (!tenant) { console.error('No active tenant found'); process.exit(1); }
  const tenantId = tenant.id;
  console.log(`Tenant: ${tenant.name} (${tenantId})`);

  const courses = await prisma.course.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } });
  console.log(`Found ${courses.length} courses`);
  const courseMap = Object.fromEntries(courses.map(c => [c.slug, c.id]));

  // ── Bundle 1: PQAP Complet (4 cours) ──
  const b1 = await upsertBundle(tenantId, {
    slug: 'pqap-complet',
    name: 'PQAP Complet — 4 examens AMF',
    description: 'Programme de qualification complet en assurance de personnes. Preparation aux 4 examens AMF: F-111 Deontologie, F-311 Assurance vie, F-312 Accident et maladie, F-313 Fonds distincts.',
    price: 499, corporatePrice: 349,
    courseIds: [
      courseMap['intro-conformite-amf-representants'],
      courseMap['assurance-vie-canada-guide'],
      courseMap['fonds-distincts-regimes-enregistres'],
      courseMap['deontologie-ethique-professionnelle'],
    ].filter(Boolean),
  });
  console.log(`  ${b1.action}: ${b1.name} (${b1.courses} cours, $${b1.price}/$${b1.corpPrice})`);

  // ── Bundle 2: PQAP Assurance vie (2 cours) ──
  const b2 = await upsertBundle(tenantId, {
    slug: 'pqap-assurance-vie',
    name: 'PQAP Assurance vie — F-111 + F-311',
    description: 'Preparation aux examens AMF F-111 (Deontologie) et F-311 (Assurance vie). Ideal pour les candidats qui veulent se concentrer sur l\'assurance vie.',
    price: 279, corporatePrice: 199,
    courseIds: [
      courseMap['intro-conformite-amf-representants'],
      courseMap['assurance-vie-canada-guide'],
    ].filter(Boolean),
  });
  console.log(`  ${b2.action}: ${b2.name} (${b2.courses} cours, $${b2.price}/$${b2.corpPrice})`);

  // ── Bundle 3: PQAP Fonds distincts (2 cours) ──
  const b3 = await upsertBundle(tenantId, {
    slug: 'pqap-fonds-distincts',
    name: 'PQAP Fonds distincts — F-111 + F-313',
    description: 'Preparation aux examens AMF F-111 (Deontologie) et F-313 (Fonds distincts et regimes enregistres).',
    price: 279, corporatePrice: 199,
    courseIds: [
      courseMap['intro-conformite-amf-representants'],
      courseMap['fonds-distincts-regimes-enregistres'],
    ].filter(Boolean),
  });
  console.log(`  ${b3.action}: ${b3.name} (${b3.courses} cours, $${b3.price}/$${b3.corpPrice})`);

  // ── Sample Corporate Account ──
  const corpSlug = 'demo-assurance-co';
  const existingCorp = await prisma.corporateAccount.findUnique({
    where: { tenantId_slug: { tenantId, slug: corpSlug } },
  });
  if (!existingCorp) {
    await prisma.corporateAccount.create({
      data: {
        tenantId,
        companyName: 'Demo Assurance Co.',
        slug: corpSlug,
        contactEmail: 'formation@demo-assurance.ca',
        contactName: 'Marie Tremblay',
        contactPhone: '+1-514-555-0100',
        billingMethod: 'INVOICE',
        paymentTermsDays: 30,
        budgetAmount: new Prisma.Decimal(50000),
        discountPercent: new Prisma.Decimal(15),
      },
    });
    console.log(`  Created: Demo Assurance Co. (budget $50,000, 15% discount)`);
  } else {
    console.log(`  Exists: Demo Assurance Co.`);
  }

  // ── Set requireSequentialCompletion on all courses ──
  const updated = await prisma.course.updateMany({
    where: { tenantId },
    data: { requireSequentialCompletion: true },
  });
  console.log(`  Updated ${updated.count} courses: requireSequentialCompletion=true`);

  console.log('\nDone!');
  await prisma.$disconnect();
}

async function upsertBundle(tenantId: string, data: {
  slug: string; name: string; description: string;
  price: number; corporatePrice: number; courseIds: string[];
}) {
  const existing = await prisma.courseBundle.findUnique({
    where: { tenantId_slug: { tenantId, slug: data.slug } },
  });

  if (existing) {
    return { action: 'Exists', name: data.name, courses: data.courseIds.length, price: data.price, corpPrice: data.corporatePrice };
  }

  await prisma.courseBundle.create({
    data: {
      tenantId,
      slug: data.slug,
      name: data.name,
      description: data.description,
      price: new Prisma.Decimal(data.price),
      corporatePrice: new Prisma.Decimal(data.corporatePrice),
      courseCount: data.courseIds.length,
      items: {
        create: data.courseIds.map((courseId, i) => ({ courseId, sortOrder: i })),
      },
    },
  });

  return { action: 'Created', name: data.name, courses: data.courseIds.length, price: data.price, corpPrice: data.corporatePrice };
}

main().catch(console.error);
