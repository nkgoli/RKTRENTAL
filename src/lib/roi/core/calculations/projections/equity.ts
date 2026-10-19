import { round, fromPercent } from '../../../utils/index';
import type { DealInput } from '../../domain/schemas/deal-input.schema';
import type {
  EquityTimelineEntry,
  AmortizationEntry,
} from '../../domain/schemas/analysis-result.schema';

/**
 * Generate equity timeline showing equity growth over holding period
 * Uses ARV (After Repair Value) as the starting property value if provided,
 * which accounts for instant equity gained from buying below market value.
 */
export function generateEquityTimeline(
  input: DealInput,
  loanAmount: number,
  _totalCashRequired: number,
  amortizationSchedule: AmortizationEntry[],
): EquityTimelineEntry[] {
  const totalMonths = input.appreciationExit.holdingPeriodYears * 12;
  const appreciationRate = fromPercent(input.appreciationExit.annualAppreciation);
  const timeline: EquityTimelineEntry[] = [];

  // Purchase equity excludes transaction costs; ARV changes are tracked separately.
  const initialEquity = input.purchase.purchasePrice - loanAmount;

  // Use ARV as the initial property value if provided (accounts for instant equity)
  // ARV represents the market value after repairs, which is what appreciation is based on
  const afterRepairValue = input.purchase.afterRepairValue ?? input.purchase.purchasePrice;
  const initialPropertyValue = afterRepairValue;

  // Track instant equity (difference between ARV and total cost)
  const totalCost = input.purchase.purchasePrice;
  const instantEquity = afterRepairValue - totalCost;

  for (let month = 1; month <= totalMonths; month++) {
    const year = Math.ceil(month / 12);

    // Property value with appreciation (compounded monthly) from ARV
    const monthlyAppreciationRate = Math.pow(1 + appreciationRate, 1 / 12) - 1;
    const propertyValue = round(
      initialPropertyValue * Math.pow(1 + monthlyAppreciationRate, month),
      2,
    );

    // Loan balance from amortization schedule
    const loanBalance =
      month <= amortizationSchedule.length ? amortizationSchedule[month - 1].balance : 0;

    // Total equity = property value - loan balance
    const equity = round(propertyValue - loanBalance, 2);

    // Appreciation equity includes:
    // 1. Instant equity from buying below ARV (if any)
    // 2. Market appreciation over time
    const marketAppreciation = propertyValue - initialPropertyValue;
    const appreciationEquity = round(instantEquity + marketAppreciation, 2);

    // Equity from principal paydown
    const principalEquity = round(loanAmount - loanBalance, 2);

    timeline.push({
      month,
      year,
      propertyValue,
      loanBalance,
      equity,
      appreciationEquity,
      principalEquity,
      initialEquity,
    });
  }

  return timeline;
}

/**
 * Calculate sale proceeds at exit
 */
export function calculateSaleProceeds(
  input: DealInput,
  propertyValueAtSale: number,
  loanBalanceAtSale: number,
): {
  grossSalePrice: number;
  sellingCosts: number;
  netSaleProceeds: number;
  loanPayoff: number;
  netProceeds: number;
} {
  const grossSalePrice = input.appreciationExit.salePriceOverride ?? propertyValueAtSale;
  const sellingCosts = round(
    grossSalePrice * fromPercent(input.appreciationExit.sellingCostsPercent),
    2,
  );
  const netSaleProceeds = round(grossSalePrice - sellingCosts, 2);
  const netProceeds = round(netSaleProceeds - loanBalanceAtSale, 2);

  return {
    grossSalePrice,
    sellingCosts,
    netSaleProceeds,
    loanPayoff: loanBalanceAtSale,
    netProceeds,
  };
}
