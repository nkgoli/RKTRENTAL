import { getSession } from '@/lib/auth/server-session';
import { getSigningAgreement, submitLeaseSignature } from '@/lib/esign/service';
import { EsignError } from '@/lib/esign/types';
import { isAllowedRequestOrigin } from '@/middleware';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
function failure(error: unknown) {
  if (error instanceof EsignError)
    return json({ error: error.message, code: error.code, field: error.field }, error.status);
  if (error instanceof SyntaxError) return json({ error: 'Invalid JSON.' }, 400);
  return json({ error: 'Signing is temporarily unavailable.' }, 500);
}

export async function GET(_request: Request, context: Context) {
  const session = await getSession();
  if (!session) return json({ error: 'Authentication required.' }, 401);
  try {
    return json(await getSigningAgreement(session, (await context.params).id));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: Context) {
  const session = await getSession();
  if (!session) return json({ error: 'Authentication required.' }, 401);
  const origin = request.headers.get('origin');
  if (
    !origin ||
    !isAllowedRequestOrigin(
      origin,
      new URL(request.url).origin,
      request.headers.get('host'),
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim(),
    )
  )
    return json({ error: 'Invalid request origin.' }, 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Use application/json.' }, 415);
  try {
    const text = await request.text();
    if (text.length > 8192) return json({ error: 'Signature request is too large.' }, 413);
    return json(await submitLeaseSignature(session, (await context.params).id, JSON.parse(text)));
  } catch (error) {
    return failure(error);
  }
}
