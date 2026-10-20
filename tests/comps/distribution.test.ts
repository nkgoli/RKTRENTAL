import { describe, expect, it } from 'vitest';
import { rentDistribution } from '@/lib/comps/distribution';

describe('rental distribution (C25)', () => {
  it('fits the curve to the comps only and peaks at 100 on the mean', () => {
    const d = rentDistribution([1000, 1200, 1400], 2000)!;
    expect(d.mean).toBe(1200);
    expect(d.low).toBe(1000);
    expect(d.high).toBe(1400);
    expect(d.sd).toBeCloseTo(Math.sqrt((200 ** 2 * 2) / 3), 9);
    expect(Math.max(...d.curve.map((p) => p.density))).toBeLessThanOrEqual(100);
    expect(d.comps.find((p) => p.rent === 1200)!.density).toBe(100);
    // The subject is plotted (domain stretches to include it) but not averaged in.
    expect(d.max).toBeGreaterThanOrEqual(2000);
    expect(d.subject!.density).toBeLessThan(5);
  });
  it('returns nothing without comps and handles identical rents', () => {
    expect(rentDistribution([], 1500)).toBeNull();
    const same = rentDistribution([1500, 1500], null)!;
    expect(same.sd).toBeCloseTo(150, 9);
    expect(same.subject).toBeNull();
  });
});
