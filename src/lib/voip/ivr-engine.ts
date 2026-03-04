/**
 * IVR Engine — Dynamic Interactive Voice Response
 *
 * Features:
 * - Prisma-backed menus (IvrMenu + IvrMenuOption)
 * - Time-based routing (business hours, after-hours, weekend)
 * - Multi-level sub-menus
 * - TTS greetings with Telnyx Speak
 * - DTMF gather with retry logic
 * - Timeout actions: replay, operator, voicemail
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import * as telnyx from '@/lib/telnyx';

/**
 * Check if current time is within business hours for a menu.
 */
function isBusinessHours(menu: {
  businessHoursStart?: string | null;
  businessHoursEnd?: string | null;
}): boolean {
  if (!menu.businessHoursStart || !menu.businessHoursEnd) return true;

  const now = new Date();
  const day = now.getDay(); // 0=Sun, 6=Sat
  if (day === 0 || day === 6) return false; // Weekend

  const [startH, startM] = menu.businessHoursStart.split(':').map(Number);
  const [endH, endM] = menu.businessHoursEnd.split(':').map(Number);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Load and resolve the correct IVR menu for a phone number,
 * considering time-of-day routing.
 */
export async function resolveIvrMenu(phoneNumber: { routeToIvr: string | null }) {
  if (!phoneNumber.routeToIvr) return null;

  const menu = await prisma.ivrMenu.findFirst({
    where: { id: phoneNumber.routeToIvr, isActive: true },
    include: { options: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!menu) return null;

  // Check business hours — redirect to after-hours menu if applicable
  if (!isBusinessHours(menu) && menu.afterHoursMenuId) {
    const afterHoursMenu = await prisma.ivrMenu.findFirst({
      where: { id: menu.afterHoursMenuId, isActive: true },
      include: { options: { orderBy: { sortOrder: 'asc' } } },
    });
    if (afterHoursMenu) return afterHoursMenu;
  }

  return menu;
}

/**
 * Build a TTS greeting from IVR menu options.
 */
export function buildGreetingText(
  options: Array<{ digit: string; label: string }>,
  companyName = 'BioCycle'
): string {
  const lines = options.map(opt => `Pour ${opt.label}, appuyez sur ${opt.digit}.`);
  return `Bienvenue chez ${companyName}. ${lines.join(' ')}`;
}

/**
 * Play IVR menu greeting and gather DTMF input.
 */
export async function playIvrMenu(
  callControlId: string,
  menu: {
    id: string;
    greetingText?: string | null;
    greetingUrl?: string | null;
    language: string;
    inputTimeout: number;
    options: Array<{ digit: string; label: string }>;
  }
): Promise<void> {
  const greeting = menu.greetingText || buildGreetingText(menu.options);

  // Play consent notice + greeting, then gather
  const fullPrompt = `Cet appel peut être enregistré à des fins de qualité. ${greeting}`;

  await telnyx.gatherDtmf(callControlId, {
    prompt: fullPrompt,
    language: menu.language,
    maxDigits: 1,
    timeoutSecs: menu.inputTimeout,
  });

  logger.info('[IVR] Menu played', { menuId: menu.id, callControlId });
}

/**
 * Handle a gathered digit against an IVR menu.
 * Returns true if the digit was handled, false if invalid.
 */
export async function handleIvrInput(
  callControlId: string,
  menuId: string,
  digits: string
): Promise<boolean> {
  const option = await prisma.ivrMenuOption.findUnique({
    where: {
      menuId_digit: { menuId, digit: digits },
    },
  });

  if (!option) return false;

  logger.info('[IVR] Executing action', {
    menuId,
    digit: digits,
    action: option.action,
    target: option.target,
  });

  await executeIvrAction(callControlId, option.action, option.target, option.announcement);
  return true;
}

/**
 * Handle IVR timeout — replay, route to operator, or voicemail.
 */
export async function handleIvrTimeout(
  callControlId: string,
  menu: {
    id: string;
    timeoutAction: string;
    timeoutTarget?: string | null;
    language: string;
    inputTimeout: number;
    greetingText?: string | null;
    options: Array<{ digit: string; label: string }>;
  },
  attempts: number
): Promise<void> {
  if (menu.timeoutAction === 'replay' && attempts < 3) {
    await telnyx.speakText(callControlId,
      "Nous n'avons pas reçu votre choix.");
    await playIvrMenu(callControlId, menu);
    return;
  }

  if (menu.timeoutAction === 'voicemail' || attempts >= 3) {
    await telnyx.speakText(callControlId,
      "Vous êtes dirigé vers la messagerie vocale. Laissez votre message après le bip.");
    await telnyx.startRecording(callControlId, { channels: 'single', format: 'wav' });
    return;
  }

  if (menu.timeoutAction === 'operator') {
    await telnyx.speakText(callControlId,
      "Transfert vers un agent. Veuillez patienter.");
    // The queue engine will pick this up via transfer_queue
    if (menu.timeoutTarget) {
      await executeIvrAction(callControlId, 'transfer_queue', menu.timeoutTarget, null);
    }
  }
}

/**
 * Execute an IVR option action.
 */
async function executeIvrAction(
  callControlId: string,
  action: string,
  target: string,
  announcement?: string | null
): Promise<void> {
  if (announcement) {
    await telnyx.speakText(callControlId, announcement);
  }

  switch (action) {
    case 'transfer_ext': {
      // Transfer to SIP extension
      const ext = await prisma.sipExtension.findUnique({
        where: { extension: target },
      });
      if (ext) {
        await telnyx.transferCall(callControlId, `sip:${ext.sipUsername}@sip.telnyx.com`);
      } else {
        await telnyx.speakText(callControlId,
          "L'extension demandée n'est pas disponible. Veuillez réessayer plus tard.");
        await telnyx.hangupCall(callControlId);
      }
      break;
    }

    case 'transfer_queue': {
      // Import dynamically to avoid circular deps
      const { routeToQueue } = await import('./queue-engine');
      await routeToQueue(callControlId, target);
      break;
    }

    case 'sub_menu': {
      const subMenu = await prisma.ivrMenu.findFirst({
        where: { id: target, isActive: true },
        include: { options: { orderBy: { sortOrder: 'asc' } } },
      });
      if (subMenu) {
        await playIvrMenu(callControlId, subMenu);
      } else {
        await telnyx.speakText(callControlId, "Menu indisponible.");
      }
      break;
    }

    case 'voicemail': {
      // Import dynamically
      const { startVoicemail } = await import('./voicemail-engine');
      await startVoicemail(callControlId, target);
      break;
    }

    case 'external': {
      await telnyx.transferCall(callControlId, target);
      break;
    }

    default:
      logger.warn('[IVR] Unknown action', { action, target });
  }
}
