import { describe, expect, it } from 'vitest';
import { cardPng } from './image';

describe('demo placeholder cards', () => {
  it('creates compact, deterministic PNGs with distinct seeded artwork', () => {
    for (const kind of ['property', 'unit', 'repair'] as const) {
      const first = cardPng(kind, 'Kitchen sink leak', 42);
      expect(first).toEqual(cardPng(kind, 'Kitchen sink leak', 42));
      expect(first).not.toEqual(cardPng(kind, 'Kitchen sink leak', 43));
      expect(first.byteLength).toBeGreaterThanOrEqual(20_000);
      expect(first.byteLength).toBeLessThanOrEqual(60_000);
      expect(Array.from(first.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    }
  });
});
