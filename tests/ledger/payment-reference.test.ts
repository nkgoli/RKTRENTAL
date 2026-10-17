import { describe, expect, it } from 'vitest';
import { describePaymentReference } from '../../src/lib/ledger';

describe('describePaymentReference', () => {
  it.each([
    ['seed:seed-lease-maple-1:2026-10', 'Rent · Oct 2026'],
    ['manual:demo-lease-x-2024:2025-03:catch-up', 'Rent · Mar 2025'],
    ['manual:lease-1:setup', 'Move-in payment'],
    ['mock-payment-alex-2026-09', 'Rent · Sep 2026'],
    ['demo-returned:lease-1:2026-02', 'Returned payment · Feb 2026'],
    ['manual:lease-1:abc123', 'Recorded manually'],
    ['pi_3Nabc', 'Online payment'],
    [null, 'Recorded manually'],
  ])('%s -> %s', (ref, label) => {
    expect(describePaymentReference(ref)).toBe(label);
  });

  it('never shows raw seed ids', () => {
    expect(describePaymentReference('seed:seed-lease-maple-1:2026-10')).not.toMatch(/seed/);
  });
});
