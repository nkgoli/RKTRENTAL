import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

/** A fresh applicant and vacant unit; never reuse or modify the seeded tenant contacts. */
export async function tenantLifecycleFixture(width: number) {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.APPLICATION_PROMOTION_TEST_FIXTURES !== '1' ||
    process.env.ROCKETRENTAL_SANDBOX !== 'true' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port !== '5498'
  ) {
    throw new Error(
      'Tenant lifecycle checks require the dedicated local promotion sandbox on 5498.',
    );
  }

  const client = new PrismaClient();
  const organizationId = 'seed-rocket-rental';
  const propertyId = 'seed-property-maple';
  const suffix = randomUUID();
  const applicationId = `tenant-lifecycle-application-${suffix}`;
  const unitId = `tenant-lifecycle-unit-${suffix}`;
  const leaseId = `tenant-lifecycle-lease-${suffix}`;
  const name = `Lifecycle Applicant ${width}`;
  const email = `tenant.lifecycle.${suffix}@example.test`;

  async function cleanup() {
    try {
      const application = await client.application.findUnique({ where: { id: applicationId } });
      await client.$transaction(async (tx) => {
        await tx.charge.deleteMany({ where: { organizationId, leaseId } });
        await tx.lease.deleteMany({ where: { organizationId, id: leaseId } });
        await tx.application.deleteMany({ where: { organizationId, id: applicationId } });
        if (application?.promotedTenantId) {
          await tx.tenant.deleteMany({
            where: {
              organizationId,
              id: application.promotedTenantId,
              email: { endsWith: '@example.test' },
            },
          });
        }
        await tx.unit.deleteMany({ where: { organizationId, id: unitId } });
      });
    } finally {
      await client.$disconnect();
    }
  }

  try {
    await client.$transaction(async (tx) => {
      await tx.unit.create({
        data: {
          id: unitId,
          organizationId,
          propertyId,
          number: `LC-${width}-${suffix.slice(0, 8)}`,
          status: 'VACANT',
          listedRent: 1250,
        },
      });
      // The reviewed application is synthetic. Promotion itself must happen through the UI.
      await tx.application.create({
        data: {
          id: applicationId,
          organizationId,
          unitId,
          applicantName: name,
          applicantEmail: email,
          status: 'APPROVED',
          decisionReason: 'criteria-met',
          decidedBy: 'seed-jordan-mills',
          decidedAt: new Date(),
        },
      });
    });
  } catch (error) {
    await client.$disconnect();
    throw error;
  }

  return {
    applicationId,
    propertyId,
    unitId,
    leaseId,
    name,
    email,
    async snapshot() {
      const application = await client.application.findUniqueOrThrow({
        where: { id: applicationId },
        include: { promotedTenant: { include: { notes: true } } },
      });
      const tenantId = application.promotedTenantId;
      const [
        unit,
        lease,
        leaseCount,
        consentCount,
        reportCount,
        chargeCount,
        paymentCount,
        autopayCount,
      ] = await Promise.all([
        client.unit.findUniqueOrThrow({ where: { id: unitId } }),
        client.lease.findUnique({ where: { id: leaseId } }),
        client.lease.count({ where: { organizationId, unitId } }),
        client.screeningConsent.count({ where: { organizationId, applicationId } }),
        client.screeningReport.count({ where: { organizationId, applicationId } }),
        client.charge.count({ where: { organizationId, lease: { unitId } } }),
        client.payment.count({ where: { organizationId, lease: { unitId } } }),
        client.autopaySetting.count({ where: { organizationId, tenantId: tenantId ?? 'missing' } }),
      ]);
      return {
        tenantId,
        tenant: application.promotedTenant,
        promotedBy: application.promotedBy,
        promotedAt: application.promotedAt,
        unitStatus: unit.status,
        leaseStatus: lease?.status ?? null,
        leaseCount,
        consentCount,
        reportCount,
        chargeCount,
        paymentCount,
        autopayCount,
      };
    },
    async createDraftLease(tenantId: string) {
      const application = await client.application.findUniqueOrThrow({
        where: { id: applicationId },
      });
      if (application.promotedTenantId !== tenantId)
        throw new Error(
          'The deliberate lease fixture requires this applicant to be promoted first.',
        );
      const startDate = new Date();
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setUTCFullYear(endDate.getUTCFullYear() + 1);
      // Lease setup is an explicit, separate test step; promotion never creates this row.
      await client.$transaction(async (tx) => {
        await tx.lease.create({
          data: {
            id: leaseId,
            organizationId,
            unitId,
            startDate,
            endDate,
            monthlyRent: 1250,
            deposit: 1250,
            status: 'DRAFT',
          },
        });
        await tx.leaseTenant.create({
          data: { organizationId, leaseId, tenantId, isPrimary: true },
        });
      });
    },
    cleanup,
  };
}
