'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

// Points configuration
export const LOYALTY_CONFIG = {
  pointsPerDollar: 10, // 10 points per $1 spent
  pointsValue: 0.01, // 1 point = $0.01
  welcomeBonus: 500, // 500 points for new members
  reviewBonus: 100, // 100 points per review
  referralBonus: 1000, // 1000 points for referrer
  referralBonusReferee: 500, // 500 points for referee
  birthdayBonus: 500, // 500 points on birthday
  subscriptionBonus: 200, // 200 bonus points per subscription order
};

// Tier configuration
export const LOYALTY_TIERS = [
  {
    id: 'bronze',
    name: 'Bronze',
    icon: '🥉',
    minPoints: 0,
    multiplier: 1,
    benefits: ['10 points per $1 spent', 'Access to member-only sales', 'Free shipping over $100'],
    color: 'from-amber-600 to-amber-700',
  },
  {
    id: 'silver',
    name: 'Silver',
    icon: '🥈',
    minPoints: 2500,
    multiplier: 1.25,
    benefits: ['12.5 points per $1 spent', 'Early access to new products', 'Free shipping over $75', '5% off all orders'],
    color: 'from-gray-400 to-gray-500',
  },
  {
    id: 'gold',
    name: 'Gold',
    icon: '🥇',
    minPoints: 7500,
    multiplier: 1.5,
    benefits: ['15 points per $1 spent', 'Priority customer support', 'Free shipping over $50', '10% off all orders', 'Exclusive Gold sales'],
    color: 'from-yellow-500 to-yellow-600',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    icon: '💎',
    minPoints: 15000,
    multiplier: 2,
    benefits: ['20 points per $1 spent', 'Dedicated account manager', 'Free shipping on all orders', '15% off all orders', 'VIP access to events', 'Free samples with every order'],
    color: 'from-purple-500 to-purple-600',
  },
];

// Rewards catalog
export const LOYALTY_REWARDS = [
  { id: 'discount-5', name: '$5 Off', points: 500, type: 'discount', value: 5 },
  { id: 'discount-10', name: '$10 Off', points: 1000, type: 'discount', value: 10 },
  { id: 'discount-25', name: '$25 Off', points: 2500, type: 'discount', value: 25 },
  { id: 'discount-50', name: '$50 Off', points: 5000, type: 'discount', value: 50 },
  { id: 'free-shipping', name: 'Free Shipping', points: 300, type: 'shipping', value: 0 },
  { id: 'bac-water-free', name: 'Free BAC Water (10ml)', points: 800, type: 'product', value: 'bac-water-10ml' },
  { id: 'syringes-free', name: 'Free Syringe Pack (10)', points: 600, type: 'product', value: 'syringes-10' },
  { id: 'double-points', name: 'Double Points (Next Order)', points: 1500, type: 'multiplier', value: 2 },
];

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
  redeemReward: (rewardId: string) => boolean;
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
  }, [session]);

  // Update tier when points change
  useEffect(() => {
    const newTier = [...LOYALTY_TIERS].reverse().find(t => state.lifetimePoints >= t.minPoints) || LOYALTY_TIERS[0];
    if (newTier.id !== state.tier.id) {
      setState(prev => ({ ...prev, tier: newTier }));
    }
  }, [state.lifetimePoints]);

  const loadLoyaltyData = async () => {
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
      } else {
        // API returned error, use default state
        console.log('Loyalty API returned non-OK status:', res.status);
      }
    } catch (error) {
      console.error('Error loading loyalty data:', error);
      // Continue with default state, don't crash
    } finally {
      setIsLoading(false);
    }
  };

  const generateReferralCode = () => {
    if (session?.user?.name) {
      return `${session.user.name.split(' ')[0].toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }
    return `PP${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  const earnPoints = async (amount: number, description: string, orderId?: string) => {
    const pointsEarned = Math.floor(amount * state.tier.multiplier);
    
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

    // Save to backend
    if (session?.user?.email) {
      try {
        await fetch('/api/loyalty/earn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: pointsEarned, description, orderId }),
        });
      } catch (error) {
        console.error('Error saving points:', error);
      }
    } else {
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

  const redeemReward = (rewardId: string): boolean => {
    const reward = LOYALTY_REWARDS.find(r => r.id === rewardId);
    if (!reward || state.points < reward.points) return false;

    const transaction: LoyaltyTransaction = {
      id: Date.now().toString(),
      type: 'redeem',
      points: -reward.points,
      description: `Redeemed: ${reward.name}`,
      date: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      points: prev.points - reward.points,
      transactions: [transaction, ...prev.transactions],
      activeRewards: [...prev.activeRewards, rewardId],
    }));

    // Save to backend
    if (session?.user?.email) {
      fetch('/api/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      });
    }

    return true;
  };

  const getPointsForPurchase = (amount: number): number => {
    return Math.floor(amount * LOYALTY_CONFIG.pointsPerDollar * state.tier.multiplier);
  };

  const getDiscountFromPoints = (points: number): number => {
    return points * LOYALTY_CONFIG.pointsValue;
  };

  const getTierProgress = () => {
    const currentTierIndex = LOYALTY_TIERS.findIndex(t => t.id === state.tier.id);
    const nextTier = LOYALTY_TIERS[currentTierIndex + 1];
    
    if (!nextTier) {
      return { current: state.lifetimePoints, next: state.lifetimePoints, percentage: 100 };
    }

    const current = state.lifetimePoints - state.tier.minPoints;
    const next = nextTier.minPoints - state.tier.minPoints;
    const percentage = Math.min(100, Math.round((current / next) * 100));

    return { current: state.lifetimePoints, next: nextTier.minPoints, percentage };
  };

  const canRedeemReward = (rewardId: string): boolean => {
    const reward = LOYALTY_REWARDS.find(r => r.id === rewardId);
    return reward ? state.points >= reward.points : false;
  };

  return (
    <LoyaltyContext.Provider
      value={{
        ...state,
        isLoading,
        earnPoints,
        redeemReward,
        getPointsForPurchase,
        getDiscountFromPoints,
        getTierProgress,
        canRedeemReward,
      }}
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
