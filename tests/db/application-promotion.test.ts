import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, type ApplicationStatus } from '@prisma/client';
import { promoteApplication } from '@/lib/applications/promotion';
import { createInvitation, completeInvitation } from '@/lib/applications/invitations';
import { invitationLink } from '@/lib/applications/invitation-policy';
import { createTenant, updateTenant } from '@/lib/tenants/service';
import { leasesDb } from '@/lib/leases/queries';
import { organizationTenants } from '@/lib/tenants/queries';

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')(
  'approved applicant promotion database contract',
  () => {
    const client = new PrismaClient();
    const org = `promotion-${randomUUID()}`,
      other = `${org}-other`;
    const actor = { organizationId: org, role: 'MANAGER' as const, subjectId: 'synthetic-manager' };
    const email = () => `${randomUUID()}@example.test`;
    const app = (
      status: ApplicationStatus = 'APPROVED',
      applicantEmail = email(),
      group?: string,
    ) =>
      client.application.create({
        data: {
          organizationId: org,
          unitId: `${org}-unit`,
          applicantName: 'Synthetic Applicant',
          applicantEmail,
          status,
          applicationGroupId: group,
        },
      });
    const promote = (id: string, data: unknown = {}) => promoteApplication(actor, id, data, client);
    beforeAll(async () => {
      for (const id of [org, other]) {
        await client.organization.create({ data: { id, name: 'Synthetic promotion test' } });
        await client.property.create({
          data: {
            id: `${id}-property`,
            organizationId: id,
            name: 'Test House',
            type: 'SINGLE_UNIT',
            street: '1 Test',
            city: 'Test',
            state: 'TX',
            postalCode: '00000',
          },
        });
        await client.unit.create({
          data: { id: `${id}-unit`, organizationId: id, propertyId: `${id}-property`, number: '1' },
        });
      }
    });
    afterAll(async () => {
      for (const id of [org, other]) {
        await client.applicationInvitation.deleteMany({ where: { organizationId: id } });
        await client.application.deleteMany({ where: { organizationId: id } });
        await client.applicationGroup.deleteMany({ where: { organizationId: id } });
        await client.tenant.deleteMany({ where: { organizationId: id } });
        await client.unit.deleteMany({ where: { organizationId: id } });
        await client.property.deleteMany({ where: { organizationId: id } });
        await client.organization.deleteMany({ where: { id } });
      }
      await client.$disconnect();
    });
    it('atomically creates one tenant for concurrent retries, with details and immutable association after edits', async () => {
      const application = await app('APPROVED', `  ${email().toUpperCase()}  `);
      const results = await Promise.all(Array.from({ length: 6 }, () => promote(application.id)));
      expect(results.every((r) => r.status === 'promoted')).toBe(true);
      const saved = await client.application.findUniqueOrThrow({
        where: { id: application.id },
        include: { promotedTenant: true },
      });
      expect(results.map((r) => r.status === 'promoted' && r.tenantId)).toEqual(
        Array(6).fill(saved.promotedTenantId),
      );
      expect(saved.promotedTenant).toMatchObject({
        name: application.applicantName,
        email: application.applicantEmail.trim().toLowerCase(),
        emailRemindersEnabled: false,
        smsRemindersEnabled: false,
      });
      expect(saved.promotedBy).toBe(actor.subjectId);
      expect(saved.promotedAt).toBeInstanceOf(Date);
      await updateTenant(
        org,
        saved.promotedTenantId!,
        { name: 'Edited Tenant', email: email(), phone: '555-0100' },
        client,
      );
      await promote(application.id);
      expect(
        (await client.tenant.findUniqueOrThrow({ where: { id: saved.promotedTenantId! } })).name,
      ).toBe('Edited Tenant');
      expect(
        (await client.application.findUniqueOrThrow({ where: { id: application.id } })).promotedAt,
      ).toEqual(saved.promotedAt);
      expect(
        (await leasesDb(org, client).formOptions()).tenants.some(
          (t) => t.id === saved.promotedTenantId,
        ),
      ).toBe(true);
      expect(await organizationTenants(org, client).detail(saved.promotedTenantId!)).not.toBeNull();
      const directory = await organizationTenants(org, client).list({ q: 'Edited Tenant' });
      expect(directory.rows.some((t) => t.id === saved.promotedTenantId)).toBe(true);
    });
    it('requires explicit confirmation for one normalized email match and preserves every tenant field', async () => {
      const address = email();
      const tenant = await client.tenant.create({
        data: {
          organizationId: org,
          name: 'Saved Name',
          email: ` ${address.toUpperCase()} `,
          phone: '555-0101',
          emergencyContactName: 'Saved Contact',
          emailRemindersEnabled: true,
        },
      });
      const application = await app('APPROVED', address);
      expect(await promote(application.id)).toMatchObject({
        status: 'confirmation-required',
        tenant: { id: tenant.id, name: tenant.name },
      });
      expect(
        (await client.application.findUniqueOrThrow({ where: { id: application.id } }))
          .promotedTenantId,
      ).toBeNull();
      await expect(promote(application.id, { existingTenantId: 'wrong' })).rejects.toThrow(
        'changed',
      );
      const results = await Promise.all(
        Array.from({ length: 4 }, () => promote(application.id, { existingTenantId: tenant.id })),
      );
      expect(results.every((r) => r.status === 'promoted' && r.tenantId === tenant.id)).toBe(true);
      expect(await client.tenant.findUnique({ where: { id: tenant.id } })).toEqual(tenant);
    });
    it('does not guess among legacy duplicates or choose a foreign tenant', async () => {
      const address = email();
      await client.tenant.createMany({
        data: ['One', 'Two'].map((name) => ({ organizationId: org, name, email: address })),
      });
      const application = await app('APPROVED', address);
      await expect(promote(application.id)).rejects.toThrow('Multiple tenants');
      const foreignEmail = email();
      const foreign = await client.tenant.create({
        data: { organizationId: other, name: 'Foreign', email: foreignEmail },
      });
      const ownApp = await app('APPROVED', foreignEmail);
      await expect(promote(ownApp.id, { existingTenantId: foreign.id })).rejects.toThrow('changed');
      const result = await promote(ownApp.id);
      expect(result.status === 'promoted' && result.tenantId !== foreign.id).toBe(true);
      await expect(
        client.application.update({
          where: { id: application.id },
          data: { promotedTenantId: foreign.id, promotedAt: new Date(), promotedBy: 'test' },
        }),
      ).rejects.toThrow();
    });
    it('serializes different applications with the same email and concurrent manual tenant creation', async () => {
      const address = email();
      const applications = await Promise.all([app('APPROVED', address), app('APPROVED', address)]);
      const results = await Promise.all(applications.map((a) => promote(a.id)));
      expect(results.filter((r) => r.status === 'promoted')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'confirmation-required')).toHaveLength(1);
      const manualEmail = email();
      const application = await app('APPROVED', manualEmail);
      await Promise.allSettled([
        promote(application.id),
        createTenant(
          org,
          {
            name: 'Manual Contact',
            email: manualEmail,
            phone: null,
            unitId: null,
            moveInDate: null,
          },
          client,
        ),
      ]);
      expect(
        await client.tenant.count({ where: { organizationId: org, email: manualEmail } }),
      ).toBe(1);
      expect(await client.tenant.count({ where: { organizationId: org, email: address } })).toBe(1);
    });
    it.each(['SUBMITTED', 'SCREENING', 'REVIEW', 'DECLINED'] as const)(
      'rejects %s and never promotes unapproved household members',
      async (status) => {
        const application = await app(status);
        await expect(promote(application.id)).rejects.toThrow('Only approved');
        expect(
          await client.tenant.count({
            where: { organizationId: org, email: application.applicantEmail },
          }),
        ).toBe(0);
      },
    );
    it.each(['OWNER', 'TENANT', 'ADMIN'] as const)('rejects the %s role', async (role) => {
      await expect(
        promoteApplication({ ...actor, role }, (await app()).id, {}, client),
      ).rejects.toThrow('Manager access');
    });
    it('rejects cross-organization reads, injected fields and partial promotion metadata', async () => {
      const application = await app();
      await expect(
        promoteApplication({ ...actor, organizationId: other }, application.id, {}, client),
      ).rejects.toThrow('not found');
      await expect(promote(application.id, { organizationId: other })).rejects.toThrow();
      await expect(
        client.application.update({
          where: { id: application.id },
          data: { promotedAt: new Date() },
        }),
      ).rejects.toThrow();
    });
    it('promotes each approved household member separately while preserving group status', async () => {
      const group = await client.applicationGroup.create({
        data: { organizationId: org, unitId: `${org}-unit`, status: 'REVIEW' },
      });
      const a = await app('APPROVED', email(), group.id),
        b = await app('APPROVED', email(), group.id),
        declined = await app('DECLINED', email(), group.id);
      const results = await Promise.all([promote(a.id), promote(b.id)]);
      expect(new Set(results.map((r) => r.status === 'promoted' && r.tenantId)).size).toBe(2);
      await expect(promote(declined.id)).rejects.toThrow('Only approved');
      expect(await client.applicationGroup.findUnique({ where: { id: group.id } })).toEqual(group);
    });
    it('invitations/submission never create a tenant; promotion creates no lease, occupancy, billing, documents or consent', async () => {
      const address = email();
      const env = {
        APPLICATIONS_INVITATION_SECRET: 'synthetic-secret-longer-than-32-characters',
        APPLICATIONS_PUBLIC_ORIGIN: 'https://example.test',
      };
      const invitation = await createInvitation(
        actor,
        {
          fullName: 'Synthetic Invite',
          email: address,
          propertyId: `${org}-property`,
          unitId: `${org}-unit`,
          requestKey: randomUUID(),
        },
        client,
        env,
      );
      expect(await client.tenant.count({ where: { organizationId: org, email: address } })).toBe(0);
      await completeInvitation(
        {
          token: invitationLink(invitation.tokenCipher, env).split('/').pop(),
          fullName: 'Submitted Name',
          intent: 'submit',
          confirmed: true,
        },
        client,
      );
      const application = await client.application.findFirstOrThrow({
        where: { organizationId: org, applicantEmail: address },
      });
      await expect(promote(application.id)).rejects.toThrow('Only approved');
      await client.application.update({
        where: { id: application.id },
        data: { status: 'APPROVED' },
      });
      const unit = await client.unit.findUnique({ where: { id: `${org}-unit` } });
      await promote(application.id);
      const where = { organizationId: org };
      expect(
        await Promise.all([
          client.lease.count({ where }),
          client.charge.count({ where }),
          client.document.count({ where }),
          client.screeningConsent.count({ where }),
          client.screeningReport.count({ where }),
          client.leaseTenant.count({ where }),
        ]),
      ).toEqual([0, 0, 0, 0, 0, 0]);
      expect(await client.unit.findUnique({ where: { id: `${org}-unit` } })).toEqual(unit);
    });
  },
);
