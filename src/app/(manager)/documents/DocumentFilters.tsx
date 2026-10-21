'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchField } from '@/components/ui';
import styles from './documents.module.css';

export function DocumentFilters({
  query,
  kind,
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
  const router = useRouter();
  function apply(changes: Record<string, string>) {
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(changes)) { if (value) url.searchParams.set(name, value); else url.searchParams.delete(name); }
    for (const key of ['leasePage', 'filesPage', 'photoPage']) url.searchParams.delete(key);
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
  }
  const [property, setProperty] = useState(propertyId ?? '');
  const [unit, setUnit] = useState(unitId ?? '');
  return (
    <div
      role="search"
      aria-label="Filter files"
      className={styles.documentFilters}
    >
      <SearchField defaultValue={query} placeholder="File, lease or property name" aria-label="Search files, leases or properties" resetParams={['leasePage', 'filesPage', 'photoPage']} />
      <label className="field">
        Property
        <select
          name="propertyId"
          value={property}
          onChange={(event) => {
            setProperty(event.target.value);
            setUnit('');
            apply({ propertyId: event.target.value, unitId: '' });
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
        <select name="unitId" value={unit} onChange={(event) => { setUnit(event.target.value); apply({ unitId: event.target.value }); }}>
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
      {(query || kind !== 'ALL' || propertyId || unitId) && (
        <Link className="btn btn-ghost" href="/documents" scroll={false}>
          Clear filters
        </Link>
      )}
    </div>
  );
}
