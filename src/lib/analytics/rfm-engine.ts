/**
 * RFM (Recency, Frequency, Monetary) Segmentation Engine
 * Auto-classify customers into actionable segments
 */

export interface RFMScore {
  recency: number;   // 1-5 (5 = most recent)
  frequency: number; // 1-5 (5 = most frequent)
  monetary: number;  // 1-5 (5 = highest value)
  totalScore: number;
  segment: RFMSegment;
}

export type RFMSegment =
  | 'CHAMPIONS'
  | 'LOYAL'
  | 'POTENTIAL_LOYAL'
  | 'NEW_CUSTOMERS'
  | 'PROMISING'
  | 'NEED_ATTENTION'
  | 'ABOUT_TO_SLEEP'
  | 'AT_RISK'
  | 'CANT_LOSE'
  | 'HIBERNATING'
  | 'LOST';

export interface RFMSegmentInfo {
  id: RFMSegment;
  name: string;
  nameFr: string;
  description: string;
  color: string;
  suggestedAction: string;
}

export const RFM_SEGMENTS: Record<RFMSegment, RFMSegmentInfo> = {
  CHAMPIONS: { id: 'CHAMPIONS', name: 'Champions', nameFr: 'Champions', description: 'Best customers, buy often, spend big', color: '#059669', suggestedAction: 'Reward with exclusive offers, ask for referrals' },
  LOYAL: { id: 'LOYAL', name: 'Loyal', nameFr: 'Fidèles', description: 'Regular buyers with good spending', color: '#10b981', suggestedAction: 'Upsell higher-value products, loyalty program' },
  POTENTIAL_LOYAL: { id: 'POTENTIAL_LOYAL', name: 'Potential Loyal', nameFr: 'Potentiellement fidèles', description: 'Recent with above-avg frequency', color: '#34d399', suggestedAction: 'Engage with loyalty program, recommend products' },
  NEW_CUSTOMERS: { id: 'NEW_CUSTOMERS', name: 'New Customers', nameFr: 'Nouveaux clients', description: 'Just made their first purchases', color: '#3b82f6', suggestedAction: 'Welcome email series, onboarding' },
  PROMISING: { id: 'PROMISING', name: 'Promising', nameFr: 'Prometteurs', description: 'Recent, but low frequency', color: '#60a5fa', suggestedAction: 'Create brand awareness, offer trials' },
  NEED_ATTENTION: { id: 'NEED_ATTENTION', name: 'Need Attention', nameFr: 'Besoin d\'attention', description: 'Above average but declining', color: '#f59e0b', suggestedAction: 'Reactivation offers, limited-time discounts' },
  ABOUT_TO_SLEEP: { id: 'ABOUT_TO_SLEEP', name: 'About to Sleep', nameFr: 'En sommeil', description: 'Below average recency and frequency', color: '#f97316', suggestedAction: 'Win-back campaigns, surveys' },
  AT_RISK: { id: 'AT_RISK', name: 'At Risk', nameFr: 'À risque', description: 'Used to be good, slipping away', color: '#ef4444', suggestedAction: 'Personalized re-engagement, special pricing' },
  CANT_LOSE: { id: 'CANT_LOSE', name: "Can't Lose", nameFr: 'Ne pas perdre', description: 'Big spenders who haven\'t been back', color: '#dc2626', suggestedAction: 'Win them back at all costs, personal outreach' },
  HIBERNATING: { id: 'HIBERNATING', name: 'Hibernating', nameFr: 'En hibernation', description: 'Low scores across all dimensions', color: '#94a3b8', suggestedAction: 'Offer discount, otherwise deprioritize' },
  LOST: { id: 'LOST', name: 'Lost', nameFr: 'Perdus', description: 'Haven\'t ordered in a very long time', color: '#64748b', suggestedAction: 'Ignore or send one last-chance email' },
};

export function calculateRFMScore(
  daysSinceLastOrder: number,
  totalOrders: number,
  totalSpent: number,
  thresholds?: { recency: number[]; frequency: number[]; monetary: number[] }
): RFMScore {
  const t = thresholds || {
    recency: [30, 60, 120, 240], // days
    frequency: [2, 4, 8, 15], // order count
    monetary: [100, 300, 700, 1500], // total CAD
  };

  const recency = daysSinceLastOrder <= t.recency[0] ? 5
    : daysSinceLastOrder <= t.recency[1] ? 4
    : daysSinceLastOrder <= t.recency[2] ? 3
    : daysSinceLastOrder <= t.recency[3] ? 2 : 1;

  const frequency = totalOrders >= t.frequency[3] ? 5
    : totalOrders >= t.frequency[2] ? 4
    : totalOrders >= t.frequency[1] ? 3
    : totalOrders >= t.frequency[0] ? 2 : 1;

  const monetary = totalSpent >= t.monetary[3] ? 5
    : totalSpent >= t.monetary[2] ? 4
    : totalSpent >= t.monetary[1] ? 3
    : totalSpent >= t.monetary[0] ? 2 : 1;

  const totalScore = recency + frequency + monetary;
  const segment = classifySegment(recency, frequency, monetary);

  return { recency, frequency, monetary, totalScore, segment };
}

function classifySegment(r: number, f: number, m: number): RFMSegment {
  if (r >= 4 && f >= 4 && m >= 4) return 'CHAMPIONS';
  if (r >= 3 && f >= 3 && m >= 3) return 'LOYAL';
  if (r >= 4 && f >= 2 && m >= 2) return 'POTENTIAL_LOYAL';
  if (r >= 4 && f <= 2) return 'NEW_CUSTOMERS';
  if (r >= 3 && f <= 2) return 'PROMISING';
  if (r >= 3 && f >= 3 && m <= 2) return 'NEED_ATTENTION';
  if (r === 2 && f <= 3) return 'ABOUT_TO_SLEEP';
  if (r <= 2 && f >= 3 && m >= 3) return 'AT_RISK';
  if (r <= 2 && f >= 4 && m >= 4) return 'CANT_LOSE';
  if (r <= 2 && f <= 2) return 'HIBERNATING';
  return 'LOST';
}

export function getSegmentInfo(segment: RFMSegment): RFMSegmentInfo {
  return RFM_SEGMENTS[segment];
}
