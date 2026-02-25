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

// F-001 FIX: Import tier thresholds from the SINGLE SOURCE OF TRUTH (constants.ts).
// Previously, this file had its own LOYALTY_TIERS array with hardcoded thresholds
// that was missing the DIAMOND tier and could drift out of sync with constants.ts.
import {
  LOYALTY_TIER_THRESHOLDS,
  calculateTierFromPoints,
} from '@/lib/constants';

export interface LoyaltyTier {
  id: string;
  name: string;
  nameFr: string;
  minPoints: number;
  multiplier: number; // points earning multiplier
  perks: string[];
  color: string;
}

// F-001 FIX: Derive LOYALTY_TIERS from the canonical LOYALTY_TIER_THRESHOLDS.
// This adds display-specific fields (nameFr, perks, hex color) on top of the
// canonical definition, ensuring thresholds and multipliers are always in sync.
const TIER_EXTRAS: Record<string, { nameFr: string; perks: string[]; color: string }> = {
  BRONZE:   { nameFr: 'Bronze',   perks: ['Earn 1x points'],                                                                             color: '#CD7F32' },
  SILVER:   { nameFr: 'Argent',   perks: ['Earn 1.25x points', 'Free shipping over $75'],                                                color: '#C0C0C0' },
  GOLD:     { nameFr: 'Or',       perks: ['Earn 1.5x points', 'Free shipping', 'Early access'],                                          color: '#FFD700' },
  PLATINUM: { nameFr: 'Platine',  perks: ['Earn 2x points', 'Free shipping', 'Early access', 'VIP support', 'Birthday 2x points'],       color: '#E5E4E2' },
  DIAMOND:  { nameFr: 'Diamant',  perks: ['Earn 3x points', 'Free express shipping', '20% off everything', 'Dedicated support', 'Exclusive products'], color: '#B9F2FF' },
};

export const LOYALTY_TIERS: LoyaltyTier[] = LOYALTY_TIER_THRESHOLDS.map(tier => {
  const extra = TIER_EXTRAS[tier.id] || { nameFr: tier.name, perks: [`Earn ${tier.multiplier}x points`], color: '#888888' };
  return {
    id: tier.id,
    name: tier.name,
    nameFr: extra.nameFr,
    minPoints: tier.minPoints,
    multiplier: tier.multiplier,
    perks: extra.perks,
    color: extra.color,
  };
});

// F-001 FIX: Delegate to canonical calculateTierFromPoints from constants.ts
// instead of maintaining a separate tier lookup.
export function getTierForPoints(lifetimePoints: number): LoyaltyTier {
  const canonical = calculateTierFromPoints(lifetimePoints);
  return LOYALTY_TIERS.find(t => t.id === canonical.id) || LOYALTY_TIERS[0];
}

export function getNextTier(currentTier: string): LoyaltyTier | null {
  const idx = LOYALTY_TIERS.findIndex(t => t.id === currentTier);
  return idx < LOYALTY_TIERS.length - 1 ? LOYALTY_TIERS[idx + 1] : null;
}

export function pointsToValue(points: number, conversionRate: number = 0.01): number {
  return Math.round(points * conversionRate * 100) / 100;
}
