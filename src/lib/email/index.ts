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
  type BirthdayEmailData,
  type WelcomeEmailData,
  type AbandonedCartEmailData,
  type BackInStockEmailData,
  type PointsExpiringEmailData,
  type PriceDropEmailData,
} from './templates/marketing-emails';
