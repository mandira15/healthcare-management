import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/email-logs — admin views the email retry queue
export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const where = status ? { status } : {};
    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, recipient: true, subject: true, status: true,
          attempts: true, nextRetryAt: true, appointmentId: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.emailLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch (err) {
    console.error('[EmailLogs] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/email-logs/[id]/retry — manually retry a permanently_failed email
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { id } = body as { id?: string };
    if (!id) return NextResponse.json({ error: 'id required in body' }, { status: 400 });

    await prisma.emailLog.update({
      where: { id },
      data: { status: 'PENDING', attempts: 0, nextRetryAt: new Date() },
    });

    return NextResponse.json({ message: 'Email reset to PENDING — will be retried on next cron tick' });
  } catch (err) {
    console.error('[EmailLogs] POST retry error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
