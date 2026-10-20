import { Prisma, type PrismaClient } from '@prisma/client';
import {
  parseRoiInputs,
  roiStorage,
  type PropertyRoiInputs,
} from '../src/lib/properties/roi-inputs';
import { demoOrganizationId } from './roi-examples';

/**
 * Fictional/demo v1 forecast assumptions for the four prisma/seed.ts properties.
 * Wholly synthetic, not observed market or property data. Whole-property budgets;
 * monthly rent is the sum of the seed's fictional unit rents. Price and debt are
 * the seed's canonical columns and are never rewritten here.
 */
const seedProperties = [
  {
    id: 'seed-property-maple',
    name: 'Maple Court',
    street: '214 Maple Ave',
    rent: 23000,
    tax: 52000,
    insurance: 14000,
    rate: 6.5,
  },
  {
    id: 'seed-property-harbor',
    name: 'Harbor View Lofts',
    street: '80 Harbor St',
    rent: 42490,
    tax: 88000,
    insurance: 24000,
    rate: 6.75,
  },
  {
    id: 'seed-property-cedar',
    name: 'Cedar Row Townhomes',
    street: '9 Cedar Row',
    rent: 13200,
    tax: 27000,
    insurance: 8000,
    rate: 6.25,
  },
  {
    id: 'seed-property-elm',
    name: '18 Elm Street',
    street: '18 Elm St',
    rent: 1690,
    tax: 7600,
    insurance: 1900,
    rate: 6.5,
  },
];

export const seedRoiInputsVersion = 'seed-roi-inputs-v1';

export function seedRoiInputs(): {
  id: string;
  name: string;
  street: string;
  inputs: PropertyRoiInputs;
}[] {
  return seedProperties.map(({ rent, tax, insurance, rate, ...identity }) => {
    const parsed = parseRoiInputs({
      version: 1,
      input: {
        purchase: { closingCosts: 25000, rehabCosts: 15000, furnishingCosts: 0 },
        financing: {
          interestRate: rate,
          loanTermYears: 30,
          amortizationYears: 30,
          loanType: 'conventional',
          pointsPaid: 0,
          lenderFees: 3500,
        },
        income: { monthlyRent: rent, otherMonthlyIncome: 0, vacancyRate: 5, annualRentGrowth: 2 },
        expenses: {
          propertyTax: tax,
          insurance,
          hoaMonthly: 0,
          maintenancePercent: 5,
          capexPercent: 5,
          propertyManagementPercent: 8,
          utilitiesMonthly: 0,
          leasingCosts: 0,
          otherExpenses: 0,
          annualExpenseGrowth: 2.5,
        },
        appreciationExit: { annualAppreciation: 3, holdingPeriodYears: 10, sellingCostsPercent: 6 },
      },
      options: { startDate: '2026-01-01T00:00:00.000Z', discountRate: 0.08 },
    });
    if (!parsed.success || !parsed.data)
      throw Error(`Invalid demo inputs: ${JSON.stringify(parsed)}`);
    return { ...identity, inputs: parsed.data };
  });
}

/**
 * Additive: fills ROI inputs only on confirmed, unedited seed properties.
 * Any existing roiInputs (customer edits or clears) and saved analyses are preserved.
 */
export async function loadSeedRoiInputs(db: PrismaClient) {
  await db.organization.findUniqueOrThrow({ where: { id: demoOrganizationId } });
  const outcomes = [];
  for (const demo of seedRoiInputs()) {
    const outcome = await db.$transaction(async (tx) => {
      // Same row lock as property edits, so a concurrent customer edit is never overwritten.
      await tx.$queryRaw`SELECT id FROM "Property" WHERE id = ${demo.id} FOR UPDATE`;
      const row = await tx.property.findUnique({ where: { id: demo.id } });
      if (!row) return 'absent';
      if (
        row.organizationId !== demoOrganizationId ||
        row.name !== demo.name ||
        row.street !== demo.street ||
        row.archivedAt
      )
        return 'skipped: not the unmodified seed record';
      if (row.roiInputs != null) return 'preserved: existing ROI inputs';
      await tx.property.updateMany({
        where: {
          id: demo.id,
          organizationId: demoOrganizationId,
          roiInputs: { equals: Prisma.DbNull },
        },
        data: roiStorage(null, demo.inputs),
      });
      return `populated ${seedRoiInputsVersion}`;
    });
    outcomes.push({ propertyId: demo.id, outcome });
  }
  return outcomes;
}
