import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'hm-local-dev-secret-32chars-xK9mP2qL';
const COOKIE_NAME = 'hm_session';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  name: string;
}

// ─────────────────────────────────────────────
// Web Crypto JWT helpers (compatible with Edge Runtime)
// ─────────────────────────────────────────────
async function hmacSha256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  
  const signatureBytes = new Uint8Array(signature);
  let signatureString = '';
  for (let i = 0; i < signatureBytes.length; i++) {
    signatureString += String.fromCharCode(signatureBytes[i]);
  }

  return btoa(signatureString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

export async function signToken(payload: JwtPayload): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  }));

  const signature = await hmacSha256(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSignature = await hmacSha256(`${header}.${payload}`, JWT_SECRET);

    if (signature !== expectedSignature) return null;

    const decodedPayload = JSON.parse(base64UrlDecode(payload));
    
    if (decodedPayload.exp && Date.now() / 1000 > decodedPayload.exp) {
      return null;
    }

    return decodedPayload as JwtPayload;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Password helpers
// ─────────────────────────────────────────────
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ─────────────────────────────────────────────
// Cookie helpers (server-only — use in Route Handlers)
// ─────────────────────────────────────────────
export function setSessionCookie(token: string, response?: any): void {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    path: '/',
  };
  if (response && typeof response.cookies?.set === 'function') {
    response.cookies.set(COOKIE_NAME, token, options);
  } else {
    cookies().set(COOKIE_NAME, token, options);
  }
}

export function clearSessionCookie(response?: any): void {
  if (response && typeof response.cookies?.set === 'function') {
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  } else {
    cookies().set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
  }
}

// ─────────────────────────────────────────────
// Session reader — call from Route Handlers or Server Components
// Returns null if not authenticated
// ─────────────────────────────────────────────
export async function getSessionUser(): Promise<JwtPayload | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─────────────────────────────────────────────
// Convenience guard — throws Response if role check fails
// ─────────────────────────────────────────────
export async function requireRole(
  ...roles: Array<'PATIENT' | 'DOCTOR' | 'ADMIN'>
): Promise<JwtPayload> {
  const user = await getSessionUser();
  if (!user) {
    throw new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!roles.includes(user.role)) {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return user;
}
