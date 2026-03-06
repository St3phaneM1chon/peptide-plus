/**
 * Timeline Event Mappers
 *
 * Converts raw database records from each module into
 * standardised TimelineEvent objects for the unified timeline.
 */

import type { TimelineEvent, BridgeModule } from './types';

// ─── Event factories ────────────────────────────────────────

function evt(
  id: string,
  module: BridgeModule,
  type: string,
  title: string,
  description: string | null,
  timestamp: string | Date,
  link?: string,
  metadata?: Record<string, unknown>
): TimelineEvent {
  return {
    id,
    module,
    type,
    title,
    description,
    timestamp: typeof timestamp === 'string' ? timestamp : timestamp.toISOString(),
    link,
    metadata,
  };
}

// ─── Commerce ───────────────────────────────────────────────

export function mapOrderEvents(orders: Array<{
  id: string; orderNumber: string; status: string; total: unknown; createdAt: Date;
}>): TimelineEvent[] {
  return orders.map((o) =>
    evt(
      `order-${o.id}`,
      'ecommerce',
      'order_placed',
      `Commande #${o.orderNumber}`,
      `Statut: ${o.status} — Total: $${Number(o.total).toFixed(2)}`,
      o.createdAt,
      `/admin/commandes?orderId=${o.id}`,
      { status: o.status, total: Number(o.total) }
    )
  );
}

export function mapOrderStatusEvents(events: Array<{
  id: string; type: string; data: unknown; createdAt: Date; order: { orderNumber: string; id: string };
}>): TimelineEvent[] {
  return events.map((e) =>
    evt(
      `order-event-${e.id}`,
      'ecommerce',
      'order_status',
      `Commande #${e.order.orderNumber} — ${e.type}`,
      typeof e.data === 'string' ? e.data : null,
      e.createdAt,
      `/admin/commandes?orderId=${e.order.id}`
    )
  );
}

// ─── CRM ────────────────────────────────────────────────────

export function mapCrmActivities(activities: Array<{
  id: string; type: string; title: string; createdAt: Date;
  deal?: { id: string; title: string } | null;
}>): TimelineEvent[] {
  return activities.map((a) =>
    evt(
      `crm-activity-${a.id}`,
      'crm',
      `crm_${a.type.toLowerCase()}`,
      a.title || `Activité CRM: ${a.type}`,
      a.deal ? `Deal: ${a.deal.title}` : null,
      a.createdAt,
      a.deal ? `/admin/crm/deals/${a.deal.id}` : undefined
    )
  );
}

export function mapDealStageChanges(changes: Array<{
  id: string; createdAt: Date;
  deal: { id: string; title: string };
  fromStage: { name: string } | null;
  toStage: { name: string };
}>): TimelineEvent[] {
  return changes.map((c) =>
    evt(
      `crm-stage-${c.id}`,
      'crm',
      'deal_stage_change',
      `Deal "${c.deal.title}" → ${c.toStage.name}`,
      c.fromStage ? `De: ${c.fromStage.name}` : null,
      c.createdAt,
      `/admin/crm/deals/${c.deal.id}`
    )
  );
}

// ─── VoIP ───────────────────────────────────────────────────

export function mapCallLogs(calls: Array<{
  id: string; direction: string; status: string; duration: number | null; startedAt: Date;
}>): TimelineEvent[] {
  return calls.map((c) => {
    const dur = c.duration ? `${Math.floor(c.duration / 60)}m${c.duration % 60}s` : '';
    return evt(
      `call-${c.id}`,
      'voip',
      `call_${c.direction}`,
      `Appel ${c.direction === 'inbound' ? 'entrant' : 'sortant'}`,
      `${c.status} ${dur}`.trim(),
      c.startedAt,
      `/admin/telephonie/journal`
    );
  });
}

// ─── Email ──────────────────────────────────────────────────

export function mapEmailLogs(emails: Array<{
  id: string; subject: string; status: string; sentAt: Date;
}>): TimelineEvent[] {
  return emails.map((e) =>
    evt(
      `email-${e.id}`,
      'email',
      `email_${e.status}`,
      e.subject,
      `Statut: ${e.status}`,
      e.sentAt,
      `/admin/emails`
    )
  );
}

// ─── Loyalty ────────────────────────────────────────────────

export function mapLoyaltyTransactions(txns: Array<{
  id: string; type: string; points: number; description: string | null; createdAt: Date;
}>): TimelineEvent[] {
  return txns.map((t) =>
    evt(
      `loyalty-${t.id}`,
      'loyalty',
      `loyalty_${t.type.toLowerCase()}`,
      `${t.points > 0 ? '+' : ''}${t.points} points — ${t.type}`,
      t.description,
      t.createdAt,
      `/admin/fidelite`
    )
  );
}

// ─── Marketing ──────────────────────────────────────────────

export function mapPromoUsages(usages: Array<{
  id: string; createdAt: Date; promoCode: { code: string };
}>): TimelineEvent[] {
  return usages.map((u) =>
    evt(
      `promo-${u.id}`,
      'marketing',
      'promo_used',
      `Coupon utilisé: ${u.promoCode.code}`,
      null,
      u.createdAt,
      `/admin/promo-codes`
    )
  );
}

// ─── Community ──────────────────────────────────────────────

export function mapReviews(reviews: Array<{
  id: string; rating: number; comment: string | null; createdAt: Date;
  product?: { name: string } | null;
}>): TimelineEvent[] {
  return reviews.map((r) =>
    evt(
      `review-${r.id}`,
      'community',
      'review_posted',
      `Avis ${r.rating}/5${r.product ? ` — ${r.product.name}` : ''}`,
      r.comment ? r.comment.substring(0, 100) : null,
      r.createdAt,
      `/admin/avis`
    )
  );
}

export function mapForumPosts(posts: Array<{
  id: string; title: string; createdAt: Date;
}>): TimelineEvent[] {
  return posts.map((p) =>
    evt(
      `forum-${p.id}`,
      'community',
      'forum_post',
      `Post forum: ${p.title}`,
      null,
      p.createdAt,
      `/admin/questions`
    )
  );
}

// ─── Accounting ─────────────────────────────────────────────

export function mapJournalEntries(entries: Array<{
  id: string; entryNumber: string; description: string | null; date: Date; type: string;
}>): TimelineEvent[] {
  return entries.map((e) =>
    evt(
      `journal-${e.id}`,
      'accounting',
      `journal_${e.type.toLowerCase()}`,
      `Écriture ${e.entryNumber}`,
      e.description,
      e.date,
      `/admin/comptabilite/ecritures`
    )
  );
}

// ─── System ─────────────────────────────────────────────────

export function mapAuditLogs(logs: Array<{
  id: string; action: string; entityType: string | null; createdAt: Date;
}>): TimelineEvent[] {
  return logs.map((l) =>
    evt(
      `audit-${l.id}`,
      'system',
      'audit',
      `${l.action}${l.entityType ? ` (${l.entityType})` : ''}`,
      null,
      l.createdAt,
      `/admin/logs`
    )
  );
}
