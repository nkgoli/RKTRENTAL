import { addMonths, monthKey, monthStart } from '../../src/lib/ledger/core';

export type DemoProperty = {
  slug: string;
  name: string;
  type: 'SINGLE_UNIT' | 'MULTI_UNIT';
  street: string;
  postalCode: string;
  yearBuilt: number;
  hasSharedLaundry: boolean;
  isFloodZone: boolean;
  count: number;
  baseRent: number;
};

export const properties: DemoProperty[] = [
  { slug: 'elm', name: '18 Elm Street', type: 'SINGLE_UNIT', street: '18 Elm St', postalCode: '78745', yearBuilt: 1968, hasSharedLaundry: false, isFloodZone: false, count: 1, baseRent: 1690 },
  { slug: 'maple', name: 'Maple Court', type: 'MULTI_UNIT', street: '214 Maple Ave', postalCode: '78704', yearBuilt: 1998, hasSharedLaundry: true, isFloodZone: false, count: 12, baseRent: 1750 },
  { slug: 'cedar', name: 'Cedar Row Townhomes', type: 'MULTI_UNIT', street: '9 Cedar Row', postalCode: '78702', yearBuilt: 1974, hasSharedLaundry: false, isFloodZone: false, count: 8, baseRent: 1650 },
  { slug: 'harbor', name: 'Harbor View Lofts', type: 'MULTI_UNIT', street: '80 Harbor St', postalCode: '78701', yearBuilt: 2012, hasSharedLaundry: true, isFloodZone: true, count: 24, baseRent: 2050 },
  { slug: 'oak', name: 'Oak Bend House', type: 'SINGLE_UNIT', street: '311 Oak Bend Ln', postalCode: '78741', yearBuilt: 1959, hasSharedLaundry: false, isFloodZone: false, count: 1, baseRent: 1880 },
  { slug: 'willow', name: 'Willow Garden House', type: 'SINGLE_UNIT', street: '142 Willow Garden Rd', postalCode: '78703', yearBuilt: 1987, hasSharedLaundry: false, isFloodZone: true, count: 1, baseRent: 2250 },
  { slug: 'congress', name: 'Congress Flats', type: 'MULTI_UNIT', street: '620 Congress Way', postalCode: '78701', yearBuilt: 2005, hasSharedLaundry: true, isFloodZone: false, count: 12, baseRent: 1790 },
  { slug: 'bluebonnet', name: 'Bluebonnet Mews', type: 'MULTI_UNIT', street: '77 Bluebonnet Mews', postalCode: '78722', yearBuilt: 1972, hasSharedLaundry: true, isFloodZone: false, count: 10, baseRent: 1520 },
];

const firstNames = ['Alex', 'Priya', 'Sam', 'Tara', 'Dana', 'Marcus', 'Lena', 'Olivia', 'Rohan', 'Nina', 'Sofia', 'Mina', 'Jules', 'Evan', 'Avery', 'Casey'];
const lastNames = ['Rivera', 'Shah', 'Patel', 'Wu', 'Kim', 'Okafor', 'Castillo', 'Reed', 'Das', 'Park', 'Nguyen', 'Bell'];

export function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pickInt(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1));
}

export function fakePerson(random: () => number, index: number) {
  const first = firstNames[pickInt(random, 0, firstNames.length - 1)]!;
  const last = lastNames[pickInt(random, 0, lastNames.length - 1)]!;
  return {
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}.${index}@example.com`,
    phone: `(512) 555-01${String(index % 100).padStart(2, '0')}`,
  };
}

export const propertyId = (slug: string) => `demo-property-${slug}`;
export const unitId = (slug: string, index: number) => `demo-unit-${slug}-${index + 1}`;

export function unitNumber(slug: string, index: number) {
  if (slug === 'elm' || slug === 'oak' || slug === 'willow') return 'Whole property';
  if (slug === 'cedar') return `Townhome ${index + 1}`;
  if (slug === 'maple') return ['1A', '1B', '1C', '2A', '2B', '2C', '3A', '3B', '3C', '4A', '4B', '5D'][index]!;
  if (slug === 'harbor') return index === 7 ? '8D' : index === 11 ? '12A' : index === 23 ? '306' : String(index + 1);
  return `${Math.floor(index / 4) + 1}${String.fromCharCode(65 + (index % 4))}`;
}

export type PlannedLease = {
  id: string;
  unitId: string;
  tenantId: string;
  startDate: Date;
  endDate: Date;
  rentCents: number;
  status: 'ACTIVE' | 'ENDED' | 'DRAFT';
  renewal: boolean;
  cycle: number;
};

export type PlannedTenant = { id: string; name: string; email: string; phone: string };
export type PlannedUnit = { id: string; propertySlug: string; number: string; index: number; vacant: boolean };

export function planPortfolio(seed: number, now: Date) {
  const random = prng(seed);
  const currentMonth = monthKey(now);
  const horizon = monthStart(addMonths(currentMonth, 3));
  const units: PlannedUnit[] = [];
  const leases: PlannedLease[] = [];
  const tenants: PlannedTenant[] = [];
  let personIndex = 0;
  for (const property of properties) {
    for (let index = 0; index < property.count; index++) {
      const id = unitId(property.slug, index);
      const vacant = (units.length + 1) % 11 === 0;
      units.push({ id, propertySlug: property.slug, number: unitNumber(property.slug, index), index, vacant });
      let next = addMonths(currentMonth, -60);
      let tenantId = '';
      // Rents are whole dollars rounded to $5, as a landlord would set them.
      const toRent = (cents: number) => Math.round(cents / 500) * 500;
      let rentCents = toRent((property.baseRent + (index % 5) * 85) * 100 * 0.83);
      for (let cycle = 0; cycle < 8 && monthStart(next) <= horizon; cycle++) {
        const renewal = cycle > 0 && random() < 0.55;
        if (cycle > 0) {
          // A 2-6% renewal raise, kept inside that band after rounding to $5.
          const prior = rentCents;
          rentCents = toRent(prior * (1 + pickInt(random, 2, 6) / 100));
          if (rentCents > prior * 1.06) rentCents -= 500;
          if (rentCents < prior * 1.02) rentCents += 500;
        }
        if (!renewal || !tenantId) {
          personIndex++;
          const person = fakePerson(random, personIndex);
          tenantId = `demo-tenant-${personIndex}`;
          tenants.push({ id: tenantId, ...person });
        }
        const duration = cycle === 4 && (units.length % 9 === 0 || vacant) ? 8 : pickInt(random, 10, 12);
        const startDate = monthStart(next);
        const after = monthStart(addMonths(next, duration));
        const endDate = new Date(after.getTime() - 86_400_000);
        const idForLease = `demo-lease-${property.slug}-${index + 1}-${cycle + 1}`;
        // The current Payments view treats every ACTIVE row as occupied, including future terms.
        // Keep scheduled future terms in draft until their start date so one unit has one current row.
        const status = startDate > now ? 'DRAFT' : endDate < now ? 'ENDED' : 'ACTIVE';
        leases.push({ id: idForLease, unitId: id, tenantId, startDate, endDate, rentCents, status, renewal, cycle });
        const gap = renewal ? 0 : pickInt(random, 0, 3);
        next = addMonths(next, duration + gap);
        if (vacant && endDate < now && monthStart(next) > now) break;
      }
    }
  }
  return { units, leases, tenants, currentMonth };
}

export function assertNoLeaseOverlap(leases: PlannedLease[]) {
  const byUnit = new Map<string, PlannedLease[]>();
  for (const lease of leases) byUnit.set(lease.unitId, [...(byUnit.get(lease.unitId) ?? []), lease]);
  for (const rows of byUnit.values()) {
    rows.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    for (let i = 1; i < rows.length; i++) {
      if (rows[i]!.startDate <= rows[i - 1]!.endDate) throw new Error(`Overlapping leases: ${rows[i]!.unitId}`);
    }
  }
}
