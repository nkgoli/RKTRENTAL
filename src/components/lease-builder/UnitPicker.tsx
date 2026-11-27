'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Glyph } from './icons';
import { StatusTag, type StatusTone } from './StatusTag';
import { useBuilderShell } from './useBuilderShell';
import { cx } from './summary';
import styles from './lease-builder.module.css';

type PickerUnit = {
  id: string;
  /** Property and unit, e.g. "Maple Court · Unit 3A". */
  label: string;
  status: string;
  /** Property name and unit name for grouping; read from the label when omitted. */
  property?: string;
  name?: string;
  draft?: { id: string; saved: string; step: number };
};

const STATUS: Record<string, [string, StatusTone]> = {
  VACANT: ['Vacant', 'ok'],
  OCCUPIED: ['Occupied', 'neutral'],
  TURNOVER: ['Turnover', 'warn'],
};

/** First stop when /leases/new is opened without a unit: pick where the lease is for. */
export function UnitPicker({
  units,
  backHref,
  context = {},
  initialUnit = '',
}: {
  units: PickerUnit[];
  backHref: string;
  context?: { applicant?: string; tenant?: string; renew?: string };
  initialUnit?: string;
}) {
  const hydrated = useBuilderShell();
  const [selectedId, setSelectedId] = useState(initialUnit);
  const [query, setQuery] = useState('');
  const list = useRef<HTMLFieldSetElement>(null);
  const selected = units.find((unit) => unit.id === selectedId);
  const groups = useMemo(() => {
    const byProperty = new Map<string, (PickerUnit & { property: string; name: string })[]>();
    for (const unit of units) {
      const [property, ...rest] = unit.label.split(' · ');
      const entry = {
        ...unit,
        property: unit.property ?? property,
        name: unit.name ?? (rest.join(' · ') || 'Entire home'),
      };
      byProperty.set(entry.property, [...(byProperty.get(entry.property) ?? []), entry]);
    }
    // Unit 2 before Unit 10: numbers in names sort by value.
    return [...byProperty.entries()].map(
      ([property, group]) =>
        [
          property,
          group.sort((a, b) => a.name.localeCompare(b.name, 'en-US', { numeric: true })),
        ] as const,
    );
  }, [units]);
  const q = query.trim().toLowerCase();
  const matches = (unit: PickerUnit) => !q || unit.label.toLowerCase().includes(q);
  const anyMatch = units.some(matches);

  // A preselected unit (a saved draft's) is brought into view inside the scrolling list.
  useEffect(() => {
    if (hydrated && initialUnit)
      list.current?.querySelector('input:checked')?.scrollIntoView({ block: 'center' });
  }, [hydrated, initialUnit]);

  return (
    <div className={styles.page} role="region" aria-label="Create lease" inert={!hydrated}>
      <header className={cx(styles.topbar, styles.topbarSimple)}>
        <Link className={styles.back} href={backHref} aria-label="Back to leases">
          <Glyph name="back" />
        </Link>
        <p className={styles.place}>New lease</p>
      </header>
      <div className={styles.pickerWrap}>
        <form className={styles.picker} method="get" action="/leases/new">
          {context.applicant && <input type="hidden" name="applicant" value={context.applicant} />}
          {context.tenant && <input type="hidden" name="tenant" value={context.tenant} />}
          {context.renew && <input type="hidden" name="renew" value={context.renew} />}
          <div className={styles.pickerHead}>
            <h1 id="pick-title" className={styles.stepTitle}>
              Which unit?
            </h1>
            <p className={styles.sub}>Choose the unit or home this lease is for.</p>
          </div>
          {units.length ? (
            <>
              <span className={styles.searchBox}>
                <Glyph name="search" className={styles.searchIcon} />
                <input
                  className={styles.input}
                  type="search"
                  aria-label="Search units"
                  placeholder="Search properties and units"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </span>
              <fieldset className={styles.unitList} ref={list}>
                <legend className={styles.srOnly}>Property / unit</legend>
                {groups.map(([property, group]) => (
                  <div
                    key={property}
                    className={styles.unitGroup}
                    role="group"
                    aria-label={property}
                    hidden={!group.some(matches)}
                  >
                    <p className={styles.unitGroupLabel} aria-hidden="true">
                      {property}
                      <span>{group.length}</span>
                    </p>
                    {group.map((unit) => {
                      const [status, tone] = STATUS[unit.status] ?? [unit.status, 'neutral'];
                      return (
                        <label
                          key={unit.id}
                          className={cx(styles.unitRow, unit.id === selectedId && styles.unitRowOn)}
                          hidden={!matches(unit)}
                        >
                          <input
                            type="radio"
                            name="unit"
                            value={unit.id}
                            required
                            checked={unit.id === selectedId}
                            onChange={() => setSelectedId(unit.id)}
                            aria-label={unit.label}
                            aria-describedby={`unit-${unit.id}-meta`}
                          />
                          <span className={styles.unitName}>{unit.name}</span>
                          <span className={styles.unitMeta} id={`unit-${unit.id}-meta`}>
                            {unit.draft && (
                              <span className={styles.draftMark}>
                                Draft saved {unit.draft.saved}
                              </span>
                            )}
                            <StatusTag tone={tone}>{status}</StatusTag>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))}
                {!anyMatch && <p className={styles.emptyRow}>No units match “{query.trim()}”</p>}
              </fieldset>
            </>
          ) : (
            <p className={styles.emptyRow} role="status">
              No units yet. Add a property and unit first.
            </p>
          )}
          {selected?.draft && (
            <div className={styles.draftChoice} role="status">
              <Glyph name="doc" className={styles.draftIcon} />
              <span className={styles.personText}>
                <span className={styles.personName}>Draft in progress</span>
                <span className={styles.personMeta}>
                  Saved {selected.draft.saved} · Step {selected.draft.step} of 10
                </span>
              </span>
              <input type="hidden" name="fresh" value="1" />
            </div>
          )}
          <footer className={styles.pickerFooter}>
            <Link className={cx(styles.btn, styles.btnGhost, styles.pickerCancel)} href={backHref}>
              Cancel
            </Link>
            {selected?.draft ? (
              <span className={styles.pickerActions}>
                <button type="submit" className={cx(styles.btn, styles.btnOutline)}>
                  Start a separate lease
                </button>
                <Link
                  className={cx(styles.btn, styles.btnPrimary)}
                  href={`/leases/new?draft=${encodeURIComponent(selected.draft.id)}`}
                >
                  Resume draft
                </Link>
              </span>
            ) : (
              <button
                type="submit"
                className={cx(styles.btn, styles.btnPrimary)}
                disabled={!units.length}
              >
                Start lease
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}
