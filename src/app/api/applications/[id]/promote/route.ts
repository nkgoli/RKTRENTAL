import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { getSession } from '@/lib/auth/server-session';
import { invitationBody, invitationFailure } from '@/lib/applications/http';
import { promoteApplication, PromotionError } from '@/lib/applications/promotion';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) throw new PromotionError('Sign in as a manager to continue.', 401);
    const result = await promoteApplication(
      session,
      (await context.params).id,
      await invitationBody(request),
    );
    if (result.status === 'promoted') {
      for (const path of ['/applications', '/properties', '/tenants', '/leases/new'])
        revalidatePath(path, 'layout');
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof PromotionError || error instanceof ZodError)
      return NextResponse.json(
        { error: error instanceof PromotionError ? error.message : 'Invalid promotion request.' },
        {
          status: error instanceof PromotionError ? error.status : 400,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    return invitationFailure(error);
  }
}
