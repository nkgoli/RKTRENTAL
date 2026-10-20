import type { PrismaClient } from '@prisma/client';
import { ENGINE_ID, calculatePayload, type AnalysisPayload } from '../src/lib/analysis/contract';
import { analysisService } from '../src/lib/analysis/service';

export const demoOrganizationId = 'seed-rocket-rental';
export function roiExamples(): AnalysisPayload[] {
  return [
    { slug: 'financed', name: 'Financed Rental', price: 240000, loan: 180000, rent: 2200, rate: 6 },
    { slug: 'cash', name: 'Cash Purchase', price: 180000, loan: 0, rent: 1600, rate: 0 },
    { slug: 'tight', name: 'Tight Cash Flow', price: 280000, loan: 224000, rent: 1900, rate: 7 },
  ].map((example) => {
    const propertyId = `demo-roi-v1-${example.slug}`;
    const result: AnalysisPayload = {
      version: 1,
      engineId: ENGINE_ID,
      propertyId,
      input: {
        schemaVersion: 1,
        propertyId,
        propertyInfo: {
          name: `Fictional Demo — ${example.name}`,
          address: '1 Fictional Example Lane',
          city: 'Demo City',
          state: 'TX',
          zipCode: '00000',
        },
        purchase: {
          purchasePrice: example.price,
          closingCosts: example.price * 0.02,
          rehabCosts: 5000,
          furnishingCosts: 0,
          acquisitionDate: '2026-01-01T00:00:00.000Z',
        },
        financing: {
          loanAmount: example.loan,
          downPaymentPercent: (1 - example.loan / example.price) * 100,
          interestRate: example.rate,
          loanTermYears: 30,
          amortizationYears: 30,
          loanType: 'conventional',
          pointsPaid: 0,
          lenderFees: 0,
        },
        income: {
          monthlyRent: example.rent,
          otherMonthlyIncome: 50,
          vacancyRate: 5,
          annualRentGrowth: 2,
        },
        expenses: {
          propertyTax: 2400,
          insurance: 1200,
          hoaMonthly: 0,
          maintenancePercent: 5,
          capexPercent: 5,
          propertyManagementPercent: 8,
          utilitiesMonthly: 50,
          leasingCosts: 300,
          otherExpenses: 200,
          annualExpenseGrowth: 2,
        },
        appreciationExit: { annualAppreciation: 2, holdingPeriodYears: 10, sellingCostsPercent: 6 },
      },
      options: { discountRate: 0.08, startDate: '2026-01-01T00:00:00.000Z' },
      evidence: [],
      scenarios: [],
      benchmarks: [],
    };
    for (const [section, fields] of Object.entries(result.input)) {
      if (fields && typeof fields === 'object')
        for (const field of Object.keys(fields))
          result.evidence.push({
            path: `input.${section}.${field}`,
            source: 'manager',
            observedAt: '2026-10-19T00:00:00.000Z',
            note: 'Fictional/demo v1 assumption; wholly synthetic, not observed market or property data. Whole-property budget.',
          });
    }
    for (const field of ['discountRate', 'startDate'])
      result.evidence.push({
        path: `options.${field}`,
        source: 'manager',
        observedAt: '2026-10-19T00:00:00.000Z',
        note: 'Explicit fictional/demo calculation option; tax analysis omitted.',
      });
    calculatePayload(result);
    return result;
  });
}

/** Additive companion to demo:seed. Never resets, updates existing properties or replaces analyses. */
export async function loadRoiExamples(db: PrismaClient) {
  await db.organization.findUniqueOrThrow({ where: { id: demoOrganizationId } });
  const service = analysisService({ organizationId: demoOrganizationId, role: 'MANAGER' }, db);
  const outcomes = [];
  for (const payload of roiExamples()) {
    const info = payload.input.propertyInfo!;
    await db.$transaction(async (tx) => {
      const existing = await tx.property.findUnique({ where: { id: payload.propertyId } });
      if (
        existing &&
        (existing.organizationId !== demoOrganizationId ||
          existing.name !== info.name ||
          existing.archivedAt)
      )
        throw Error(`Demo identifier collision: ${payload.propertyId}`);
      const unit = await tx.unit.findUnique({ where: { id: `${payload.propertyId}-unit` } });
      if (
        unit &&
        (unit.organizationId !== demoOrganizationId || unit.propertyId !== payload.propertyId)
      )
        throw Error(`Demo unit identifier collision: ${payload.propertyId}`);
      await tx.property.createMany({
        skipDuplicates: true,
        data: [
          {
            id: payload.propertyId,
            organizationId: demoOrganizationId,
            name: info.name!,
            street: info.address!,
            city: info.city!,
            state: info.state!,
            postalCode: info.zipCode!,
            type: 'SINGLE_UNIT',
            purchasePrice: payload.input.purchase!.purchasePrice,
            loanAmount: payload.input.financing!.loanAmount,
            downPayment:
              payload.input.purchase!.purchasePrice! - payload.input.financing!.loanAmount!,
          },
        ],
      });
      await tx.unit.createMany({
        skipDuplicates: true,
        data: [
          {
            id: `${payload.propertyId}-unit`,
            organizationId: demoOrganizationId,
            propertyId: payload.propertyId,
            number: 'Demo 1',
            listedRent: payload.input.income!.monthlyRent,
            status: 'VACANT',
          },
        ],
      });
    });
    const saved = await service.loadSaved(payload.propertyId);
    if (!saved.ok) throw Error(JSON.stringify(saved));
    if (saved.data) {
      outcomes.push({ propertyId: payload.propertyId, outcome: 'preserved' });
      continue;
    }
    const created = await service.save({
      propertyId: payload.propertyId,
      expectedRevision: 0,
      status: 'READY',
      payload,
    });
    if (!created.ok && created.code !== 'CONFLICT') throw Error(JSON.stringify(created));
    outcomes.push({
      propertyId: payload.propertyId,
      outcome: created.ok ? 'created' : 'preserved',
    });
  }
  return outcomes;
}
