import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  completeInvitation,
  createInvitation,
  getApplicantInvitation,
  getManagerInvitation,
  manageInvitation,
  type Manager,
} from '@/lib/applications/invitations';
import { invitationLink } from '@/lib/applications/invitation-policy';
import type { ReminderTransport } from '@/lib/notifications/reminder-transport';

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')(
  'application invitations database contract',
  () => {
    const client = new PrismaClient();
    const organizationId = `invitation-test-${randomUUID()}`;
    const otherOrg = `${organizationId}-other`;
    const propertyId = `${organizationId}-property`,
      unitId = `${organizationId}-unit`;
    const actor: Manager = { role: 'MANAGER', organizationId, subjectId: 'synthetic-manager' };
    const env = {
      APPLICATIONS_INVITATION_SECRET: 'synthetic-invitation-secret-at-least-32-characters',
      APPLICATIONS_PUBLIC_ORIGIN: 'https://applications.example.test',
      ROCKETRENTAL_SANDBOX: 'true',
    };
    const input = () => ({
      fullName: 'Synthetic Applicant',
      email: `synthetic-${randomUUID()}@example.test`,
      propertyId,
      unitId,
      requestKey: randomUUID(),
    });
    const create = () => createInvitation(actor, input(), client, env);
    const token = (row: { tokenCipher: string }) =>
      invitationLink(row.tokenCipher, env).split('/').pop()!;
    const action = (generation = 1) => ({
      intent: 'send' as const,
      generation,
      requestKey: randomUUID(),
    });
    beforeAll(async () => {
      for (const id of [organizationId, otherOrg]) {
        await client.organization.create({ data: { id, name: 'Synthetic invitation test' } });
        await client.property.create({
          data: {
            id: `${id}-property`,
            organizationId: id,
            name: 'Synthetic House',
            type: 'SINGLE_UNIT',
            street: '1 Test Street',
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
      for (const id of [organizationId, otherOrg]) {
        await client.applicationInvitation.deleteMany({ where: { organizationId: id } });
        await client.application.deleteMany({ where: { organizationId: id } });
        await client.unit.deleteMany({ where: { organizationId: id } });
        await client.property.deleteMany({ where: { organizationId: id } });
        await client.organization.deleteMany({ where: { id } });
      }
      await client.$disconnect();
    });
    it('creates one invitation on concurrent replay and never a submitted application', async () => {
      const data = input();
      const rows = await Promise.all(
        Array.from({ length: 4 }, () => createInvitation(actor, data, client, env)),
      );
      expect(new Set(rows.map((r) => r.id)).size).toBe(1);
      expect(await client.application.count({ where: { organizationId } })).toBe(0);
      expect(
        await createInvitation(actor, { ...data, requestKey: randomUUID() }, client, env),
      ).toMatchObject({ id: rows[0].id });
      await expect(
        createInvitation(actor, { ...data, fullName: 'Altered request' }, client, env),
      ).rejects.toThrow('already used');
    });
    it.each(['OWNER', 'TENANT', 'ADMIN'] as const)(
      'denies %s manager writes and reads',
      async (role) => {
        const row = await create();
        await expect(createInvitation({ ...actor, role }, input(), client, env)).rejects.toThrow(
          'Manager access',
        );
        await expect(getManagerInvitation({ ...actor, role }, row.id, client)).rejects.toThrow(
          'Manager access',
        );
        await expect(
          manageInvitation({ ...actor, role }, row.id, action(), client, env),
        ).rejects.toThrow('Manager access');
      },
    );
    it('rejects foreign organization, mismatched property/unit and cross-scope reads/sends', async () => {
      const row = await create();
      await expect(
        createInvitation(
          actor,
          { ...input(), propertyId: `${otherOrg}-property`, unitId: `${otherOrg}-unit` },
          client,
          env,
        ),
      ).rejects.toThrow('Choose a unit');
      await expect(
        createInvitation(actor, { ...input(), propertyId: `${otherOrg}-property` }, client, env),
      ).rejects.toThrow('Choose a unit');
      await expect(
        getManagerInvitation({ ...actor, organizationId: otherOrg }, row.id, client),
      ).rejects.toThrow('not found');
      await expect(
        manageInvitation({ ...actor, organizationId: otherOrg }, row.id, action(), client, env),
      ).rejects.toThrow('not found');
      await expect(
        client.applicationInvitation.update({
          where: { id: row.id },
          data: { unitId: `${otherOrg}-unit` },
        }),
      ).rejects.toThrow();
    });
    it('persists draft, submits exactly once under concurrency and creates no screening consent', async () => {
      const row = await create();
      const form = {
        token: token(row),
        fullName: 'Synthetic Corrected Name',
        intent: 'save',
        confirmed: false,
      };
      expect(await completeInvitation(form, client)).toEqual({ submitted: false });
      expect(await getApplicantInvitation(form.token, client)).toMatchObject({
        draftName: form.fullName,
        applicationId: null,
      });
      await expect(completeInvitation({ ...form, intent: 'submit' }, client)).rejects.toThrow(
        'Confirm',
      );
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          completeInvitation({ ...form, intent: 'submit', confirmed: true }, client),
        ),
      );
      expect(results.every((r) => r.submitted)).toBe(true);
      const updated = await getManagerInvitation(actor, row.id, client);
      const app = await client.application.findUniqueOrThrow({
        where: { id: updated.applicationId! },
        include: { consents: true, reports: true },
      });
      expect(app).toMatchObject({
        applicantName: form.fullName,
        applicantEmail: row.applicantEmail,
        organizationId,
        unitId,
        status: 'SUBMITTED',
        consents: [],
        reports: [],
      });
      expect(
        await client.application.count({
          where: { organizationId, applicantEmail: row.applicantEmail },
        }),
      ).toBe(1);
      await completeInvitation({ ...form, fullName: 'Late draft' }, client);
      expect(
        (await client.application.findUniqueOrThrow({ where: { id: app.id } })).applicantName,
      ).toBe(form.fullName);
      await expect(manageInvitation(actor, row.id, action(), client, env)).rejects.toThrow(
        'already been submitted',
      );
    });
    it('denies injected applicant scope/consent and invalid or expired tokens', async () => {
      const row = await create();
      const form = {
        token: token(row),
        fullName: 'Synthetic Applicant',
        intent: 'submit',
        confirmed: true,
      };
      await expect(
        completeInvitation({ ...form, unitId: `${otherOrg}-unit`, consent: true }, client),
      ).rejects.toThrow();
      expect(await getApplicantInvitation('x'.repeat(43), client)).toBeNull();
      await expect(completeInvitation({ ...form, token: 'x'.repeat(43) }, client)).rejects.toThrow(
        'invalid or has expired',
      );
      await client.applicationInvitation.update({
        where: { id: row.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      expect(await getApplicantInvitation(form.token, client)).toBeNull();
      await expect(completeInvitation(form, client)).rejects.toThrow('invalid or has expired');
      await expect(manageInvitation(actor, row.id, action(), client, env)).rejects.toThrow(
        'expired',
      );
    });
    it('renews expired links once, revokes the old token, and fences stale send requests', async () => {
      const row = await create();
      const oldToken = token(row);
      await client.applicationInvitation.update({
        where: { id: row.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      const request = { ...action(), intent: 'renew' };
      await manageInvitation(actor, row.id, request, client, env);
      await expect(manageInvitation(actor, row.id, request, client, env)).rejects.toThrow(
        'changed',
      );
      const updated = await getManagerInvitation(actor, row.id, client);
      expect(updated.generation).toBe(2);
      expect(await getApplicantInvitation(oldToken, client)).toBeNull();
      expect(await getApplicantInvitation(token(updated), client)).not.toBeNull();
      await expect(manageInvitation(actor, row.id, action(), client, env)).rejects.toThrow(
        'changed',
      );
    });
    it('records unconfigured transport without sending and allows intentional sandbox retry', async () => {
      const row = await create();
      await manageInvitation(actor, row.id, action(), client, {
        ...env,
        ROCKETRENTAL_SANDBOX: 'false',
      });
      expect((await getManagerInvitation(actor, row.id, client)).attempts[0].status).toBe(
        'UNCONFIGURED',
      );
      await manageInvitation(actor, row.id, action(), client, env);
      expect((await getManagerInvitation(actor, row.id, client)).attempts[0].status).toBe(
        'MOCK_RECORDED',
      );
      expect(await client.emailDelivery.count({ where: { organizationId } })).toBe(0);
    });
    it('claims concurrent sends once, labels acceptance accurately and limits immediate resend', async () => {
      const row = await create();
      const send = vi.fn(async () => ({ status: 'ACCEPTED' as const, providerId: 'synthetic-id' }));
      const factory = async (): Promise<ReminderTransport> => ({ name: 'synthetic', send });
      const request = action();
      await Promise.all(
        Array.from({ length: 4 }, () =>
          manageInvitation(actor, row.id, request, client, env, factory),
        ),
      );
      expect(send).toHaveBeenCalledTimes(1);
      expect((await getManagerInvitation(actor, row.id, client)).attempts[0].status).toBe(
        'ACCEPTED',
      );
      await expect(manageInvitation(actor, row.id, action(), client, env, factory)).rejects.toThrow(
        'one minute',
      );
      await client.applicationInvitationAttempt.updateMany({
        where: { invitationId: row.id },
        data: { createdAt: new Date(Date.now() - 61_000) },
      });
      await manageInvitation(actor, row.id, action(), client, env, factory);
      expect(send).toHaveBeenCalledTimes(2);
    });
    it('permits explicit retry after failure but blocks uncertain outcome replay', async () => {
      const row = await create();
      const failed = vi.fn(async () => ({ status: 'FAILED' as const }));
      await manageInvitation(actor, row.id, action(), client, env, async () => ({
        name: 'synthetic',
        send: failed,
      }));
      expect((await getManagerInvitation(actor, row.id, client)).attempts[0].status).toBe('FAILED');
      const uncertain = vi.fn(async () => ({ status: 'UNCERTAIN' as const }));
      const request = action();
      const factory = async () => ({ name: 'synthetic', send: uncertain });
      await manageInvitation(actor, row.id, request, client, env, factory);
      await manageInvitation(actor, row.id, request, client, env, factory);
      await expect(manageInvitation(actor, row.id, action(), client, env, factory)).rejects.toThrow(
        'outcome is unknown',
      );
      expect(uncertain).toHaveBeenCalledTimes(1);
    });
    it('fails closed for archived properties', async () => {
      const row = await create();
      await client.property.update({ where: { id: propertyId }, data: { archivedAt: new Date() } });
      try {
        expect(await getApplicantInvitation(token(row), client)).toBeNull();
        await expect(createInvitation(actor, input(), client, env)).rejects.toThrow(
          'active property',
        );
        await expect(
          completeInvitation(
            { token: token(row), fullName: 'Synthetic Name', intent: 'submit', confirmed: true },
            client,
          ),
        ).rejects.toThrow('invalid or has expired');
        await expect(manageInvitation(actor, row.id, action(), client, env)).rejects.toThrow(
          'no longer accepting',
        );
      } finally {
        await client.property.update({ where: { id: propertyId }, data: { archivedAt: null } });
      }
    });
  },
);
