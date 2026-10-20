import { payload } from './fixture';

/**
 * RealROI's locked `/demo` deal (`sampleDealInput`, reference commit 0b12c76),
 * expressed in RocketRental inputs. Test-only: it never touches a saved analysis.
 * See docs/analysis/realroi-chart-parity.md §1 for the reference values.
 */
export function realRoiSample() {
  const p = payload('realroi-sample');
  p.input.propertyInfo = {
    name: 'Sample Investment Property',
    address: '123 Main Street',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
  };
  p.input.purchase = {
    ...p.input.purchase!,
    purchasePrice: 350000,
    afterRepairValue: 380000,
    closingCosts: 8000,
    rehabCosts: 5000,
    furnishingCosts: 0,
  };
  p.input.financing = {
    ...p.input.financing!,
    downPaymentPercent: 25,
    interestRate: 7.25,
    loanTermYears: 30,
    pointsPaid: 0,
    lenderFees: 1500,
  };
  p.input.income = {
    monthlyRent: 2800,
    otherMonthlyIncome: 100,
    vacancyRate: 5,
    annualRentGrowth: 3,
  };
  p.input.expenses = {
    ...p.input.expenses!,
    propertyTax: 4200,
    insurance: 1800,
    hoaMonthly: 0,
    maintenancePercent: 5,
    capexPercent: 5,
    propertyManagementPercent: 8,
    utilitiesMonthly: 0,
    leasingCosts: 500,
    otherExpenses: 200,
    annualExpenseGrowth: 2,
  };
  p.input.appreciationExit = {
    annualAppreciation: 3,
    holdingPeriodYears: 30,
    sellingCostsPercent: 6,
  };
  p.scenarios = [];
  p.benchmarks = [];
  return p;
}
