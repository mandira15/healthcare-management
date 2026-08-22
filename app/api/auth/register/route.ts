import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { hashPassword, signToken, setSessionCookie } from '@/lib/auth';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['PATIENT']).optional().default('PATIENT'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { email, password, name, role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role },
      select: { id: true, email: true, name: true, role: true },
    });

    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'PATIENT',
      name: user.name,
    });
    const response = NextResponse.json({ user }, { status: 201 });
    setSessionCookie(token, response);
    return response;
  } catch (err) {
    console.error('[Auth] Register error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
