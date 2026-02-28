/**
 * Seed Script: Video Categories + Default Consent Form Template
 *
 * Seeds the initial VideoCategory records and a default ConsentFormTemplate
 * for the Content Hub. Uses upsert to be safely re-runnable.
 *
 * Usage: npx tsx scripts/seed-video-categories.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Seeding Video Categories ===\n');

  // ──────────────────────────────────────────────
  // 1. Video Categories
  // ──────────────────────────────────────────────

  const categories = [
    {
      name: 'Podcast',
      slug: 'podcast',
      description: 'Épisodes de podcast audio et vidéo',
      icon: 'podcast',
      sortOrder: 1,
    },
    {
      name: 'Formation',
      slug: 'formation',
      description: 'Contenu de formation et éducatif',
      icon: 'graduation-cap',
      sortOrder: 2,
    },
    {
      name: 'Session Personnelle',
      slug: 'session-personnelle',
      description: 'Sessions individuelles avec les clients',
      icon: 'user',
      sortOrder: 3,
    },
    {
      name: 'Demo Produit',
      slug: 'demo-produit',
      description: 'Démonstrations et présentations de produits',
      icon: 'package',
      sortOrder: 4,
    },
    {
      name: 'Temoignage',
      slug: 'temoignage',
      description: 'Témoignages clients et histoires de réussite',
      icon: 'quote',
      sortOrder: 5,
    },
    {
      name: 'FAQ Video',
      slug: 'faq-video',
      description: 'Réponses vidéo aux questions fréquentes',
      icon: 'help-circle',
      sortOrder: 6,
    },
    {
      name: 'Webinaire',
      slug: 'webinaire',
      description: 'Enregistrements de webinaires',
      icon: 'monitor',
      sortOrder: 7,
    },
    {
      name: 'Tutoriel',
      slug: 'tutoriel',
      description: 'Vidéos tutorielles pas à pas',
      icon: 'book-open',
      sortOrder: 8,
    },
    {
      name: 'Brand Story',
      slug: 'brand-story',
      description: 'Storytelling de la marque et de l\'entreprise',
      icon: 'heart',
      sortOrder: 9,
    },
    {
      name: 'Recherche',
      slug: 'recherche',
      description: 'Actualités de recherche et contenu scientifique',
      icon: 'microscope',
      sortOrder: 10,
    },
  ];

  for (const cat of categories) {
    await prisma.videoCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        icon: cat.icon,
        sortOrder: cat.sortOrder,
      },
      create: cat,
    });
    console.log(`  [ok] ${cat.name} (${cat.slug})`);
  }

  console.log(`\n  ${categories.length} video categories seeded.\n`);

  // ──────────────────────────────────────────────
  // 2. Default Consent Form Template
  // ──────────────────────────────────────────────

  console.log('=== Seeding Default Consent Form Template ===\n');

  const consentTemplate = {
    name: 'Video Appearance Consent',
    slug: 'video-appearance-consent',
    description: 'Standard consent form for clients appearing in video content',
    version: 1,
    isActive: true,
    type: 'VIDEO_APPEARANCE' as const,
    questions: [
      {
        id: 'q1',
        question:
          'I consent to being recorded and featured in the described video content.',
        type: 'checkbox',
        required: true,
      },
      {
        id: 'q2',
        question:
          'I authorize BioCycle Peptides to use this content for marketing and educational purposes.',
        type: 'checkbox',
        required: true,
      },
      {
        id: 'q3',
        question:
          'I understand that I may revoke this consent at any time by contacting support.',
        type: 'checkbox',
        required: true,
      },
      {
        id: 'q4',
        question: 'Additional comments or conditions (optional)',
        type: 'text',
        required: false,
      },
      {
        id: 'q5',
        question: 'Electronic Signature',
        type: 'signature',
        required: true,
      },
    ],
    legalText:
      'By providing your electronic signature below, you confirm that you have read and understood the terms above. This consent is given voluntarily and may be revoked at any time. Revocation will result in the removal of your likeness from any unpublished content. Content already published at the time of revocation will be removed within 30 business days. This consent is governed by the laws of Canada.',
  };

  await prisma.consentFormTemplate.upsert({
    where: { slug: consentTemplate.slug },
    update: {
      name: consentTemplate.name,
      description: consentTemplate.description,
      version: consentTemplate.version,
      isActive: consentTemplate.isActive,
      type: consentTemplate.type,
      questions: consentTemplate.questions,
      legalText: consentTemplate.legalText,
    },
    create: consentTemplate,
  });

  console.log(`  [ok] ${consentTemplate.name} (${consentTemplate.slug})`);
  console.log('\n  1 consent form template seeded.\n');

  // ──────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────

  const totalCategories = await prisma.videoCategory.count();
  const totalTemplates = await prisma.consentFormTemplate.count();

  console.log('=== Summary ===');
  console.log(`  Total video categories in DB: ${totalCategories}`);
  console.log(`  Total consent templates in DB: ${totalTemplates}`);
  console.log('\nDone!');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
