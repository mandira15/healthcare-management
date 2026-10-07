import { NextRequest } from 'next/server';
import { GET as nearbyGET } from '../nearby/route';

export const dynamic = 'force-dynamic';

/**
 * GET /api/doctors/recommended
 * Proxies to doctor recommendation engine in /api/doctors/nearby.
 * Defaults sortBy to 'recommended' based on transparent multi-factor scoring.
 */
export async function GET(req: NextRequest) {
  return nearbyGET(req);
}
