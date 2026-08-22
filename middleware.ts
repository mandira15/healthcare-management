// middleware.ts — Next.js Edge Middleware
// Runs on every request BEFORE route handlers.
// Reads the JWT httpOnly cookie and injects user identity headers
// so API routes and Server Components can trust them without re-parsing.
// Also enforces role-based access at the routing level.

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

// Routes that require authentication (prefix-matched)
const PROTECTED_PREFIXES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: '/patient', roles: ['PATIENT', 'ADMIN'] },
  { prefix: '/doctor', roles: ['DOCTOR', 'ADMIN'] },
  { prefix: '/admin', roles: ['ADMIN'] },
  { prefix: '/api/appointments', roles: ['PATIENT', 'DOCTOR', 'ADMIN'] },
  { prefix: '/api/doctors', roles: ['PATIENT', 'DOCTOR', 'ADMIN'] },
  { prefix: '/api/admin', roles: ['ADMIN'] },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Find matching protection rule
  const rule = PROTECTED_PREFIXES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const token = request.cookies.get('hm_session')?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    // Not authenticated → redirect to login (for pages) or 401 (for API)
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!rule.roles.includes(payload.role)) {
    // Wrong role
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Inject user identity into request headers so route handlers can read them
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-role', payload.role);
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-name', payload.name);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/patient/:path*',
    '/doctor/:path*',
    '/admin/:path*',
    '/api/appointments/:path*',
    '/api/doctors/:path*',
    '/api/admin/:path*',
  ],
};
