import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { parsePropertyInput } from '../../src/lib/properties/validation';
import { parseRoiInputs, type PropertyRoiInputs } from '../../src/lib/properties/roi-inputs';
import { propertiesDb } from '../../src/lib/properties/data';
import { analysisService } from '../../src/lib/analysis/service';
import { calculatePayload } from '../../src/lib/analysis/contract';
import { payload } from './fixture';

const basic = {
  name: 'Optional inputs home',
  type: 'SINGLE_UNIT',
  street: '1 Test',
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
};
function parsed(roiInputs?: unknown) {
  const result = parsePropertyInput({
    ...basic,
    ...(roiInputs === undefined ? {} : { roiInputs }),
  });
  if (!result.ok) throw Error(JSON.stringify(result.errors));
  return result.data;
}
function source(): PropertyRoiInputs {
  const p = payload();
  const { purchase, financing, income, expenses, appreciationExit } = p.input;
  return {
    version: 1,
    input: {
      purchase,
      financing: { ...financing, loanAmount: 0 },
      income,
      expenses,
      appreciationExit,
    },
    options: p.options,
  };
}
describe('optional property ROI parsing', () => {
  it('accepts absent, partial, zero and sufficient inputs without defaults', () => {
    expect(parsed().roiInputs).toBeUndefined();
    expect(parsed('').roiInputs).toBeUndefined();
    const partial = { version: 1, input: { income: { monthlyRent: 0 } }, options: {} };
    expect(parsed(JSON.stringify(partial)).roiInputs).toEqual(partial);
    expect(parsed(source()).roiInputs).toEqual(source());
  });
  it.each([
    { version: 2, input: {}, options: {} },
    { version: 1, input: { financing: { interestRate: -1 } }, options: {} },
    { version: 1, input: { financing: { loanTermYears: 0 } }, options: {} },
    { version: 1, input: { purchase: { purchasePrice: 1.234 } }, options: {} },
    { version: 1, input: { income: { monthlyRent: null } }, options: {} },
    { version: 1, input: { income: { monthlyRent: '10' } }, options: {} },
    { version: 1, input: { expenses: { insurance: Infinity } }, options: {} },
    { version: 1, input: { propertyId: 'forged' }, options: {} },
    { version: 1, input: { income: { invented: 1 } }, options: {} },
    { version: 1, input: {}, options: { startDate: 'not a date' } },
    '{invalid',
  ])('rejects invalid supplied values: %j', (value) => {
    expect(parseRoiInputs(value).success).toBe(false);
  });
});

describe.skipIf(process.env.RUN_ANALYSIS_DB !== '1')('property ROI database round trips', () => {
  const db = new PrismaClient();
  const properties = propertiesDb('roi-input-a', db);
  const analysis = analysisService({ organizationId: 'roi-input-a', role: 'MANAGER' }, db);
  const foreign = propertiesDb('roi-input-b', db);
  beforeAll(async () => {
    await db.organization.createMany({
      data: [
        { id: 'roi-input-a', name: 'A' },
        { id: 'roi-input-b', name: 'B' },
      ],
    });
  });
  afterAll(async () => {
    await db.$disconnect();
  });
  async function create(value?: unknown) {
    const result = await properties.createProperty(parsed(value));
    if (!result.ok) throw Error('create failed');
    return result.id;
  }
  it('creates no-data properties, reloads unknowns, and upgrades an existing property with partial values', async () => {
    const id = await create();
    const row = await db.property.findUniqueOrThrow({ where: { id } });
    expect(row.roiInputs).toBeNull();
    expect(row.purchasePrice).toBeNull();
    const initial = await analysis.loadDraft(id);
    expect(initial.ok && initial.data.payload.input.purchase).toEqual({});
    expect(initial.ok && initial.data.payload.input.income).toEqual({});
    expect(initial.ok && initial.data.missing.length).toBeGreaterThan(0);
    const partial = {
      version: 1,
      input: { income: { monthlyRent: 0 }, expenses: { capex: 0 } },
      options: {},
    };
    const partialId = await create(partial);
    const partialDraft = await analysis.loadDraft(partialId);
    expect(partialDraft.ok && partialDraft.data.payload.input.income).toEqual({ monthlyRent: 0 });
    expect(partialDraft.ok && partialDraft.data.missing.length).toBeGreaterThan(0);
    expect(await properties.updateProperty(id, parsed(partial))).toEqual({ ok: true, id });
    const draft = await analysis.loadDraft(id);
    expect(draft.ok && draft.data.payload.input.income).toEqual({ monthlyRent: 0 });
    expect(draft.ok && draft.data.payload.input.expenses).toEqual({ capex: 0 });
    expect(draft.ok && draft.data.payload.input.financing).toEqual({});
    expect(draft.ok && draft.data.payload.evidence).toContainEqual(
      expect.objectContaining({ path: 'input.expenses.capex', source: 'property', sourceId: id }),
    );
    expect((await properties.getProperty(id))?.roiInputs.input.income).toEqual({ monthlyRent: 0 });
    await properties.updateProperty(id, parsed());
    expect((await properties.getProperty(id))?.roiInputs.input.income).toEqual({ monthlyRent: 0 });
  });
  it('calculates sufficient all-cash inputs; preserves saved edits across property updates and denies foreign access', async () => {
    const id = await create(source());
    const row = await db.property.findUniqueOrThrow({ where: { id } });
    expect(Number(row.purchasePrice)).toBe(100000);
    expect(Number(row.loanAmount)).toBe(0);
    expect(row.roiInputs).not.toHaveProperty('input.purchase.purchasePrice');
    const draft = await analysis.loadDraft(id);
    if (!draft.ok) throw Error('draft failed');
    expect(draft.data.missing).toEqual([]);
    expect(calculatePayload(draft.data.payload).base.summaryMetrics.noi).toBe(10800);
    draft.data.payload.input.income!.monthlyRent = 0;
    expect(
      (
        await analysis.save({
          propertyId: id,
          expectedRevision: 0,
          status: 'READY',
          payload: draft.data.payload,
        })
      ).ok,
    ).toBe(true);
    const before = await analysis.loadSaved(id);
    await properties.updateProperty(
      id,
      parsed({ version: 1, input: { income: { monthlyRent: 2000 } }, options: {} }),
    );
    expect(await analysis.loadSaved(id)).toEqual(before);
    const fresh = await analysis.loadDraft(id);
    expect(fresh.ok && fresh.data.payload.input.income?.monthlyRent).toBe(2000);
    expect(fresh.ok && fresh.data.payload.input.expenses?.insurance).toBe(0);
    expect(await foreign.getProperty(id)).toBeNull();
    expect((await foreign.updateProperty(id, parsed(source()))).ok).toBe(false);
    const denied = analysisService({ organizationId: 'roi-input-b', role: 'MANAGER' }, db);
    expect(await denied.loadDraft(id)).toEqual({ ok: false, code: 'NOT_FOUND' });
  });
  it('preserves concurrent sibling patches and respects canonical financial facts', async () => {
    const id = await create(source());
    await Promise.all([
      properties.updateProperty(
        id,
        parsed({ version: 1, input: { expenses: { insurance: 123 } }, options: {} }),
      ),
      properties.updateProperty(
        id,
        parsed({ version: 1, input: { income: { otherMonthlyIncome: 25 } }, options: {} }),
      ),
    ]);
    const detail = await properties.getProperty(id);
    expect(detail?.roiInputs.input.expenses?.insurance).toBe(123);
    expect(detail?.roiInputs.input.income?.otherMonthlyIncome).toBe(25);
    await db.property.update({ where: { id }, data: { purchasePrice: 110000, loanAmount: 0 } });
    const draft = await analysis.loadDraft(id);
    expect(draft.ok && draft.data.payload.input.purchase?.purchasePrice).toBe(110000);
    expect(draft.ok && draft.data.payload.input.financing?.loanAmount).toBe(0);
  });
  it('loads sufficient financed inputs and gives explicit forecast zero precedence over active leases', async () => {
    const financed = source();
    financed.input.financing = {
      ...financed.input.financing,
      loanAmount: 60000,
      downPaymentPercent: 40,
      interestRate: 5,
    };
    const id = await create(financed);
    const unit = await db.unit.findFirstOrThrow({
      where: { propertyId: id, organizationId: 'roi-input-a' },
    });
    await db.lease.create({
      data: {
        organizationId: 'roi-input-a',
        unitId: unit.id,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        monthlyRent: 1800,
        deposit: 0,
        status: 'ACTIVE',
      },
    });
    let draft = await analysis.loadDraft(id, new Date('2026-06-01'));
    if (!draft.ok) throw Error('draft failed');
    expect(draft.data.missing).toEqual([]);
    expect(calculatePayload(draft.data.payload).base.summaryMetrics.annualCashFlow).toBeLessThan(
      10800,
    );
    await properties.updateProperty(
      id,
      parsed({ version: 1, input: { income: { monthlyRent: 0 } }, options: {} }),
    );
    draft = await analysis.loadDraft(id, new Date('2026-06-01'));
    if (!draft.ok) throw Error('draft failed');
    expect(draft.data.facts.scheduledMonthlyRent).toBe(1800);
    expect(draft.data.payload.input.income?.monthlyRent).toBe(0);
    expect(
      draft.data.payload.evidence
        .filter((e) => e.path === 'input.income.monthlyRent')
        .map((e) => e.source),
    ).toEqual(['property']);
    expect((await properties.getProperty(id))?.roiInputs.input.financing?.loanAmount).toBe(60000);
  });
});
