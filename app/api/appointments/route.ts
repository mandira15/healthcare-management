import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { queueEmail, buildBookingConfirmEmail } from '@/lib/mailer';
import { generatePreVisitSummary } from '@/lib/gemini';
import { createCalendarEvent } from '@/lib/googleCalendar';

const BookingSchema = z.object({
  doctorId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  symptomText: z.string().optional(),
});

// ─────────────────────────────────────────────
// POST /api/appointments — create a new appointment
//
// DOUBLE-BOOKING PREVENTION (atomic):
//   The Appointment model has @@unique([doctorId, date, startTime]).
//   We wrap the INSERT in a Prisma transaction and catch Prisma error P2002
//   (unique-constraint violation). This guarantees that even under concurrent
//   requests hitting the same slot simultaneously, exactly one will succeed
//   and all others will receive HTTP 409 Conflict — no double-booking possible.
//   SQLite's serialized writes provide an additional serialization guarantee.
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'PATIENT') {
      return NextResponse.json({ error: 'Patients only' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = BookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { doctorId, date, startTime, endTime, symptomText } = parsed.data;

    // Verify doctor exists
    const doctor = await prisma.user.findUnique({
      where: { id: doctorId, role: 'DOCTOR' },
      select: { name: true, email: true, doctorProfile: { select: { leaveDates: true } } },
    });
    if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });

    // Check leave date at application level for a cleaner error message
    const leaveDates: string[] = JSON.parse(doctor.doctorProfile?.leaveDates ?? '[]');
    if (leaveDates.includes(date)) {
      return NextResponse.json({ error: 'Doctor is on leave this day' }, { status: 409 });
    }

    // ── Atomic booking inside a transaction ───────────────────────
    let appointment;
    try {
      appointment = await prisma.$transaction(async (tx) => {
        // Attempt to INSERT — unique constraint prevents double-booking.
        // If another concurrent request already inserted this slot,
        // Prisma throws P2002 which we catch outside the transaction.
        return tx.appointment.create({
          data: {
            patientId: session.userId,
            doctorId,
            date,
            startTime,
            endTime,
            status: 'CONFIRMED',
            symptomText: symptomText ?? null,
          },
          include: {
            patient: { select: { name: true, email: true } },
            doctor: { select: { name: true } },
          },
        });
      });
    } catch (e) {
      // P2002 = Unique constraint violation = slot already taken
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return NextResponse.json(
          { error: 'This slot is already booked. Please choose another time.' },
          { status: 409 }
        );
      }
      throw e; // re-throw unexpected errors
    }

    // ── Post-booking side-effects (non-blocking) ──────────────────
    // 1. Queue confirmation email
    const confirmHtml = buildBookingConfirmEmail({
      patientName: appointment.patient.name,
      doctorName: appointment.doctor.name,
      date,
      startTime,
      endTime,
    });
    void queueEmail(
      appointment.patient.email,
      `Appointment Confirmed — Dr. ${appointment.doctor.name}`,
      confirmHtml,
      appointment.id,
      session.userId
    );

    // 2. Queue email to doctor too
    void queueEmail(
      doctor.email,
      `New Appointment — ${appointment.patient.name} on ${date}`,
      `<p>You have a new appointment on <strong>${date}</strong> at <strong>${startTime}</strong>.</p>`,
      appointment.id
    );

    // 3. Create Google Calendar events (skips if not connected)
    void (async () => {
      const title = `Appointment: ${appointment.patient.name} ↔ Dr. ${appointment.doctor.name}`;
      const desc = symptomText ? `Symptoms: ${symptomText}` : undefined;

      const [patientEventId, doctorEventId] = await Promise.all([
        createCalendarEvent(session.userId, title, date, startTime, endTime, desc),
        createCalendarEvent(doctorId, title, date, startTime, endTime, desc),
      ]);

      if (patientEventId || doctorEventId) {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: {
            googleEventIdPatient: patientEventId,
            googleEventIdDoctor: doctorEventId,
          },
        });
      }
    })();

    // 4. Trigger pre-visit AI summary (non-blocking — failure stored gracefully)
    if (symptomText) {
      void (async () => {
        const summary = await generatePreVisitSummary(symptomText, appointment.id);
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { preVisitSummary: JSON.stringify(summary) },
        });
      })();
    }

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err) {
    console.error('[Appointments] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/appointments — list appointments (filtered by role)
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');

    let where: Record<string, unknown> = {};
    if (session.role === 'PATIENT') where = { patientId: session.userId };
    if (session.role === 'DOCTOR') where = { doctorId: session.userId };
    // ADMIN sees all
    if (status) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: {
          select: {
            id: true, name: true,
            doctorProfile: { select: { specialization: true } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    return NextResponse.json({ appointments });
  } catch (err) {
    console.error('[Appointments] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
