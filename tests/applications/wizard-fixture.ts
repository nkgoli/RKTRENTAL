import { PrismaClient } from '@prisma/client';
import { tenantLifecycleFixture } from '../tenants/lifecycle-fixture';
import { promoteApplication } from '../../src/lib/applications/promotion';

/** Synthetic collision: the promoted contact changed email; a different tenant has the old one. */
export async function applicantWizardFixture(width: number) {
  const base = await tenantLifecycleFixture(width);
  const client = new PrismaClient();
  const organizationId = 'seed-rocket-rental';
  const promoted = await promoteApplication(
    { organizationId, role: 'MANAGER', subjectId: 'seed-jordan-mills' },
    base.applicationId,
    {},
    client,
  );
  if (promoted.status !== 'promoted') throw Error('Fresh synthetic applicant must promote.');
  const tenantId = promoted.tenantId;
  const tenantName = `Saved Promoted Contact ${width}`;
  await client.tenant.update({
    where: { id: tenantId },
    data: { name: tenantName, email: base.email.replace('tenant.lifecycle.', 'tenant.changed.') },
  });
  const collision = await client.tenant.create({
    data: { organizationId, name: `Different Contact ${width}`, email: base.email },
  });
  const pending = await Promise.all(
    (['APPROVED', 'REVIEW'] as const).map((status) =>
      client.application.create({
        data: {
          organizationId,
          unitId: base.unitId,
          applicantName: `${status} Unpromoted ${width}`,
          applicantEmail: base.email,
          status,
        },
      }),
    ),
  );
  return {
    ...base,
    tenantId,
    tenantName,
    collision,
    pending,
    async drafts() {
      return client.leaseDraft.findMany({
        where: { organizationId, lease: { unitId: base.unitId } },
      });
    },
    async cleanup() {
      try {
        await client.lease.deleteMany({ where: { organizationId, unitId: base.unitId } });
        await client.application.deleteMany({
          where: { organizationId, id: { in: pending.map((app) => app.id) } },
        });
        await client.tenant.delete({ where: { id: collision.id } });
      } finally {
        await client.$disconnect();
        await base.cleanup();
      }
    },
  };
}
