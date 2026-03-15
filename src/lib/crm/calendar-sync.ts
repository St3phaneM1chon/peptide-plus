/**
 * CRM Calendar Sync (M6 - Google Calendar + Outlook)
 *
 * Bidirectional calendar sync for meetings/tasks.
 * - syncGoogleCalendar: Sync CRM tasks with Google Calendar
 * - syncOutlookCalendar: Sync CRM tasks with Outlook Calendar
 * - createCalendarEvent: Push a CRM meeting to an external calendar
 * - importCalendarEvents: Pull calendar events into CRM tasks
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarProvider = 'google' | 'outlook';

export interface CalendarEvent {
  id?: string;
  title: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  attendees?: string[];
  location?: string;
  externalId?: string; // ID in external calendar
}

export interface SyncResult {
  provider: CalendarProvider;
  pushed: number;
  pulled: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Lazy SDK initialization
// ---------------------------------------------------------------------------

function getGoogleConfig(): { clientId: string; clientSecret: string; calendarApiUrl: string } {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google Calendar credentials not configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)');
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    calendarApiUrl: 'https://www.googleapis.com/calendar/v3',
  };
}

function getOutlookConfig(): { clientId: string; clientSecret: string; graphApiUrl: string } {
  if (!process.env.AZURE_AD_CLIENT_ID || !process.env.AZURE_AD_CLIENT_SECRET) {
    throw new Error('Outlook Calendar credentials not configured (AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET)');
  }
  return {
    clientId: process.env.AZURE_AD_CLIENT_ID,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    graphApiUrl: 'https://graph.microsoft.com/v1.0',
  };
}

// ---------------------------------------------------------------------------
// Sync Google Calendar
// ---------------------------------------------------------------------------

/**
 * Sync CRM tasks/meetings with Google Calendar for a user.
 */
export async function syncGoogleCalendar(userId: string, accessToken: string): Promise<SyncResult> {
  const config = getGoogleConfig();
  const result: SyncResult = { provider: 'google', pushed: 0, pulled: 0, errors: 0 };

  // Push CRM tasks (type MEETING) to Google Calendar
  const tasks = await prisma.crmTask.findMany({
    where: {
      assignedToId: userId,
      type: 'MEETING',
      status: { not: 'COMPLETED' },
      dueAt: { not: null },
    },
    orderBy: { dueAt: 'asc' },
    take: 50,
  });

  for (const task of tasks) {
    try {
      const event = {
        summary: task.title,
        description: task.description || '',
        start: { dateTime: task.dueAt!.toISOString() },
        end: { dateTime: new Date(task.dueAt!.getTime() + 3600000).toISOString() },
      };

      const response = await fetch(
        `${config.calendarApiUrl}/calendars/primary/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (response.ok) {
        result.pushed++;
      } else {
        result.errors++;
        logger.warn('[calendar-sync] Failed to push Google event', {
          taskId: task.id,
          status: response.status,
        });
      }
    } catch (err) {
      result.errors++;
      logger.error('[calendar-sync] Google push error', {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Pull recent events from Google Calendar
  try {
    const pullResult = await importCalendarEvents('google', userId, accessToken);
    result.pulled = pullResult;
  } catch (err) {
    logger.error('[calendar-sync] Google pull error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('[calendar-sync] Google Calendar sync completed', { userId, ...result });
  return result;
}

// ---------------------------------------------------------------------------
// Sync Outlook Calendar
// ---------------------------------------------------------------------------

/**
 * Sync CRM tasks/meetings with Outlook Calendar for a user.
 */
export async function syncOutlookCalendar(userId: string, accessToken: string): Promise<SyncResult> {
  const config = getOutlookConfig();
  const result: SyncResult = { provider: 'outlook', pushed: 0, pulled: 0, errors: 0 };

  const tasks = await prisma.crmTask.findMany({
    where: {
      assignedToId: userId,
      type: 'MEETING',
      status: { not: 'COMPLETED' },
      dueAt: { not: null },
    },
    orderBy: { dueAt: 'asc' },
    take: 50,
  });

  for (const task of tasks) {
    try {
      const event = {
        subject: task.title,
        body: { contentType: 'text', content: task.description || '' },
        start: { dateTime: task.dueAt!.toISOString(), timeZone: 'UTC' },
        end: { dateTime: new Date(task.dueAt!.getTime() + 3600000).toISOString(), timeZone: 'UTC' },
      };

      const response = await fetch(
        `${config.graphApiUrl}/me/events`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        }
      );

      if (response.ok) {
        result.pushed++;
      } else {
        result.errors++;
        logger.warn('[calendar-sync] Failed to push Outlook event', {
          taskId: task.id,
          status: response.status,
        });
      }
    } catch (err) {
      result.errors++;
      logger.error('[calendar-sync] Outlook push error', {
        taskId: task.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  try {
    const pullResult = await importCalendarEvents('outlook', userId, accessToken);
    result.pulled = pullResult;
  } catch (err) {
    logger.error('[calendar-sync] Outlook pull error', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('[calendar-sync] Outlook Calendar sync completed', { userId, ...result });
  return result;
}

// ---------------------------------------------------------------------------
// Create Calendar Event
// ---------------------------------------------------------------------------

/**
 * Push a single CRM meeting event to an external calendar provider.
 */
export async function createCalendarEvent(
  provider: CalendarProvider,
  accessToken: string,
  event: CalendarEvent
): Promise<{ externalId: string } | null> {
  let url: string;
  let body: Record<string, unknown>;

  if (provider === 'google') {
    const config = getGoogleConfig();
    url = `${config.calendarApiUrl}/calendars/primary/events`;
    body = {
      summary: event.title,
      description: event.description || '',
      start: { dateTime: event.startTime },
      end: { dateTime: event.endTime },
      location: event.location || '',
      attendees: event.attendees?.map((email) => ({ email })) || [],
    };
  } else {
    const config = getOutlookConfig();
    url = `${config.graphApiUrl}/me/events`;
    body = {
      subject: event.title,
      body: { contentType: 'text', content: event.description || '' },
      start: { dateTime: event.startTime, timeZone: 'UTC' },
      end: { dateTime: event.endTime, timeZone: 'UTC' },
      location: { displayName: event.location || '' },
      attendees: event.attendees?.map((email) => ({
        emailAddress: { address: email },
        type: 'required',
      })) || [],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    logger.error('[calendar-sync] Failed to create event', {
      provider,
      status: response.status,
    });
    return null;
  }

  const data = await response.json();
  const externalId = provider === 'google' ? data.id : data.id;

  logger.info('[calendar-sync] Calendar event created', {
    provider,
    externalId,
    title: event.title,
  });

  return { externalId };
}

// ---------------------------------------------------------------------------
// Import Calendar Events
// ---------------------------------------------------------------------------

/**
 * Pull recent calendar events from an external provider and create CRM tasks.
 */
export async function importCalendarEvents(
  provider: CalendarProvider,
  userId: string,
  accessToken?: string
): Promise<number> {
  if (!accessToken) return 0;

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  let events: Array<{ title: string; start: string; end: string }> = [];

  if (provider === 'google') {
    const config = getGoogleConfig();
    const response = await fetch(
      `${config.calendarApiUrl}/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${nextWeek.toISOString()}&maxResults=25`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (response.ok) {
      const data = await response.json();
      events = (data.items || []).map((item: Record<string, unknown>) => ({
        title: (item.summary as string) || 'Calendar Event',
        start: ((item.start as Record<string, string>)?.dateTime) || now.toISOString(),
        end: ((item.end as Record<string, string>)?.dateTime) || nextWeek.toISOString(),
      }));
    }
  } else {
    const config = getOutlookConfig();
    const response = await fetch(
      `${config.graphApiUrl}/me/calendarview?startDateTime=${now.toISOString()}&endDateTime=${nextWeek.toISOString()}&$top=25`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (response.ok) {
      const data = await response.json();
      events = (data.value || []).map((item: Record<string, unknown>) => ({
        title: (item.subject as string) || 'Calendar Event',
        start: ((item.start as Record<string, string>)?.dateTime) || now.toISOString(),
        end: ((item.end as Record<string, string>)?.dateTime) || nextWeek.toISOString(),
      }));
    }
  }

  // N+1 FIX: Batch-fetch all existing tasks for this user matching any event title+date,
  // then filter in memory instead of per-event findFirst (was 1 query per event, now 1 query total)
  const eventTitles = events.map((e) => e.title);
  const eventDates = events.map((e) => new Date(e.start));

  const existingTasks = eventTitles.length > 0
    ? await prisma.crmTask.findMany({
        where: {
          assignedToId: userId,
          title: { in: eventTitles },
          dueAt: { in: eventDates },
        },
        select: { title: true, dueAt: true },
      })
    : [];
  const existingSet = new Set(
    existingTasks.map((t) => `${t.title}::${t.dueAt?.toISOString()}`)
  );

  // Collect new tasks to create
  const newTasks = events
    .filter((event) => !existingSet.has(`${event.title}::${new Date(event.start).toISOString()}`))
    .map((event) => ({
      title: event.title,
      type: 'MEETING' as const,
      priority: 'MEDIUM' as const,
      status: 'PENDING' as const,
      dueAt: new Date(event.start),
      assignedToId: userId,
    }));

  let imported = 0;
  if (newTasks.length > 0) {
    const result = await prisma.crmTask.createMany({ data: newTasks });
    imported = result.count;
  }

  logger.info('[calendar-sync] Events imported', { provider, userId, imported, total: events.length });
  return imported;
}
