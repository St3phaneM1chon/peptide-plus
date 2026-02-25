/**
 * Loyalty Email Triggers
 * Welcome, tier upgrade, points expiring, milestone reached, monthly summary
 */

export interface LoyaltyEmailTrigger {
  id: string;
  type: string;
  name: string;
  nameFr: string;
  description: string;
  subject: string;
  subjectFr: string;
}

export const LOYALTY_EMAIL_TRIGGERS: LoyaltyEmailTrigger[] = [
  {
    id: 'loyalty-welcome',
    type: 'LOYALTY_WELCOME',
    name: 'Loyalty Welcome',
    nameFr: 'Bienvenue fidélité',
    description: 'Sent when user first joins loyalty program',
    subject: 'Welcome to BioCycle Rewards!',
    subjectFr: 'Bienvenue au programme fidélité BioCycle!',
  },
  {
    id: 'tier-upgrade',
    type: 'TIER_UPGRADE',
    name: 'Tier Upgrade',
    nameFr: 'Montée de niveau',
    description: 'Sent when user reaches new loyalty tier',
    subject: 'Congratulations! You\'ve reached {{tierName}}!',
    subjectFr: 'Félicitations! Vous avez atteint le niveau {{tierName}}!',
  },
  {
    id: 'points-expiring',
    type: 'POINTS_EXPIRING',
    name: 'Points Expiring',
    nameFr: 'Points expirants',
    description: 'Reminder before points expire',
    subject: '{{points}} points expiring soon - use them now!',
    subjectFr: '{{points}} points expirent bientôt - utilisez-les!',
  },
  {
    id: 'milestone-reached',
    type: 'MILESTONE_REACHED',
    name: 'Milestone Reached',
    nameFr: 'Jalon atteint',
    description: 'Congratulations on reaching a purchase milestone',
    subject: 'You\'ve earned the {{badgeName}} badge!',
    subjectFr: 'Vous avez gagné le badge {{badgeName}}!',
  },
  {
    id: 'monthly-summary',
    type: 'MONTHLY_SUMMARY',
    name: 'Monthly Summary',
    nameFr: 'Résumé mensuel',
    description: 'Monthly points and activity summary',
    subject: 'Your BioCycle Rewards Summary - {{month}}',
    subjectFr: 'Votre résumé fidélité BioCycle - {{month}}',
  },
];

export function generateLoyaltyEmailData(
  trigger: LoyaltyEmailTrigger,
  variables: Record<string, string>,
  locale: string = 'fr'
): { subject: string; templateId: string } {
  let subject = locale === 'fr' ? trigger.subjectFr : trigger.subject;
  for (const [key, value] of Object.entries(variables)) {
    subject = subject.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return { subject, templateId: trigger.id };
}
