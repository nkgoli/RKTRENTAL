export function propertyListingMode(activeUnitCount: number): 'single-family-comps' | 'unit-market-table' {
  return activeUnitCount === 1 ? 'single-family-comps' : 'unit-market-table';
}
