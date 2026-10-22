'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ActionGlyph, Badge, Cover } from '@/components/ui';
import type { BadgeTone, CoverKind } from '@/components/ui';
import type { WorkspaceScope, WorkspaceUnit } from './Workspace';
import { UnitSwitcher } from './UnitSwitcher';
import styles from './Workspace.module.css';

function propertyTypeLabel(scope: WorkspaceScope) {
  return scope.activeUnitCount === 1 || scope.propertyType === 'SINGLE_UNIT'
    ? 'Single-family'
    : 'Multi-unit';
}

/** "Multi-unit · 12 units" or "Single-family". */
export function headerEyebrow(scope: WorkspaceScope) {
  const type = propertyTypeLabel(scope);
  if (type === 'Single-family' || scope.activeUnitCount == null) return type;
  return `${type} · ${scope.activeUnitCount} unit${scope.activeUnitCount === 1 ? '' : 's'}`;
}

function statusLabel(scope: WorkspaceScope) {
  if (scope.propertyArchived) return 'Archived';
  if (!scope.unitId) return 'Active';
  return (
    (
      {
        OCCUPIED: 'Occupied',
        VACANT: 'Vacant',
        TURNOVER: 'Turnover',
        ARCHIVED: 'Archived',
      } as Record<string, string>
    )[scope.unitStatus ?? ''] ?? 'Active'
  );
}

const statusTone: Record<string, BadgeTone> = {
  Active: 'success',
  Occupied: 'success',
  Vacant: 'warning',
  Turnover: 'info',
  Archived: 'neutral',
};

function MapPin() {
  return (
    <svg
      focusable="false"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

export function WorkspaceHeader({
  scope,
  units,
  coverKind,
  coverSrc,
}: {
  scope: WorkspaceScope;
  units: WorkspaceUnit[];
  coverKind?: CoverKind;
  coverSrc?: string;
}) {
  const searchParams = useSearchParams();
  const selectedUnit = units.find((unit) => unit.id === searchParams.get('unit'));
  const current = selectedUnit
    ? {
        ...scope,
        unitId: selectedUnit.id,
        unitNumber: selectedUnit.number,
        unitIsImplicit: selectedUnit.isImplicit,
        unitStatus: selectedUnit.status,
      }
    : scope;
  const unitScoped = !!current.unitId && !current.unitIsImplicit;
  const title = unitScoped
    ? `${current.propertyName} · Unit ${current.unitNumber}`
    : current.propertyName;
  const status = statusLabel(current);
  const multiUnit = propertyTypeLabel(scope) === 'Multi-unit';

  return (
    <header className={styles.header} data-workspace-header="true">
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/properties">Properties</Link>
        {unitScoped && (
          <>
            <span aria-hidden="true">/</span>
            <Link href={`/properties/${scope.propertyId}`}>{scope.propertyName}</Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{unitScoped ? `Unit ${current.unitNumber}` : title}</span>
      </nav>
      <div className={styles.headRow}>
        <div className={styles.identity}>
          <div className={styles.cover}>
            <Cover
              kind={coverKind ?? (scope.activeUnitCount === 1 ? 'house' : 'apartment')}
              src={coverSrc}
            />
          </div>
          <div className={styles.headerCopy}>
            <p className={`eyebrow ${styles.eyebrow}`}>{headerEyebrow(scope)}</p>
            <div className={styles.titleLine}>
              <h1>{title}</h1>
              <Badge tone={statusTone[status] ?? 'neutral'}>{status}</Badge>
            </div>
            {/* The address and type live here once; overview cards do not repeat them. */}
            {scope.propertyAddress && (
              <p className={styles.address}>
                <MapPin />
                <span>{scope.propertyAddress}</span>
              </p>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          {multiUnit && <UnitSwitcher propertyName={scope.propertyName} units={units} />}
          <Link className="btn btn-secondary btn-sm" href={`/properties/${scope.propertyId}/edit`}>
            <ActionGlyph name="edit" />
            Edit property
          </Link>
        </div>
      </div>
    </header>
  );
}
