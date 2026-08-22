import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { queueEmail, buildCancellationEmail } from '@/lib/mailer';
import { deleteCalendarEvent } from '@/lib/googleCalendar';

const LeaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

// POST /api/doctors/[id]/leave — add a leave date
//
// LEAVE-CONFLICT TRANSACTION:
//   All three operations happen atomically in a single Prisma transaction:
//   1. Update DoctorProfile.leaveDates to add the new date.
//   2. findMany all CONFIRMED/PENDING appointments for that doctor+date.
//   3. updateMany to CANCELLED.
//   4. Create EmailLog rows for each affected patient (cron sends them).
//   If any step fails, the entire transaction rolls back.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (session.role !== 'DOCTOR' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.role === 'DOCTOR' && session.userId !== params.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = LeaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { date } = parsed.data;

    // Load doctor info for cancellation email
    const doctorUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: { name: true, doctorProfile: true },
    });
    if (!doctorUser?.doctorProfile) {
      return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    }

    let cancelledCount = 0;

    await prisma.$transaction(async (tx) => {
      // ── 1. Parse existing leave dates and add the new one ────────
      const existing: string[] = JSON.parse(doctorUser.doctorProfile!.leaveDates || '[]');
      if (!existing.includes(date)) existing.push(date);

      await tx.doctorProfile.update({
        where: { userId: params.id },
        data: { leaveDates: JSON.stringify(existing) },
      });

      // ── 2. Find affected confirmed appointments ───────────────────
      const affected = await tx.appointment.findMany({
        where: {
          doctorId: params.id,
          date,
          status: { in: ['CONFIRMED', 'PENDING'] },
        },
        include: {
          patient: { select: { email: true, name: true } },
        },
      });

      if (affected.length === 0) return;

      // ── 3. Cancel them all in one updateMany ─────────────────────
      await tx.appointment.updateMany({
        where: { id: { in: affected.map((a) => a.id) } },
        data: { status: 'CANCELLED' },
      });

      // ── 4. Queue cancellation email for each patient ─────────────
      for (const appt of affected) {
        const html = buildCancellationEmail({
          patientName: appt.patient.name,
          doctorName: doctorUser.name,
          date: appt.date,
          startTime: appt.startTime,
          reason: 'Doctor is on leave this day',
        });
        await tx.emailLog.create({
          data: {
            recipient: appt.patient.email,
            subject: 'Your appointment has been cancelled',
            body: html,
            status: 'PENDING',
            attempts: 0,
            nextRetryAt: new Date(),
            appointmentId: appt.id,
            userId: appt.patientId,
          },
        });
      }

      cancelledCount = affected.length;

      // Google Calendar deletions happen outside the transaction (non-critical)
      // so they don't roll back the leave if Calendar fails.
      for (const appt of affected) {
        void deleteCalendarEvent(appt.patientId, appt.googleEventIdPatient);
        void deleteCalendarEvent(params.id, appt.googleEventIdDoctor);
      }
    });

    return NextResponse.json({
      message: `Leave date ${date} added. ${cancelledCount} appointment(s) cancelled.`,
      cancelledCount,
    });
  } catch (err) {
    console.error('[Leave] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/doctors/[id]/leave — remove a leave date
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (session.role === 'PATIENT') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (session.role === 'DOCTOR' && session.userId !== params.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const date = searchParams.get('date');
    if (!date) return NextResponse.json({ error: 'date query param required' }, { status: 400 });

    const profile = await prisma.doctorProfile.findUnique({ where: { userId: params.id } });
    if (!profile) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });

    const existing: string[] = JSON.parse(profile.leaveDates || '[]');
    const updated = existing.filter((d) => d !== date);

    await prisma.doctorProfile.update({
      where: { userId: params.id },
      data: { leaveDates: JSON.stringify(updated) },
    });

    return NextResponse.json({ message: `Leave date ${date} removed` });
  } catch (err) {
    console.error('[Leave] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
