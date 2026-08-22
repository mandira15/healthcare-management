import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// GET /api/doctors/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const doctor = await prisma.user.findUnique({
      where: { id: params.id, role: 'DOCTOR' },
      select: {
        id: true, name: true, email: true,
        doctorProfile: true,
      },
    });
    if (!doctor) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
    return NextResponse.json({ doctor });
  } catch (err) {
    console.error('[Doctors] GET[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const UpdateDoctorSchema = z.object({
  specialization: z.string().optional(),
  slotDurationMinutes: z.number().int().min(15).max(120).optional(),
  workingHours: z.record(z.object({ start: z.string(), end: z.string() })).optional(),
  bio: z.string().optional(),
  clinicName: z.string().optional(),
  clinicAddress: z.string().optional(),
  phone: z.string().optional(),
  name: z.string().optional(),
});

// PATCH /api/doctors/[id] — doctor updates own profile, admin updates any
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    // Allow doctor to edit their own profile; admin can edit any
    if (session.role === 'DOCTOR' && session.userId !== params.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (session.role === 'PATIENT') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateDoctorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { workingHours, name, ...profileFields } = parsed.data;

    await prisma.$transaction(async (tx) => {
      if (name) await tx.user.update({ where: { id: params.id }, data: { name } });
      await tx.doctorProfile.update({
        where: { userId: params.id },
        data: {
          ...profileFields,
          ...(workingHours !== undefined
            ? { workingHours: JSON.stringify(workingHours) }
            : {}),
        },
      });
    });

    const updated = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true, name: true, email: true, doctorProfile: true },
    });
    return NextResponse.json({ doctor: updated });
  } catch (err) {
    console.error('[Doctors] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/doctors/[id] — admin only
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await prisma.user.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'Doctor deleted' });
  } catch (err) {
    console.error('[Doctors] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
