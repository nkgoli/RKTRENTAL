import { NextRequest, NextResponse } from 'next/server';
import { requireManagerRole } from '@/lib/auth/access';

/**
 * Finish application actions with a document navigation. On this Next version,
 * applying the redirected Flight tree can discard the application page body.
 * A non-Flight response makes the action router use its normal document fallback;
 * the browser then follows this same-origin 303 to the existing review URL.
 */
export async function GET(request: NextRequest) {
  await requireManagerRole();
  if (request.headers.get('rsc') === '1') {
    return new NextResponse(null, {
      status: 204,
      headers: { 'Cache-Control': 'no-store', Vary: 'RSC' },
    });
  }
  const query = new URLSearchParams();
  for (const key of ['propertyId', 'unitId', 'applicant', 'notice']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }
  // Keep the browser's origin: the server's internal request URL can use a
  // different hostname behind a proxy (or localhost versus 127.0.0.1).
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: `/applications${query.size ? `?${query}` : ''}` },
  });
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Vary', 'RSC');
  return response;
}
