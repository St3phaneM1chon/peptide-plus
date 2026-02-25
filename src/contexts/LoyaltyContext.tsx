'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import {
  LOYALTY_POINTS_CONFIG,
  LOYALTY_TIER_THRESHOLDS,
  LOYALTY_REWARDS_CATALOG,
} from '@/lib/constants';

// Re-export from constants for backward compatibility
export const LOYALTY_CONFIG = LOYALTY_POINTS_CONFIG;

// Map canonical tier thresholds to client-side format with icons/benefits
export const LOYALTY_TIERS = LOYALTY_TIER_THRESHOLDS.map(tier => {
  const extras: Record<string, { icon: string; benefits: string[]; color: string }> = {
    BRONZE:   { icon: '🥉', benefits: [`${tier.multiplier * LOYALTY_POINTS_CONFIG.pointsPerDollar} points per $1 spent`, 'Access to member-only sales', 'Free shipping over $100'], color: 'from-amber-600 to-amber-700' },
    SILVER:   { icon: '🥈', benefits: [`${tier.multiplier * LOYALTY_POINTS_CONFIG.pointsPerDollar} points per $1 spent`, 'Early access to new products', 'Free shipping over $75', '5% off all orders'], color: 'from-gray-400 to-gray-500' },
    GOLD:     { icon: '🥇', benefits: [`${tier.multiplier * LOYALTY_POINTS_CONFIG.pointsPerDollar} points per $1 spent`, 'Priority customer support', 'Free shipping over $50', '10% off all orders', 'Exclusive Gold sales'], color: 'from-yellow-500 to-yellow-600' },
    PLATINUM: { icon: '💎', benefits: [`${tier.multiplier * LOYALTY_POINTS_CONFIG.pointsPerDollar} points per $1 spent`, 'Dedicated account manager', 'Free shipping on all orders', '15% off all orders', 'VIP access to events'], color: 'from-purple-500 to-purple-600' },
    DIAMOND:  { icon: '💠', benefits: [`${tier.multiplier * LOYALTY_POINTS_CONFIG.pointsPerDollar} points per $1 spent`, 'Free express shipping', '20% off everything', 'Dedicated support', 'Exclusive products'], color: 'from-indigo-500 to-indigo-700' },
  };
  const extra = extras[tier.id] || extras.BRONZE;
  return {
    id: tier.id.toLowerCase(),
    name: tier.name,
    icon: extra.icon,
    minPoints: tier.minPoints,
    multiplier: tier.multiplier,
    benefits: extra.benefits,
    color: extra.color,
  };
});

// Rewards catalog - mapped from canonical definition for client-side use
export const LOYALTY_REWARDS = Object.entries(LOYALTY_REWARDS_CATALOG).map(([key, r]) => ({
  id: key,
  name: r.description,
  points: r.points,
  type: r.type,
  value: r.value,
}));

interface LoyaltyTransaction {
  id: string;
  type: 'earn' | 'redeem' | 'bonus' | 'expire';
  points: number;
  description: string;
  date: string;
  orderId?: string;
}

interface LoyaltyState {
  points: number;
  lifetimePoints: number;
  tier: typeof LOYALTY_TIERS[0];
  transactions: LoyaltyTransaction[];
  activeRewards: string[];
  referralCode: string;
  referralCount: number;
}

interface LoyaltyContextType extends LoyaltyState {
  isLoading: boolean;
  earnPoints: (amount: number, description: string, orderId?: string) => void;
  redeemReward: (rewardId: string) => Promise<boolean>;
  getPointsForPurchase: (amount: number) => number;
  getDiscountFromPoints: (points: number) => number;
  getTierProgress: () => { current: number; next: number; percentage: number };
  canRedeemReward: (rewardId: string) => boolean;
}

const defaultState: LoyaltyState = {
  points: 0,
  lifetimePoints: 0,
  tier: LOYALTY_TIERS[0],
  transactions: [],
  activeRewards: [],
  referralCode: '',
  referralCount: 0,
};

const LoyaltyContext = createContext<LoyaltyContextType | undefined>(undefined);

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const [state, setState] = useState<LoyaltyState>(defaultState);
  const [isLoading, setIsLoading] = useState(true);

  const generateReferralCode = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomBytes = crypto.getRandomValues(new Uint8Array(6));
    const randomStr = Array.from(randomBytes).map(b => chars[b % chars.length]).join('');
    if (session?.user?.name) {
      return `${session.user.name.split(' ')[0].toUpperCase()}${randomStr.substring(0, 4)}`;
    }
    return `PP${randomStr}`;
  }, [session?.user?.name]);

  const loadLoyaltyData = useCallback(async () => {
    try {
      const res = await fetch('/api/loyalty');
      if (res.ok) {
        const data = await res.json();
        const tier = [...LOYALTY_TIERS].reverse().find(t => data.lifetimePoints >= t.minPoints) || LOYALTY_TIERS[0];
        setState({
          points: data.points || 0,
          lifetimePoints: data.lifetimePoints || 0,
          tier,
          transactions: data.transactions || [],
          activeRewards: data.activeRewards || [],
          referralCode: data.referralCode || generateReferralCode(),
          referralCount: data.referralCount || 0,
        });
      }
    } catch (error) {
      console.error('Error loading loyalty data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.name, generateReferralCode]);

  // Load loyalty data
  useEffect(() => {
    if (session?.user?.email) {
      loadLoyaltyData();
    } else {
      // Load from localStorage for non-authenticated users
      try {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('loyalty_preview');
          if (saved) {
            const data = JSON.parse(saved);
            setState(prev => ({
              ...prev,
              points: data.points || 0,
              lifetimePoints: data.lifetimePoints || 0,
            }));
          }
        }
      } catch (e) {
        console.error('Error loading loyalty preview:', e);
      }
      setIsLoading(false);
    }
  }, [session, loadLoyaltyData]);

  // Update tier when points change
  useEffect(() => {
    const newTier = [...LOYALTY_TIERS].reverse().find(t => state.lifetimePoints >= t.minPoints) || LOYALTY_TIERS[0];
    if (newTier.id !== state.tier.id) {
      setState(prev => ({ ...prev, tier: newTier }));
    }
  }, [state.lifetimePoints, state.tier.id]);

  // F-002 FIX: earnPoints now updates client state ONLY AFTER a successful API
  // response. Previously, setState was called BEFORE the fetch, so if the API
  // rejected the operation (rate limit, validation error, server error) the UI
  // would show incorrect points that never matched the database.
  const earnPoints = async (amount: number, description: string, orderId?: string) => {
    const pointsEarned = Math.floor(amount * state.tier.multiplier);

    // F-002 FIX: For authenticated users, call the API FIRST and only update
    // local state from the server-confirmed response.
    if (session?.user?.email) {
      try {
        const res = await fetch('/api/loyalty/earn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: pointsEarned, description, orderId }),
        });

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('Earn points API error:', errorData);
          // F-002 FIX: Do NOT update state on failure - keep the previous
          // (correct) values so the UI stays consistent with the server.
          return;
        }

        const data = await res.json();

        // F-002 FIX: Update state from server-confirmed values, not local estimates.
        setState(prev => ({
          ...prev,
          points: data.newBalance ?? (prev.points + pointsEarned),
          lifetimePoints: data.lifetimePoints ?? (prev.lifetimePoints + pointsEarned),
          transactions: [{
            id: data.transaction?.id || Date.now().toString(),
            type: 'earn' as const,
            points: data.transaction?.points ?? pointsEarned,
            description: data.transaction?.description ?? description,
            date: data.transaction?.date || new Date().toISOString(),
            orderId,
          }, ...prev.transactions],
        }));
      } catch (error) {
        console.error('Error saving points:', error);
        // F-002 FIX: Network error - do NOT update local state.
      }
    } else {
      // Not authenticated: local-only preview (no API to confirm against)
      const transaction: LoyaltyTransaction = {
        id: Date.now().toString(),
        type: 'earn',
        points: pointsEarned,
        description,
        date: new Date().toISOString(),
        orderId,
      };

      setState(prev => ({
        ...prev,
        points: prev.points + pointsEarned,
        lifetimePoints: prev.lifetimePoints + pointsEarned,
        transactions: [transaction, ...prev.transactions],
      }));

      // Save preview to localStorage
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('loyalty_preview', JSON.stringify({
            points: state.points + pointsEarned,
            lifetimePoints: state.lifetimePoints + pointsEarned,
          }));
        }
      } catch (e) {
        console.error('Error saving loyalty preview:', e);
      }
    }
  };

  const redeemReward = async (rewardId: string): Promise<boolean> => {
    const reward = LOYALTY_REWARDS.find(r => r.id === rewardId);
    if (!reward || state.points < reward.points) return false;

    // FIX F-003: Call API FIRST, only update local state on success
    if (session?.user?.email) {
      try {
        const res = await fetch('/api/loyalty/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rewardId }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          console.error('Redeem API error:', errorData);
          return false;
        }
        const data = await res.json();
        // Update state from server response for consistency
        setState(prev => ({
          ...prev,
          points: data.newBalance ?? (prev.points - reward.points),
          transactions: [{
            id: data.transaction?.id || Date.now().toString(),
            type: 'redeem' as const,
            points: -reward.points,
            description: `Redeemed: ${reward.name}`,
            date: data.transaction?.date || new Date().toISOString(),
          }, ...prev.transactions],
          activeRewards: [...prev.activeRewards, rewardId],
        }));
        return true;
      } catch (error) {
        console.error('Redeem network error:', error);
        return false;
      }
    }

    // Offline / not authenticated: local-only update
    setState(prev => ({
      ...prev,
      points: prev.points - reward.points,
      transactions: [{
        id: Date.now().toString(),
        type: 'redeem' as const,
        points: -reward.points,
        description: `Redeemed: ${reward.name}`,
        date: new Date().toISOString(),
      }, ...prev.transactions],
      activeRewards: [...prev.activeRewards, rewardId],
    }));
    return true;
  };

  const getPointsForPurchase = useCallback((amount: number): number => {
    return Math.floor(amount * LOYALTY_CONFIG.pointsPerDollar * state.tier.multiplier);
  }, [state.tier.multiplier]);

  const getDiscountFromPoints = useCallback((points: number): number => {
    return points * LOYALTY_CONFIG.pointsValue;
  }, []);

  const getTierProgress = useCallback(() => {
    const currentTierIndex = LOYALTY_TIERS.findIndex(t => t.id === state.tier.id);
    const nextTier = LOYALTY_TIERS[currentTierIndex + 1];
    
    if (!nextTier) {
      return { current: state.lifetimePoints, next: state.lifetimePoints, percentage: 100 };
    }

    const current = state.lifetimePoints - state.tier.minPoints;
    const next = nextTier.minPoints - state.tier.minPoints;
    const percentage = Math.min(100, Math.round((current / next) * 100));

    return { current: state.lifetimePoints, next: nextTier.minPoints, percentage };
  }, [state.lifetimePoints, state.tier.id, state.tier.minPoints]);

  const canRedeemReward = useCallback((rewardId: string): boolean => {
    const reward = LOYALTY_REWARDS.find(r => r.id === rewardId);
    return reward ? state.points >= reward.points : false;
  }, [state.points]);

  const contextValue = useMemo(() => ({
    ...state,
    isLoading,
    earnPoints,
    redeemReward,
    getPointsForPurchase,
    getDiscountFromPoints,
    getTierProgress,
    canRedeemReward,
  }), [state, isLoading, earnPoints, redeemReward, getPointsForPurchase, getDiscountFromPoints, getTierProgress, canRedeemReward]);

  return (
    <LoyaltyContext.Provider
      value={contextValue}
    >
      {children}
    </LoyaltyContext.Provider>
  );
}

export function useLoyalty() {
  const context = useContext(LoyaltyContext);
  if (context === undefined) {
    throw new Error('useLoyalty must be used within a LoyaltyProvider');
  }
  return context;
}
