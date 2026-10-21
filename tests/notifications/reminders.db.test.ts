import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PaymentReminders, type ReminderActor } from '@/lib/notifications/reminders';
import type { ReminderTransport } from '@/lib/notifications/reminder-transport';

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')(
  'durable payment reminders (PostgreSQL)',
  () => {
    const db = new PrismaClient();
    const org = `reminders-${randomUUID()}`;
    const other = `${org}-other`;
    const manager = `${org}-manager`;
    const actor: ReminderActor = { subjectId: manager, organizationId: org, role: 'MANAGER' };
    const now = new Date('2026-10-21T12:00:00Z');
    const clock = () => new Date(now);
    const key = () => randomUUID();
    const mock = () => ({
      name: 'mock',
      send: vi.fn(async () => ({ status: 'MOCK_RECORDED' as const })),
    });
    const service = (transport: ReminderTransport = mock(), client = db) =>
      new PaymentReminders(client, async () => transport, clock);

    beforeAll(async () => {
      await db.organization.createMany({
        data: [
          { id: org, name: 'Synthetic reminders' },
          { id: other, name: 'Isolated organization' },
        ],
      });
      await db.user.create({
        data: {
          id: manager,
          organizationId: org,
          name: 'Synthetic Manager',
          email: 'manager@example.invalid',
          role: 'MANAGER',
        },
      });
      await db.property.create({
        data: {
          id: org,
          organizationId: org,
          name: 'Synthetic Court',
          type: 'MULTI_UNIT',
          street: '1 Test St',
          city: 'Test',
          state: 'TX',
          postalCode: '00000',
        },
      });
    });
    afterAll(async () => {
      await db.paymentReminderAttempt.deleteMany({ where: { organizationId: org } });
      await db.paymentReminderPreview.deleteMany({ where: { organizationId: org } });
      await db.organization.deleteMany({ where: { id: { in: [org, other] } } });
      await db.$disconnect();
    });

    async function fixture() {
      const id = randomUUID();
      await db.unit.create({ data: { id, organizationId: org, propertyId: org, number: id } });
      const tenant = await db.tenant.create({
        data: {
          organizationId: org,
          name: 'Synthetic Tenant',
          email: `${id}@example.invalid`,
          phone: '+15005550006',
          smsRemindersEnabled: true,
        },
      });
      const second = await db.tenant.create({
        data: {
          organizationId: org,
          name: 'Synthetic Cotenant',
          email: `${id}-co@example.invalid`,
          phone: '+15005550007',
          smsRemindersEnabled: true,
        },
      });
      const lease = await db.lease.create({
        data: {
          id,
          organizationId: org,
          unitId: id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2027-01-01'),
          monthlyRent: '1000',
          deposit: '0',
          status: 'ACTIVE',
          graceDays: 3,
          tenants: { create: [tenant, second].map((t) => ({ tenantId: t.id })) },
          charges: {
            create: [
              { kind: 'RENT', amount: '1000', dueDate: new Date('2026-09-01') },
              { kind: 'RENT', amount: '1000', dueDate: new Date('2026-10-01') },
              { kind: 'LATE_FEE', amount: '50', dueDate: new Date('2026-10-21') },
              { kind: 'OTHER', amount: '500', dueDate: new Date('2026-11-01') },
            ],
          },
          payments: {
            create: [
              { status: 'SUCCEEDED', amount: '1200', paidAt: new Date('2026-10-06') },
              { status: 'PENDING', amount: '100' },
              { status: 'FAILED', amount: '1000' },
              { status: 'REFUNDED', amount: '1000' },
            ],
          },
        },
      });
      return { lease, tenant, second };
    }

    it('allocates partial payments across arrears, assessed fees and excludes future charges; scopes multiple leases', async () => {
      const { lease } = await fixture();
      const otherLease = await fixture();
      const preview = await service().preview(actor, lease.id, 'EMAIL');
      expect(preview.snapshot).toMatchObject({
        amountCents: 85000,
        pendingCents: 10000,
        propertyId: org,
        unitId: lease.unitId,
        charges: [
          { kind: 'RENT', outstandingCents: 80000 },
          { kind: 'LATE_FEE', outstandingCents: 5000 },
        ],
      });
      const snapshot = preview.snapshot as { recipients: { body: string }[] };
      expect(snapshot.recipients).toHaveLength(2);
      expect(snapshot.recipients[0].body).toContain('$850');
      expect(await service().history(actor, otherLease.lease.id)).toEqual([]);
    });

    it('enforces manager-only access and organization isolation for every operation', async () => {
      const { lease } = await fixture();
      const s = service();
      for (const role of ['TENANT', 'OWNER', 'ADMIN'] as const)
        await expect(s.preview({ ...actor, role }, lease.id, 'EMAIL')).rejects.toMatchObject({
          code: 'MANAGER_REQUIRED',
        });
      const outsider = await db.user.create({
        data: {
          organizationId: other,
          name: 'Other Manager',
          email: 'other@example.invalid',
          role: 'MANAGER',
        },
      });
      const foreign = { ...actor, subjectId: outsider.id, organizationId: other };
      await expect(s.preview(foreign, lease.id, 'EMAIL')).rejects.toMatchObject({
        code: 'LEASE_NOT_FOUND',
      });
      await expect(s.history(foreign, lease.id)).rejects.toMatchObject({ code: 'LEASE_NOT_FOUND' });
      const preview = await s.preview(actor, lease.id, 'EMAIL');
      await expect(s.dispatch(foreign, preview.id, key())).rejects.toMatchObject({
        code: 'PREVIEW_NOT_FOUND',
      });
      await expect(s.reconcile(foreign, 'missing')).rejects.toMatchObject({
        code: 'ATTEMPT_NOT_FOUND',
      });
    });

    it('enforces channel preferences, existing user email opt-out and strict contact validation', async () => {
      const { lease, tenant, second } = await fixture();
      const user = await db.user.create({
        data: {
          organizationId: org,
          name: 'Opted out',
          email: `${key()}@example.invalid`,
          role: 'TENANT',
          emailNotificationsEnabled: false,
        },
      });
      await db.tenant.update({
        where: { id: tenant.id },
        data: { userId: user.id, smsRemindersEnabled: false },
      });
      const s = service();
      expect((await s.preview(actor, lease.id, 'EMAIL')).snapshot).toMatchObject({
        recipients: [{ tenantId: second.id }],
        excluded: [{ tenantId: tenant.id, reason: 'OPTED_OUT' }],
      });
      expect((await s.preview(actor, lease.id, 'SMS')).snapshot).toMatchObject({
        recipients: [{ tenantId: second.id }],
        excluded: [{ tenantId: tenant.id, reason: 'OPTED_OUT' }],
      });
      await db.tenant.update({
        where: { id: second.id },
        data: { phone: '(500) 555-0007', email: 'bad\r\nBcc: someone' },
      });
      await expect(s.preview(actor, lease.id, 'SMS')).rejects.toMatchObject({
        code: 'NO_ELIGIBLE_RECIPIENTS',
      });
      await expect(s.preview(actor, lease.id, 'EMAIL')).rejects.toMatchObject({
        code: 'NO_ELIGIBLE_RECIPIENTS',
      });
    });

    it.each(['payment', 'contact', 'optout', 'membership', 'expired'] as const)(
      'rejects a stale %s preview before sending',
      async (change) => {
        const { lease, tenant } = await fixture();
        const transport = mock();
        const s = service(transport);
        const preview = await s.preview(actor, lease.id, 'EMAIL');
        if (change === 'payment')
          await db.payment.create({
            data: { organizationId: org, leaseId: lease.id, amount: '50', status: 'SUCCEEDED' },
          });
        if (change === 'contact')
          await db.tenant.update({
            where: { id: tenant.id },
            data: { email: `${key()}@example.invalid` },
          });
        if (change === 'optout')
          await db.tenant.update({
            where: { id: tenant.id },
            data: { emailRemindersEnabled: false },
          });
        if (change === 'membership')
          await db.leaseTenant.delete({
            where: { leaseId_tenantId: { leaseId: lease.id, tenantId: tenant.id } },
          });
        if (change === 'expired')
          await db.paymentReminderPreview.update({
            where: { id: preview.id },
            data: { expiresAt: new Date('2026-10-20') },
          });
        await expect(s.dispatch(actor, preview.id, key())).rejects.toMatchObject({
          code: 'STALE_PREVIEW',
        });
        expect(transport.send).not.toHaveBeenCalled();
      },
    );

    it('claims each recipient once under concurrent/repeated requests and keeps history after restart', async () => {
      const { lease } = await fixture();
      const transport = mock();
      const s = service(transport);
      const preview = await s.preview(actor, lease.id, 'EMAIL');
      const idempotencyKey = key();
      await Promise.all(
        Array.from({ length: 6 }, () => s.dispatch(actor, preview.id, idempotencyKey)),
      );
      expect(transport.send).toHaveBeenCalledTimes(2);
      const restartedClient = new PrismaClient();
      try {
        const restarted = service(transport, restartedClient);
        const [history] = await restarted.history(actor, lease.id);
        expect(history.attempts).toHaveLength(2);
        expect(
          history.attempts.every(
            (a) => a.status === 'MOCK_RECORDED' && !a.deliveredAt && !a.acceptedAt,
          ),
        ).toBe(true);
        await restarted.dispatch(actor, preview.id, idempotencyKey);
        expect(transport.send).toHaveBeenCalledTimes(2);
      } finally {
        await restartedClient.$disconnect();
      }
      const duplicate = await s.preview(actor, lease.id, 'EMAIL');
      await expect(s.dispatch(actor, duplicate.id, key())).rejects.toMatchObject({
        code: 'REMINDER_ALREADY_DISPATCHED',
      });
      const another = await fixture();
      const otherPreview = await s.preview(actor, another.lease.id, 'EMAIL');
      await expect(s.dispatch(actor, otherPreview.id, idempotencyKey)).rejects.toMatchObject({
        code: 'IDEMPOTENCY_KEY_REUSED',
      });
    });

    it.each(['FAILED', 'UNCERTAIN'] as const)(
      'preserves %s attempts and never resends them',
      async (status) => {
        const { lease } = await fixture();
        const send = vi.fn(async () => ({ status, errorCode: 'SYNTHETIC_FAILURE' }));
        const s = service({ name: 'test', send });
        const preview = await s.preview(actor, lease.id, 'EMAIL');
        const idempotencyKey = key();
        const result = await s.dispatch(actor, preview.id, idempotencyKey);
        expect(result.attempts.every((a) => a.status === status && !a.deliveredAt)).toBe(true);
        await s.dispatch(actor, preview.id, idempotencyKey);
        expect(send).toHaveBeenCalledTimes(2);
        if (status === 'UNCERTAIN')
          await expect(s.reconcile(actor, result.attempts[0].id)).rejects.toMatchObject({
            code: 'MANUAL_RECONCILIATION_REQUIRED',
          });
        else expect((await s.reconcile(actor, result.attempts[0].id)).status).toBe('FAILED');
        if (status === 'UNCERTAIN') {
          const tomorrow = new PaymentReminders(
            db,
            async () => ({ name: 'test', send }),
            () => new Date('2026-10-22T12:00:00Z'),
          );
          const newPreview = await tomorrow.preview(actor, lease.id, 'EMAIL');
          await expect(tomorrow.dispatch(actor, newPreview.id, key())).rejects.toMatchObject({
            code: 'UNRESOLVED_DISPATCH',
          });
          expect(send).toHaveBeenCalledTimes(2);
        }
      },
    );

    it('includes ended arrears, rejects fully paid balances and fails closed without reserving when unconfigured', async () => {
      const { lease } = await fixture();
      await db.lease.update({ where: { id: lease.id }, data: { status: 'ENDED' } });
      const s = service();
      const p = await s.preview(actor, lease.id, 'EMAIL');
      const unavailable = new PaymentReminders(
        db,
        async () => {
          throw new Error('unconfigured');
        },
        clock,
      );
      await expect(unavailable.dispatch(actor, p.id, key())).rejects.toThrow('unconfigured');
      expect(await db.paymentReminderAttempt.count({ where: { previewId: p.id } })).toBe(0);
      await db.payment.create({
        data: { organizationId: org, leaseId: lease.id, amount: '850', status: 'SUCCEEDED' },
      });
      await expect(s.preview(actor, lease.id, 'EMAIL')).rejects.toMatchObject({
        code: 'NOT_OVERDUE',
      });
    });

    it('resumes only READY attempts after a crash and cancels them if the provider changed', async () => {
      const { lease, tenant } = await fixture();
      const p = await service().preview(actor, lease.id, 'EMAIL');
      const idempotencyKey = key();
      await db.paymentReminderPreview.update({
        where: { id: p.id },
        data: {
          dispatchedAt: now,
          idempotencyKey,
          attempts: {
            create: {
              tenantId: tenant.id,
              recipient: tenant.email!,
              subject: 'Synthetic',
              body: 'Synthetic',
              provider: 'mock',
            },
          },
        },
      });
      const send = vi.fn(async () => ({ status: 'ACCEPTED' as const }));
      const s = service({ name: 'smtp', send });
      const result = await s.dispatch(actor, p.id, idempotencyKey);
      expect(result.attempts[0].status).toBe('CANCELLED');
      expect(send).not.toHaveBeenCalled();
    });

    it('reconciles acceptance to delivery, preserves terminal observations, and marks orphaned SENDING uncertain', async () => {
      const { lease } = await fixture();
      const s = service({
        name: 'test',
        send: async (m) => ({ status: 'ACCEPTED', providerId: m.id }),
        reconcile: async (id) => ({ status: 'DELIVERED', providerId: id }),
      });
      const preview = await s.preview(actor, lease.id, 'SMS');
      const result = await s.dispatch(actor, preview.id, key());
      const attempt = result.attempts[0];
      expect(attempt.status).toBe('ACCEPTED');
      expect(attempt.deliveredAt).toBeNull();
      expect((await s.reconcile(actor, attempt.id)).status).toBe('DELIVERED');
      await s.applyResult(attempt.id, { status: 'ACCEPTED' });
      expect(
        (await db.paymentReminderAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).status,
      ).toBe('DELIVERED');
      await db.paymentReminderAttempt.update({
        where: { id: result.attempts[1].id },
        data: { status: 'SENDING', startedAt: new Date('2026-10-21T11:00:00Z') },
      });
      expect(
        (await s.history(actor, lease.id))[0].attempts.some((a) => a.status === 'UNCERTAIN'),
      ).toBe(true);
    });
  },
);
