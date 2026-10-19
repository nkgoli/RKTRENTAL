'use client';

import { useState } from 'react';
import styles from './documents.module.css';

export function DocumentFilters({
  query,
  kind,
  sort,
  propertyId,
  unitId,
  properties,
  units,
}: {
  query: string;
  kind: string;
  sort: string;
  propertyId?: string;
  unitId?: string;
  properties: { id: string; name: string }[];
  units: { id: string; propertyId: string; label: string }[];
}) {
  const [property, setProperty] = useState(propertyId ?? '');
  const [unit, setUnit] = useState(unitId ?? '');
  return (
    <form
      action="/documents"
      method="get"
      role="search"
      aria-label="Filter files"
      className={styles.documentFilters}
    >
      {kind !== 'ALL' && <input type="hidden" name="kind" value={kind} />}
      <label className={`field ${styles.fileSearch}`}>
        Search files
        <input
          name="q"
          defaultValue={query}
          aria-label="Search files, leases or properties"
          placeholder="File, lease or property name"
        />
      </label>
      <label className="field">
        Property
        <select
          name="propertyId"
          value={property}
          onChange={(event) => {
            setProperty(event.target.value);
            setUnit('');
          }}
        >
          <option value="">All properties</option>
          {properties.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Unit
        <select name="unitId" value={unit} onChange={(event) => setUnit(event.target.value)}>
          <option value="">All units</option>
          {units
            .filter((item) => !property || item.propertyId === property)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        Sort order
        <select name="sort" defaultValue={sort}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </label>
      <button className="btn btn-secondary" type="submit">
        Apply
      </button>
      {(query || kind !== 'ALL' || propertyId || unitId) && (
        <a className="btn btn-ghost" href="/documents">
          Clear filters
        </a>
      )}
    </form>
  );
}
