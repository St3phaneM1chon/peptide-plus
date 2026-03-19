/**
 * Sync Knowledge Base — Export Aurelia KB + Prisma Products → Redis Embeddings
 *
 * This script builds the Voice AI knowledge base by:
 * 1. Exporting Aurelia Knowledge Islands (904 items from 28 domains)
 * 2. Exporting product catalog from Prisma (products, formats, prices)
 * 3. Exporting FAQ entries
 * 4. Exporting published articles
 * 5. Generating embeddings via OpenAI text-embedding-3-small
 * 6. Storing everything in Redis for fast RAG search during calls
 *
 * Usage:
 *   npx tsx scripts/sync-knowledge-base.ts
 *   npx tsx scripts/sync-knowledge-base.ts --products-only
 *   npx tsx scripts/sync-knowledge-base.ts --aurelia-only
 *
 * Schedule: Run nightly at 3:30 AM (after Aurelia Night Worker at 3 AM)
 */

import { PrismaClient } from '@prisma/client';

// ── Types ────────────────────────────────────────────────────────────────────

interface KBChunk {
  id: string;
  text: string;
  source: 'product' | 'faq' | 'article' | 'aurora_kb' | 'policy' | 'promotion';
  metadata: Record<string, string | undefined>;
  embedding?: number[];
}

interface KnowledgeEntry {
  id: string;
  type: string;
  content: string;
  confidence: number;
  source: string;
  verified: boolean;
}

// ── Configuration ────────────────────────────────────────────────────────────

const AURELIA_KB_PATH = '/Volumes/AI_Project/AttitudesVIP-iOS/.aurelia_data/knowledge_islands';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_BATCH_SIZE = 20;
const REDIS_KB_INDEX_KEY = 'voiceai:kb:index';
const REDIS_KB_STATS_KEY = 'voiceai:kb:stats';

// Relevant islands for voice AI (customer-facing knowledge)
const RELEVANT_ISLANDS = [
  'comptabilite',
  'ecommerce',
  'crm-ventes',
  'marketing',
  'fidelite',
  'securite-systeme',
  'telephonie',
  'peptide-plus',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY required');

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts.map(t => t.substring(0, 8000)),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  return data.data
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding);
}

async function getRedis() {
  const Redis = (await import('ioredis')).default;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  return client;
}

// ── Source 1: Aurelia Knowledge Islands ──────────────────────────────────────

async function exportAureliaKB(): Promise<KBChunk[]> {
  const fs = await import('fs');
  const path = await import('path');
  const chunks: KBChunk[] = [];

  console.log('\n📚 Exporting Aurelia Knowledge Islands...');

  for (const island of RELEVANT_ISLANDS) {
    const filePath = path.join(AURELIA_KB_PATH, `${island}.json`);

    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  Island not found: ${island}`);
      continue;
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as KnowledgeEntry[];

    // Filter for useful types (skip hypotheses and low-confidence entries)
    const useful = data.filter(entry =>
      ['fact', 'pattern', 'lesson'].includes(entry.type) &&
      entry.confidence >= 0.7 &&
      entry.content.length >= 20
    );

    for (const entry of useful) {
      chunks.push({
        id: `aurelia_${island}_${entry.id}`,
        text: `[${island.toUpperCase()}] ${entry.content}`,
        source: 'aurora_kb',
        metadata: {
          island,
          type: entry.type,
          confidence: String(entry.confidence),
        },
      });
    }

    console.log(`  ✅ ${island}: ${useful.length}/${data.length} entries exported`);
  }

  console.log(`  Total Aurelia chunks: ${chunks.length}`);
  return chunks;
}

// ── Source 2: Product Catalog ────────────────────────────────────────────────

async function exportProducts(prisma: PrismaClient): Promise<KBChunk[]> {
  const chunks: KBChunk[] = [];

  console.log('\n🛍️  Exporting Product Catalog...');

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      category: { select: { name: true } },
      formats: {
        where: { isActive: true },
        select: {
          name: true,
          price: true,
          comparePrice: true,
          sku: true,
          inStock: true,
          availability: true,
          dosageMg: true,
          volumeMl: true,
        },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  for (const product of products) {
    // Chunk 1: Product overview (name + description + category)
    const overview = [
      `Produit: ${product.name}`,
      product.shortDescription ? `Description: ${product.shortDescription}` : '',
      product.category ? `Catégorie: ${product.category.name}` : '',
      product.purity ? `Pureté: ${product.purity}` : '',
      product.molecularFormula ? `Formule: ${product.molecularFormula}` : '',
      product.storageConditions ? `Conservation: ${product.storageConditions}` : '',
    ].filter(Boolean).join('\n');

    chunks.push({
      id: `product_overview_${product.id}`,
      text: overview,
      source: 'product',
      metadata: {
        productId: product.id,
        productName: product.name,
        categoryName: product.category?.name || undefined,
      },
    });

    // Chunk 2: Pricing (all formats with prices)
    if (product.formats.length > 0) {
      const pricing = product.formats.map(f => {
        const parts = [`  - ${f.name}: ${Number(f.price).toFixed(2)} $ CAD`];
        if (f.comparePrice && Number(f.comparePrice) > Number(f.price)) {
          parts.push(`(prix régulier: ${Number(f.comparePrice).toFixed(2)} $)`);
        }
        if (f.dosageMg) parts.push(`(${f.dosageMg} mg)`);
        if (f.volumeMl) parts.push(`(${f.volumeMl} mL)`);
        parts.push(f.inStock ? '✓ En stock' : '✗ Rupture de stock');
        return parts.join(' ');
      }).join('\n');

      chunks.push({
        id: `product_pricing_${product.id}`,
        text: `Prix de ${product.name}:\n${pricing}`,
        source: 'product',
        metadata: {
          productId: product.id,
          productName: product.name,
          price: product.formats[0] ? String(Number(product.formats[0].price)) : undefined,
        },
      });
    }

    // Chunk 3: Full details (if available)
    if (product.fullDetails && product.fullDetails.length > 50) {
      chunks.push({
        id: `product_details_${product.id}`,
        text: `Détails de ${product.name}:\n${product.fullDetails.substring(0, 2000)}`,
        source: 'product',
        metadata: {
          productId: product.id,
          productName: product.name,
        },
      });
    }
  }

  console.log(`  ✅ ${products.length} products → ${chunks.length} chunks`);
  return chunks;
}

// ── Source 3: FAQ ────────────────────────────────────────────────────────────

async function exportFAQ(prisma: PrismaClient): Promise<KBChunk[]> {
  const chunks: KBChunk[] = [];

  console.log('\n❓ Exporting FAQ...');

  const faqs = await prisma.faq.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: 'asc' },
  });

  for (const faq of faqs) {
    chunks.push({
      id: `faq_${faq.id}`,
      text: `Question: ${faq.question}\nRéponse: ${faq.answer}`,
      source: 'faq',
      metadata: {
        category: faq.category,
        locale: faq.locale,
      },
    });
  }

  console.log(`  ✅ ${faqs.length} FAQ entries`);
  return chunks;
}

// ── Source 4: Articles ──────────────────────────────────────────────────────

async function exportArticles(prisma: PrismaClient): Promise<KBChunk[]> {
  const chunks: KBChunk[] = [];

  console.log('\n📄 Exporting Articles...');

  const articles = await prisma.article.findMany({
    where: { isPublished: true },
    select: {
      id: true,
      title: true,
      excerpt: true,
      content: true,
      category: true,
      tags: true,
    },
  });

  for (const article of articles) {
    const text = [
      `Article: ${article.title}`,
      article.excerpt ? `Résumé: ${article.excerpt}` : '',
      article.content ? article.content.substring(0, 1500) : '',
    ].filter(Boolean).join('\n');

    chunks.push({
      id: `article_${article.id}`,
      text,
      source: 'article',
      metadata: {
        category: article.category || undefined,
      },
    });
  }

  console.log(`  ✅ ${articles.length} articles`);
  return chunks;
}

// ── Source 5: Business Policies ──────────────────────────────────────────────

function getBusinessPolicies(): KBChunk[] {
  console.log('\n📋 Adding Business Policies...');

  const policies: KBChunk[] = [
    {
      id: 'policy_shipping',
      text: `Politique de livraison Attitudes VIP:
- Livraison gratuite au Canada pour les commandes de plus de 150 $ CAD
- Livraison standard: 3-5 jours ouvrables au Canada
- Livraison express: 1-2 jours ouvrables (frais supplémentaires)
- Livraison internationale disponible (délais variables)
- Tous les colis sont expédiés en emballage discret
- Numéro de suivi fourni par courriel`,
      source: 'policy',
      metadata: { category: 'shipping' },
    },
    {
      id: 'policy_returns',
      text: `Politique de retour Attitudes VIP:
- Retour accepté dans les 30 jours suivant la réception
- Le produit doit être dans son emballage original non ouvert
- Remboursement sur le mode de paiement original
- Les frais de retour sont à la charge du client sauf erreur de notre part
- Pour initier un retour, contacter le service client`,
      source: 'policy',
      metadata: { category: 'returns' },
    },
    {
      id: 'policy_research',
      text: `Avis important - Produits de recherche:
- Tous les peptides vendus par BioCycle Peptides / Attitudes VIP sont destinés exclusivement à la recherche scientifique
- Ils ne sont pas destinés à la consommation humaine ou animale
- Certificat d'analyse (CoA) disponible pour chaque lot
- Pureté HPLC ≥ 98% garantie
- Stockage recommandé: congélateur -20°C, lyophilisé`,
      source: 'policy',
      metadata: { category: 'research_disclaimer' },
    },
    {
      id: 'policy_loyalty',
      text: `Programme de fidélité Attitudes VIP:
- Tiers: BRONZE (0-499$), SILVER (500-999$), GOLD (1000-2499$), PLATINUM (2500$+), VIP (invitation)
- BRONZE: 1 point/$, accès boutique
- SILVER: 1.5 points/$, livraison gratuite
- GOLD: 2 points/$, accès ventes privées, support prioritaire
- PLATINUM: 3 points/$, remises exclusives, agent dédié
- VIP: avantages sur mesure, invitations événements
- 100 points = 1$ de réduction`,
      source: 'policy',
      metadata: { category: 'loyalty' },
    },
    {
      id: 'policy_contact',
      text: `Coordonnées Attitudes VIP:
- Téléphone Montréal: +1 (438) 803-0370
- Téléphone Toronto: +1 (437) 888-0370
- Sans frais: +1 (844) 304-0370
- Courriel: info@attitudes.vip
- Site web: attitudes.vip
- Heures: lundi au vendredi, 9h à 17h, heure de l'Est`,
      source: 'policy',
      metadata: { category: 'contact' },
    },
    {
      id: 'policy_payment',
      text: `Modes de paiement acceptés:
- Visa, Mastercard, American Express
- Interac (débit)
- PayPal
- Virement bancaire (commandes de plus de 500$)
- Toutes les transactions sont sécurisées (SSL/TLS)
- Les prix sont en dollars canadiens (CAD) sauf indication contraire
- Les taxes (TPS 5% + TVQ 9.975%) sont ajoutées au Québec`,
      source: 'policy',
      metadata: { category: 'payment' },
    },
  ];

  console.log(`  ✅ ${policies.length} business policies`);
  return policies;
}

// ── Main Sync Pipeline ──────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const productsOnly = args.includes('--products-only');
  const aureliaOnly = args.includes('--aurelia-only');

  console.log('🧠 Voice AI Knowledge Base Sync');
  console.log('================================');
  console.log(`Mode: ${productsOnly ? 'Products only' : aureliaOnly ? 'Aurelia only' : 'Full sync'}`);

  const prisma = new PrismaClient();
  let allChunks: KBChunk[] = [];

  try {
    // Collect chunks from all sources
    if (!productsOnly) {
      const aureliaChunks = await exportAureliaKB();
      allChunks.push(...aureliaChunks);
    }

    if (!aureliaOnly) {
      const productChunks = await exportProducts(prisma);
      allChunks.push(...productChunks);

      const faqChunks = await exportFAQ(prisma);
      allChunks.push(...faqChunks);

      const articleChunks = await exportArticles(prisma);
      allChunks.push(...articleChunks);
    }

    // Always include business policies
    const policyChunks = getBusinessPolicies();
    allChunks.push(...policyChunks);

    console.log(`\n📊 Total chunks to embed: ${allChunks.length}`);

    // Generate embeddings in batches
    console.log('\n🔄 Generating embeddings...');
    for (let i = 0; i < allChunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = allChunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const texts = batch.map(c => c.text);

      try {
        const embeddings = await generateEmbeddings(texts);
        for (let j = 0; j < batch.length; j++) {
          batch[j].embedding = embeddings[j];
        }
        console.log(`  Batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(allChunks.length / EMBEDDING_BATCH_SIZE)} ✅`);
      } catch (err) {
        console.error(`  Batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1} FAILED:`, err instanceof Error ? err.message : err);
        // Remove chunks that failed embedding
        for (const chunk of batch) {
          const idx = allChunks.indexOf(chunk);
          if (idx >= 0) allChunks.splice(idx, 1);
        }
      }

      // Rate limit: ~3000 RPM for text-embedding-3-small
      if (i + EMBEDDING_BATCH_SIZE < allChunks.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Filter out chunks without embeddings
    allChunks = allChunks.filter(c => c.embedding && c.embedding.length > 0);

    console.log(`\n✅ Successfully embedded: ${allChunks.length} chunks`);

    // Save to Redis
    console.log('\n💾 Saving to Redis...');
    const redis = await getRedis();

    // If not full sync, merge with existing data
    if (productsOnly || aureliaOnly) {
      const existing = await redis.get(REDIS_KB_INDEX_KEY);
      if (existing) {
        const existingChunks = JSON.parse(existing) as KBChunk[];
        const newIds = new Set(allChunks.map(c => c.id));

        // Keep chunks from other sources
        const kept = existingChunks.filter(c => !newIds.has(c.id));
        allChunks = [...kept, ...allChunks];
      }
    }

    await redis.set(REDIS_KB_INDEX_KEY, JSON.stringify(allChunks));

    const stats = {
      totalChunks: allChunks.length,
      bySource: allChunks.reduce((acc, c) => {
        acc[c.source] = (acc[c.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      lastSync: new Date().toISOString(),
      embeddingModel: EMBEDDING_MODEL,
    };

    await redis.set(REDIS_KB_STATS_KEY, JSON.stringify(stats));

    console.log('\n📊 Final Statistics:');
    console.log(JSON.stringify(stats, null, 2));

    await redis.quit();
    console.log('\n✅ Knowledge Base sync complete!');
  } catch (err) {
    console.error('\n❌ Sync failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
