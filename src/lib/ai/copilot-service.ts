/**
 * AI Copilot Service - BioCycle Peptides Admin
 *
 * Context-aware AI assistant for admin users.
 * Provides: customer summaries, anomaly detection, email drafts,
 * next-best-action suggestions, and dashboard insights.
 *
 * Prefers Claude (Anthropic) when ANTHROPIC_API_KEY is set.
 * Falls back to OpenAI gpt-4o otherwise.
 * Uses lazy initialization (KB-PP-BUILD-002 pattern).
 */

import { prisma } from '@/lib/db';

// ---------------------------------------------------------------------------
// Unified AI completion layer (Claude preferred, OpenAI fallback)
// ---------------------------------------------------------------------------

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

let _anthropic: any | null = null;
let _openai: any | null = null;

function usesClaude(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

async function getAnthropic() {
  if (_anthropic) return _anthropic;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

async function getOpenAI() {
  if (_openai) return _openai;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('No AI API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
  }
  const { default: OpenAIClient } = await import('openai');
  _openai = new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const CLAUDE_FAST = 'claude-haiku-4-5-20251001';
const GPT_MODEL = 'gpt-4o';
const GPT_FAST = 'gpt-4o-mini';

async function aiComplete(
  messages: ChatMessage[],
  options: { fast?: boolean; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const { fast = false, maxTokens = 800, temperature = 0.3 } = options;

  if (usesClaude()) {
    const anthropic = await getAnthropic();
    const systemMsg = messages.find(m => m.role === 'system')?.content || '';
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const response = await anthropic.messages.create({
      model: fast ? CLAUDE_FAST : CLAUDE_MODEL,
      max_tokens: maxTokens,
      temperature,
      system: systemMsg,
      messages: nonSystemMsgs.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
    });

    return response.content[0]?.text || '';
  } else {
    const openai = await getOpenAI();
    const completion = await openai.chat.completions.create({
      model: fast ? GPT_FAST : GPT_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    });
    return completion.choices[0]?.message?.content || '';
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CopilotAction =
  | 'summarize_customer'
  | 'draft_email'
  | 'next_best_action'
  | 'explain_anomaly'
  | 'dashboard_insights'
  | 'seo_suggestions'
  | 'summarize_notes'
  | 'morning_briefing'
  | 'generate_report'
  | 'generate_variants'
  | 'extract_invoice'
  | 'predict_stock'
  | 'churn_alerts'
  | 'nli_search'
  | 'chat';

export interface CopilotRequest {
  action: CopilotAction;
  context: {
    page?: string;       // current admin page path
    entityId?: string;   // e.g. customer/order/deal ID
    entityType?: string; // 'customer' | 'order' | 'deal' | 'lead' | 'product'
    selection?: string;  // selected text or data
  };
  message?: string;      // user free-text message
  locale?: string;
}

export interface CopilotResponse {
  content: string;
  suggestions?: string[];
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const SYSTEM_BASE = `You are the AI Copilot for BioCycle Peptides admin dashboard.
You help admin users be more productive by providing insights, summaries, and suggestions.

RULES:
- Be concise and actionable (max 3-4 paragraphs unless more detail is requested)
- Use bullet points and bold for key information
- Reference specific numbers, dates, and names from the data provided
- If you don't have enough data, say so honestly
- Respond in the user's language (based on locale provided)
- Use currency CAD unless specified otherwise
- Format numbers with proper locale separators`;

// ---------------------------------------------------------------------------
// Customer Summary
// ---------------------------------------------------------------------------

export async function summarizeCustomer(customerId: string, locale: string): Promise<CopilotResponse> {
  const customer = await prisma.user.findUnique({
    where: { id: customerId },
    select: {
      id: true, name: true, email: true, role: true, createdAt: true,
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          orderNumber: true, total: true, status: true, createdAt: true,
          items: { select: { productName: true, quantity: true } },
        },
      },
      assignedLeads: {
        take: 3,
        select: {
          status: true,
          activities: { orderBy: { createdAt: 'desc' }, take: 5, select: { type: true, createdAt: true } },
          deals: { select: { value: true, stage: { select: { name: true } } } },
        },
      },
    },
  });

  if (!customer) {
    return { content: 'Customer not found.' };
  }

  const orderSummary = customer.orders.map(o => ({
    number: o.orderNumber,
    total: Number(o.total),
    status: o.status,
    date: o.createdAt.toISOString().split('T')[0],
    products: o.items.map(i => i.productName),
  }));

  const totalSpent = customer.orders.reduce((sum: number, o) => sum + Number(o.total), 0);
  const leadInfo = customer.assignedLeads[0];

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

Generate a concise customer summary card. Include:
1. **Profile**: Name, email, role, member since
2. **Order History**: Total orders, total spent, last order date, top products
3. **CRM Status**: Lead status, recent activities, open deals
4. **Health Score**: Rate 1-10 based on recency, frequency, monetary value
5. **Recommended Actions**: 2-3 specific next steps

Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: JSON.stringify({
        name: customer.name,
        email: customer.email,
        role: customer.role,
        memberSince: customer.createdAt.toISOString().split('T')[0],
        totalOrders: customer.orders.length,
        totalSpent,
        recentOrders: orderSummary.slice(0, 5),
        lead: leadInfo ? {
          status: leadInfo.status,
          recentActivities: leadInfo.activities.length,
          deals: leadInfo.deals.map((d) => ({ stage: d.stage?.name, value: Number(d.value) })),
        } : null,
      }),
    },
  ], { fast: true });

  return {
    content,
    suggestions: [
      'Draft a follow-up email',
      'View order history',
      'Create a deal',
    ],
    metadata: { totalSpent, orderCount: customer.orders.length },
  };
}

// ---------------------------------------------------------------------------
// Dashboard Insights (Anomaly Detection)
// ---------------------------------------------------------------------------

export async function getDashboardInsights(locale: string): Promise<CopilotResponse> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeekStart = new Date(today.getTime() - 7 * 86400000);
  const prevWeekStart = new Date(today.getTime() - 14 * 86400000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    ordersToday,
    ordersYesterday,
    ordersThisWeek,
    ordersPrevWeek,
    revenueThisMonth,
    revenueLastMonth,
    lowStockCount,
    pendingOrders,
    newCustomersThisWeek,
    newCustomersPrevWeek,
    topProducts,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: today } } }),
    prisma.order.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    prisma.order.count({ where: { createdAt: { gte: lastWeekStart } } }),
    prisma.order.count({ where: { createdAt: { gte: prevWeekStart, lt: lastWeekStart } } }),
    prisma.order.aggregate({ where: { createdAt: { gte: thisMonthStart }, paymentStatus: 'PAID' }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart }, paymentStatus: 'PAID' }, _sum: { total: true } }),
    prisma.productFormat.count({ where: { stockQuantity: { lte: 5 }, product: { isActive: true } } }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.user.count({ where: { createdAt: { gte: lastWeekStart }, role: 'CUSTOMER' } }),
    prisma.user.count({ where: { createdAt: { gte: prevWeekStart, lt: lastWeekStart }, role: 'CUSTOMER' } }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5,
      where: { order: { createdAt: { gte: lastWeekStart } } },
    }),
  ]);

  // Fetch product names for top products
  const productIds = topProducts.map(p => p.productId).filter(Boolean) as string[];
  const products = productIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    : [];
  const productMap = new Map(products.map(p => [p.id, p.name]));

  const revThisMonth = Number(revenueThisMonth._sum.total || 0);
  const revLastMonth = Number(revenueLastMonth._sum.total || 0);

  const dataPayload = {
    ordersToday,
    ordersYesterday,
    ordersThisWeek,
    ordersPrevWeek,
    weekOverWeekOrderChange: ordersPrevWeek > 0 ? ((ordersThisWeek - ordersPrevWeek) / ordersPrevWeek * 100).toFixed(1) + '%' : 'N/A',
    revenueThisMonth: revThisMonth,
    revenueLastMonth: revLastMonth,
    monthOverMonthRevenueChange: revLastMonth > 0 ? ((revThisMonth - revLastMonth) / revLastMonth * 100).toFixed(1) + '%' : 'N/A',
    lowStockAlerts: lowStockCount,
    pendingOrders,
    newCustomersThisWeek,
    newCustomersPrevWeek,
    topSellingProducts: topProducts.map(p => ({
      name: productMap.get(p.productId || '') || 'Unknown',
      quantity: p._sum.quantity,
    })),
  };

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

Analyze this business data and provide 3-5 actionable insights. Focus on:
1. **Anomalies**: Unusual spikes or drops vs previous period
2. **Trends**: Growing/declining patterns
3. **Alerts**: Stock issues, pending orders, customer acquisition changes
4. **Opportunities**: Based on top products and customer behavior
5. **Recommendations**: Specific actions to take today

Format each insight with an emoji prefix:
- 📈 for positive trends
- 📉 for negative trends
- ⚠️ for alerts/anomalies
- 💡 for opportunities/recommendations

Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: JSON.stringify(dataPayload),
    },
  ], { fast: true, maxTokens: 600, temperature: 0.4 });

  return {
    content,
    metadata: {
      ordersToday,
      revenueThisMonth: revThisMonth,
      lowStockCount,
      pendingOrders,
    },
  };
}

// ---------------------------------------------------------------------------
// Draft Email
// ---------------------------------------------------------------------------

export async function draftEmail(
  context: { entityId?: string; entityType?: string; selection?: string },
  userInstruction: string,
  locale: string,
): Promise<CopilotResponse> {
  let contextData = '';

  if (context.entityType === 'customer' && context.entityId) {
    const customer = await prisma.user.findUnique({
      where: { id: context.entityId },
      select: { name: true, email: true, orders: { take: 3, orderBy: { createdAt: 'desc' }, select: { orderNumber: true, total: true, status: true } } },
    });
    if (customer) {
      contextData = `Customer: ${customer.name} (${customer.email})\nRecent orders: ${JSON.stringify(customer.orders)}`;
    }
  } else if (context.entityType === 'order' && context.entityId) {
    const order = await prisma.order.findUnique({
      where: { id: context.entityId },
      select: { orderNumber: true, total: true, status: true, paymentStatus: true, shippingName: true },
    });
    if (order) {
      contextData = `Order: ${JSON.stringify(order)}`;
    }
  }

  if (context.selection) {
    contextData += `\n\nSelected text/context: ${context.selection}`;
  }

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

Draft a professional email for BioCycle Peptides. The sender is a BioCycle admin team member.

Include:
- Subject line
- Email body
- Professional closing

Context data about the recipient/situation is provided below.
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: `${userInstruction}\n\n---\nContext:\n${contextData}`,
    },
  ], { temperature: 0.5 });

  return {
    content,
    suggestions: ['Copy to clipboard', 'Adjust tone', 'Make shorter'],
  };
}

// ---------------------------------------------------------------------------
// Next Best Action (AI-enhanced)
// ---------------------------------------------------------------------------

export async function getNextBestActionAI(
  entityType: string,
  entityId: string,
  locale: string,
): Promise<CopilotResponse> {
  // Use the existing rule-based engine first
  const { getNextBestActions } = await import('@/lib/crm/next-best-action');
  const nbaType = entityType === 'deal' ? 'deal' : 'lead';
  const suggestions = await getNextBestActions(nbaType, entityId);

  // Fetch entity context for AI enrichment
  let entityContext = '';
  if (nbaType === 'lead') {
    const lead = await prisma.crmLead.findUnique({
      where: { id: entityId },
      select: { contactName: true, companyName: true, status: true, score: true, source: true, email: true, phone: true },
    });
    if (lead) entityContext = JSON.stringify(lead);
  } else {
    const deal = await prisma.crmDeal.findUnique({
      where: { id: entityId },
      select: { title: true, value: true, stage: { select: { name: true } }, expectedCloseDate: true },
    });
    if (deal) entityContext = JSON.stringify(deal);
  }

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

You're providing next-best-action recommendations for a CRM ${nbaType}.
A rule-based engine already produced suggestions. Enrich them with:
1. **Priority actions** — What to do RIGHT NOW (most urgent)
2. **Strategy tips** — How to approach each action for best results
3. **Talking points** — If calling/emailing, what to say
4. **Risk assessment** — What happens if no action is taken

Use emoji priorities: 🔴 urgent, 🟡 medium, 🟢 low
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: `Entity data:\n${entityContext}\n\nRule-based suggestions:\n${JSON.stringify(suggestions)}`,
    },
  ], { fast: true, maxTokens: 600, temperature: 0.4 });

  return {
    content,
    suggestions: suggestions.slice(0, 3).map(s => s.action),
    metadata: { entityType: nbaType, suggestionsCount: suggestions.length },
  };
}

// ---------------------------------------------------------------------------
// SEO Suggestions
// ---------------------------------------------------------------------------

export async function getSeoSuggestions(
  entityType: string,
  entityId: string,
  locale: string,
): Promise<CopilotResponse> {
  let entityData: Record<string, unknown> = {};

  if (entityType === 'product') {
    const product = await prisma.product.findUnique({
      where: { id: entityId },
      select: {
        name: true, slug: true, description: true,
        metaTitle: true, metaDescription: true,
        category: { select: { name: true } },
        tags: true,
      },
    });
    if (product) entityData = product as Record<string, unknown>;
  } else if (entityType === 'article') {
    const article = await prisma.article.findUnique({
      where: { id: entityId },
      select: {
        title: true, slug: true, content: true,
        metaTitle: true, metaDescription: true,
      },
    });
    if (article) {
      entityData = {
        ...article,
        content: typeof article.content === 'string' ? article.content.slice(0, 500) : '',
      };
    }
  }

  if (Object.keys(entityData).length === 0) {
    return { content: 'Entity not found or unsupported type for SEO analysis.' };
  }

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

You're an SEO expert for BioCycle Peptides, a Canadian research peptide supplier.
Analyze the provided ${entityType} data and provide actionable SEO recommendations:

1. **Meta Title** — Suggest an optimized title (50-60 chars, include primary keyword)
2. **Meta Description** — Suggest a compelling description (150-160 chars, include CTA)
3. **Content Gaps** — What's missing from the description/content for better ranking
4. **Keywords** — 5-8 target keywords (primary + long-tail)
5. **Quick Wins** — 3 easy improvements to make right now
6. **Score** — Rate current SEO 1-10 with brief justification

Focus on: peptide research, laboratory supplies, Canadian market, scientific terminology.
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: JSON.stringify(entityData),
    },
  ], { fast: true, maxTokens: 800, temperature: 0.3 });

  return {
    content,
    suggestions: ['Apply meta title', 'Apply meta description', 'Generate keywords'],
  };
}

// ---------------------------------------------------------------------------
// Summarize Notes / Meeting
// ---------------------------------------------------------------------------

export async function summarizeNotes(
  entityId: string,
  entityType: string,
  locale: string,
): Promise<CopilotResponse> {
  let notes: { type: string; description: string | null; createdAt: Date }[] = [];

  if (entityType === 'lead') {
    const activities = await prisma.crmActivity.findMany({
      where: { leadId: entityId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { type: true, description: true, createdAt: true },
    });
    notes = activities;
  } else if (entityType === 'deal') {
    const activities = await prisma.crmActivity.findMany({
      where: { dealId: entityId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { type: true, description: true, createdAt: true },
    });
    notes = activities;
  }

  if (notes.length === 0) {
    return { content: 'No notes or activities found for this entity.' };
  }

  const notesText = notes.map(n =>
    `[${n.createdAt.toISOString().split('T')[0]}] ${n.type}: ${n.description || '(no description)'}`
  ).join('\n');

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

Summarize the following CRM activity notes. Provide:
1. **Executive Summary** — 2-3 sentences covering the key story
2. **Key Decisions** — What was decided or agreed upon
3. **Action Items** — Outstanding tasks or follow-ups
4. **Sentiment** — Overall tone of the interactions (positive/neutral/negative)
5. **Timeline** — Key dates and milestones

Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: notesText,
    },
  ], { fast: true, maxTokens: 600, temperature: 0.3 });

  return {
    content,
    suggestions: ['Create follow-up task', 'Draft summary email'],
    metadata: { notesCount: notes.length },
  };
}

// ---------------------------------------------------------------------------
// Morning Briefing ("What should I do next?")
// ---------------------------------------------------------------------------

export async function getMorningBriefing(locale: string): Promise<CopilotResponse> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const [
    pendingOrders,
    ordersYesterday,
    lowStock,
    overdueDeals,
    uncontactedLeads,
    recentActivities,
    pendingTasks,
    revenueYesterday,
  ] = await Promise.all([
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.count({ where: { createdAt: { gte: yesterday, lt: today } } }),
    prisma.productFormat.count({ where: { stockQuantity: { lte: 3 }, product: { isActive: true } } }),
    prisma.crmDeal.count({
      where: { expectedCloseDate: { lt: today }, actualCloseDate: null },
    }),
    prisma.crmLead.count({
      where: { lastContactedAt: null, status: 'NEW' },
    }),
    prisma.crmActivity.count({ where: { createdAt: { gte: yesterday } } }),
    prisma.crmTask.count({ where: { status: 'PENDING', dueAt: { lte: today } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: yesterday, lt: today }, paymentStatus: 'PAID' },
      _sum: { total: true },
    }),
  ]);

  const revYesterday = Number(revenueYesterday._sum.total || 0);

  const briefingData = {
    pendingOrders,
    ordersYesterday,
    revenueYesterday: revYesterday,
    lowStockAlerts: lowStock,
    overdueDeals,
    uncontactedLeads,
    crmActivitiesYesterday: recentActivities,
    overdueTasks: pendingTasks,
    currentTime: now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    dayOfWeek: now.toLocaleDateString(locale, { weekday: 'long' }),
  };

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

You're delivering a morning briefing to the admin team. Be energetic and actionable.

Structure:
1. **Good morning greeting** — Mention the day of week
2. **Yesterday recap** — Orders, revenue, activities (1-2 lines)
3. **Today's priorities** — Top 3-5 tasks ranked by urgency, based on:
   - Pending orders to process
   - Overdue deals to follow up
   - Uncontacted new leads
   - Low stock items to reorder
   - Overdue CRM tasks
4. **Quick wins** — Easy tasks that can be done in <5 min
5. **Heads up** — Any anomalies or risks to watch

Use emoji for visual scanning:
- 🎯 for priority tasks
- ⚡ for quick wins
- ⚠️ for heads up / risks
- 📊 for stats

Keep it concise — this should be scannable in 30 seconds.
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: JSON.stringify(briefingData),
    },
  ], { fast: true, maxTokens: 700, temperature: 0.5 });

  return {
    content,
    metadata: {
      pendingOrders,
      overdueDeals,
      uncontactedLeads,
      overdueTasks: pendingTasks,
      lowStock,
    },
  };
}

// ---------------------------------------------------------------------------
// Generate Report by Prompt
// ---------------------------------------------------------------------------

export async function generateReport(
  reportPrompt: string,
  locale: string,
): Promise<CopilotResponse> {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastWeekStart = new Date(now.getTime() - 7 * 86400000);

  // Gather comprehensive data for the report
  const [
    ordersThisMonth,
    ordersLastMonth,
    revenueThisMonth,
    revenueLastMonth,
    ordersThisWeek,
    newCustomersThisMonth,
    topProducts,
    ordersByStatus,
    paymentStats,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: thisMonthStart } } }),
    prisma.order.count({ where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart } } }),
    prisma.order.aggregate({ where: { createdAt: { gte: thisMonthStart }, paymentStatus: 'PAID' }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { createdAt: { gte: lastMonthStart, lt: thisMonthStart }, paymentStatus: 'PAID' }, _sum: { total: true } }),
    prisma.order.count({ where: { createdAt: { gte: lastWeekStart } } }),
    prisma.user.count({ where: { createdAt: { gte: thisMonthStart }, role: 'CUSTOMER' } }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 10,
      where: { order: { createdAt: { gte: thisMonthStart } } },
    }),
    prisma.order.groupBy({
      by: ['status'],
      _count: true,
      where: { createdAt: { gte: thisMonthStart } },
    }),
    prisma.order.groupBy({
      by: ['paymentStatus'],
      _count: true,
      _sum: { total: true },
      where: { createdAt: { gte: thisMonthStart } },
    }),
  ]);

  // Resolve product names
  const productIds = topProducts.map(p => p.productId).filter(Boolean) as string[];
  const products = productIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } })
    : [];
  const productMap = new Map(products.map(p => [p.id, p.name]));

  const reportData = {
    period: { thisMonth: thisMonthStart.toISOString().split('T')[0], today: now.toISOString().split('T')[0] },
    orders: {
      thisMonth: ordersThisMonth,
      lastMonth: ordersLastMonth,
      thisWeek: ordersThisWeek,
      byStatus: ordersByStatus.map(s => ({ status: s.status, count: s._count })),
    },
    revenue: {
      thisMonth: Number(revenueThisMonth._sum.total || 0),
      lastMonth: Number(revenueLastMonth._sum.total || 0),
    },
    payments: paymentStats.map(p => ({ status: p.paymentStatus, count: p._count, total: Number(p._sum.total || 0) })),
    newCustomers: newCustomersThisMonth,
    topProducts: topProducts.map(p => ({
      name: productMap.get(p.productId || '') || 'Unknown',
      quantity: p._sum.quantity,
      revenue: Number(p._sum.total || 0),
    })),
  };

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

Generate a professional business report for BioCycle Peptides based on real data.

The user will tell you what kind of report they want. Use the business data provided to write it.

Format:
- **Title** at top
- **Executive Summary** (2-3 sentences)
- **Key Metrics** in a structured format
- **Analysis** with insights
- **Recommendations** based on the data
- Use tables (markdown) where appropriate

If the user asks for something not covered by the data, note what's available and what's not.
Always include actual numbers from the data.
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: `Report request: ${reportPrompt}\n\n---\nAvailable data:\n${JSON.stringify(reportData)}`,
    },
  ], { maxTokens: 1200, temperature: 0.3 });

  return {
    content,
    suggestions: ['Export as PDF', 'Send by email', 'Generate another report'],
  };
}

// ---------------------------------------------------------------------------
// Generate Product Variants
// ---------------------------------------------------------------------------

export async function generateVariants(
  productId: string,
  locale: string,
): Promise<CopilotResponse> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true, name: true, description: true, productType: true, price: true,
      sku: true, manufacturer: true,
      formats: {
        select: { name: true, price: true, dosageMg: true, formatType: true, sku: true },
        orderBy: { sortOrder: 'asc' },
      },
      category: { select: { name: true } },
    },
  });

  if (!product) {
    return { content: 'Product not found.' };
  }

  const productData = {
    name: product.name,
    type: product.productType,
    category: product.category?.name,
    description: product.description?.slice(0, 300),
    basePrice: Number(product.price),
    manufacturer: product.manufacturer,
    existingFormats: product.formats.map(f => ({
      name: f.name,
      type: f.formatType,
      price: Number(f.price),
      dosageMg: f.dosageMg ? Number(f.dosageMg) : null,
    })),
  };

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

You are a peptide & supplement product expert. Suggest new product format variants.

Available format types: VIAL_2ML, VIAL_10ML, CARTRIDGE_3ML, KIT_12, CAPSULE_60, CAPSULE_120, PACK_5, PACK_10, BUNDLE, ACCESSORY, NASAL_SPRAY, CREAM

For each suggested variant, provide:
1. **Name** — descriptive format name
2. **Format type** — from the list above
3. **Dosage (mg)** — if applicable
4. **Suggested price (CAD)** — based on existing pricing patterns
5. **Rationale** — why this variant makes sense (market demand, margin, etc.)

Consider:
- Common dosage ranges for peptides (1mg, 2mg, 5mg, 10mg, 15mg, 30mg)
- Market trends (nasal sprays, pre-mixed cartridges, starter kits)
- Bundle opportunities with existing formats
- Price laddering strategy (entry → mid → premium)

Suggest 3-5 variants that don't already exist. Be specific and practical.
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: `Product data:\n${JSON.stringify(productData)}`,
    },
  ], { maxTokens: 800, temperature: 0.6 });

  return {
    content,
    suggestions: ['Create these variants', 'Adjust pricing', 'Suggest bundles instead'],
  };
}

// ---------------------------------------------------------------------------
// Extract Invoice Data (OCR-like text extraction)
// ---------------------------------------------------------------------------

export async function extractInvoice(
  invoiceText: string,
  locale: string,
): Promise<CopilotResponse> {
  const chartOfAccounts = await prisma.chartOfAccount.findMany({
    where: { isActive: true },
    select: { code: true, name: true, type: true },
    orderBy: { code: 'asc' },
    take: 50,
  });

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

You are an accounting assistant. Extract structured data from invoice text and suggest journal entries.

From the invoice text, extract:
1. **Supplier/vendor name**
2. **Invoice number**
3. **Invoice date**
4. **Due date**
5. **Line items** (description, quantity, unit price, total)
6. **Subtotal, taxes (GST/QST/HST), total**
7. **Currency**

Then suggest a **journal entry** using the chart of accounts provided:
- Debit the appropriate expense/asset account
- Credit Accounts Payable
- Include tax accounts if applicable (GST: usually account 2300+, QST: 2310+)

Available chart of accounts:
${chartOfAccounts.map(a => `${a.code} - ${a.name} (${a.type})`).join('\n')}

Format the extracted data clearly with tables.
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: `Invoice text to extract:\n\n${invoiceText}`,
    },
  ], { maxTokens: 1000, temperature: 0.2 });

  return {
    content,
    suggestions: ['Create journal entry', 'Copy extracted data', 'Extract another invoice'],
  };
}

// ---------------------------------------------------------------------------
// Stock Prediction & Reorder Suggestions
// ---------------------------------------------------------------------------

export async function predictStock(locale: string): Promise<CopilotResponse> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

  // Get active products with stock info
  const productsWithStock = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      formats: {
        where: { isActive: true },
        select: { id: true, name: true, stockQuantity: true, price: true },
      },
    },
  });

  // Get sales velocity for last 30 days and 30-60 days ago
  const [salesLast30, salesPrev30] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: {
        order: { createdAt: { gte: thirtyDaysAgo }, paymentStatus: 'PAID' },
      },
    }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      where: {
        order: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo }, paymentStatus: 'PAID' },
      },
    }),
  ]);

  const salesMap30 = new Map(salesLast30.map(s => [s.productId, s._sum.quantity || 0]));
  const salesMapPrev = new Map(salesPrev30.map(s => [s.productId, s._sum.quantity || 0]));

  const stockAnalysis = productsWithStock
    .map(p => {
      const totalStock = p.formats.reduce((sum, f) => sum + f.stockQuantity, 0);
      const sold30 = salesMap30.get(p.id) || 0;
      const soldPrev = salesMapPrev.get(p.id) || 0;
      const dailyVelocity = sold30 / 30;
      const daysRemaining = dailyVelocity > 0 ? Math.round(totalStock / dailyVelocity) : null;
      const trend = soldPrev > 0 ? ((sold30 - soldPrev) / soldPrev * 100) : 0;

      return {
        name: p.name,
        stock: totalStock,
        sold30d: sold30,
        soldPrev30d: soldPrev,
        dailyVelocity: Math.round(dailyVelocity * 10) / 10,
        daysRemaining,
        trend: Math.round(trend),
        formats: p.formats.map(f => ({ name: f.name, stock: f.stockQuantity })),
      };
    })
    .filter(p => p.sold30d > 0 || p.stock < 10)
    .sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

You are a supply chain analyst for BioCycle Peptides. Analyze stock data and predict reorder needs.

For each product, provide:
1. **Stock status** — critical (< 7 days), warning (7-21 days), healthy (21+ days)
2. **Sales trend** — accelerating, stable, or declining vs previous 30 days
3. **Reorder recommendation** — suggested quantity based on 45-day supply target
4. **Priority** — URGENT / SOON / OK

Format as a prioritized list. Start with most urgent items.
Use 🔴 for critical, 🟡 for warning, 🟢 for healthy.
Include a summary section at the top with total products at risk.
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: `Stock analysis data:\n${JSON.stringify(stockAnalysis.slice(0, 30))}`,
    },
  ], { maxTokens: 1000, temperature: 0.3 });

  const criticalCount = stockAnalysis.filter(p => p.daysRemaining !== null && p.daysRemaining < 7).length;
  const warningCount = stockAnalysis.filter(p => p.daysRemaining !== null && p.daysRemaining >= 7 && p.daysRemaining < 21).length;

  return {
    content,
    metadata: { criticalCount, warningCount, totalAnalyzed: stockAnalysis.length },
    suggestions: ['Export reorder list', 'Show format breakdown', 'Refresh analysis'],
  };
}

// ---------------------------------------------------------------------------
// Churn Risk Alerts
// ---------------------------------------------------------------------------

export async function getChurnAlerts(locale: string): Promise<CopilotResponse> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

  // Customers with 2+ orders who haven't ordered in 60+ days
  const atRiskCustomers = await prisma.user.findMany({
    where: {
      role: 'CUSTOMER',
      orders: {
        some: { paymentStatus: 'PAID' },
        none: { createdAt: { gte: sixtyDaysAgo } },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      orders: {
        where: { paymentStatus: 'PAID' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          orderNumber: true,
          total: true,
          createdAt: true,
          items: { select: { productName: true, quantity: true } },
        },
      },
    },
    take: 30,
  });

  // Recent churners who came back (win-backs) for context
  const recentOrders = await prisma.order.count({
    where: { createdAt: { gte: thirtyDaysAgo }, paymentStatus: 'PAID' },
  });

  const totalCustomers = await prisma.user.count({ where: { role: 'CUSTOMER' } });

  const churnData = atRiskCustomers.map(c => {
    const lastOrder = c.orders[0];
    const daysSinceLastOrder = lastOrder
      ? Math.round((now.getTime() - new Date(lastOrder.createdAt).getTime()) / 86400000)
      : null;
    const totalSpent = c.orders.reduce((sum, o) => sum + Number(o.total), 0);
    const avgOrderValue = c.orders.length > 0 ? totalSpent / c.orders.length : 0;
    const topProducts = [...new Set(c.orders.flatMap(o => o.items.map(i => i.productName)))].slice(0, 3);

    return {
      name: c.name || c.email,
      email: c.email,
      orderCount: c.orders.length,
      daysSinceLastOrder,
      totalSpent: Math.round(totalSpent),
      avgOrderValue: Math.round(avgOrderValue),
      topProducts,
      risk: daysSinceLastOrder && daysSinceLastOrder > 90 ? 'HIGH' : 'MEDIUM',
    };
  }).sort((a, b) => (b.totalSpent) - (a.totalSpent));

  const highRisk = churnData.filter(c => c.risk === 'HIGH').length;
  const medRisk = churnData.filter(c => c.risk === 'MEDIUM').length;

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

You are a customer retention analyst for BioCycle Peptides. Analyze churn risk data and provide actionable insights.

Provide:
1. **Summary** — total at-risk customers, high vs medium risk, potential revenue at stake
2. **Top 5 highest-value at-risk customers** — with personalized win-back suggestions
3. **Patterns** — common products among at-risk customers, timing patterns
4. **Recommended actions** — specific outreach strategies (email campaign, discount offer, product recommendations)

Use 🔴 for high-risk (90+ days), 🟡 for medium-risk (60-90 days).
Be specific about amounts — these are real customers with real revenue at stake.
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: JSON.stringify({
        atRiskCustomers: churnData.slice(0, 20),
        summary: {
          totalCustomers,
          recentOrdersLast30d: recentOrders,
          highRiskCount: highRisk,
          mediumRiskCount: medRisk,
          totalRevenueAtRisk: churnData.reduce((s, c) => s + c.totalSpent, 0),
        },
      }),
    },
  ], { maxTokens: 1000, temperature: 0.4 });

  return {
    content,
    metadata: { highRisk, mediumRisk: medRisk, totalAtRisk: churnData.length },
    suggestions: ['Draft win-back email', 'Export at-risk list', 'Create discount campaign'],
  };
}

// ---------------------------------------------------------------------------
// Natural Language Search (NLI)
// ---------------------------------------------------------------------------

export async function nliSearch(
  query: string,
  locale: string,
): Promise<CopilotResponse> {
  // Gather schema context for the AI to understand what's searchable
  const [productCount, orderCount, customerCount, leadCount] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.crmLead.count(),
  ]);

  // Execute a broad search across key entities based on the query
  const searchTerms = query.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  const term = searchTerms[0] || query;
  const skuTerm = searchTerms.find(t => /^[A-Z0-9-]+$/i.test(t));
  const statusTerm = searchTerms.find(t =>
    ['pending', 'shipped', 'delivered', 'cancelled'].includes(t.toLowerCase()),
  );

  const [products, orders, customers, leads] = await Promise.all([
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          ...(skuTerm ? [{ sku: skuTerm }] : []),
        ],
      },
      select: { id: true, name: true, price: true, sku: true, isActive: true, productType: true },
      take: 5,
    }),
    prisma.order.findMany({
      where: {
        OR: [
          { orderNumber: { contains: term, mode: 'insensitive' as const } },
          { shippingName: { contains: term, mode: 'insensitive' as const } },
          ...(statusTerm ? [{ status: statusTerm.toUpperCase() }] : []),
        ],
      },
      select: { orderNumber: true, total: true, status: true, paymentStatus: true, shippingName: true, createdAt: true },
      take: 5,
      orderBy: { createdAt: 'desc' as const },
    }),
    prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        OR: [
          { name: { contains: term, mode: 'insensitive' as const } },
          { email: { contains: term, mode: 'insensitive' as const } },
        ],
      },
      select: { id: true, name: true, email: true, createdAt: true },
      take: 5,
    }),
    prisma.crmLead.findMany({
      where: {
        OR: [
          { contactName: { contains: term, mode: 'insensitive' as const } },
          { companyName: { contains: term, mode: 'insensitive' as const } },
          { email: { contains: term, mode: 'insensitive' as const } },
        ],
      },
      select: { id: true, contactName: true, companyName: true, status: true, email: true },
      take: 5,
    }),
  ]);

  const searchResults = {
    query,
    dbCounts: { products: productCount, orders: orderCount, customers: customerCount, leads: leadCount },
    results: {
      products: products.map(p => ({ name: p.name, price: Number(p.price), sku: p.sku, type: p.productType, active: p.isActive })),
      orders: orders.map(o => ({ number: o.orderNumber, total: Number(o.total), status: o.status, payment: o.paymentStatus, customer: o.shippingName, date: o.createdAt })),
      customers: customers.map(c => ({ name: c.name, email: c.email, since: c.createdAt })),
      leads: leads.map(l => ({ name: l.contactName, company: l.companyName, status: l.status, email: l.email })),
    },
  };

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

You are a natural language search interface for BioCycle Peptides admin.

The user asks a question in natural language. You have searched the database and found results.

Present results clearly:
- If results were found, show them in a formatted list/table
- Group by entity type (Products, Orders, Customers, Leads)
- Only show sections with results
- Include direct links suggestion (e.g., "View in admin: /admin/produits/[id]")
- If no results match, suggest what the user might be looking for
- If the query seems like a question about data (e.g., "how many orders this month"), answer it using the database counts

Be helpful and conversational. The goal is to let admins find anything by just asking.
Respond in ${getLanguageName(locale)}.`,
    },
    {
      role: 'user',
      content: `Search query: "${query}"\n\nSearch results:\n${JSON.stringify(searchResults)}`,
    },
  ], { fast: true, maxTokens: 700, temperature: 0.3 });

  return {
    content,
    suggestions: ['Refine search', 'Show more results', 'Search in orders only'],
  };
}

// ---------------------------------------------------------------------------
// Free-form Chat
// ---------------------------------------------------------------------------

export async function copilotChat(
  message: string,
  context: CopilotRequest['context'],
  locale: string,
): Promise<CopilotResponse> {
  let contextInfo = '';
  if (context.page) contextInfo += `User is on page: ${context.page}\n`;
  if (context.entityType && context.entityId) contextInfo += `Viewing ${context.entityType}: ${context.entityId}\n`;
  if (context.selection) contextInfo += `Selected: ${context.selection}\n`;

  const content = await aiComplete([
    {
      role: 'system',
      content: `${SYSTEM_BASE}

You're helping an admin user with their current task. Their context:
${contextInfo}

Provide helpful, specific answers. If they ask about data you don't have,
suggest which page or report they should look at.
Respond in ${getLanguageName(locale)}.`,
    },
    { role: 'user', content: message },
  ], { fast: true, maxTokens: 600, temperature: 0.5 });

  return { content };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'English', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian',
    pt: 'Portuguese', zh: 'Chinese', ko: 'Korean', ar: 'Arabic', ru: 'Russian',
    hi: 'Hindi', pl: 'Polish', sv: 'Swedish', vi: 'Vietnamese', ta: 'Tamil',
    pa: 'Punjabi', tl: 'Tagalog', ht: 'Haitian Creole', gcr: 'Guianese Creole',
  };
  const base = code.includes('-') ? code.split('-')[0] : code;
  return languages[base] || 'English';
}
