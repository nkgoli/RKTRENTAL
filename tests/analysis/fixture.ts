import { ENGINE_ID, type AnalysisPayload } from '../../src/lib/analysis/contract';

export function payload(propertyId = 'property-a'): AnalysisPayload {
  return {
    version: 1,
    engineId: ENGINE_ID,
    propertyId,
    input: {
      propertyId,
      schemaVersion: 1,
      propertyInfo: { name: 'A', address: '', city: '', state: '', zipCode: '' },
      purchase: {
        purchasePrice: 100000,
        closingCosts: 0,
        rehabCosts: 0,
        furnishingCosts: 0,
        acquisitionDate: '2026-01-31T00:00:00.000Z',
      },
      financing: {
        downPaymentPercent: 100,
        interestRate: 0,
        loanTermYears: 30,
        loanType: 'conventional',
        pointsPaid: 0,
        lenderFees: 0,
      },
      income: { monthlyRent: 1000, otherMonthlyIncome: 0, vacancyRate: 0, annualRentGrowth: 0 },
      expenses: {
        propertyTax: 1200,
        insurance: 0,
        hoaMonthly: 0,
        maintenancePercent: 0,
        capexPercent: 0,
        propertyManagementPercent: 0,
        utilitiesMonthly: 0,
        leasingCosts: 0,
        otherExpenses: 0,
        annualExpenseGrowth: 0,
      },
      appreciationExit: { annualAppreciation: 0, holdingPeriodYears: 1, sellingCostsPercent: 0 },
    },
    options: { discountRate: 0.08, startDate: '2026-01-31T00:00:00.000Z' },
    evidence: [
      {
        path: 'input',
        source: 'manager',
        observedAt: '2026-10-19T00:00:00.000Z',
        note: 'Explicit test assumptions, including zero costs.',
      },
    ],
    scenarios: [
      {
        id: 'higher-rent',
        name: 'Higher rent',
        overrides: { income: { monthlyRent: 1100 } },
        options: {
          startDate: '2027-02-28T00:00:00.000Z',
          discountRate: 0.05,
          tax: {
            marginalTaxRate: 20,
            stateTaxRate: 0,
            capitalGainsTaxRate: 15,
            recaptureTaxRate: 25,
            depreciationEnabled: true,
            depreciationYears: 27.5,
            landValuePercent: 20,
            allowImmediateLossBenefit: false,
          },
        },
      },
    ],
    benchmarks: [
      {
        type: 'custom',
        name: 'Reference',
        description: 'Editable test assumption',
        historicalCAGR: 5,
        averageYield: 0,
        volatility: 0,
        source: 'Manager assumption as of 2026-10-19',
        color: '#123456',
      },
    ],
  };
}
