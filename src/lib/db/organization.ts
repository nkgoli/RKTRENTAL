import { type ESignStatus, type LeaseStatus, type PrismaClient } from '@prisma/client';
import { db } from './client';

/**
 * The caller must derive organizationId from an authenticated membership.
 * Every query here carries that ID; composite foreign keys in the migration
 * prevent cross-organization references on writes.
 */
export function organizationDb(organizationId: string, client: PrismaClient = db) {
  if (!organizationId.trim()) throw new Error('organizationId is required');

  return {
    listProperties: () =>
      client.property.findMany({
        where: { organizationId, archivedAt: null },
        include: { units: true },
        orderBy: { name: 'asc' },
      }),
    getProperty: (id: string) =>
      client.property.findFirst({
        where: { id, organizationId },
        include: { units: true },
      }),
    listUnits: (propertyId: string) =>
      client.unit.findMany({
        where: { organizationId, propertyId },
        orderBy: { number: 'asc' },
      }),
    getUnit: (id: string) =>
      client.unit.findFirst({
        where: { id, organizationId },
        include: { property: true, leases: { where: { status: 'ACTIVE' } } },
      }),
    listTenants: () =>
      client.tenant.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
      }),
    getTenant: (id: string) =>
      client.tenant.findFirst({
        where: { id, organizationId },
        include: { leases: { include: { lease: true } } },
      }),
    listLeases: () =>
      client.lease.findMany({
        where: { organizationId },
        include: { unit: { include: { property: true } }, tenants: { include: { tenant: true } } },
        orderBy: { endDate: 'asc' },
      }),
    getLease: (id: string) =>
      client.lease.findFirst({
        where: { id, organizationId },
        include: {
          unit: { include: { property: true } },
          tenants: { include: { tenant: true } },
          documents: true,
          charges: true,
          payments: true,
        },
      }),
    listDocuments: () =>
      client.document.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
    listCharges: (leaseId: string) =>
      client.charge.findMany({
        where: { organizationId, leaseId },
        orderBy: { dueDate: 'desc' },
      }),
    listPayments: (leaseId: string) =>
      client.payment.findMany({
        where: { organizationId, leaseId },
        orderBy: { createdAt: 'desc' },
      }),
    listMaintenanceRequests: () =>
      client.maintenanceRequest.findMany({
        where: { organizationId },
        include: { photos: true, unit: true },
        orderBy: { createdAt: 'desc' },
      }),
    createLease: (input: {
      unitId: string;
      startDate: Date;
      endDate: Date;
      monthlyRent: number;
      deposit: number;
      lateFee?: number;
      graceDays?: number;
      status?: LeaseStatus;
      eSignStatus?: ESignStatus;
    }) => {
      if (input.endDate < input.startDate) throw new Error('Lease end date precedes start date');
      return client.lease.create({
        data: { ...input, organizationId },
      });
    },
  };
}
