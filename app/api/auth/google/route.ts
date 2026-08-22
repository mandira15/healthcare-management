import { NextRequest, NextResponse } from 'next/server';
import { getCalendarAuthUrl } from '@/lib/googleCalendar';
import { getSessionUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const url = getCalendarAuthUrl(user.userId);
  return NextResponse.redirect(url);
}
