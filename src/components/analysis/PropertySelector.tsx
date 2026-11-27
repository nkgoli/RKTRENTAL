'use client';
import { useState } from 'react';
import type { PropertySelectionResult } from '@/lib/analysis';
import { Icon } from '@/components/shell/Icons';
import styles from './analysis.module.css';
export type PropertyChoice = Extract<PropertySelectionResult, { ok: true }>['data'][number];
export function PropertySelector({
  properties,
  onSelect,
  disabled = false,
}: {
  properties: PropertyChoice[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const filtered = properties.filter((p) =>
    `${p.name} ${p.street} ${p.city} ${p.postalCode}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className={styles.card} aria-label="Your properties">
      <div className={`search ${styles.search}`}>
        <Icon name="search" />
        <input
          type="search"
          aria-label="Search properties"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search properties"
        />
      </div>
      <div className={styles.properties}>
        {filtered.map((p) => (
          <button disabled={disabled} key={p.id} onClick={() => onSelect(p.id)}>
            <strong>{p.name}</strong>
            <span>
              {p.street}, {p.city}, {p.state} {p.postalCode}
            </span>
            {p.units.length > 0 && (
              <small>
                {p.units.length} {p.units.length === 1 ? 'unit' : 'units'}
              </small>
            )}
          </button>
        ))}
      </div>
      {!properties.length ? (
        <p>No active properties yet.</p>
      ) : !filtered.length ? (
        <p>No properties match your search.</p>
      ) : null}
    </section>
  );
}
