import { describe, expect, it } from 'vitest';
import {
  ENGINE_ID,
  calculatePayload,
  missingData,
  type AnalysisPayload,
} from '@/lib/analysis/contract';
import { readPropertyRoiInputs, roiStorage } from '@/lib/properties/roi-inputs';
import { seedRoiInputs } from '../../prisma/seed-roi-inputs';

// Canonical seed price/debt columns from prisma/seed.ts; the loader never rewrites them.
const canonical: Record<string, { purchasePrice: number; loanAmount: number }> = {
  'seed-property-maple': { purchasePrice: 2830000, loanAmount: 1980000 },
  'seed-property-harbor': { purchasePrice: 4790000, loanAmount: 3350000 },
  'seed-property-cedar': { purchasePrice: 1470000, loanAmount: 1030000 },
  'seed-property-elm': { purchasePrice: 413000, loanAmount: 289000 },
};

describe('fictional seed property ROI inputs', () => {
  it('covers exactly the four seed properties', () => {
    expect(seedRoiInputs().map((d) => d.id)).toEqual(Object.keys(canonical));
  });

  it.each(seedRoiInputs())(
    '$id stores no price/debt and calculates with its seed columns',
    (demo) => {
      const storage = roiStorage(null, demo.inputs);
      expect(storage).not.toHaveProperty('purchasePrice');
      expect(storage).not.toHaveProperty('loanAmount');
      expect(storage).toHaveProperty('roiInputs');
      const roi = readPropertyRoiInputs({ ...storage, ...canonical[demo.id] });
      const payload: AnalysisPayload = {
        version: 1,
        engineId: ENGINE_ID,
        propertyId: demo.id,
        input: { schemaVersion: 1, propertyId: demo.id, ...roi.input },
        options: roi.options,
        evidence: [],
        scenarios: [],
        benchmarks: [],
      } as AnalysisPayload;
      expect(missingData(payload)).toEqual([]);
      const { annualCashFlow } = calculatePayload(payload).base.summaryMetrics;
      expect(Number.isFinite(annualCashFlow)).toBe(true);
      // Matches the live Maple Court result observed in the browser after loading.
      if (demo.id === 'seed-property-maple') expect(Math.round(annualCashFlow)).toBe(-2555);
    },
  );
});
