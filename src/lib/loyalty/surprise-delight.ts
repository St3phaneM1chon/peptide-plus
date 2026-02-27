/**
 * Surprise & Delight Engine
 * Random bonus points, birthday rewards, tenure celebrations
 */

export interface SurpriseReward {
  type: 'bonus_points' | 'free_shipping' | 'discount_code' | 'birthday' | 'anniversary' | 'random';
  title: string;
  titleFr: string;
  description: string;
  value: number; // points or percentage
  expiresInDays: number;
}

export function checkBirthdayReward(birthDate: Date | null, lastBirthdayReward: Date | null): SurpriseReward | null {
  if (!birthDate) return null;
  const today = new Date();
  const isBirthday = today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate();
  if (!isBirthday) return null;
  if (lastBirthdayReward && lastBirthdayReward.getFullYear() === today.getFullYear()) return null;

  return {
    type: 'birthday',
    title: 'Happy Birthday!',
    titleFr: 'Joyeux anniversaire!',
    description: 'Double points on all orders today + 100 bonus points',
    value: 100,
    expiresInDays: 7,
  };
}

export function checkAnniversaryReward(createdAt: Date, lastAnniversaryReward: Date | null): SurpriseReward | null {
  const today = new Date();
  const isAnniversary = today.getMonth() === createdAt.getMonth() && today.getDate() === createdAt.getDate();
  if (!isAnniversary) return null;
  const years = today.getFullYear() - createdAt.getFullYear();
  if (years < 1) return null;
  if (lastAnniversaryReward && lastAnniversaryReward.getFullYear() === today.getFullYear()) return null;

  return {
    type: 'anniversary',
    title: `${years}-Year Anniversary!`,
    titleFr: `${years} an${years > 1 ? 's' : ''} avec nous!`,
    description: `${years * 50} bonus points for your loyalty`,
    value: years * 50,
    expiresInDays: 30,
  };
}

export function generateRandomSurprise(_orderCount: number, lastSurpriseDate: Date | null): SurpriseReward | null {
  // Only surprise every 30+ days
  if (lastSurpriseDate) {
    const daysSince = (Date.now() - lastSurpriseDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) return null;
  }

  // 10% chance on each qualifying order
  if (Math.random() > 0.1) return null;

  const surprises: SurpriseReward[] = [
    { type: 'bonus_points', title: 'Lucky Day!', titleFr: 'Jour de chance!', description: '50 bonus points just because', value: 50, expiresInDays: 30 },
    { type: 'free_shipping', title: 'Free Shipping!', titleFr: 'Livraison gratuite!', description: 'Free shipping on your next order', value: 0, expiresInDays: 14 },
    { type: 'discount_code', title: 'Special Discount!', titleFr: 'Réduction spéciale!', description: '10% off your next order', value: 10, expiresInDays: 14 },
  ];

  return surprises[Math.floor(Math.random() * surprises.length)];
}
