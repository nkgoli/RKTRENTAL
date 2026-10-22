import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server-session';
import { createInvitation } from '@/lib/applications/invitations';
import { invitationBody, invitationFailure } from '@/lib/applications/http';
import { InvitationError } from '@/lib/applications/invitation-policy';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new InvitationError('Sign in as a manager to continue.', 401);
    const row = await createInvitation(session, await invitationBody(request));
    return NextResponse.json(
      { href: `/applications/invitations/${row.id}` },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return invitationFailure(error);
  }
}
