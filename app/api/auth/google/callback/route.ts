import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForRefreshToken } from '@/lib/googleCalendar';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const userId = searchParams.get('state'); // state was set to userId in getCalendarAuthUrl

  if (!code || !userId) {
    return NextResponse.redirect(new URL('/patient/dashboard?calendarError=1', req.url));
  }

  await exchangeCodeForRefreshToken(code, userId);

  // Redirect back to the user's dashboard
  return NextResponse.redirect(new URL('/patient/dashboard?calendarConnected=1', req.url));
}
