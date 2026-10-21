'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge, Cover } from '@/components/ui';
import type { CoverKind } from '@/components/ui';
import type { WorkspaceScope, WorkspaceUnit } from './Workspace';
import { UnitSwitcher } from './UnitSwitcher';
import styles from './Workspace.module.css';

function propertyTypeLabel(scope: WorkspaceScope) {
  return scope.activeUnitCount === 1 || scope.propertyType === 'SINGLE_UNIT' ? 'Single-family' : 'Multi-unit';
}

function statusLabel(scope: WorkspaceScope) {
  if (scope.propertyArchived) return 'Archived';
  if (!scope.unitId) return 'Active';
  return ({ OCCUPIED: 'Occupied', VACANT: 'Vacant', TURNOVER: 'Turnover', ARCHIVED: 'Archived' } as Record<string, string>)[scope.unitStatus ?? ''] ?? 'Active';
}

export function WorkspaceHeader({ scope, units, coverKind, coverSrc }: {
  scope: WorkspaceScope;
  units: WorkspaceUnit[];
  coverKind?: CoverKind;
  coverSrc?: string;
}) {
  const searchParams = useSearchParams();
  const selectedUnit = units.find((unit) => unit.id === searchParams.get('unit'));
  const current = selectedUnit ? {
    ...scope,
    unitId: selectedUnit.id,
    unitNumber: selectedUnit.number,
    unitIsImplicit: selectedUnit.isImplicit,
    unitStatus: selectedUnit.status,
  } : scope;
  const title = current.unitId && !current.unitIsImplicit
    ? `${current.propertyName} · Unit ${current.unitNumber}` : current.propertyName;
  const status = statusLabel(current);

  return <header className={styles.header} data-workspace-header="true">
    <div className={styles.headerCopy}>
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <Link href="/properties">Properties</Link>
        {current.unitId && !current.unitIsImplicit && <>
          <span aria-hidden="true">/</span>
          <Link href={`/properties/${scope.propertyId}`}>{scope.propertyName}</Link>
        </>}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{current.unitId && !current.unitIsImplicit ? `Unit ${current.unitNumber}` : title}</span>
      </nav>
      <div className={styles.titleLine}>
        <h1>{title}</h1>
        <div className={styles.badges}>
          <Badge tone={status === 'Occupied' || status === 'Active' ? 'success' : 'info'}>{status}</Badge>
          <span className="muted">{propertyTypeLabel(scope)}</span>
        </div>
        {scope.propertyAddress && <p className={styles.address}>{scope.propertyAddress}</p>}
      </div>
      {propertyTypeLabel(scope) === 'Multi-unit' && <UnitSwitcher propertyName={scope.propertyName} units={units} />}
      <div className={styles.headerActions}>
        <Link className="btn btn-secondary btn-sm" href={`/properties/${scope.propertyId}/edit`}>Edit property</Link>
      </div>
    </div>
    <div className={styles.cover}><Cover kind={coverKind ?? (scope.activeUnitCount === 1 ? 'house' : 'apartment')} src={coverSrc} /></div>
  </header>;
}
