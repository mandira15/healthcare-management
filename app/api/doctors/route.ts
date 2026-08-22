import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getSessionUser, hashPassword } from '@/lib/auth';

// GET /api/doctors — list all doctors (any authenticated user)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const specialization = searchParams.get('specialization');

    const doctors = await prisma.user.findMany({
      where: {
        role: 'DOCTOR',
        ...(specialization
          ? { doctorProfile: { specialization: { contains: specialization } } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        doctorProfile: {
          select: {
            id: true,
            specialization: true,
            slotDurationMinutes: true,
            workingHours: true,
            bio: true,
            clinicName: true,
            clinicAddress: true,
            phone: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ doctors });
  } catch (err) {
    console.error('[Doctors] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/doctors — admin creates a new doctor account
const CreateDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  specialization: z.string().min(1),
  slotDurationMinutes: z.number().int().min(15).max(120).optional().default(30),
  workingHours: z.record(z.object({ start: z.string(), end: z.string() })).optional(),
  bio: z.string().optional(),
  clinicName: z.string().optional(),
  clinicAddress: z.string().optional(),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreateDoctorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const {
      email, password, name, specialization,
      slotDurationMinutes, workingHours, bio, clinicName, clinicAddress, phone,
    } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const doctor = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'DOCTOR',
        doctorProfile: {
          create: {
            specialization,
            slotDurationMinutes,
            workingHours: workingHours ? JSON.stringify(workingHours) : '{}',
            bio: bio ?? null,
            clinicName: clinicName ?? null,
            clinicAddress: clinicAddress ?? null,
            phone: phone ?? null,
          },
        },
      },
      select: {
        id: true, email: true, name: true, role: true,
        doctorProfile: true,
      },
    });

    return NextResponse.json({ doctor }, { status: 201 });
  } catch (err) {
    console.error('[Doctors] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
