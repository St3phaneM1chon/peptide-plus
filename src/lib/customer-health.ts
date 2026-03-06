/**
 * Customer Health Score Algorithm
 *
 * Multi-factor score 0-100 based on cross-module engagement:
 * - Commerce: recency, frequency, monetary value (RFM)
 * - CRM: open deals, deal success rate
 * - Support: recent calls, satisfaction
 * - Email: engagement rate
 * - Loyalty: tier level, active status
 * - Community: reviews, forum activity
 */

interface HealthInputs {
  /** Days since last order */
  daysSinceLastOrder: number | null;
  /** Total orders ever */
  totalOrders: number;
  /** Total lifetime spend */
  totalSpent: number;
  /** Active CRM deals */
  openDeals: number;
  /** Total calls in last 90 days */
  recentCalls: number;
  /** Email open rate (0-1) */
  emailOpenRate: number | null;
  /** Loyalty tier */
  loyaltyTier: string;
  /** Number of reviews written */
  reviewCount: number;
  /** Has outstanding support tickets */
  hasOpenTickets: boolean;
}

export function computeHealthScore(inputs: HealthInputs): number {
  let score = 0;

  // ── Recency (0-25 pts) ───────────────────────────────
  if (inputs.daysSinceLastOrder === null) {
    score += 5; // New customer, neutral
  } else if (inputs.daysSinceLastOrder <= 30) {
    score += 25;
  } else if (inputs.daysSinceLastOrder <= 60) {
    score += 20;
  } else if (inputs.daysSinceLastOrder <= 90) {
    score += 15;
  } else if (inputs.daysSinceLastOrder <= 180) {
    score += 8;
  } else {
    score += 2;
  }

  // ── Frequency (0-20 pts) ─────────────────────────────
  if (inputs.totalOrders >= 10) score += 20;
  else if (inputs.totalOrders >= 5) score += 15;
  else if (inputs.totalOrders >= 3) score += 10;
  else if (inputs.totalOrders >= 1) score += 5;

  // ── Monetary (0-15 pts) ──────────────────────────────
  if (inputs.totalSpent >= 5000) score += 15;
  else if (inputs.totalSpent >= 1000) score += 12;
  else if (inputs.totalSpent >= 500) score += 8;
  else if (inputs.totalSpent >= 100) score += 4;

  // ── CRM Engagement (0-10 pts) ────────────────────────
  if (inputs.openDeals > 0) score += 10;

  // ── Email Engagement (0-10 pts) ──────────────────────
  if (inputs.emailOpenRate !== null) {
    if (inputs.emailOpenRate >= 0.5) score += 10;
    else if (inputs.emailOpenRate >= 0.3) score += 7;
    else if (inputs.emailOpenRate >= 0.1) score += 4;
  }

  // ── Loyalty (0-10 pts) ───────────────────────────────
  const tierScores: Record<string, number> = {
    DIAMOND: 10,
    PLATINUM: 8,
    GOLD: 6,
    SILVER: 4,
    BRONZE: 2,
  };
  score += tierScores[inputs.loyaltyTier] ?? 2;

  // ── Community (0-5 pts) ──────────────────────────────
  if (inputs.reviewCount >= 3) score += 5;
  else if (inputs.reviewCount >= 1) score += 3;

  // ── Support Risk (0-5 pts deduction) ─────────────────
  if (inputs.hasOpenTickets) score -= 5;
  if (inputs.recentCalls >= 5) score -= 3; // High support load = risk

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function healthScoreLabel(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'at_risk';
  return 'critical';
}

export function healthScoreColor(score: number): string {
  if (score >= 80) return 'text-green-700 bg-green-100';
  if (score >= 60) return 'text-blue-700 bg-blue-100';
  if (score >= 40) return 'text-yellow-700 bg-yellow-100';
  if (score >= 20) return 'text-orange-700 bg-orange-100';
  return 'text-red-700 bg-red-100';
}
