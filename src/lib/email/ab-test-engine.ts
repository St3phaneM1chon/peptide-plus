/**
 * A/B Test Engine for Email Campaigns
 * Auto-select winning variant after statistical significance
 */

export interface ABTestVariant {
  id: string;
  name: string;
  subject?: string;
  content?: string;
  percentage: number; // 0-100 allocation
  sent: number;
  opens: number;
  clicks: number;
  conversions: number;
}

export interface ABTest {
  id: string;
  campaignId: string;
  metric: 'open_rate' | 'click_rate' | 'conversion_rate';
  variants: ABTestVariant[];
  status: 'DRAFT' | 'RUNNING' | 'WINNER_SELECTED' | 'COMPLETED';
  winnerId?: string;
  minSampleSize: number;
  confidenceLevel: number; // 0.95 default
  startedAt?: Date;
  winnerSelectedAt?: Date;
}

export function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export function getMetricValue(variant: ABTestVariant, metric: ABTest['metric']): number {
  switch (metric) {
    case 'open_rate': return calculateRate(variant.opens, variant.sent);
    case 'click_rate': return calculateRate(variant.clicks, variant.sent);
    case 'conversion_rate': return calculateRate(variant.conversions, variant.sent);
  }
}

/**
 * Simple Z-test for two proportions to determine statistical significance
 */
export function isStatisticallySignificant(
  variant1: ABTestVariant,
  variant2: ABTestVariant,
  metric: ABTest['metric'],
  confidenceLevel: number = 0.95
): boolean {
  const n1 = variant1.sent;
  const n2 = variant2.sent;
  if (n1 < 30 || n2 < 30) return false; // min sample size

  const p1 = getMetricValue(variant1, metric);
  const p2 = getMetricValue(variant2, metric);
  const pPooled = (p1 * n1 + p2 * n2) / (n1 + n2);

  if (pPooled === 0 || pPooled === 1) return false;

  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / n1 + 1 / n2));
  if (se === 0) return false;

  const z = Math.abs(p1 - p2) / se;
  const zThreshold = confidenceLevel === 0.99 ? 2.576 : confidenceLevel === 0.95 ? 1.96 : 1.645;

  return z > zThreshold;
}

export function selectWinner(test: ABTest): ABTestVariant | null {
  if (test.variants.length < 2) return null;

  const sorted = [...test.variants].sort((a, b) => getMetricValue(b, test.metric) - getMetricValue(a, test.metric));
  const best = sorted[0];
  const runnerUp = sorted[1];

  // Check if we have enough data
  if (best.sent < test.minSampleSize || runnerUp.sent < test.minSampleSize) {
    return null;
  }

  // Check statistical significance
  if (isStatisticallySignificant(best, runnerUp, test.metric, test.confidenceLevel)) {
    return best;
  }

  return null;
}
