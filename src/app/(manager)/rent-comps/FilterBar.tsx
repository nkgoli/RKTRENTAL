'use client';

import type { FormEvent } from 'react';
import { DAYS_OPTIONS, RADIUS_OPTIONS, type CompFilters } from '@/lib/comps/core';
import styles from './comps.module.css';

const submitOnChange = (event: FormEvent<HTMLFormElement>) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement) event.currentTarget.requestSubmit();
};

export function UnitPicker({
  units,
  unitId,
  action,
}: {
  units: { id: string; label: string }[];
  unitId: string;
  action?: string;
}) {
  return (
    <form method="get" action={action} onChange={submitOnChange} style={{ flex: '1 1 200px', minWidth: 0 }}>
      <label className="field">
        Unit
        <select name="unit" defaultValue={unitId}>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button className="btn btn-secondary btn-sm">Show comps</button>
      </noscript>
    </form>
  );
}

const STATUS_CHIPS = [
  { value: 'all', label: 'Listed + leased' },
  { value: 'listed', label: 'Listed' },
  { value: 'leased', label: 'Leased' },
] as const;

export function FilterBar({ unitId, filters, action }: { unitId: string; filters: CompFilters; action?: string }) {
  const radii = RADIUS_OPTIONS.includes(filters.radiusMiles as 1)
    ? RADIUS_OPTIONS
    : [...RADIUS_OPTIONS, filters.radiusMiles].sort((a, b) => a - b);
  return (
    <form method="get" action={action} className="form" onChange={submitOnChange} aria-label="Comp filters">
      <input type="hidden" name="unit" value={unitId} />
      <div className={styles.filterFields}>
        <label className="field">
          Radius
          <select name="radius" defaultValue={String(filters.radiusMiles)}>
            {radii.map((miles) => (
              <option key={miles} value={miles}>
                {miles} {miles === 1 ? 'mile' : 'miles'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Beds
          <select name="beds" defaultValue={String(filters.bedrooms)}>
            {[0, 1, 2, 3, 4].map((beds) => (
              <option key={beds} value={beds}>
                {beds === 0 ? 'Studio' : `${beds} bd`}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Baths
          <select
            name="baths"
            defaultValue={filters.bathrooms === null ? 'any' : String(filters.bathrooms)}
          >
            <option value="any">Any</option>
            {[1, 1.5, 2, 2.5].map((baths) => (
              <option key={baths} value={baths}>
                {baths} ba
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Min sqft
          <input name="minSqft" inputMode="numeric" defaultValue={filters.minSqft ?? ''} />
        </label>
        <label className="field">
          Max sqft
          <input name="maxSqft" inputMode="numeric" defaultValue={filters.maxSqft ?? ''} />
        </label>
        <label className="field">
          Time frame
          <select name="days" defaultValue={String(filters.days)}>
            {DAYS_OPTIONS.map((days) => (
              <option key={days} value={days}>
                Last {days} days
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.filterFooter}>
        <div className={styles.statusChips} role="group" aria-label="Rental status">
          {STATUS_CHIPS.map((chip) => (
            <label
              key={chip.value}
              className={`chip ${styles.statusChip}${filters.status === chip.value ? ' active' : ''}`}
            >
              <input
                type="radio"
                name="status"
                value={chip.value}
                defaultChecked={filters.status === chip.value}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
              />
              {chip.label}
            </label>
          ))}
        </div>
        <button type="submit" className="btn btn-secondary btn-sm">
          Update comps
        </button>
      </div>
    </form>
  );
}
