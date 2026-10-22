import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { isAllowedRequestOrigin } from '@/middleware';
import { InvitationError } from './invitation-policy';

export async function invitationBody(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (
    !origin ||
    !isAllowedRequestOrigin(
      origin,
      request.nextUrl.origin,
      request.headers.get('host'),
      request.headers.get('x-forwarded-proto'),
    )
  )
    throw new InvitationError('Invalid request origin.', 403);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new InvitationError('JSON required.', 415);
  const text = await request.text();
  if (text.length > 8192) throw new InvitationError('Request too large.', 413);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvitationError('Invalid request.');
  }
}
export function invitationFailure(error: unknown) {
  const status =
    error instanceof InvitationError ? error.status : error instanceof ZodError ? 400 : 500;
  const message =
    error instanceof InvitationError
      ? error.message
      : error instanceof ZodError
        ? 'Check your name, email and property/unit selection, then try again.'
        : 'The request could not be completed. Reload to check its status before retrying.';
  return NextResponse.json(
    { error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
