import { z } from 'zod';

/**
 * Summary metrics from the analysis
 */
export const SummaryMetricsSchema = z.object({
  // Core income metrics
  /** Annual Gross Potential Income */
  grossPotentialIncome: z.number(),
  /** Annual Effective Gross Income (after vacancy) */
  effectiveGrossIncome: z.number(),
  /** Annual Operating Expenses */
  totalOperatingExpenses: z.number(),
  /** Net Operating Income (EGI - OpEx) */
  noi: z.number(),
  /** Operating Expense Ratio (OpEx / EGI) */
  oer: z.number(),

  // Purchase metrics
  /** Original purchase price of the property */
  purchasePrice: z.number(),
  /** Total cash required at closing */
  totalCashRequired: z.number(),
  /** Loan amount */
  loanAmount: z.number(),
  /** Monthly debt service (P&I) */
  monthlyDebtService: z.number(),
  /** Annual debt service */
  annualDebtService: z.number(),

  // Return metrics
  /** Cap Rate (NOI / Purchase Price) */
  capRate: z.number(),
  /** Cash-on-Cash Return (Annual Cash Flow / Total Cash Invested) */
  cashOnCash: z.number(),
  /** Gross Rent Multiplier (Purchase Price / Annual Gross Rent) */
  grm: z.number(),
  /** Debt Service Coverage Ratio (NOI / Annual Debt Service) */
  dscr: z.number(),

  // Year 1 cash flow
  /** Monthly cash flow (NOI/12 - Monthly Debt Service) */
  monthlyCashFlow: z.number(),
  /** Annual cash flow */
  annualCashFlow: z.number(),

  // Advanced return metrics (calculated in Phase 2)
  /** Internal Rate of Return - leveraged */
  irrLeveraged: z.number().nullable(),
  /** Internal Rate of Return - unleveraged */
  irrUnleveraged: z.number().nullable(),
  /** Net Present Value at given discount rate */
  npv: z.number(),
  /** Discount rate used for NPV calculation */
  npvDiscountRate: z.number(),
  /** Equity Multiple (Total Returns / Total Cash Invested) */
  equityMultiple: z.number(),
  /** Total return over holding period (dollars) */
  totalReturn: z.number(),
  /** Total return as percentage of investment */
  totalReturnPercent: z.number(),
  /** Average annual return (simple, not compounded) */
  averageAnnualReturn: z.number(),
  /** Break-even occupancy rate (as decimal) */
  breakEvenOccupancy: z.number(),
  /** Years to recoup initial investment from cashflow (null if never) */
  paybackPeriodYears: z.number().nullable(),
  /** Rent to price ratio (1% rule check) */
  rentToPrice: z.number(),
  /** Profitability Index (PV of future cashflows / initial investment) */
  profitabilityIndex: z.number(),

  // Tax-aware metrics (optional)
  /** After-tax cash-on-cash return */
  afterTaxCashOnCash: z.number().optional(),
  /** After-tax IRR */
  afterTaxIrr: z.number().optional(),
});

export type SummaryMetrics = z.infer<typeof SummaryMetricsSchema>;

/**
 * Monthly cashflow entry
 */
export const MonthlyCashflowSchema = z.object({
  /** Month number (1-indexed) */
  month: z.number().int().positive(),
  /** Year number (1-indexed) */
  year: z.number().int().positive(),
  /** Date of this month */
  date: z.date().optional(),
  /** Gross scheduled rent */
  grossRent: z.number(),
  /** Other income */
  otherIncome: z.number(),
  /** Vacancy loss */
  vacancyLoss: z.number(),
  /** Effective gross income */
  effectiveGrossIncome: z.number(),
  /** Total operating expenses */
  operatingExpenses: z.number(),
  /** Net operating income */
  noi: z.number(),
  /** Debt service (P&I) */
  debtService: z.number(),
  /** Cash flow (NOI - Debt Service) */
  cashFlow: z.number(),
  /** Cumulative cash flow from start */
  cumulativeCashFlow: z.number(),
});

export type MonthlyCashflow = z.infer<typeof MonthlyCashflowSchema>;

/**
 * Annual cashflow summary
 */
export const AnnualCashflowSchema = z.object({
  /** Year number (1-indexed) */
  year: z.number().int().positive(),
  /** Total gross rent for year */
  grossRent: z.number(),
  /** Total other income */
  otherIncome: z.number(),
  /** Total vacancy loss */
  vacancyLoss: z.number(),
  /** Effective gross income */
  effectiveGrossIncome: z.number(),
  /** Total operating expenses */
  operatingExpenses: z.number(),
  /** Net operating income */
  noi: z.number(),
  /** Total debt service for year */
  debtService: z.number(),
  /** Net cash flow */
  cashFlow: z.number(),
  /** Cumulative cash flow */
  cumulativeCashFlow: z.number(),
  /** Property value at year end */
  propertyValue: z.number(),
  /** Loan balance at year end */
  loanBalance: z.number(),
  /** Total equity (property value - loan balance) */
  equity: z.number(),
  /** Principal paid during year */
  principalPaid: z.number(),
  /** Interest paid during year */
  interestPaid: z.number(),
});

export type AnnualCashflow = z.infer<typeof AnnualCashflowSchema>;

/**
 * Amortization schedule entry
 */
export const AmortizationEntrySchema = z.object({
  /** Payment number (1-indexed) */
  paymentNumber: z.number().int().positive(),
  /** Month number */
  month: z.number().int().positive(),
  /** Year number */
  year: z.number().int().positive(),
  /** Date of payment */
  date: z.date().optional(),
  /** Total payment amount */
  payment: z.number(),
  /** Principal portion */
  principal: z.number(),
  /** Interest portion */
  interest: z.number(),
  /** Remaining balance after payment */
  balance: z.number(),
  /** Cumulative principal paid */
  cumulativePrincipal: z.number(),
  /** Cumulative interest paid */
  cumulativeInterest: z.number(),
});

export type AmortizationEntry = z.infer<typeof AmortizationEntrySchema>;

/**
 * Equity timeline entry
 */
export const EquityTimelineEntrySchema = z.object({
  /** Month number (1-indexed) */
  month: z.number().int().positive(),
  /** Year number (1-indexed) */
  year: z.number().int().positive(),
  /** Property market value */
  propertyValue: z.number(),
  /** Remaining loan balance */
  loanBalance: z.number(),
  /** Total equity (value - balance) */
  equity: z.number(),
  /** Equity from appreciation */
  appreciationEquity: z.number(),
  /** Equity from principal paydown */
  principalEquity: z.number(),
  /** Initial equity (down payment + closing) */
  initialEquity: z.number(),
});

export type EquityTimelineEntry = z.infer<typeof EquityTimelineEntrySchema>;

/**
 * Warning severity levels
 */
export const WarningSeveritySchema = z.enum(['info', 'warning', 'error']);
export type WarningSeverity = z.infer<typeof WarningSeveritySchema>;

/**
 * Analysis warning
 */
export const WarningSchema = z.object({
  /** Warning code for programmatic handling */
  code: z.string(),
  /** Severity level */
  severity: WarningSeveritySchema,
  /** Human-readable message */
  message: z.string(),
  /** Related input field (if applicable) */
  field: z.string().optional(),
  /** Suggested fix */
  suggestion: z.string().optional(),
});

export type Warning = z.infer<typeof WarningSchema>;

/**
 * Explainability step for "How is this calculated?"
 */
export const ExplainabilityStepSchema = z.object({
  /** Name of the metric */
  metricName: z.string(),
  /** LaTeX or text formula */
  formula: z.string(),
  /** Input values used */
  inputs: z.record(z.string(), z.number()),
  /** Calculated result */
  result: z.number(),
  /** Human-readable description */
  description: z.string(),
});

export type ExplainabilityStep = z.infer<typeof ExplainabilityStepSchema>;

/**
 * Expense breakdown by category
 */
export const ExpenseBreakdownSchema = z.object({
  propertyTax: z.number(),
  insurance: z.number(),
  hoa: z.number(),
  maintenance: z.number(),
  capex: z.number(),
  propertyManagement: z.number(),
  utilities: z.number(),
  leasing: z.number(),
  other: z.number(),
  total: z.number(),
});

export type ExpenseBreakdown = z.infer<typeof ExpenseBreakdownSchema>;

/**
 * Income breakdown by source
 */
export const IncomeBreakdownSchema = z.object({
  grossRent: z.number(),
  otherIncome: z.number(),
  vacancyLoss: z.number(),
  effectiveGrossIncome: z.number(),
});

export type IncomeBreakdown = z.infer<typeof IncomeBreakdownSchema>;

/**
 * Complete analysis result
 */
export const AnalysisResultSchema = z.object({
  /** Summary metrics */
  summaryMetrics: SummaryMetricsSchema,
  /** Monthly cashflow projections */
  monthlyCashflows: z.array(MonthlyCashflowSchema),
  /** Annual cashflow summaries */
  annualCashflows: z.array(AnnualCashflowSchema),
  /** Loan amortization schedule */
  amortizationSchedule: z.array(AmortizationEntrySchema),
  /** Equity growth timeline */
  equityTimeline: z.array(EquityTimelineEntrySchema),
  /** Expense breakdown */
  expenseBreakdown: ExpenseBreakdownSchema,
  /** Income breakdown */
  incomeBreakdown: IncomeBreakdownSchema,
  /** Analysis warnings */
  warnings: z.array(WarningSchema),
  /** Calculation explanations */
  explainability: z.array(ExplainabilityStepSchema),
  /** Timestamp of analysis */
  computedAt: z.date(),
  /** Time taken to compute (ms) */
  computeTimeMs: z.number(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
