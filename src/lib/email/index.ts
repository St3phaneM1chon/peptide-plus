/**
 * Email System - BioCycle Peptides
 * Export centralisé pour le système d'emails
 */

// Service d'envoi
export { sendEmail, type SendEmailOptions, type EmailResult, type EmailRecipient } from './email-service';

// Templates de base
export { baseTemplate, emailComponents } from './templates/base-template';

// Templates de commandes
export {
  orderConfirmationEmail,
  orderProcessingEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderCancelledEmail,
  orderRefundEmail,
  satisfactionSurveyEmail,
  type OrderData,
  type OrderItem,
} from './templates/order-emails';

// Order lifecycle email dispatcher
export { sendOrderLifecycleEmail } from './order-lifecycle';

// Templates marketing
export {
  birthdayEmail,
  welcomeEmail,
  abandonedCartEmail,
  backInStockEmail,
  pointsExpiringEmail,
  priceDropEmail,
  browseAbandonmentEmail,
  replenishmentReminderEmail,
  crossSellEmail,
  sunsetEmail,
  vipTierUpEmail,
  PEPTIDE_CROSS_SELL_MAP,
  LOYALTY_TIERS,
  type BirthdayEmailData,
  type WelcomeEmailData,
  type AbandonedCartEmailData,
  type BackInStockEmailData,
  type PointsExpiringEmailData,
  type PriceDropEmailData,
  type BrowseAbandonmentEmailData,
  type ReplenishmentReminderEmailData,
  type CrossSellEmailData,
  type SunsetEmailData,
  type VipTierUpEmailData,
} from './templates/marketing-emails';

// Unsubscribe URL generation (CAN-SPAM / RGPD / LCAP compliance)
export {
  generateUnsubscribeUrl,
  generateUnsubscribeToken,
  type UnsubscribeCategory,
} from './unsubscribe';

// Inbound email handler (Communication Hub)
export {
  processInboundEmail,
  getConversationThread,
  updateConversationStatus,
  assignConversation,
  updateConversationTags,
  type InboundEmailPayload,
  type ProcessedEmail,
} from './inbound-handler';

// Automation engine (Workflow execution)
export {
  handleEvent,
  getPreBuiltFlows,
  type FlowNode,
  type FlowEdge,
  type TriggerEvent,
} from './automation-engine';
