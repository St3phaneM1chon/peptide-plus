/**
 * Points-for-Everything Engine
 * Earn points for purchases, reviews, referrals, social shares, birthday, newsletter
 */

export interface PointsRule {
  id: string;
  action: string;
  points: number | ((value: number) => number);
  description: string;
  descriptionFr: string;
  maxPerDay?: number;
  cooldownHours?: number;
}

export const POINTS_RULES: PointsRule[] = [
  { id: 'purchase', action: 'PURCHASE', points: (amount: number) => Math.floor(amount), description: '1 point per $1 spent', descriptionFr: '1 point par $ dépensé' },
  { id: 'review', action: 'REVIEW', points: 50, description: '50 points per review', descriptionFr: '50 points par avis', maxPerDay: 3 },
  { id: 'review-photo', action: 'REVIEW_WITH_PHOTO', points: 75, description: '75 points per review with photo', descriptionFr: '75 points par avis avec photo', maxPerDay: 3 },
  { id: 'referral', action: 'REFERRAL', points: 200, description: '200 points per successful referral', descriptionFr: '200 points par parrainage réussi' },
  { id: 'social-share', action: 'SOCIAL_SHARE', points: 25, description: '25 points per social share', descriptionFr: '25 points par partage social', maxPerDay: 5 },
  { id: 'birthday', action: 'BIRTHDAY', points: 100, description: '100 birthday points', descriptionFr: '100 points d\'anniversaire' },
  { id: 'newsletter', action: 'NEWSLETTER_SIGNUP', points: 50, description: '50 points for newsletter signup', descriptionFr: '50 points pour l\'inscription newsletter' },
  { id: 'account-complete', action: 'PROFILE_COMPLETE', points: 100, description: '100 points for completing profile', descriptionFr: '100 points pour profil complet' },
  { id: 'first-order', action: 'FIRST_ORDER', points: 100, description: '100 bonus points on first order', descriptionFr: '100 points bonus première commande' },
];

export function calculatePoints(action: string, value: number = 0): number {
  const rule = POINTS_RULES.find(r => r.action === action);
  if (!rule) return 0;
  if (typeof rule.points === 'function') return rule.points(value);
  return rule.points;
}

export interface PointsBalance {
  available: number;
  pending: number;
  lifetime: number;
  expiringSoon: number; // points expiring in next 30 days
}

export interface LoyaltyTier {
  id: string;
  name: string;
  nameFr: string;
  minPoints: number;
  multiplier: number; // points earning multiplier
  perks: string[];
  color: string;
}

export const LOYALTY_TIERS: LoyaltyTier[] = [
  { id: 'BRONZE', name: 'Bronze', nameFr: 'Bronze', minPoints: 0, multiplier: 1, perks: ['Earn 1x points'], color: '#CD7F32' },
  { id: 'SILVER', name: 'Silver', nameFr: 'Argent', minPoints: 500, multiplier: 1.25, perks: ['Earn 1.25x points', 'Free shipping over $75'], color: '#C0C0C0' },
  { id: 'GOLD', name: 'Gold', nameFr: 'Or', minPoints: 2000, multiplier: 1.5, perks: ['Earn 1.5x points', 'Free shipping', 'Early access'], color: '#FFD700' },
  { id: 'PLATINUM', name: 'Platinum', nameFr: 'Platine', minPoints: 5000, multiplier: 2, perks: ['Earn 2x points', 'Free shipping', 'Early access', 'VIP support', 'Birthday 2x points'], color: '#E5E4E2' },
];

export function getTierForPoints(lifetimePoints: number): LoyaltyTier {
  const sorted = [...LOYALTY_TIERS].sort((a, b) => b.minPoints - a.minPoints);
  return sorted.find(t => lifetimePoints >= t.minPoints) || LOYALTY_TIERS[0];
}

export function getNextTier(currentTier: string): LoyaltyTier | null {
  const idx = LOYALTY_TIERS.findIndex(t => t.id === currentTier);
  return idx < LOYALTY_TIERS.length - 1 ? LOYALTY_TIERS[idx + 1] : null;
}

export function pointsToValue(points: number, conversionRate: number = 0.01): number {
  return Math.round(points * conversionRate * 100) / 100;
}
