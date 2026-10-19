import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { analysisService } from '../../src/lib/analysis/service';
import { calculatePayload } from '../../src/lib/analysis/contract';
import { payload } from './fixture';

describe.skipIf(process.env.RUN_ANALYSIS_DB !== '1')(
  'isolated analysis persistence and authorization',
  () => {
    const db = new PrismaClient();
    const a = analysisService({ organizationId: 'analysis-a', role: 'MANAGER' }, db);
    const b = analysisService({ organizationId: 'analysis-b', role: 'MANAGER' }, db);
    beforeAll(async () => {
      await db.organization.createMany({
        data: [
          { id: 'analysis-a', name: 'A' },
          { id: 'analysis-b', name: 'B' },
        ],
      });
      for (const [id, organizationId] of [
        ['property-a', 'analysis-a'],
        ['property-b', 'analysis-b'],
        ['property-c', 'analysis-a'],
      ]) {
        await db.property.create({
          data: {
            id,
            organizationId,
            name: id,
            type: 'MULTI_UNIT',
            street: '1 Test',
            city: 'Austin',
            state: 'TX',
            postalCode: '78701',
            ...(id === 'property-a'
              ? {
                  purchasePrice: '123456.78',
                  loanAmount: '60000.25',
                  downPayment: '63456.53',
                  annualDebtService: '7200.12',
                }
              : {}),
          },
        });
      }
      await db.unit.create({
        data: {
          id: 'unit-a',
          organizationId: 'analysis-a',
          propertyId: 'property-a',
          number: '1',
          bathrooms: '1.5',
          marketRent: '1900.75',
        },
      });
      await db.lease.create({
        data: {
          id: 'lease-a',
          organizationId: 'analysis-a',
          unitId: 'unit-a',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          monthlyRent: '1850.25',
          deposit: '1000',
          status: 'ACTIVE',
        },
      });
      await db.payment.create({
        data: {
          organizationId: 'analysis-a',
          leaseId: 'lease-a',
          amount: '99999',
          status: 'SUCCEEDED',
          paidAt: new Date('2026-06-01'),
        },
      });
      await db.expense.create({
        data: {
          id: 'expense-a',
          organizationId: 'analysis-a',
          propertyId: 'property-a',
          category: 'UTILITIES',
          amount: '123.45',
          occurredOn: new Date('2026-06-01'),
        },
      });
    });
    afterAll(async () => {
      await db.$disconnect();
    });
    it('queries only authorized property/unit facts and converts Decimal currency without cents scaling', async () => {
      const selection = await a.selection();
      expect(selection.ok && selection.data.map((p) => p.id)).toEqual(['property-a', 'property-c']);
      if (!selection.ok) throw Error('selection failed');
      expect(selection.data[0].units[0]).toMatchObject({ bathrooms: 1.5, marketRent: 1900.75 });
      const draft = await a.loadDraft('property-a', new Date('2026-06-15T00:00:00Z'));
      if (!draft.ok) throw Error('draft failed');
      expect(draft.data.payload.input.purchase).toEqual({ purchasePrice: 123456.78 });
      expect(draft.data.payload.input.financing).toEqual({ loanAmount: 60000.25 });
      expect(draft.data.payload.input.income).toEqual({ monthlyRent: 1850.25 });
      expect(draft.data.payload.input.expenses).toBeUndefined();
      expect(draft.data.facts.expenses[0].amount).toBe(123.45);
      expect(draft.data.payload.evidence.some((e) => e.sourceId === 'lease-a')).toBe(true);
      expect(draft.data.missing.length).toBeGreaterThan(0);
      // No recorded property price/debt/lease fact mutation occurred.
      expect(
        (
          await db.property.findUniqueOrThrow({ where: { id: 'property-a' } })
        ).purchasePrice?.toString(),
      ).toBe('123456.78');
    });
    it('denies foreign organization, unknown/forged IDs and non-manager sessions', async () => {
      expect(await b.loadDraft('property-a')).toEqual({ ok: false, code: 'NOT_FOUND' });
      expect(await b.loadSaved('property-a')).toEqual({ ok: false, code: 'NOT_FOUND' });
      expect(
        await b.save({
          propertyId: 'property-a',
          expectedRevision: 0,
          status: 'READY',
          payload: payload(),
        }),
      ).toEqual({ ok: false, code: 'NOT_FOUND' });
      expect(await a.loadDraft('forged')).toEqual({ ok: false, code: 'NOT_FOUND' });
      for (const role of ['TENANT', 'OWNER', 'ADMIN'] as const) {
        const denied = analysisService({ organizationId: 'analysis-a', role }, db);
        expect(await denied.selection()).toEqual({ ok: false, code: 'FORBIDDEN' });
        expect(await denied.save({})).toEqual({ ok: false, code: 'FORBIDDEN' });
      }
      await expect(
        db.roiAnalysisState.create({
          data: {
            organizationId: 'analysis-b',
            propertyId: 'property-a',
            status: 'DRAFT',
            payload: {},
          },
        }),
      ).rejects.toThrow();
    });
    it('saves/reloads calculable state, options, evidence, named scenarios and comparisons', async () => {
      const saved = await a.save({
        propertyId: 'property-a',
        expectedRevision: 0,
        status: 'READY',
        payload: payload(),
      });
      expect(saved.ok).toBe(true);
      const loaded = await a.loadSaved('property-a');
      if (!loaded.ok || !loaded.data) throw Error('load failed');
      expect(loaded.data.revision).toBe(1);
      expect(loaded.data.payload).toEqual(payload());
      expect(loaded.data.createdAt).not.toBe(loaded.data.payload.options.startDate);
      expect(calculatePayload(loaded.data.payload).base.summaryMetrics.noi).toBe(10800);
      expect(await a.loadSaved('property-c')).toEqual({ ok: true, data: null });
      expect(
        (await db.lease.findUniqueOrThrow({ where: { id: 'lease-a' } })).monthlyRent.toString(),
      ).toBe('1850.25');
      expect(
        (await db.expense.findUniqueOrThrow({ where: { id: 'expense-a' } })).amount.toString(),
      ).toBe('123.45');
      const switched = await a.loadDraft('property-c');
      expect(switched.ok && switched.data.payload.input.purchase).toEqual({});
      expect(
        await a.save({
          propertyId: 'property-c',
          expectedRevision: 0,
          status: 'READY',
          payload: payload(),
        }),
      ).toMatchObject({ ok: false, code: 'INVALID' });
    });
    it('rejects duplicate create, stale revisions and concurrent lost updates', async () => {
      expect(
        await a.save({
          propertyId: 'property-a',
          expectedRevision: 0,
          status: 'READY',
          payload: payload(),
        }),
      ).toMatchObject({ ok: false, code: 'CONFLICT', currentRevision: 1 });
      const results = await Promise.all(
        [1, 2].map(() =>
          a.save({
            propertyId: 'property-a',
            expectedRevision: 1,
            status: 'READY',
            payload: payload(),
          }),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({ code: 'CONFLICT', currentRevision: 2 });
      expect(
        await a.save({
          propertyId: 'property-a',
          expectedRevision: 1,
          status: 'READY',
          payload: payload(),
        }),
      ).toMatchObject({ code: 'CONFLICT', currentRevision: 2 });
    });
    it('separates resumable incomplete drafts from calculable state', async () => {
      const draft = await a.loadDraft('property-c');
      if (!draft.ok) throw Error('draft failed');
      const request = {
        propertyId: 'property-c',
        expectedRevision: 0,
        status: 'READY',
        payload: draft.data.payload,
      };
      expect(await a.save(request)).toMatchObject({ ok: false, code: 'MISSING_DATA' });
      expect(await a.save({ ...request, status: 'DRAFT' })).toMatchObject({
        ok: true,
        data: { status: 'DRAFT', revision: 1 },
      });
      const loaded = await a.loadSaved('property-c');
      expect(loaded.ok && loaded.data?.missing.length).toBeGreaterThan(0);
      const invalid = payload();
      invalid.scenarios[0].overrides = { financing: { loanAmount: 200000 } };
      expect(
        await a.save({
          propertyId: 'property-a',
          expectedRevision: 2,
          status: 'READY',
          payload: invalid,
        }),
      ).toMatchObject({ ok: false, code: 'INVALID' });
    });
    it('does not infer vacancy rents and includes a lease on its UTC end date', async () => {
      const ending = await a.loadDraft('property-a', new Date('2026-12-31T23:59:59Z'));
      expect(ending.ok && ending.data.payload.input.income?.monthlyRent).toBe(1850.25);
      await db.unit.create({
        data: {
          id: 'vacant-a',
          organizationId: 'analysis-a',
          propertyId: 'property-a',
          number: '2',
          listedRent: 2000,
        },
      });
      const vacant = await a.loadDraft('property-a', new Date('2026-06-01T00:00:00Z'));
      expect(vacant.ok && vacant.data.payload.input.income?.monthlyRent).toBeUndefined();
    });
  },
);
