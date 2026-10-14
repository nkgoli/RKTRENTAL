'use client';

import type { FormEvent } from 'react';
import { Chips } from '@/components/ui';
import { DAYS_OPTIONS, RADIUS_OPTIONS, type CompFilters } from '@/lib/comps/core';

const submitOnChange = (event: FormEvent<HTMLFormElement>) => {
  const target = event.target;
  if (target instanceof HTMLSelectElement) event.currentTarget.requestSubmit();
};

export function UnitPicker({
  units,
  unitId,
}: {
  units: { id: string; label: string }[];
  unitId: string;
}) {
  return (
    <form method="get" onChange={submitOnChange}>
      <label className="field" style={{ minWidth: 200 }}>
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

export function FilterBar({ unitId, filters }: { unitId: string; filters: CompFilters }) {
  const radii = RADIUS_OPTIONS.includes(filters.radiusMiles as 1)
    ? RADIUS_OPTIONS
    : [...RADIUS_OPTIONS, filters.radiusMiles].sort((a, b) => a - b);
  return (
    <form method="get" className="form" onChange={submitOnChange} aria-label="Comp filters">
      <input type="hidden" name="unit" value={unitId} />
      <div className="form-row" style={{ gridTemplateColumns: 'repeat(6,1fr)' }}>
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
      <div className="row between">
        <Chips>
          {STATUS_CHIPS.map((chip) => (
            <label
              key={chip.value}
              className={`chip${filters.status === chip.value ? ' active' : ''}`}
              style={{ cursor: 'pointer', position: 'relative' }}
            >
              <input
                type="radio"
                name="status"
                value={chip.value}
                defaultChecked={filters.status === chip.value}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              />
              {chip.label}
            </label>
          ))}
        </Chips>
        <button type="submit" className="btn btn-secondary btn-sm">
          Update comps
        </button>
      </div>
    </form>
  );
}
