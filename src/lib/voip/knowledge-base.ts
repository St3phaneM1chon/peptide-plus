/**
 * Voice AI Knowledge Base — RAG for Real-Time Call Answering
 *
 * Aggregates knowledge from multiple sources:
 * 1. Aurelia Knowledge Islands (904 items, 28 domains)
 * 2. Product catalog (Prisma DB — products, formats, prices)
 * 3. FAQ database
 * 4. Articles & guides
 * 5. CRM client context (per-call)
 *
 * Uses Redis for fast vectorial search (<50ms) during calls.
 * Embeddings via OpenAI text-embedding-3-small (1536 dims).
 */

import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

// ── Types ────────────────────────────────────────────────────────────────────

export interface KBChunk {
  id: string;
  text: string;
  source: 'product' | 'faq' | 'article' | 'aurora_kb' | 'policy' | 'promotion';
  metadata: {
    productId?: string;
    productName?: string;
    categoryName?: string;
    price?: string;
    island?: string;
    locale?: string;
    [key: string]: string | undefined;
  };
  embedding?: number[];
}

export interface KBSearchResult {
  chunk: KBChunk;
  score: number;
}

export interface ClientContext {
  clientId?: string;
  name?: string;
  email?: string;
  phone?: string;
  loyaltyTier?: string;
  totalOrders?: number;
  lastOrderDate?: string;
  openDeals?: Array<{ title: string; stage: string; value: number }>;
  recentTickets?: Array<{ subject: string; status: string }>;
}

// ── Constants ────────────────────────────────────────────────────────────────

const KB_INDEX_KEY = 'voiceai:kb:index';
const KB_STATS_KEY = 'voiceai:kb:stats';
const EMBEDDING_DIM = 1536;

// ── Embedding ────────────────────────────────────────────────────────────────

let _openai: { createEmbedding: (text: string) => Promise<number[]> } | null = null;

async function getEmbedder() {
  if (_openai) return _openai;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured for embeddings');

  _openai = {
    async createEmbedding(text: string): Promise<number[]> {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.substring(0, 8000),
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>;
      };
      return data.data[0].embedding;
    },
  };

  return _openai;
}

// ── Cosine Similarity ────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ── Knowledge Base Manager ───────────────────────────────────────────────────

export class VoiceAIKnowledgeBase {
  private chunks: KBChunk[] = [];
  private loaded = false;

  /**
   * Load the knowledge base from Redis into memory for fast search.
   * Called once at startup, refreshed nightly.
   */
  async load(): Promise<void> {
    const redis = await getRedisClient();

    if (redis) {
      try {
        const indexData = await redis.get(KB_INDEX_KEY);
        if (indexData) {
          this.chunks = JSON.parse(indexData);
          this.loaded = true;
          logger.info('[KnowledgeBase] Loaded from Redis', {
            chunks: this.chunks.length,
          });
          return;
        }
      } catch (err) {
        logger.warn('[KnowledgeBase] Failed to load from Redis, will use empty KB', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Fallback: empty KB (sync-knowledge-base.ts must run first)
    this.chunks = [];
    this.loaded = true;
    logger.warn('[KnowledgeBase] No data in Redis — run sync-knowledge-base script');
  }

  /**
   * Search the knowledge base for relevant chunks.
   * Uses cosine similarity on pre-computed embeddings.
   */
  async search(query: string, options?: {
    limit?: number;
    sources?: KBChunk['source'][];
    minScore?: number;
  }): Promise<KBSearchResult[]> {
    if (!this.loaded) await this.load();

    const limit = options?.limit || 5;
    const minScore = options?.minScore || 0.3;

    try {
      const embedder = await getEmbedder();
      const queryEmbedding = await embedder.createEmbedding(query);

      let candidates = this.chunks;

      // Filter by source if specified
      if (options?.sources) {
        candidates = candidates.filter(c => options.sources!.includes(c.source));
      }

      // Score all chunks
      const scored: KBSearchResult[] = candidates
        .filter(c => c.embedding && c.embedding.length === EMBEDDING_DIM)
        .map(chunk => ({
          chunk,
          score: cosineSimilarity(queryEmbedding, chunk.embedding!),
        }))
        .filter(r => r.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      logger.debug('[KnowledgeBase] Search completed', {
        query: query.substring(0, 60),
        results: scored.length,
        topScore: scored[0]?.score.toFixed(3),
      });

      return scored;
    } catch (err) {
      logger.error('[KnowledgeBase] Search failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fallback: keyword search
      return this.keywordSearch(query, limit);
    }
  }

  /**
   * Keyword-based fallback search (no embeddings needed).
   */
  private keywordSearch(query: string, limit: number): KBSearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (terms.length === 0) return [];

    return this.chunks
      .map(chunk => {
        const text = chunk.text.toLowerCase();
        const matches = terms.filter(t => text.includes(t));
        const score = matches.length / terms.length;
        return { chunk, score };
      })
      .filter(r => r.score > 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Build the context string for the LLM from search results.
   */
  buildRAGContext(results: KBSearchResult[]): string {
    if (results.length === 0) return '';

    const sections = results.map((r, i) => {
      const meta = r.chunk.metadata;
      const source = r.chunk.source === 'product'
        ? `Produit: ${meta.productName || 'N/A'}`
        : r.chunk.source === 'faq'
          ? 'FAQ'
          : r.chunk.source === 'aurora_kb'
            ? `Base de connaissances (${meta.island || 'général'})`
            : r.chunk.source;

      return `[${i + 1}] ${source} (pertinence: ${(r.score * 100).toFixed(0)}%)\n${r.chunk.text}`;
    });

    return '--- INFORMATIONS VÉRIFIÉES ---\n' + sections.join('\n\n');
  }

  /**
   * Add or update chunks in the knowledge base.
   * Used by the sync script.
   */
  async upsertChunks(newChunks: KBChunk[]): Promise<void> {
    // Merge with existing chunks (replace by ID)
    const existingMap = new Map(this.chunks.map(c => [c.id, c]));
    for (const chunk of newChunks) {
      existingMap.set(chunk.id, chunk);
    }
    this.chunks = Array.from(existingMap.values());

    // Persist to Redis
    const redis = await getRedisClient();
    if (redis) {
      await redis.set(KB_INDEX_KEY, JSON.stringify(this.chunks));
      await redis.set(KB_STATS_KEY, JSON.stringify({
        totalChunks: this.chunks.length,
        bySource: this.getSourceStats(),
        lastSync: new Date().toISOString(),
      }));

      logger.info('[KnowledgeBase] Saved to Redis', {
        totalChunks: this.chunks.length,
      });
    }
  }

  /**
   * Get knowledge base statistics.
   */
  getStats(): {
    totalChunks: number;
    bySource: Record<string, number>;
    loaded: boolean;
  } {
    return {
      totalChunks: this.chunks.length,
      bySource: this.getSourceStats(),
      loaded: this.loaded,
    };
  }

  private getSourceStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const chunk of this.chunks) {
      stats[chunk.source] = (stats[chunk.source] || 0) + 1;
    }
    return stats;
  }
}

// ── CRM Context Lookup ───────────────────────────────────────────────────────

/**
 * Look up client context by phone number for personalized AI responses.
 * Called at the start of each Voice AI call.
 */
export async function lookupClientContext(phoneNumber: string): Promise<ClientContext | null> {
  try {
    const { prisma } = await import('@/lib/db');
    const normalized = phoneNumber.replace(/^\+?1/, '').slice(-10);

    if (normalized.length < 10) return null;

    const user = await prisma.user.findFirst({
      where: {
        phone: { contains: normalized },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        loyaltyTier: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            createdAt: true,
            total: true,
            status: true,
          },
        },
      },
    });

    if (!user) return null;

    // Get open CRM deals
    let openDeals: Array<{ title: string; stage: string; value: number }> = [];
    try {
      const deals = await prisma.crmDeal.findMany({
        where: {
          contactId: user.id,
          actualCloseDate: null, // Open deals (not closed)
        },
        select: {
          title: true,
          value: true,
          stage: { select: { name: true } },
        },
        take: 3,
      });
      openDeals = deals.map(d => ({
        title: d.title,
        stage: d.stage?.name || 'Open',
        value: Number(d.value) || 0,
      }));
    } catch {
      // CRM deals lookup is non-critical
    }

    return {
      clientId: user.id,
      name: user.name || undefined,
      email: user.email || undefined,
      phone: user.phone || undefined,
      loyaltyTier: user.loyaltyTier || undefined,
      totalOrders: user.orders.length,
      lastOrderDate: user.orders[0]?.createdAt?.toISOString(),
      openDeals,
    };
  } catch (err) {
    logger.warn('[KnowledgeBase] Client lookup failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _knowledgeBase: VoiceAIKnowledgeBase | null = null;

export function getKnowledgeBase(): VoiceAIKnowledgeBase {
  if (!_knowledgeBase) {
    _knowledgeBase = new VoiceAIKnowledgeBase();
  }
  return _knowledgeBase;
}
