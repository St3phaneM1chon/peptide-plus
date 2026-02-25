/**
 * Gamification Engine
 * Progress bars, milestone badges, streak rewards, seasonal challenges
 */

export interface Badge {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  icon: string; // emoji
  requirement: { type: string; value: number };
  pointsReward: number;
}

export interface Streak {
  userId: string;
  type: string;
  currentStreak: number;
  longestStreak: number;
  lastActionDate: Date;
}

export interface Challenge {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  type: 'orders' | 'spend' | 'reviews' | 'referrals' | 'login';
  target: number;
  pointsReward: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

export const BADGES: Badge[] = [
  { id: 'first-purchase', name: 'First Purchase', nameFr: 'Premier achat', description: 'Complete your first order', icon: '🛒', requirement: { type: 'orders', value: 1 }, pointsReward: 50 },
  { id: 'loyal-5', name: 'Loyal Customer', nameFr: 'Client fidèle', description: '5 orders completed', icon: '⭐', requirement: { type: 'orders', value: 5 }, pointsReward: 200 },
  { id: 'loyal-10', name: 'Super Loyal', nameFr: 'Super fidèle', description: '10 orders completed', icon: '🌟', requirement: { type: 'orders', value: 10 }, pointsReward: 500 },
  { id: 'big-spender', name: 'Big Spender', nameFr: 'Grand acheteur', description: 'Spent $1000+', icon: '💎', requirement: { type: 'totalSpent', value: 1000 }, pointsReward: 300 },
  { id: 'reviewer', name: 'Reviewer', nameFr: 'Évaluateur', description: 'Write 3 reviews', icon: '📝', requirement: { type: 'reviews', value: 3 }, pointsReward: 150 },
  { id: 'ambassador', name: 'Ambassador', nameFr: 'Ambassadeur', description: 'Refer 3 friends', icon: '🤝', requirement: { type: 'referrals', value: 3 }, pointsReward: 500 },
  { id: 'streak-7', name: 'Weekly Streak', nameFr: 'Série hebdo', description: '7-day login streak', icon: '🔥', requirement: { type: 'loginStreak', value: 7 }, pointsReward: 100 },
  { id: 'streak-30', name: 'Monthly Streak', nameFr: 'Série mensuelle', description: '30-day login streak', icon: '💪', requirement: { type: 'loginStreak', value: 30 }, pointsReward: 500 },
  { id: 'early-adopter', name: 'Early Adopter', nameFr: 'Pionnier', description: 'Account created in first 100 users', icon: '🚀', requirement: { type: 'accountAge', value: 100 }, pointsReward: 200 },
  { id: 'birthday', name: 'Birthday Hero', nameFr: 'Héros d\'anniversaire', description: 'Order on your birthday', icon: '🎂', requirement: { type: 'birthdayOrder', value: 1 }, pointsReward: 100 },
];

export function checkBadgeEligibility(
  stats: { orders: number; totalSpent: number; reviews: number; referrals: number; loginStreak: number },
  earnedBadgeIds: Set<string>
): Badge[] {
  const newBadges: Badge[] = [];

  for (const badge of BADGES) {
    if (earnedBadgeIds.has(badge.id)) continue;
    const { type, value } = badge.requirement;
    const stat = stats[type as keyof typeof stats];
    if (typeof stat === 'number' && stat >= value) {
      newBadges.push(badge);
    }
  }

  return newBadges;
}

export function calculateProgress(current: number, target: number): number {
  return Math.min(100, Math.round((current / target) * 100));
}

export function getNextMilestone(currentOrders: number): { target: number; reward: number } | null {
  const milestones = [1, 5, 10, 25, 50, 100];
  const next = milestones.find(m => m > currentOrders);
  if (!next) return null;
  return { target: next, reward: next * 50 };
}

export function updateStreak(lastDate: Date | null): { isActive: boolean; shouldIncrement: boolean; shouldReset: boolean } {
  if (!lastDate) return { isActive: false, shouldIncrement: true, shouldReset: false };
  const now = new Date();
  const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
  if (diffHours < 24) return { isActive: true, shouldIncrement: false, shouldReset: false };
  if (diffHours < 48) return { isActive: true, shouldIncrement: true, shouldReset: false };
  return { isActive: false, shouldIncrement: true, shouldReset: true };
}
