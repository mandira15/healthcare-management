import { google } from 'googleapis';
import prisma from './prisma';

// ─────────────────────────────────────────────
// Google Calendar OAuth2 helpers
// All functions skip gracefully (log + return null)
// if the user hasn't connected their Google account.
// ─────────────────────────────────────────────

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ─────────────────────────────────────────────
// getAuthUrl — returns the URL to redirect the user to for OAuth consent
// ─────────────────────────────────────────────
export function getCalendarAuthUrl(userId: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: userId, // passed back in callback to identify the user
    prompt: 'consent', // force refresh_token to be returned every time
  });
}

// ─────────────────────────────────────────────
// exchangeCodeForRefreshToken — called in OAuth callback
// Stores the refresh token on the User record.
// ─────────────────────────────────────────────
export async function exchangeCodeForRefreshToken(
  code: string,
  userId: string
): Promise<void> {
  try {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    if (!tokens.refresh_token) {
      console.warn('[Calendar] No refresh_token returned — user may need to revoke & reconnect');
      return;
    }
    await prisma.user.update({
      where: { id: userId },
      data: { googleRefreshToken: tokens.refresh_token },
    });
  } catch (err) {
    console.error('[Calendar] Failed to exchange code:', err);
  }
}

// ─────────────────────────────────────────────
// Internal helper — returns an authenticated Calendar client for a user,
// or null if they haven't connected Google Calendar.
// ─────────────────────────────────────────────
async function getCalendarClient(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true },
  });
  if (!user?.googleRefreshToken) return null;

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: user.googleRefreshToken });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// ─────────────────────────────────────────────
// createCalendarEvent
// Returns the created event ID, or null if Calendar not connected / error.
// ─────────────────────────────────────────────
export async function createCalendarEvent(
  userId: string,
  title: string,
  date: string,
  startTime: string,
  endTime: string,
  description?: string
): Promise<string | null> {
  try {
    const calendar = await getCalendarClient(userId);
    if (!calendar) return null;

    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;

    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        description,
        start: { dateTime: startDateTime, timeZone: 'UTC' },
        end: { dateTime: endDateTime, timeZone: 'UTC' },
      },
    });

    return event.data.id ?? null;
  } catch (err) {
    console.error('[Calendar] createCalendarEvent failed for user', userId, err);
    return null;
  }
}

// ─────────────────────────────────────────────
// updateCalendarEvent — called on reschedule
// ─────────────────────────────────────────────
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  date: string,
  startTime: string,
  endTime: string,
  description?: string
): Promise<void> {
  try {
    const calendar = await getCalendarClient(userId);
    if (!calendar || !eventId) return;

    const startDateTime = `${date}T${startTime}:00`;
    const endDateTime = `${date}T${endTime}:00`;

    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        start: { dateTime: startDateTime, timeZone: 'UTC' },
        end: { dateTime: endDateTime, timeZone: 'UTC' },
        description,
      },
    });
  } catch (err) {
    console.error('[Calendar] updateCalendarEvent failed for user', userId, 'event', eventId, err);
  }
}

// ─────────────────────────────────────────────
// deleteCalendarEvent — called on cancellation
// ─────────────────────────────────────────────
export async function deleteCalendarEvent(
  userId: string,
  eventId: string | null | undefined
): Promise<void> {
  try {
    if (!eventId) return;
    const calendar = await getCalendarClient(userId);
    if (!calendar) return;

    await calendar.events.delete({ calendarId: 'primary', eventId });
  } catch (err) {
    // 410 Gone is fine — event already deleted
    const status = (err as { code?: number })?.code;
    if (status !== 410) {
      console.error('[Calendar] deleteCalendarEvent failed for user', userId, 'event', eventId, err);
    }
  }
}
