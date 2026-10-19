import { NextRequest, NextResponse } from 'next/server';
import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { leaseResult } from '../feedback';

/** Finish successful lease actions through Next's document-navigation fallback. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagerRole();
  const { id } = await params;
  const lease = await db.lease.findFirst({
    where: { id, organizationId: session.organizationId },
    select: { id: true, unitId: true, unit: { select: { propertyId: true } } },
  });
  if (!lease) notFound();
  const headers = { 'Cache-Control': 'no-store', Vary: 'RSC' };
  if (request.headers.get('rsc') === '1') {
    return new NextResponse(null, { status: 204, headers });
  }
  const query = new URLSearchParams();
  const scope = request.nextUrl.searchParams.get('scope');
  // Restore context only from the authorized lease; no arbitrary return URL.
  if (scope === 'unit' || scope === 'property') query.set('propertyId', lease.unit.propertyId);
  if (scope === 'unit') query.set('unitId', lease.unitId);
  query.set('tab', 'agreement');
  const saved = leaseResult(request.nextUrl.searchParams.get('saved'));
  if (saved) query.set('saved', saved);
  const anchor =
    saved === 'terms' ? 'edit-terms' : saved === 'notice' ? 'lease-notice' : 'lease-agreement';
  return new NextResponse(null, {
    status: 303,
    headers: {
      ...headers,
      Location: `/leases/${encodeURIComponent(lease.id)}?${query}#${anchor}`,
    },
  });
}
