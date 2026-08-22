import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ─────────────────────────────────────────────
// GET /api/doctors/[id]/slots?date=YYYY-MM-DD
//
// SLOT COMPUTATION (never hardcoded):
//   1. Parse the doctor's workingHours JSON for the requested day-of-week.
//   2. Generate all slot intervals of slotDurationMinutes within working hours.
//   3. Subtract slots already booked (status != CANCELLED).
//   4. Subtract the entire day if it's in the doctor's leaveDates.
// ─────────────────────────────────────────────

type TimeSlot = { startTime: string; endTime: string; available: boolean };

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

const DAY_MAP: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = req.nextUrl;
    const date = searchParams.get('date');

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Query param "date" is required in YYYY-MM-DD format' },
        { status: 400 }
      );
    }

    const doctorUser = await prisma.user.findUnique({
      where: { id: params.id, role: 'DOCTOR' },
      select: { doctorProfile: true },
    });

    if (!doctorUser?.doctorProfile) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    const profile = doctorUser.doctorProfile;

    // ── Step 1: Check leave dates ─────────────────────────────────
    const leaveDates: string[] = JSON.parse(profile.leaveDates || '[]');
    if (leaveDates.includes(date)) {
      return NextResponse.json({ date, slots: [], onLeave: true });
    }

    // ── Step 2: Get working hours for this day-of-week ────────────
    const dayIndex = new Date(date).getDay(); // 0=Sun..6=Sat
    const dayKey = DAY_MAP[dayIndex];
    const workingHours: Record<string, { start: string; end: string }> =
      JSON.parse(profile.workingHours || '{}');

    const dayHours = workingHours[dayKey];
    if (!dayHours) {
      // Doctor doesn't work this day
      return NextResponse.json({ date, slots: [], onLeave: false, offDay: true });
    }

    // ── Step 3: Generate all possible slots ───────────────────────
    const startMins = timeToMinutes(dayHours.start);
    const endMins = timeToMinutes(dayHours.end);
    const duration = profile.slotDurationMinutes;

    const allSlots: TimeSlot[] = [];
    for (let t = startMins; t + duration <= endMins; t += duration) {
      allSlots.push({
        startTime: minutesToTime(t),
        endTime: minutesToTime(t + duration),
        available: true,
      });
    }

    // ── Step 4: Subtract booked slots ─────────────────────────────
    const booked = await prisma.appointment.findMany({
      where: {
        doctorId: params.id,
        date,
        status: { not: 'CANCELLED' },
      },
      select: { startTime: true },
    });

    const bookedTimes = new Set(booked.map((a) => a.startTime));
    const slots = allSlots.map((s) => ({
      ...s,
      available: !bookedTimes.has(s.startTime),
    }));

    return NextResponse.json({ date, slots, onLeave: false, offDay: false });
  } catch (err) {
    console.error('[Slots] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
