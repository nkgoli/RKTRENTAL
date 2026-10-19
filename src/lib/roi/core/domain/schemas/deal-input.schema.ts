import { z } from 'zod';

/**
 * Property info schema (name and address)
 */
export const PropertyInfoSchema = z.object({
  /** Property name/title */
  name: z.string().default(''),
  /** Full address or single-line address */
  address: z.string().default(''),
  /** City */
  city: z.string().default(''),
  /** State/Province */
  state: z.string().default(''),
  /** ZIP/Postal code */
  zipCode: z.string().default(''),
});

export type PropertyInfo = z.infer<typeof PropertyInfoSchema>;

/**
 * Purchase details schema
 */
export const PurchaseSchema = z.object({
  /** Purchase price of the property */
  purchasePrice: z.number().positive('Purchase price must be positive'),
  /** After Repair Value (ARV) - estimated market value after renovations */
  afterRepairValue: z.number().nonnegative().optional(),
  /** Closing costs (title, escrow, legal, etc.) */
  closingCosts: z.number().nonnegative().default(0),
  /** Rehab/repair costs */
  rehabCosts: z.number().nonnegative().default(0),
  /** Furnishing costs (for furnished rentals) */
  furnishingCosts: z.number().nonnegative().default(0),
  /** Acquisition date */
  acquisitionDate: z.date().optional(),
});

export type Purchase = z.infer<typeof PurchaseSchema>;

/**
 * Loan types
 */
export const LoanTypeSchema = z.enum([
  'conventional',
  'fha',
  'va',
  'commercial',
  'portfolio',
  'hard_money',
]);

export type LoanType = z.infer<typeof LoanTypeSchema>;

/**
 * Financing details schema
 */
export const FinancingSchema = z.object({
  /** Down payment as a percentage (0-100) */
  downPaymentPercent: z.number().min(0).max(100).default(20),
  /** Loan amount (calculated if not provided) */
  loanAmount: z.number().nonnegative().optional(),
  /** Annual interest rate as a percentage (e.g., 7.5 for 7.5%) */
  interestRate: z.number().min(0).max(100).default(7),
  /** Loan term in years */
  loanTermYears: z.number().int().positive().default(30),
  /** Amortization period in years (can differ from loan term for balloon loans) */
  amortizationYears: z.number().int().positive().optional(),
  /** Type of loan */
  loanType: LoanTypeSchema.default('conventional'),
  /** Points paid at closing (as percentage of loan amount) */
  pointsPaid: z.number().nonnegative().default(0),
  /** Other lender fees */
  lenderFees: z.number().nonnegative().default(0),
});

export type Financing = z.infer<typeof FinancingSchema>;

/**
 * Income details schema
 */
export const IncomeSchema = z.object({
  /** Monthly rental income */
  monthlyRent: z.number().nonnegative().default(0),
  /** Other monthly income (parking, laundry, storage, etc.) */
  otherMonthlyIncome: z.number().nonnegative().default(0),
  /** Vacancy rate as percentage (0-100) */
  vacancyRate: z.number().min(0).max(100).default(5),
  /** Annual rent growth rate as percentage */
  annualRentGrowth: z.number().min(-50).max(100).default(2),
});

export type Income = z.infer<typeof IncomeSchema>;

/**
 * Expense details schema
 */
export const ExpensesSchema = z.object({
  /** Annual property tax */
  propertyTax: z.number().nonnegative().default(0),
  /** Annual insurance premium */
  insurance: z.number().nonnegative().default(0),
  /** Monthly HOA fees */
  hoaMonthly: z.number().nonnegative().default(0),
  /** Annual maintenance (or use maintenancePercent) */
  maintenance: z.number().nonnegative().optional(),
  /** Maintenance as percentage of gross rent (5-15% typical) */
  maintenancePercent: z.number().min(0).max(100).default(5),
  /** Annual CapEx reserve (or use capexPercent) */
  capex: z.number().nonnegative().optional(),
  /** CapEx as percentage of gross rent (5-10% typical) */
  capexPercent: z.number().min(0).max(100).default(5),
  /** Property management (or use propertyManagementPercent) */
  propertyManagement: z.number().nonnegative().optional(),
  /** Property management as percentage of effective gross income (8-12% typical) */
  propertyManagementPercent: z.number().min(0).max(100).default(8),
  /** Monthly utilities (if landlord pays) */
  utilitiesMonthly: z.number().nonnegative().default(0),
  /** Annual leasing/turnover costs */
  leasingCosts: z.number().nonnegative().default(0),
  /** Other annual expenses */
  otherExpenses: z.number().nonnegative().default(0),
  /** Annual expense growth rate as percentage */
  annualExpenseGrowth: z.number().min(-50).max(100).default(2),
});

export type Expenses = z.infer<typeof ExpensesSchema>;

/**
 * Appreciation and exit strategy schema
 */
export const AppreciationExitSchema = z.object({
  /** Annual property appreciation rate as percentage */
  annualAppreciation: z.number().min(-50).max(100).default(3),
  /** Holding period in years */
  holdingPeriodYears: z.number().int().min(1).max(50).default(30),
  /** Selling costs as percentage of sale price (agent fees, closing, etc.) */
  sellingCostsPercent: z.number().min(0).max(30).default(6),
  /** Override sale price (if known, otherwise calculated from appreciation) */
  salePriceOverride: z.number().positive().optional(),
});

export type AppreciationExit = z.infer<typeof AppreciationExitSchema>;

/**
 * Tax settings schema (optional)
 */
export const TaxSettingsSchema = z
  .object({
    /** Marginal income tax rate as percentage */
    marginalTaxRate: z.number().min(0).max(100).optional(),
    /** State income tax rate as percentage */
    stateTaxRate: z.number().min(0).max(100).optional(),
    /** Capital gains tax rate as percentage */
    capitalGainsTaxRate: z.number().min(0).max(100).optional(),
    /** Enable depreciation calculations */
    depreciationEnabled: z.boolean().default(false),
    /** Depreciation period in years (27.5 for residential, 39 for commercial) */
    depreciationYears: z.number().min(1).max(50).default(27.5),
    /** Land value as percentage of purchase price (not depreciable) */
    landValuePercent: z.number().min(0).max(100).default(20),
  })
  .optional();

export type TaxSettings = z.infer<typeof TaxSettingsSchema>;

/**
 * Complete deal input schema
 */
export const DealInputSchema = z.object({
  /** Opaque application property ID (RocketRental CUID or an imported UUID). */
  propertyId: z.string().min(1).max(200).optional(),
  /** Schema version for migrations */
  schemaVersion: z.number().int().default(1),
  /** Property info (name, address) */
  propertyInfo: PropertyInfoSchema.default({}),
  /** Purchase details */
  purchase: PurchaseSchema,
  /** Financing details */
  financing: FinancingSchema,
  /** Income details */
  income: IncomeSchema,
  /** Expense details */
  expenses: ExpensesSchema,
  /** Appreciation and exit strategy */
  appreciationExit: AppreciationExitSchema,
  /** Tax settings (optional) */
  taxes: TaxSettingsSchema,
});

export type DealInput = z.infer<typeof DealInputSchema>;

/**
 * Create default deal input with realistic sample values
 */
export function createDefaultDealInput(): DealInput {
  return DealInputSchema.parse({
    propertyInfo: {
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
    },
    purchase: {
      purchasePrice: 300000,
      closingCosts: 6000,
      rehabCosts: 0,
    },
    financing: {
      downPaymentPercent: 20,
      interestRate: 7,
      loanTermYears: 30,
    },
    income: {
      monthlyRent: 2000,
      vacancyRate: 5,
      annualRentGrowth: 2,
    },
    expenses: {
      propertyTax: 3600,
      insurance: 1200,
      maintenancePercent: 5,
      capexPercent: 5,
      propertyManagementPercent: 8,
    },
    appreciationExit: {
      annualAppreciation: 3,
      holdingPeriodYears: 10,
      sellingCostsPercent: 6,
    },
  });
}
