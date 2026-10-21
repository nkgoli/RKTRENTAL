'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WorkspaceUnit } from './Workspace';
import styles from './Workspace.module.css';

/** Switches the property workspace between the whole property and one unit, staying on the current tab. */
export function UnitSwitcher({ propertyName, units }: { propertyName: string; units: WorkspaceUnit[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get('unit') ?? '';
  const selectable = units.filter((unit) => !unit.isImplicit && unit.status !== 'ARCHIVED');
  if (selectable.length === 0) return null;

  function change(unitId: string) {
    // Only view-level params carry over; notices and one-shot flags belong to the previous page.
    const next = new URLSearchParams();
    for (const name of ['period', 'from', 'to']) {
      const value = searchParams.get(name);
      if (value) next.set(name, value);
    }
    if (unitId) next.set('unit', unitId);
    router.push(`${pathname}${next.size ? `?${next}` : ''}`);
  }

  return <label className={styles.switcher}>
    <span>View</span>
    <select aria-label="Switch unit" value={selectable.some((unit) => unit.id === current) ? current : ''} onChange={(event) => change(event.target.value)}>
      <option value="">{propertyName} · all units</option>
      {selectable.map((unit) => <option key={unit.id} value={unit.id}>Unit {unit.number}</option>)}
    </select>
  </label>;
}
