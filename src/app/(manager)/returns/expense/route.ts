import { getSession } from '@/lib/auth/server-session';
import { canAccessRole, roleHome } from '@/lib/auth/policy';
import { addExpense } from '../add-expense';

export const runtime = 'nodejs';

// A native POST answered with 303, so the report reloads as a document. Same-route client
// transitions on /returns can stall in production (see docs/verification/expense-cancel.md).
const redirectTo = (path: string) =>
  new Response(null, {
    status: 303,
    headers: { Location: path, 'Cache-Control': 'no-store' },
  });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return redirectTo('/sign-in');
  if (!canAccessRole(session.role, 'MANAGER'))
    return redirectTo(`${roleHome(session.role)}?notice=role`);
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
  return redirectTo(await addExpense(await request.formData(), session.organizationId));
}
