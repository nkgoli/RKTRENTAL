/** Local synthetic evidence only. Consent fixtures are not an applicant consent collection flow. */
import { PrismaClient } from '@prisma/client';
import { organizationTenants } from '@/lib/tenants/queries';
import { leasesDb } from '@/lib/leases/queries';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (
    process.env.APPLICATION_PROMOTION_TEST_FIXTURES !== '1' ||
    process.env.ROCKETRENTAL_SANDBOX !== 'true' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port !== '5498'
  )
    throw new Error('Dedicated local promotion sandbox required.');
  const client = new PrismaClient();
  const organizationId = 'seed-rocket-rental';
  const emails = ['promotion.desktop@example.test', 'promotion.mobile@example.test'];
  try {
    const applications = await client.application.findMany({
      where: { organizationId, applicantEmail: { in: emails } },
      include: { promotedTenant: true, consents: true, reports: true },
    });
    if (process.argv[2] === 'consent') {
      for (const app of applications)
        await client.screeningConsent.upsert({
          where: { applicationId_provider: { applicationId: app.id, provider: 'transunion' } },
          update: {},
          create: {
            organizationId,
            applicationId: app.id,
            provider: 'transunion',
            consentVersion: 'synthetic-promotion-browser-only',
            consentedAt: new Date(Date.now() - 1000),
          },
        });
      console.log(
        `Added explicit synthetic consent fixtures for ${applications.length} submitted applications.`,
      );
    } else if (process.argv[2] === 'existing') {
      const email = emails[0];
      const existing = await client.tenant.findFirst({ where: { organizationId, email } });
      if (!existing)
        await client.tenant.create({
          data: {
            organizationId,
            name: 'Saved Desktop Contact',
            email,
            phone: '555-0102',
            emergencyContactName: 'Saved Emergency Contact',
            emailRemindersEnabled: true,
          },
        });
      console.log('Synthetic existing desktop contact is ready for explicit-match verification.');
    } else if (process.argv[2] === 'edit-contact') {
      const desktop = applications.find((app) => app.applicantEmail === emails[0]);
      if (!desktop?.promotedTenantId)
        throw new Error('Promote the synthetic desktop applicant first.');
      await client.tenant.update({
        where: { id: desktop.promotedTenantId },
        data: { email: 'promotion.desktop.edited@example.test' },
      });
      await client.tenant.upsert({
        where: { id: 'promotion-synthetic-other-contact' },
        update: {},
        create: {
          id: 'promotion-synthetic-other-contact',
          organizationId,
          name: 'Different Desktop Contact',
          email: emails[0],
        },
      });
      console.log(
        'Synthetic contact edited; original applicant email now belongs to a different contact. Promotion and lease links must retain the saved tenant ID.',
      );
    } else if (process.argv[2] === 'evidence') {
      for (const app of applications) {
        const profile = app.promotedTenantId
          ? await organizationTenants(organizationId, client).detail(app.promotedTenantId)
          : null;
        const options = await leasesDb(organizationId, client).formOptions();
        console.log(
          JSON.stringify({
            email: app.applicantEmail,
            applicationId: app.id,
            status: app.status,
            decisionReason: app.decisionReason,
            decidedBy: app.decidedBy,
            promotedTenantId: app.promotedTenantId,
            promotedBy: app.promotedBy,
            tenantName: app.promotedTenant?.name,
            profileAvailable: Boolean(profile),
            leaseSelectable: options.tenants.some((t) => t.id === app.promotedTenantId),
            tenantLeases: await client.leaseTenant.count({
              where: { organizationId, tenantId: app.promotedTenantId ?? 'missing' },
            }),
            consents: app.consents.length,
            reports: app.reports.length,
          }),
        );
      }
    } else throw new Error('Use consent, existing, edit-contact or evidence.');
  } finally {
    await client.$disconnect();
  }
}
void main();
