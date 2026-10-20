import { payload } from './fixture';

/** Explicit business inputs: no debt and annual fixed costs, with no unused loan/rate basis. */
export function cashPayload(propertyId = 'property-a') {
  const p = payload(propertyId);
  p.input.financing = { loanAmount: 0 };
  p.input.expenses = {
    propertyTax: 1200,
    insurance: 0,
    hoaMonthly: 0,
    maintenance: 0,
    capex: 0,
    propertyManagement: 0,
    utilitiesMonthly: 0,
    leasingCosts: 0,
    otherExpenses: 0,
    annualExpenseGrowth: 0,
  };
  p.scenarios = [];
  p.benchmarks = [];
  return p;
}
