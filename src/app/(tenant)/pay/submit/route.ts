import { getSession } from '@/lib/auth/server-session';
import { submitRent } from '../submission';

export const runtime = 'nodejs';

// Match the existing native tenant result-route pattern: POST once, then GET feedback.
const redirectTo = (path: string) =>
  new Response(null, {
    status: 303,
    headers: { Location: path, 'Cache-Control': 'no-store' },
  });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'TENANT') return redirectTo('/sign-in');
  // Retain the server action's browser-origin boundary on this native POST endpoint.
  const origin = request.headers.get('origin');
  const host = request.headers.get('host') ?? new URL(request.url).host;
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    return new Response(null, { status: 403 });
  if (origin) {
    try {
      if (new URL(origin).host !== host) return new Response(null, { status: 403 });
    } catch {
      return new Response(null, { status: 403 });
    }
  }
  let notice: string;
  try {
    notice = await submitRent(await request.formData(), session);
  } catch {
    // An unexpected transport/service error may follow a completed charge. Never retry here
    // or tell the tenant that nothing was charged; the ledger remains the source of truth.
    notice = 'payment-unconfirmed';
  }
  return redirectTo(`/pay?notice=${notice}#payment-result`);
}
