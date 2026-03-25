/**
 * Import Real PQAP Exam Questions into QuestionBank
 * Source: /documents/formation assurance/ (324 questions extracted from DOCX)
 * Run: npx tsx scripts/import-exam-questions.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient({ log: ['error', 'warn'] });

interface ExtractedQuestion {
  question: string;
  options: string[];
  type: string;
}

interface QuestionSet {
  manual: string;
  source: string;
  questions: ExtractedQuestion[];
  count: number;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { status: 'ACTIVE' } });
  if (!tenant) { console.error('No active tenant'); process.exit(1); }
  const tenantId = tenant.id;

  // Load extracted questions
  const data: Record<string, QuestionSet> = JSON.parse(
    fs.readFileSync('scripts/exam-questions-extracted.json', 'utf-8')
  );

  // Domain mapping
  const domainMap: Record<string, string> = {
    'deontologie': 'deontologie_qc',
    'deontologie_ch1-2': 'deontologie_qc',
    'deontologie_ch3-4': 'deontologie_qc',
    'deontologie_supp': 'deontologie_qc',
    'accma': 'acc_maladie',
    'accma_supp': 'acc_maladie',
  };

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const [key, set] of Object.entries(data)) {
    const domain = domainMap[key] ?? key;
    const bankName = `PQAP ${set.manual} — ${set.source.replace('.docx', '')}`;

    // Check if bank already exists
    const existingBank = await prisma.questionBank.findFirst({
      where: { tenantId, name: bankName },
    });

    if (existingBank) {
      console.log(`  Skip (exists): ${bankName}`);
      totalSkipped += set.count;
      continue;
    }

    // Create bank
    const bank = await prisma.questionBank.create({
      data: {
        tenantId,
        name: bankName,
        description: `Questions extraites de: ${set.source} (Manuel ${set.manual})`,
        domain,
      },
    });

    // Create questions
    for (const q of set.questions) {
      const options = q.options.map((text, i) => ({
        id: String.fromCharCode(97 + i), // a, b, c, d
        text,
        isCorrect: false, // Answers not available in "sans réponses" files
      }));

      await prisma.questionBankItem.create({
        data: {
          bankId: bank.id,
          type: 'MULTIPLE_CHOICE',
          question: q.question,
          options: options,
          bloomLevel: 2, // Comprehension level (typical PQAP)
          difficulty: 'medium',
          tags: [set.manual, domain],
        },
      });
      totalCreated++;
    }

    console.log(`  Created: ${bankName} (${set.count} questions)`);
  }

  console.log(`\nDone: ${totalCreated} questions created, ${totalSkipped} skipped`);
  await prisma.$disconnect();
}

main().catch(console.error);
