'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SearchField } from '@/components/ui';
import { KIND_FILTERS } from './library-view';
import styles from './documents.module.css';

const PAGE_KEYS = ['leasePage', 'filesPage', 'photoPage'];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
];

export function DocumentFilters({
  query,
  kind,
  sort,
  propertyId,
  unitId,
  properties,
  units,
  tabs,
  caption,
}: {
  query: string;
  kind: string;
  sort: string;
  propertyId?: string;
  unitId?: string;
  properties: { id: string; name: string }[];
  units: { id: string; propertyId: string; label: string }[];
  /** File type tabs shown on wider screens; phones use the File type select instead. */
  tabs?: ReactNode;
  caption?: ReactNode;
}) {
  const router = useRouter();
  function apply(changes: Record<string, string>) {
    const url = new URL(window.location.href);
    for (const [name, value] of Object.entries(changes)) {
      if (value) url.searchParams.set(name, value);
      else url.searchParams.delete(name);
    }
    for (const key of PAGE_KEYS) url.searchParams.delete(key);
    url.searchParams.delete('file');
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false });
  }
  const [property, setProperty] = useState(propertyId ?? '');
  const [unit, setUnit] = useState(unitId ?? '');
  const filtered = Boolean(query || kind !== 'ALL' || propertyId || unitId);
  return (
    <div className={styles.filterPanel}>
      <div className={styles.filterHead}>
        {tabs && <div className={styles.kindTabs}>{tabs}</div>}
        <div className={`field ${styles.sortField}`}>
          <select
            aria-label="Sort files"
            value={sort}
            onChange={(event) =>
              apply({ sort: event.target.value === 'newest' ? '' : event.target.value })
            }
          >
            {SORTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div role="search" aria-label="Filter files" className={styles.documentFilters}>
        <label className={`field ${styles.fileSearch}`}>
          Search
          <SearchField
            defaultValue={query}
            placeholder="File, lease or property name"
            aria-label="Search files, leases or properties"
            resetParams={[...PAGE_KEYS, 'file']}
          />
        </label>
        <label className={`field ${styles.kindField}`}>
          File type
          <select
            name="kind"
            value={kind}
            onChange={(event) =>
              apply({ kind: event.target.value === 'ALL' ? '' : event.target.value })
            }
          >
            {KIND_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
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
          <select
            name="unitId"
            value={unit}
            onChange={(event) => {
              setUnit(event.target.value);
              apply({ unitId: event.target.value });
            }}
          >
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
      </div>
      {(caption || filtered) && (
        <div className={styles.filterFoot}>
          {caption}
          {filtered && (
            <Link className="btn btn-ghost btn-sm" href="/documents" scroll={false}>
              Clear filters
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
