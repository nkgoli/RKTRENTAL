/**
 * Depreciation calculations for real estate investments
 *
 * Residential real estate is depreciated over 27.5 years using straight-line method.
 * Commercial real estate is depreciated over 39 years.
 * Land is not depreciable.
 */

export interface DepreciationInput {
  /** Purchase price of the property */
  purchasePrice: number;
  /** Closing costs that can be added to cost basis */
  closingCosts: number;
  /** Rehab/improvement costs that can be depreciated */
  rehabCosts: number;
  /** Land value as percentage of purchase price (not depreciable) */
  landValuePercent: number;
  /** Depreciation period in years (27.5 residential, 39 commercial) */
  depreciationYears: number;
}

export interface DepreciationScheduleEntry {
  year: number;
  /** Annual depreciation amount */
  annualDepreciation: number;
  /** Accumulated depreciation to date */
  accumulatedDepreciation: number;
  /** Remaining depreciable basis */
  remainingBasis: number;
}

export interface DepreciationResult {
  /** Total cost basis (purchase + closing + rehab) */
  totalCostBasis: number;
  /** Land value (not depreciable) */
  landValue: number;
  /** Depreciable basis (cost basis - land value) */
  depreciableBasis: number;
  /** Annual depreciation amount */
  annualDepreciation: number;
  /** Depreciation period in years */
  depreciationYears: number;
  /** Year-by-year depreciation schedule */
  schedule: DepreciationScheduleEntry[];
}

/**
 * Calculate straight-line depreciation for real estate
 */
export function calculateDepreciation(input: DepreciationInput): DepreciationResult {
  const { purchasePrice, closingCosts, rehabCosts, landValuePercent, depreciationYears } = input;

  // Validate depreciationYears is reasonable (between 1 and 50 years)
  // This catches bugs where years might be passed as a decimal (e.g., 0.275 instead of 27.5)
  const validDepreciationYears =
    depreciationYears >= 1 && depreciationYears <= 50 ? depreciationYears : 27.5; // Default to residential if invalid

  // Calculate cost basis
  const totalCostBasis = purchasePrice + closingCosts + rehabCosts;

  // Land is not depreciable
  const landValue = purchasePrice * (landValuePercent / 100);

  // Depreciable basis = cost basis - land value
  const depreciableBasis = totalCostBasis - landValue;

  // Annual depreciation (straight-line)
  const annualDepreciation = depreciableBasis / validDepreciationYears;

  // Generate depreciation schedule
  const schedule: DepreciationScheduleEntry[] = [];
  let accumulatedDepreciation = 0;

  for (let year = 1; year <= Math.ceil(validDepreciationYears); year++) {
    // Handle partial year at the end (e.g., 27.5 years)
    const isPartialYear = year > Math.floor(validDepreciationYears);
    const yearDepreciation = isPartialYear
      ? annualDepreciation * (validDepreciationYears - Math.floor(validDepreciationYears))
      : annualDepreciation;

    accumulatedDepreciation += yearDepreciation;

    schedule.push({
      year,
      annualDepreciation: Math.round(yearDepreciation * 100) / 100,
      accumulatedDepreciation: Math.round(accumulatedDepreciation * 100) / 100,
      remainingBasis: Math.max(
        0,
        Math.round((depreciableBasis - accumulatedDepreciation) * 100) / 100,
      ),
    });

    // Stop if fully depreciated
    if (accumulatedDepreciation >= depreciableBasis) break;
  }

  return {
    totalCostBasis,
    landValue,
    depreciableBasis,
    annualDepreciation: Math.round(annualDepreciation * 100) / 100,
    depreciationYears: validDepreciationYears,
    schedule,
  };
}

/**
 * Get depreciation amount for a specific year
 */
export function getDepreciationForYear(result: DepreciationResult, year: number): number {
  const entry = result.schedule.find((e) => e.year === year);
  return entry?.annualDepreciation ?? 0;
}

/**
 * Calculate accumulated depreciation up to a specific year
 */
export function getAccumulatedDepreciation(result: DepreciationResult, year: number): number {
  const entry = result.schedule.find((e) => e.year === year);
  return entry?.accumulatedDepreciation ?? 0;
}

/**
 * Calculate depreciation recapture on sale
 * When selling, depreciation taken is "recaptured" and taxed at 25% (or ordinary income rate if lower)
 */
export function calculateDepreciationRecapture(
  accumulatedDepreciation: number,
  recaptureRate: number = 25,
): number {
  return accumulatedDepreciation * (recaptureRate / 100);
}
