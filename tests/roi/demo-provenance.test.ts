import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { analysisService } from '@/lib/analysis/service';
import { PayloadSchema } from '@/lib/analysis/contract';
import {
  demoValuesAfterPatch,
  parseRoiInputs,
  readPropertyRoiInputs,
  roiStorage,
  type PropertyRoiInputs,
} from '@/lib/properties/roi-inputs';
import {
  backfillDemoValues,
  seedDemoValues,
  seedRoiInputs,
  seedRoiInputsVersion,
} from '../../prisma/seed-roi-inputs';

const maple = seedRoiInputs()[0];
const rent = 'input.income.monthlyRent';
const tax = 'input.expenses.propertyTax';
const vacancy = 'input.income.vacancyRate';
const provenance = { label: seedRoiInputsVersion, values: seedDemoValues(maple.inputs) };
const stored = (patch?: PropertyRoiInputs) => {
  const first = (roiStorage(null, maple.inputs) as { roiInputs: unknown }).roiInputs;
  return patch ? (roiStorage(first, patch) as { roiInputs: unknown }).roiInputs : first;
};
const parsed = (raw: unknown) => {
  const result = parseRoiInputs(raw);
  if (!result.success || !result.data) throw Error('parse');
  return result.data;
};
const customized: PropertyRoiInputs = {
  version: 1,
  input: { income: { monthlyRent: 24000 } },
  options: {},
  cleared: [tax],
};

function draftFor(roiInputs: unknown, roiProvenance: unknown) {
  const row = {
    id: maple.id,
    name: maple.name,
    street: maple.street,
    city: 'Austin',
    state: 'TX',
    postalCode: '78704',
    purchasePrice: 2830000,
    loanAmount: 1980000,
    downPayment: 850000,
    annualDebtService: 36000,
    roiInputs,
    roiProvenance,
    units: [],
    expenses: [],
  };
  const db = { property: { findFirst: async () => row } } as unknown as PrismaClient;
  return analysisService({ organizationId: 'seed-rocket-rental', role: 'MANAGER' }, db).loadDraft(
    maple.id,
    new Date('2026-10-20T00:00:00Z'),
  );
}

describe('fictional demo provenance', () => {
  it('records every demo value except canonical price/debt', () => {
    expect(provenance.values).toMatchObject({ [rent]: 23000, 'options.discountRate': 0.08 });
    expect(provenance.values).not.toHaveProperty('input.purchase.purchasePrice');
    expect(provenance.values).not.toHaveProperty('input.financing.loanAmount');
  });

  it('cannot be submitted through customer ROI input', () => {
    const raw = JSON.stringify({
      version: 1,
      input: {},
      options: {},
      demo: { label: 'x', paths: [rent] },
    });
    expect(parseRoiInputs(raw).success).toBe(false);
  });

  it('labels only values still equal to the recorded demo value and not cleared', () => {
    const all = readPropertyRoiInputs({
      roiInputs: stored(),
      purchasePrice: 2830000,
      loanAmount: 1980000,
      roiProvenance: provenance,
    });
    expect(all.demo).toEqual({
      label: seedRoiInputsVersion,
      paths: Object.keys(provenance.values).sort(),
    });
    const edited = readPropertyRoiInputs({
      roiInputs: stored(customized),
      purchasePrice: 2830000,
      loanAmount: 1980000,
      roiProvenance: provenance,
    });
    expect(edited.input.income?.monthlyRent).toBe(24000);
    expect(edited.input.income?.vacancyRate).toBe(5);
    expect(edited.demo!.paths).not.toContain(rent);
    expect(edited.demo!.paths).not.toContain(tax);
    expect(edited.demo!.paths).toContain(vacancy);
    expect(
      readPropertyRoiInputs({ roiInputs: stored(), purchasePrice: 1, loanAmount: 0 }).demo,
    ).toBeUndefined();
  });

  it('releases supplied or cleared values even when re-entered unchanged', () => {
    const remaining = demoValuesAfterPatch(provenance, {
      version: 1,
      input: { income: { monthlyRent: 23000 } },
      options: {},
      cleared: [tax],
    });
    expect(remaining).not.toHaveProperty(rent);
    expect(remaining).not.toHaveProperty(tax);
    expect(remaining).toHaveProperty(vacancy, 5);
  });

  it('backfills only unchanged, uncleared values without changing inputs', () => {
    expect(backfillDemoValues(parsed(stored()), maple.inputs)).toEqual(provenance.values);
    const values = backfillDemoValues(parsed(stored(customized)), maple.inputs);
    expect(values).not.toHaveProperty(rent);
    expect(values).not.toHaveProperty(tax);
    expect(values).toHaveProperty('options.startDate');
  });

  it('marks draft evidence for demo values only and survives the saved payload contract', async () => {
    const draft = await draftFor(stored(customized), provenance);
    if (!draft.ok) throw Error(draft.code);
    const latest = (path: string) =>
      draft.data.payload.evidence.filter((e) => e.path === path).at(-1);
    expect(latest(vacancy)).toMatchObject({ demo: seedRoiInputsVersion });
    expect(latest(vacancy)!.note).toMatch(/Fictional demo assumption/);
    expect(latest(rent)!.demo).toBeUndefined();
    expect(latest(tax)).toBeUndefined();
    expect(latest('input.purchase.purchasePrice')!.demo).toBeUndefined();
    expect(PayloadSchema.safeParse(draft.data.payload).success).toBe(true);
  });

  it('leaves non-demo properties unlabeled', async () => {
    const plain = (
      roiStorage(null, { version: 1, input: { income: { monthlyRent: 2345 } }, options: {} }) as {
        roiInputs: unknown;
      }
    ).roiInputs;
    const draft = await draftFor(plain, null);
    if (!draft.ok) throw Error(draft.code);
    expect(draft.data.payload.evidence.some((e) => e.demo)).toBe(false);
  });
});
