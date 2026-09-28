import prisma from '@/lib/prisma';
import { safeJsonParse } from '@/lib/safeJson';

export type AvailabilityStatus =
  | { type: 'today'; label: 'Available Today'; badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
  | { type: 'tomorrow'; label: 'Available Tomorrow'; badgeClass: 'bg-amber-100 text-amber-800 border-amber-200' }
  | { type: 'week'; label: 'Available This Week'; badgeClass: 'bg-blue-100 text-blue-800 border-blue-200' }
  | { type: 'none'; label: 'No Available Slots'; badgeClass: 'bg-gray-100 text-gray-600 border-gray-200' };

const DAY_MAP: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Checks whether a doctor has at least one open slot for a given ISO date (YYYY-MM-DD).
 * Reuses the exact workingHours, leaveDates, slotDurationMinutes, and booked slots logic.
 */
export function checkDateSlotAvailable(
  dateStr: string,
  profile: {
    workingHours: string;
    leaveDates: string;
    slotDurationMinutes: number;
  },
  bookedStartTimesSet: Set<string>
): boolean {
  // 1. Check leave
  const leaveDates: string[] = safeJsonParse<string[]>(profile.leaveDates, []);
  if (leaveDates.includes(dateStr)) return false;

  // 2. Check working hours (safe date parsing for day-of-week)
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayKey = DAY_MAP[new Date(y, m - 1, d).getDay()];
  const workingHours: Record<string, { start: string; end: string }> =
    safeJsonParse<Record<string, { start: string; end: string }>>(profile.workingHours, {});
  const dayHours = workingHours[dayKey];
  if (!dayHours) return false;

  const startMins = timeToMinutes(dayHours.start);
  const endMins = timeToMinutes(dayHours.end);
  const duration = profile.slotDurationMinutes || 30;

  // 3. Check slots vs booked
  for (let t = startMins; t + duration <= endMins; t += duration) {
    const h = Math.floor(t / 60).toString().padStart(2, '0');
    const m = (t % 60).toString().padStart(2, '0');
    const slotStart = `${h}:${m}`;
    if (!bookedStartTimesSet.has(slotStart)) {
      return true; // found at least one free slot
    }
  }

  return false;
}

/**
 * Efficiently computes availability status for a list of doctors over the next 7 days.
 * Executes a single batch query for upcoming appointments rather than N+1 queries.
 */
export async function getDoctorsAvailabilityBatch(
  doctorIds: string[],
  doctorProfilesMap: Map<
    string,
    {
      workingHours: string;
      leaveDates: string;
      slotDurationMinutes: number;
    }
  >
): Promise<Map<string, AvailabilityStatus>> {
  const result = new Map<string, AvailabilityStatus>();
  if (doctorIds.length === 0) return result;

  const now = new Date();
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const todayStr = dates[0];
  const tomorrowStr = dates[1];

  // Batch query appointments for these doctors in the next 7 days
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: { in: doctorIds },
      date: { in: dates },
      status: { not: 'CANCELLED' },
    },
    select: {
      doctorId: true,
      date: true,
      startTime: true,
    },
  });

  // Group booked times: doctorId -> date -> Set<startTime>
  const bookedMap = new Map<string, Map<string, Set<string>>>();
  for (const appt of appointments) {
    if (!bookedMap.has(appt.doctorId)) {
      bookedMap.set(appt.doctorId, new Map());
    }
    const docDates = bookedMap.get(appt.doctorId)!;
    if (!docDates.has(appt.date)) {
      docDates.set(appt.date, new Set());
    }
    docDates.get(appt.date)!.add(appt.startTime);
  }

  for (const docId of doctorIds) {
    const profile = doctorProfilesMap.get(docId);
    if (!profile) {
      result.set(docId, {
        type: 'none',
        label: 'No Available Slots',
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
      });
      continue;
    }

    const docBooked = bookedMap.get(docId) || new Map<string, Set<string>>();

    // Check today
    const bookedToday = docBooked.get(todayStr) || new Set<string>();
    const isTodayAvail = checkDateSlotAvailable(todayStr, profile, bookedToday);
    if (isTodayAvail) {
      result.set(docId, {
        type: 'today',
        label: 'Available Today',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      });
      continue;
    }

    // Check tomorrow
    const bookedTomorrow = docBooked.get(tomorrowStr) || new Set<string>();
    const isTomorrowAvail = checkDateSlotAvailable(tomorrowStr, profile, bookedTomorrow);
    if (isTomorrowAvail) {
      result.set(docId, {
        type: 'tomorrow',
        label: 'Available Tomorrow',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
      });
      continue;
    }

    // Check rest of week
    let weekAvail = false;
    for (let i = 2; i < dates.length; i++) {
      const dayStr = dates[i];
      const bookedDay = docBooked.get(dayStr) || new Set<string>();
      if (checkDateSlotAvailable(dayStr, profile, bookedDay)) {
        weekAvail = true;
        break;
      }
    }

    if (weekAvail) {
      result.set(docId, {
        type: 'week',
        label: 'Available This Week',
        badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
      });
    } else {
      result.set(docId, {
        type: 'none',
        label: 'No Available Slots',
        badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
      });
    }
  }

  return result;
}
