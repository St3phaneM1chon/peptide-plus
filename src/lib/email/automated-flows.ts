/**
 * Automated Email Flow Engine
 * 12 pre-built flows: welcome, abandoned cart, post-purchase, win-back, review request,
 * birthday, re-engagement, browse abandonment, replenishment reminder, cross-sell,
 * sunset/list cleanup, VIP loyalty tier
 */

export interface EmailFlow {
  id: string;
  name: string;
  nameFr: string;
  trigger: string;
  description: string;
  steps: EmailFlowStep[];
  isActive: boolean;
}

export interface EmailFlowStep {
  id: string;
  type: 'email' | 'wait' | 'condition' | 'action';
  delayHours?: number;
  templateId?: string;
  subject?: string;
  condition?: { field: string; operator: string; value: unknown };
  action?: { type: string; params: Record<string, unknown> };
}

export const DEFAULT_FLOWS: EmailFlow[] = [
  {
    id: 'welcome',
    name: 'Welcome Series',
    nameFr: 'Série de bienvenue',
    trigger: 'USER_REGISTERED',
    description: '3-email welcome series for new customers',
    isActive: true,
    steps: [
      { id: 'w1', type: 'email', subject: 'Bienvenue chez BioCycle Peptides!', templateId: 'welcome-1' },
      { id: 'w2', type: 'wait', delayHours: 48 },
      { id: 'w3', type: 'email', subject: 'Découvrez nos peptides les plus populaires', templateId: 'welcome-2' },
      { id: 'w4', type: 'wait', delayHours: 120 },
      { id: 'w5', type: 'email', subject: '10% de réduction sur votre première commande', templateId: 'welcome-3' },
    ],
  },
  {
    id: 'abandoned-cart',
    name: 'Abandoned Cart Recovery',
    nameFr: 'Récupération de panier abandonné',
    trigger: 'CART_ABANDONED',
    description: '3-step recovery: reminder, discount, last chance',
    isActive: true,
    steps: [
      { id: 'ac1', type: 'wait', delayHours: 1 },
      { id: 'ac2', type: 'email', subject: 'Vous avez oublié quelque chose...', templateId: 'cart-reminder' },
      { id: 'ac3', type: 'wait', delayHours: 24 },
      { id: 'ac4', type: 'condition', condition: { field: 'cartRecovered', operator: 'eq', value: false } },
      { id: 'ac5', type: 'email', subject: '5% de réduction sur votre panier', templateId: 'cart-discount' },
      { id: 'ac6', type: 'wait', delayHours: 48 },
      { id: 'ac7', type: 'email', subject: 'Dernière chance – votre panier expire bientôt', templateId: 'cart-last-chance' },
    ],
  },
  {
    id: 'post-purchase',
    name: 'Post-Purchase',
    nameFr: 'Après-achat',
    trigger: 'ORDER_DELIVERED',
    description: 'Thank you, review request, cross-sell',
    isActive: true,
    steps: [
      { id: 'pp1', type: 'email', subject: 'Merci pour votre commande!', templateId: 'thank-you' },
      { id: 'pp2', type: 'wait', delayHours: 168 },
      { id: 'pp3', type: 'email', subject: 'Comment aimez-vous vos produits?', templateId: 'review-request' },
      { id: 'pp4', type: 'wait', delayHours: 336 },
      { id: 'pp5', type: 'email', subject: 'Produits complémentaires sélectionnés pour vous', templateId: 'cross-sell' },
    ],
  },
  {
    id: 'win-back',
    name: 'Win-Back',
    nameFr: 'Reconquête',
    trigger: 'CUSTOMER_INACTIVE',
    description: 'Re-engage customers inactive for 60+ days',
    isActive: true,
    steps: [
      { id: 'wb1', type: 'email', subject: 'Vous nous manquez!', templateId: 'win-back-1' },
      { id: 'wb2', type: 'wait', delayHours: 168 },
      { id: 'wb3', type: 'condition', condition: { field: 'hasOrdered', operator: 'eq', value: false } },
      { id: 'wb4', type: 'email', subject: '15% de réduction – juste pour vous', templateId: 'win-back-2' },
      { id: 'wb5', type: 'wait', delayHours: 336 },
      { id: 'wb6', type: 'email', subject: 'Dernières nouveautés que vous avez manquées', templateId: 'win-back-3' },
    ],
  },
  {
    id: 'review-request',
    name: 'Review Request',
    nameFr: 'Demande d\'avis',
    trigger: 'ORDER_DELIVERED',
    description: 'Request product review 7 days after delivery',
    isActive: true,
    steps: [
      { id: 'rr1', type: 'wait', delayHours: 168 },
      { id: 'rr2', type: 'email', subject: 'Partagez votre expérience', templateId: 'review-request' },
      { id: 'rr3', type: 'wait', delayHours: 336 },
      { id: 'rr4', type: 'condition', condition: { field: 'hasReviewed', operator: 'eq', value: false } },
      { id: 'rr5', type: 'email', subject: 'Gagnez 50 points fidélité pour votre avis', templateId: 'review-incentive' },
    ],
  },
  {
    id: 'birthday',
    name: 'Birthday',
    nameFr: 'Anniversaire',
    trigger: 'CUSTOMER_BIRTHDAY',
    description: 'Birthday discount email',
    isActive: true,
    steps: [
      { id: 'bd1', type: 'email', subject: 'Joyeux anniversaire! 🎂 Un cadeau pour vous', templateId: 'birthday' },
    ],
  },
  {
    id: 're-engagement',
    name: 'Re-Engagement',
    nameFr: 'Réengagement',
    trigger: 'EMAIL_INACTIVE',
    description: 'Re-engage subscribers who haven\'t opened emails in 90 days',
    isActive: true,
    steps: [
      { id: 're1', type: 'email', subject: 'Toujours intéressé(e)?', templateId: 're-engagement' },
      { id: 're2', type: 'wait', delayHours: 168 },
      { id: 're3', type: 'condition', condition: { field: 'emailOpened', operator: 'eq', value: false } },
      { id: 're4', type: 'action', action: { type: 'UNSUBSCRIBE', params: { reason: 'inactive_90d' } } },
    ],
  },
  // -- 8. Browse Abandonment -----------------------------------------------
  {
    id: 'browse-abandonment',
    name: 'Browse Abandonment',
    nameFr: 'Abandon de navigation',
    trigger: 'BROWSE_ABANDONED',
    description: '3-step flow for users who viewed products 2+ times without adding to cart',
    isActive: true,
    steps: [
      { id: 'ba1', type: 'wait', delayHours: 4 },
      { id: 'ba2', type: 'email', subject: 'Toujours intéressé(e) par ce produit?', templateId: 'browse-abandonment-interest' },
      { id: 'ba3', type: 'wait', delayHours: 24 },
      { id: 'ba4', type: 'condition', condition: { field: 'addedToCart', operator: 'eq', value: false } },
      { id: 'ba5', type: 'email', subject: 'Des produits similaires qui pourraient vous plaire', templateId: 'browse-abandonment-similar' },
      { id: 'ba6', type: 'wait', delayHours: 48 },
      { id: 'ba7', type: 'condition', condition: { field: 'cartValue', operator: 'gt', value: 100 } },
      { id: 'ba8', type: 'email', subject: '5% de rabais sur votre prochain achat!', templateId: 'browse-abandonment-incentive' },
    ],
  },
  // -- 9. Replenishment Reminder -------------------------------------------
  {
    id: 'replenishment-reminder',
    name: 'Replenishment Reminder',
    nameFr: 'Rappel de réapprovisionnement',
    trigger: 'REORDER_DUE',
    description: '3-step flow to remind customers to reorder before running out (critical for peptides)',
    isActive: true,
    steps: [
      { id: 'rp1', type: 'email', subject: 'Bientôt à court? Recommandez votre produit', templateId: 'replenishment-running-low' },
      { id: 'rp2', type: 'wait', delayHours: 120 },
      { id: 'rp3', type: 'condition', condition: { field: 'hasReordered', operator: 'eq', value: false } },
      { id: 'rp4', type: 'email', subject: 'Ne tombez pas en rupture! Dernière chance de recommander', templateId: 'replenishment-last-chance' },
      { id: 'rp5', type: 'wait', delayHours: 120 },
      { id: 'rp6', type: 'condition', condition: { field: 'hasReordered', operator: 'eq', value: false } },
      { id: 'rp7', type: 'email', subject: 'Votre produit vous manque? 10% de rabais', templateId: 'replenishment-incentive' },
    ],
  },
  // -- 10. Cross-Sell / Upsell ---------------------------------------------
  {
    id: 'cross-sell',
    name: 'Cross-Sell / Upsell',
    nameFr: 'Vente croisée / montée en gamme',
    trigger: 'ORDER_DELIVERED',
    description: '2-step flow: complementary products at 7 days, upgrade options at 14 days',
    isActive: true,
    steps: [
      { id: 'cs1', type: 'wait', delayHours: 168 },
      { id: 'cs2', type: 'email', subject: 'Les clients qui ont acheté ce produit adorent aussi...', templateId: 'cross-sell-complementary' },
      { id: 'cs3', type: 'wait', delayHours: 168 },
      { id: 'cs4', type: 'email', subject: 'Passez au niveau supérieur avec votre protocole', templateId: 'cross-sell-upgrade' },
    ],
  },
  // -- 11. Sunset / List Cleanup -------------------------------------------
  {
    id: 'sunset',
    name: 'Sunset / List Cleanup',
    nameFr: 'Nettoyage de liste',
    trigger: 'EMAIL_INACTIVE_90D',
    description: '3-step sunset: re-engage, last chance, auto-unsubscribe for inactive subscribers',
    isActive: true,
    steps: [
      { id: 'su1', type: 'email', subject: 'Vous nous manquez! Voici les nouveautés', templateId: 'sunset-miss-you' },
      { id: 'su2', type: 'wait', delayHours: 168 },
      { id: 'su3', type: 'condition', condition: { field: 'emailOpened', operator: 'eq', value: false } },
      { id: 'su4', type: 'email', subject: 'Dernière chance de rester en contact', templateId: 'sunset-last-chance' },
      { id: 'su5', type: 'wait', delayHours: 168 },
      { id: 'su6', type: 'condition', condition: { field: 'emailOpened', operator: 'eq', value: false } },
      { id: 'su7', type: 'email', subject: 'Au revoir pour le moment', templateId: 'sunset-goodbye' },
      { id: 'su8', type: 'action', action: { type: 'UNSUBSCRIBE', params: { reason: 'sunset_inactive_90d', setInactive: true } } },
    ],
  },
  // -- 12. VIP / Loyalty Tier -----------------------------------------------
  {
    id: 'vip-tier',
    name: 'VIP / Loyalty Tier',
    nameFr: 'Niveau VIP / Fidélité',
    trigger: 'LOYALTY_TIER_UP',
    description: '3-step celebration: tier announcement, perks explanation, exclusive access',
    isActive: true,
    steps: [
      { id: 'vt1', type: 'email', subject: 'Félicitations! Vous avez atteint un nouveau niveau!', templateId: 'vip-tier-congrats' },
      { id: 'vt2', type: 'wait', delayHours: 72 },
      { id: 'vt3', type: 'email', subject: 'Vos avantages exclusifs en détail', templateId: 'vip-tier-perks' },
      { id: 'vt4', type: 'wait', delayHours: 168 },
      { id: 'vt5', type: 'email', subject: 'Accès anticipé VIP - Produits exclusifs', templateId: 'vip-tier-early-access' },
    ],
  },
];

export function getFlowById(id: string): EmailFlow | undefined {
  return DEFAULT_FLOWS.find((f) => f.id === id);
}

export function getActiveFlows(): EmailFlow[] {
  return DEFAULT_FLOWS.filter((f) => f.isActive);
}

export function getFlowByTrigger(trigger: string): EmailFlow[] {
  return DEFAULT_FLOWS.filter((f) => f.trigger === trigger && f.isActive);
}
