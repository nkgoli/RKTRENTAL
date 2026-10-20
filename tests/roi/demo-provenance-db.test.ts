import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { propertiesDb } from '../../src/lib/properties/data';
import { analysisService } from '../../src/lib/analysis/service';
import { loadSeedRoiInputs, seedRoiInputs } from '../../prisma/seed-roi-inputs';
import { demoOrganizationId } from '../../prisma/roi-examples';

// Run through tests/analysis/property-inputs-runtime.mjs (isolated embedded PostgreSQL only).
describe.skipIf(process.env.RUN_ANALYSIS_DB !== '1')('demo provenance persistence', () => {
  const db = new PrismaClient();
  const [maple, harbor, cedar, elm] = seedRoiInputs();
  const read = (id: string) =>
    db.property.findUniqueOrThrow({ where: { id }, include: { roiProvenance: true } });
  beforeAll(async () => {
    await db.organization.create({ data: { id: demoOrganizationId, name: 'Demo' } });
    for (const demo of [maple, harbor, cedar, elm])
      await db.property.create({
        data: {
          id: demo.id,
          organizationId: demoOrganizationId,
          name: demo.name,
          street: demo.street,
          city: 'Austin',
          state: 'TX',
          postalCode: '78704',
          type: 'MULTI_UNIT',
          purchasePrice: 400000,
          loanAmount: 300000,
        },
      });
    // Harbor was already populated (as on the live demo) and its rent customized since.
    await db.property.update({
      where: { id: harbor.id },
      data: {
        roiInputs: {
          ...(JSON.parse(JSON.stringify(harbor.inputs)) as object),
          input: {
            ...(JSON.parse(JSON.stringify(harbor.inputs.input)) as object),
            income: { ...harbor.inputs.input.income, monthlyRent: 45000 },
          },
        },
      },
    });
    // Cedar holds a genuine customer entry unrelated to the dataset.
    await db.property.update({
      where: { id: cedar.id },
      data: { roiInputs: { version: 1, input: { income: { monthlyRent: 9999 } }, options: {} } },
    });
    await db.property.update({ where: { id: elm.id }, data: { name: 'Renamed by customer' } });
  });
  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: demoOrganizationId } });
    await db.$disconnect();
  });

  it('populates, backfills unchanged values only and never rewrites inputs', async () => {
    const harborBefore = (await read(harbor.id)).roiInputs;
    const cedarBefore = (await read(cedar.id)).roiInputs;
    const outcomes = await loadSeedRoiInputs(db);
    expect(outcomes.map((o) => o.outcome)).toEqual([
      'populated seed-roi-inputs-v1',
      expect.stringMatching(/^provenance added for \d+ unchanged demo values$/),
      'preserved: customized ROI inputs',
      'skipped: not the unmodified seed record',
    ]);
    const h = await read(harbor.id);
    expect(h.roiInputs).toEqual(harborBefore);
    expect(h.roiProvenance!.values).not.toHaveProperty('input.income.monthlyRent');
    expect(h.roiProvenance!.values).toHaveProperty('input.income.vacancyRate', 5);
    const c = await read(cedar.id);
    expect(c.roiInputs).toEqual(cedarBefore);
    expect(c.roiProvenance).toBeNull();
    expect((await read(elm.id)).roiInputs).toBeNull();
    expect((await loadSeedRoiInputs(db))[0].outcome).toBe(
      'preserved: existing ROI inputs and provenance',
    );
  });

  it('releases demo labels for customer edits and clears in the same transaction', async () => {
    const properties = propertiesDb(demoOrganizationId, db);
    const result = await properties.updateRoiInputs(maple.id, {
      version: 1,
      input: { income: { monthlyRent: 23000 } },
      options: {},
      cleared: ['input.expenses.propertyTax'],
    });
    expect(result.ok).toBe(true);
    const m = await read(maple.id);
    expect(m.roiProvenance!.values).not.toHaveProperty('input.income.monthlyRent');
    expect(m.roiProvenance!.values).not.toHaveProperty('input.expenses.propertyTax');
    const detail = await properties.getProperty(maple.id);
    expect(detail!.roiInputs.demo!.paths).toContain('input.income.vacancyRate');
    expect(detail!.roiInputs.demo!.paths).not.toContain('input.income.monthlyRent');
    const draft = await analysisService(
      { organizationId: demoOrganizationId, role: 'MANAGER' },
      db,
    ).loadDraft(maple.id);
    if (!draft.ok) throw Error(draft.code);
    const latest = (path: string) =>
      draft.data.payload.evidence.filter((e) => e.path === path).at(-1);
    expect(latest('input.income.vacancyRate')!.demo).toBe('seed-roi-inputs-v1');
    expect(latest('input.income.monthlyRent')!.demo).toBeUndefined();
  });
});
