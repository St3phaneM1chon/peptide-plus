/**
 * Voice AI Daily Sync — Bidirectional Learning (Voice AI ↔ Aurelia)
 *
 * Runs nightly (integrated with Aurelia Night Worker at 3:30 AM):
 *
 * 1. EXPORT Voice AI → Aurelia:
 *    - Summarize 24h of conversations
 *    - Extract unresolved questions → add to Aurelia KB
 *    - Extract new client vocabulary → add as aliases
 *
 * 2. ANALYZE Patterns:
 *    - Top questions asked
 *    - Unresolved intents
 *    - Most requested products
 *    - Language distribution
 *
 * 3. REFRESH Aurelia → Voice AI:
 *    - Re-sync knowledge base (runs sync-knowledge-base.ts)
 *
 * 4. DAILY REPORT:
 *    - Stats (calls resolved by AI, transfer rate, top questions)
 *
 * Usage:
 *   npx tsx scripts/voice-ai-daily-sync.ts
 *   npx tsx scripts/voice-ai-daily-sync.ts --dry-run
 */

import { execSync } from 'child_process';

// ── Types ────────────────────────────────────────────────────────────────────

interface ConversationLog {
  callControlId: string;
  callerNumber: string;
  language: string;
  duration: number;
  turnCount: number;
  resolved: boolean;
  transferredToAgent: boolean;
  questionsAsked: string[];
  unresolvedQuestions: string[];
  timestamp: string;
  summary: string[];
}

interface DailyReport {
  date: string;
  totalCalls: number;
  resolvedByAI: number;
  transferredToAgent: number;
  resolutionRate: number;
  avgDuration: number;
  avgTurns: number;
  topQuestions: Array<{ question: string; count: number }>;
  unresolvedQuestions: Array<{ question: string; count: number }>;
  languageDistribution: Record<string, number>;
  newKnowledgeAdded: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DAILY_LOG_KEY = 'voiceai:daily_log';
const DAILY_REPORT_PREFIX = 'voiceai:report:';
const AURELIA_VECTOR_STORE = '/Volumes/AI_Project/AttitudesVIP-iOS/Scripts/aurelia_vector_store.py';
// Knowledge islands script path (used for future enrichment)
// const AURELIA_KB_SCRIPT = '/Volumes/AI_Project/AttitudesVIP-iOS/Scripts/aurelia_knowledge_islands.py';
const PYTHON = '/opt/homebrew/bin/python3.13';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getRedis() {
  const Redis = (await import('ioredis')).default;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl, { maxRetriesPerRequest: 3 });
}

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout: 30_000 }).trim();
  } catch {
    return '';
  }
}

// ── Phase 1: Export Voice AI Conversations → Aurelia ─────────────────────────

async function exportToAurelia(logs: ConversationLog[], dryRun: boolean): Promise<number> {
  console.log('\n📤 Phase 1: Exporting Voice AI learnings to Aurelia...');

  let addedCount = 0;

  // Collect unresolved questions
  const unresolvedMap = new Map<string, number>();
  for (const log of logs) {
    for (const q of log.unresolvedQuestions) {
      const normalized = q.toLowerCase().trim();
      unresolvedMap.set(normalized, (unresolvedMap.get(normalized) || 0) + 1);
    }
  }

  // Add frequently unresolved questions as new KB entries
  const frequent = Array.from(unresolvedMap.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  for (const [question, count] of frequent.slice(0, 10)) {
    const today = new Date().toISOString().split('T')[0];
    const vectorId = `learning-voiceai-unresolved-${today}-${addedCount}`;
    const description = `[VOICE-AI] Question fréquente non résolue (${count}x): "${question}". Nécessite ajout à la base de connaissances ou formation de l'IA.`;

    if (!dryRun) {
      safeExec(`${PYTHON} ${AURELIA_VECTOR_STORE} --add "${description.replace(/"/g, '\\"')}" --id "${vectorId}"`);
    }

    console.log(`  📝 Unresolved (${count}x): ${question.substring(0, 80)}`);
    addedCount++;
  }

  // Add daily summary as a learning
  if (logs.length > 0 && !dryRun) {
    const today = new Date().toISOString().split('T')[0];
    const resolved = logs.filter(l => l.resolved).length;
    const transferred = logs.filter(l => l.transferredToAgent).length;
    const summary = `[VOICE-AI DAILY] ${today}: ${logs.length} appels, ${resolved} résolus par IA (${(resolved / logs.length * 100).toFixed(0)}%), ${transferred} transférés. Top questions non résolues: ${frequent.slice(0, 3).map(([q]) => q.substring(0, 50)).join('; ')}`;

    safeExec(`${PYTHON} ${AURELIA_VECTOR_STORE} --add "${summary.replace(/"/g, '\\"')}" --id "learning-voiceai-daily-${today}"`);
  }

  console.log(`  ✅ ${addedCount} new entries added to Aurelia`);
  return addedCount;
}

// ── Phase 2: Analyze Patterns ────────────────────────────────────────────────

function analyzePatterns(logs: ConversationLog[]): DailyReport {
  console.log('\n📊 Phase 2: Analyzing patterns...');

  const today = new Date().toISOString().split('T')[0];

  // Question frequency analysis
  const questionMap = new Map<string, number>();
  const unresolvedMap = new Map<string, number>();
  const langMap: Record<string, number> = {};

  for (const log of logs) {
    // Language stats
    langMap[log.language] = (langMap[log.language] || 0) + 1;

    // Questions
    for (const q of log.questionsAsked) {
      const normalized = q.toLowerCase().trim().substring(0, 100);
      questionMap.set(normalized, (questionMap.get(normalized) || 0) + 1);
    }

    for (const q of log.unresolvedQuestions) {
      const normalized = q.toLowerCase().trim().substring(0, 100);
      unresolvedMap.set(normalized, (unresolvedMap.get(normalized) || 0) + 1);
    }
  }

  const topQuestions = Array.from(questionMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([question, count]) => ({ question, count }));

  const unresolvedQuestions = Array.from(unresolvedMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([question, count]) => ({ question, count }));

  const resolved = logs.filter(l => l.resolved).length;
  const transferred = logs.filter(l => l.transferredToAgent).length;

  const report: DailyReport = {
    date: today,
    totalCalls: logs.length,
    resolvedByAI: resolved,
    transferredToAgent: transferred,
    resolutionRate: logs.length > 0 ? resolved / logs.length : 0,
    avgDuration: logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + l.duration, 0) / logs.length)
      : 0,
    avgTurns: logs.length > 0
      ? Math.round(logs.reduce((sum, l) => sum + l.turnCount, 0) / logs.length)
      : 0,
    topQuestions,
    unresolvedQuestions,
    languageDistribution: langMap,
    newKnowledgeAdded: 0,
  };

  console.log(`  Total calls: ${report.totalCalls}`);
  console.log(`  Resolution rate: ${(report.resolutionRate * 100).toFixed(1)}%`);
  console.log(`  Avg duration: ${report.avgDuration}s`);
  console.log(`  Top questions: ${topQuestions.slice(0, 3).map(q => q.question.substring(0, 40)).join(', ')}`);

  return report;
}

// ── Phase 3: Refresh KB ──────────────────────────────────────────────────────

async function refreshKB(dryRun: boolean): Promise<void> {
  console.log('\n🔄 Phase 3: Refreshing Knowledge Base...');

  if (dryRun) {
    console.log('  [DRY RUN] Would run sync-knowledge-base.ts');
    return;
  }

  try {
    const output = execSync(
      'npx tsx scripts/sync-knowledge-base.ts',
      { cwd: '/Volumes/AI_Project/peptide-plus', encoding: 'utf-8', timeout: 300_000 }
    );
    console.log(output.split('\n').slice(-5).join('\n'));
  } catch (err) {
    console.error('  ❌ KB refresh failed:', err instanceof Error ? err.message : err);
  }
}

// ── Phase 4: Save Daily Report ───────────────────────────────────────────────

async function saveReport(report: DailyReport, redis: Awaited<ReturnType<typeof getRedis>>): Promise<void> {
  console.log('\n💾 Phase 4: Saving daily report...');

  await redis.set(
    `${DAILY_REPORT_PREFIX}${report.date}`,
    JSON.stringify(report),
    'EX',
    30 * 24 * 3600 // Keep reports for 30 days
  );

  // Save to file for easy access
  const fs = await import('fs');
  const reportDir = '/Volumes/AI_Project/peptide-plus/logs/voice-ai-reports';
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = `${reportDir}/report-${report.date}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`  ✅ Report saved: ${reportPath}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('🤖 Voice AI Daily Sync');
  console.log('======================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Date: ${new Date().toISOString()}`);

  const redis = await getRedis();

  try {
    // Fetch all conversation logs from the last 24 hours
    const logsRaw: string[] = [];
    let cursor = 0;
    do {
      const item = await redis.rpop(DAILY_LOG_KEY);
      if (!item) break;
      logsRaw.push(item);
      cursor++;
    } while (cursor < 1000);

    const logs: ConversationLog[] = logsRaw
      .map(raw => {
        try { return JSON.parse(raw); } catch { return null; }
      })
      .filter(Boolean) as ConversationLog[];

    console.log(`\n📋 Found ${logs.length} conversation logs`);

    if (logs.length === 0) {
      console.log('No conversations to process. Exiting.');
      await redis.quit();
      return;
    }

    // Phase 1: Export to Aurelia
    const newKnowledge = await exportToAurelia(logs, dryRun);

    // Phase 2: Analyze patterns
    const report = analyzePatterns(logs);
    report.newKnowledgeAdded = newKnowledge;

    // Phase 3: Refresh KB (full re-embed)
    await refreshKB(dryRun);

    // Phase 4: Save report
    if (!dryRun) {
      await saveReport(report, redis);
    }

    console.log('\n✅ Voice AI Daily Sync complete!');
    console.log(`   Resolution rate: ${(report.resolutionRate * 100).toFixed(1)}%`);
    console.log(`   New knowledge added: ${newKnowledge}`);
    console.log(`   Top unresolved: ${report.unresolvedQuestions.slice(0, 3).map(q => q.question.substring(0, 40)).join(', ') || 'none'}`);
  } finally {
    await redis.quit();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
