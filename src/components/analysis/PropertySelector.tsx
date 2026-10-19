'use client';
import { useState } from 'react';
import type { PropertySelectionResult } from '@/lib/analysis';
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
      <h2>Your properties</h2>
      <label className={styles.field}>
        Search properties
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, address or postal code"
        />
      </label>
      <div className={styles.properties}>
        {filtered.map((p) => (
          <button disabled={disabled} key={p.id} onClick={() => onSelect(p.id)}>
            <strong>{p.name}</strong>
            <span>
              {p.street}, {p.city}, {p.state} {p.postalCode}
            </span>
            <small>{p.units.length} active units · Open ROI Analysis →</small>
          </button>
        ))}
      </div>
      {!properties.length ? (
        <p>No properties available. Add an active property to begin.</p>
      ) : !filtered.length ? (
        <p>No properties match your search.</p>
      ) : null}
    </section>
  );
}
