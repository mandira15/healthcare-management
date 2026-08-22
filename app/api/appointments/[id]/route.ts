import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { queueEmail, buildCancellationEmail } from '@/lib/mailer';
import { updateCalendarEvent, deleteCalendarEvent } from '@/lib/googleCalendar';

// GET /api/appointments/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const appt = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: {
          select: {
            id: true, name: true, email: true,
            doctorProfile: { select: { specialization: true } },
          },
        },
      },
    });
    if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    // Verify ownership
    if (
      session.role === 'PATIENT' && appt.patientId !== session.userId ||
      session.role === 'DOCTOR' && appt.doctorId !== session.userId
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse JSON fields before returning
    const parsed = {
      ...appt,
      preVisitSummary: appt.preVisitSummary ? JSON.parse(appt.preVisitSummary) : null,
      postVisitSummary: appt.postVisitSummary ? JSON.parse(appt.postVisitSummary) : null,
      prescription: appt.prescription ? JSON.parse(appt.prescription) : null,
    };

    return NextResponse.json({ appointment: parsed });
  } catch (err) {
    console.error('[Appointments] GET[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const RescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED']).optional(),
});

// PATCH /api/appointments/[id] — reschedule or update status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const appt = await prisma.appointment.findUnique({ where: { id: params.id } });
    if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    if (session.role === 'PATIENT' && appt.patientId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.role === 'DOCTOR' && appt.doctorId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = RescheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.appointment.update({
      where: { id: params.id },
      data: parsed.data,
      include: {
        patient: { select: { name: true } },
        doctor: { select: { name: true } },
      },
    });

    // Update Calendar events on reschedule (non-blocking)
    if (parsed.data.date || parsed.data.startTime) {
      const newDate = updated.date;
      const newStart = updated.startTime;
      const newEnd = updated.endTime;
      void updateCalendarEvent(appt.patientId, appt.googleEventIdPatient ?? '', newDate, newStart, newEnd);
      void updateCalendarEvent(appt.doctorId, appt.googleEventIdDoctor ?? '', newDate, newStart, newEnd);
    }

    return NextResponse.json({ appointment: updated });
  } catch (err) {
    console.error('[Appointments] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/appointments/[id] — admin hard-delete
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await prisma.appointment.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[Appointments] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
