import { db } from '@/lib/db/client';
import type { AuthSession } from '@/lib/auth/session';
import { findTenantLeaseForPortal } from '@/lib/tenant-portal';

/**
 * Requests for the signed-in tenant's own unit only: the unit comes from their active lease on
 * the server, never from the browser.
 */
export async function loadTenantRepairs(session: AuthSession) {
  const lease = await findTenantLeaseForPortal(session);
  if (!lease) return null;
  const requests = await db.maintenanceRequest.findMany({
    where: { organizationId: session.organizationId, unitId: lease.unitId },
    include: {
      photos: {
        include: { document: { select: { id: true, name: true, leaseId: true, unitId: true } } },
        orderBy: { createdAt: 'asc' },
      },
      events: {
        where: { kind: { in: ['COMMENT', 'STATUS_CHANGED'] } },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return {
    unitId: lease.unitId,
    unitNumber: lease.unit.number,
    propertyName: lease.unit.property.name,
    tenantName: lease.tenants.find((t) => t.tenantId === session.tenantId)?.tenant.name ?? '',
    requests,
  };
}
