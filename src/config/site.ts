/**
 * SITE CONFIGURATION
 * Configuration unique pour chaque instance du template
 * 
 * Chaque site créé à partir de ce template aura un SITE_ID unique
 * permettant de router les messages vers le bon destinataire.
 */

export const siteConfig = {
  // Identifiant unique du site (à changer pour chaque déploiement)
  // Utilisé pour identifier les conversations provenant de ce site
  siteId: process.env.SITE_ID || 'default-site',
  
  // Nom du site affiché
  siteName: process.env.SITE_NAME || process.env.BUSINESS_NAME || 'Mon Site',
  
  // URL du site
  siteUrl: process.env.NEXTAUTH_URL || 'https://example.com',
  
  // Configuration du chat
  chat: {
    // Activer/désactiver le chat
    enabled: process.env.CHAT_ENABLED !== 'false',
    
    // Notification email pour les nouveaux messages
    notificationEmail: process.env.CHAT_NOTIFICATION_EMAIL || process.env.BUSINESS_EMAIL,
    
    // Webhook URL pour notifications externes (Slack, Discord, etc.)
    webhookUrl: process.env.CHAT_WEBHOOK_URL,
    
    // Temps de réponse moyen affiché (en minutes)
    averageResponseTime: parseInt(process.env.CHAT_RESPONSE_TIME || '30'),
    
    // Heures d'ouverture du support
    businessHours: {
      enabled: process.env.CHAT_BUSINESS_HOURS_ENABLED === 'true',
      timezone: process.env.CHAT_TIMEZONE || 'America/Toronto',
      // Format: "HH:MM-HH:MM" ou null pour fermé
      schedule: {
        monday: process.env.CHAT_HOURS_MON || '09:00-17:00',
        tuesday: process.env.CHAT_HOURS_TUE || '09:00-17:00',
        wednesday: process.env.CHAT_HOURS_WED || '09:00-17:00',
        thursday: process.env.CHAT_HOURS_THU || '09:00-17:00',
        friday: process.env.CHAT_HOURS_FRI || '09:00-17:00',
        saturday: process.env.CHAT_HOURS_SAT || null,
        sunday: process.env.CHAT_HOURS_SUN || null,
      },
    },
    
    // Message hors heures
    offlineMessage: {
      fr: 'Notre équipe est actuellement indisponible. Nous vous répondrons dès que possible.',
      en: 'Our team is currently unavailable. We will get back to you as soon as possible.',
      es: 'Nuestro equipo no está disponible actualmente. Nos pondremos en contacto con usted lo antes posible.',
    },
  },
  
  // Configuration des notifications
  notifications: {
    // Envoyer un email pour chaque nouveau message client
    emailOnNewMessage: process.env.NOTIFY_EMAIL_ON_MESSAGE === 'true',
    
    // Envoyer une notification webhook
    webhookOnNewMessage: process.env.NOTIFY_WEBHOOK_ON_MESSAGE === 'true',
  },
};

/**
 * Vérifie si le support est actuellement disponible
 */
export function isSupportAvailable(): boolean {
  if (!siteConfig.chat.businessHours.enabled) {
    return true; // Toujours disponible si les heures ne sont pas configurées
  }

  const now = new Date();
  const timezone = siteConfig.chat.businessHours.timezone;
  
  // Obtenir le jour et l'heure dans le fuseau horaire configuré
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: timezone, 
    weekday: 'long', 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false,
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  
  const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase();
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  
  const currentTime = hour * 60 + minute; // Minutes depuis minuit
  
  const schedule = siteConfig.chat.businessHours.schedule;
  const todaySchedule = schedule[weekday as keyof typeof schedule];
  
  if (!todaySchedule) {
    return false; // Fermé ce jour
  }
  
  const [start, end] = todaySchedule.split('-');
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  
  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Obtient le message hors-ligne traduit
 */
export function getOfflineMessage(locale: string): string {
  const messages = siteConfig.chat.offlineMessage;
  return messages[locale as keyof typeof messages] || messages.en;
}

export default siteConfig;
