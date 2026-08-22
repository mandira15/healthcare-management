import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { generatePostVisitSummary } from '@/lib/gemini';
import { buildRemindersFromPrescription } from '@/lib/reminderParser';
import { queueEmail, buildPostVisitEmail } from '@/lib/mailer';

const PostVisitSchema = z.object({
  postVisitNotes: z.string().min(1),
});

// POST /api/appointments/[id]/post-visit
// Doctor submits clinical notes. Gemini converts to patient-friendly JSON.
// Medication reminders are scheduled from the AI output.
// Core notes save ALWAYS succeeds; AI failure stores sentinel + is shown to user.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'DOCTOR') {
      return NextResponse.json({ error: 'Doctors only' }, { status: 403 });
    }

    const appt = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        doctor: { select: { name: true } },
      },
    });
    if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    if (appt.doctorId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = PostVisitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { postVisitNotes } = parsed.data;

    // ── 1. Save raw notes FIRST (never blocked by AI) ─────────────
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { postVisitNotes, status: 'COMPLETED' },
    });

    // ── 2. Generate AI post-visit summary ─────────────────────────
    // try/catch inside generatePostVisitSummary; returns error sentinel on failure
    const summary = await generatePostVisitSummary(postVisitNotes, appt.id);

    // ── 3. Store summary (success or error sentinel) ───────────────
    await prisma.appointment.update({
      where: { id: appt.id },
      data: {
        postVisitSummary: JSON.stringify(summary),
        prescription: JSON.stringify(summary), // store full object as prescription too
      },
    });

    const aiAvailable = !('error' in summary);

    // ── 4. Schedule medication reminders (only if AI succeeded) ────
    if (aiAvailable && 'medicationSchedule' in summary && summary.medicationSchedule.length > 0) {
      const reminderData = buildRemindersFromPrescription(
        appt.id,
        appt.patient.id,
        summary.medicationSchedule
      );
      await prisma.medicationReminder.createMany({ data: reminderData });
    }

    // ── 5. Queue post-visit email to patient ──────────────────────
    if (aiAvailable && 'summary' in summary) {
      const html = buildPostVisitEmail({
        patientName: appt.patient.name,
        doctorName: appt.doctor.name,
        summary: summary.summary,
        followUpSteps: summary.followUpSteps ?? [],
      });
      void queueEmail(
        appt.patient.email,
        `Your Visit Summary — Dr. ${appt.doctor.name}`,
        html,
        appt.id,
        appt.patient.id
      );
    }

    return NextResponse.json({ summary, aiAvailable }, { status: 200 });
  } catch (err) {
    console.error('[PostVisit] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/appointments/[id]/post-visit — retrieve stored post-visit data
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const appt = await prisma.appointment.findUnique({
      where: { id: params.id },
      select: {
        patientId: true, doctorId: true,
        postVisitNotes: true, postVisitSummary: true, prescription: true,
      },
    });
    if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (session.role === 'PATIENT' && appt.patientId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.role === 'DOCTOR' && appt.doctorId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const summary = appt.postVisitSummary ? JSON.parse(appt.postVisitSummary) : null;
    return NextResponse.json({
      postVisitNotes: appt.postVisitNotes,
      summary,
      aiAvailable: summary && !('error' in summary),
    });
  } catch (err) {
    console.error('[PostVisit] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
