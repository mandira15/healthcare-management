import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { generatePreVisitSummary } from '@/lib/gemini';

// POST /api/appointments/[id]/pre-visit
// Triggers (or retries) the Gemini pre-visit AI summary.
// The LLM result NEVER blocks this endpoint — on failure, a sentinel JSON
// is stored and the "Retry AI Summary" button can call this endpoint again.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const appt = await prisma.appointment.findUnique({
      where: { id: params.id },
      select: {
        id: true, patientId: true, doctorId: true,
        symptomText: true, preVisitSummary: true,
      },
    });
    if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    // Ownership check
    if (session.role === 'PATIENT' && appt.patientId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.role === 'DOCTOR' && appt.doctorId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!appt.symptomText) {
      return NextResponse.json({ error: 'No symptoms recorded for this appointment' }, { status: 400 });
    }

    // Generate AI summary (try/catch inside generatePreVisitSummary)
    const summary = await generatePreVisitSummary(appt.symptomText, appt.id);

    // Store result — success OR error sentinel
    await prisma.appointment.update({
      where: { id: appt.id },
      data: { preVisitSummary: JSON.stringify(summary) },
    });

    const isError = 'error' in summary;
    return NextResponse.json(
      { summary, aiAvailable: !isError },
      { status: isError ? 207 : 200 } // 207 = partial success
    );
  } catch (err) {
    console.error('[PreVisit] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/appointments/[id]/pre-visit — retrieve stored summary
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const appt = await prisma.appointment.findUnique({
      where: { id: params.id },
      select: { patientId: true, doctorId: true, preVisitSummary: true, symptomText: true },
    });
    if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (session.role === 'PATIENT' && appt.patientId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.role === 'DOCTOR' && appt.doctorId !== session.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const summary = appt.preVisitSummary ? JSON.parse(appt.preVisitSummary) : null;
    const aiAvailable = summary && !('error' in summary);
    return NextResponse.json({ summary, aiAvailable, symptomText: appt.symptomText });
  } catch (err) {
    console.error('[PreVisit] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
