import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { queueEmail, buildCancellationEmail } from '@/lib/mailer';
import { deleteCalendarEvent } from '@/lib/googleCalendar';

// POST /api/appointments/[id]/cancel
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const appt = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        patient: { select: { name: true, email: true, id: true } },
        doctor: { select: { name: true } },
      },
    });
    if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    if (appt.status === 'CANCELLED') {
      return NextResponse.json({ error: 'Already cancelled' }, { status: 400 });
    }

    // Ownership check
    if (session.role === 'PATIENT' && appt.patientId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.role === 'DOCTOR' && appt.doctorId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = body?.reason as string | undefined;

    // Cancel in DB
    await prisma.appointment.update({
      where: { id: params.id },
      data: { status: 'CANCELLED' },
    });

    // Queue cancellation email
    const html = buildCancellationEmail({
      patientName: appt.patient.name,
      doctorName: appt.doctor.name,
      date: appt.date,
      startTime: appt.startTime,
      reason,
    });
    void queueEmail(
      appt.patient.email,
      'Appointment Cancelled',
      html,
      appt.id,
      appt.patient.id
    );

    // Delete Calendar events (non-blocking)
    void deleteCalendarEvent(appt.patientId, appt.googleEventIdPatient);
    void deleteCalendarEvent(appt.doctorId, appt.googleEventIdDoctor);

    return NextResponse.json({ message: 'Appointment cancelled' });
  } catch (err) {
    console.error('[Cancel] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
