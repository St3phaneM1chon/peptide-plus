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
  satisfactionSurveyEmail,
  type OrderData,
  type OrderItem,
} from './templates/order-emails';

// Templates marketing
export {
  birthdayEmail,
  welcomeEmail,
  abandonedCartEmail,
  backInStockEmail,
  pointsExpiringEmail,
  type BirthdayEmailData,
  type WelcomeEmailData,
  type AbandonedCartEmailData,
  type BackInStockEmailData,
  type PointsExpiringEmailData,
} from './templates/marketing-emails';
