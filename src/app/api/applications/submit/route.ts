import { NextRequest, NextResponse } from 'next/server';
import { completeInvitation } from '@/lib/applications/invitations';
import { invitationBody, invitationFailure } from '@/lib/applications/http';

export async function POST(request: NextRequest) {
  try {
    const result = await completeInvitation(await invitationBody(request));
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  } catch (error) {
    return invitationFailure(error);
  }
}
