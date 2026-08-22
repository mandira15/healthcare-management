import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// GET /api/admin/users — list all users
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const role = searchParams.get('role');

    const users = await prisma.user.findMany({
      where: role ? { role } : {},
      select: {
        id: true, email: true, name: true, role: true, createdAt: true,
        googleRefreshToken: true, // just whether it's set
        doctorProfile: {
          select: { specialization: true, slotDurationMinutes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Don't expose the actual refresh token
    const sanitized = users.map((u) => ({
      ...u,
      calendarConnected: Boolean(u.googleRefreshToken),
      googleRefreshToken: undefined,
    }));

    return NextResponse.json({ users: sanitized });
  } catch (err) {
    console.error('[AdminUsers] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
