import { NextRequest, NextResponse } from 'next/server';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';

/**
 * Finishes draft deletion through a full document load (the lease page no longer exists, and a
 * fresh load refreshes every list count). The destination is rebuilt from an authorized unit,
 * never taken from the caller.
 */
export async function GET(request: NextRequest) {
  const session = await requireManagerRole();
  const headers = { 'Cache-Control': 'no-store', Vary: 'RSC' };
  if (request.headers.get('rsc') === '1') return new NextResponse(null, { status: 204, headers });
  const params = request.nextUrl.searchParams;
  const notice = params.get('notice') === 'draft-gone' ? 'draft-gone' : 'draft-deleted';
  const to = params.get('to');
  const unitId = params.get('unit');
  const unit =
    (to === 'property' || to === 'unit') && unitId
      ? await db.unit.findFirst({
          where: { id: unitId, organizationId: session.organizationId },
          select: { id: true, propertyId: true },
        })
      : null;
  const location = unit
    ? `/properties/${encodeURIComponent(unit.propertyId)}/leases?${new URLSearchParams({
        ...(to === 'unit' ? { unit: unit.id } : {}),
        notice,
      })}`
    : `/leases?tab=drafts&notice=${notice}`;
  return new NextResponse(null, { status: 303, headers: { ...headers, Location: location } });
}
