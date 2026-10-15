import Link from 'next/link';
import { Badge, Cover } from '@/components/ui';
import type { CoverKind } from '@/components/ui';
import styles from './Workspace.module.css';

export type WorkspaceTab = 'overview' | 'listing' | 'returns';

export type WorkspaceScope = {
  propertyId: string;
  propertyName: string;
  propertyType: string;
  propertyArchived?: boolean;
  propertyAddress?: string;
  activeUnitCount?: number;
  unitId?: string;
  unitNumber?: string;
  unitIsImplicit?: boolean;
  unitStatus?: string;
};

export type WorkspaceAction = { label: string; href: string; primary?: boolean };

const tabs = ['Overview', 'Listing', 'Applications', 'Leases', 'Payments', 'Returns', 'Maintenance', 'Documents'] as const;

function scopedHref(scope: WorkspaceScope, tab: (typeof tabs)[number]): string {
  const base = scope.unitId
    ? `/properties/${scope.propertyId}/units/${scope.unitId}`
    : `/properties/${scope.propertyId}`;
  if (tab === 'Overview') return base;
  if (tab === 'Listing') return `${base}?tab=listing`;
  if (tab === 'Returns') return `${base}?tab=returns`;

  const query = new URLSearchParams();
  if (tab === 'Applications' || tab === 'Leases') {
    query.set('q', scope.unitNumber ? `${scope.propertyName} ${scope.unitNumber}` : scope.propertyName);
    return `/${tab === 'Applications' ? 'applications' : 'leases'}?${query}`;
  }
  query.set('propertyId', scope.propertyId);
  if (scope.unitId) query.set('unitId', scope.unitId);
  if (tab === 'Payments') return `/payments?${query}`;
  if (tab === 'Maintenance') return `/maintenance?${query}`;
  return `/documents?${query}`;
}

function propertyTypeLabel(scope: WorkspaceScope): string {
  if (scope.activeUnitCount === 1 || scope.propertyType === 'SINGLE_UNIT') return 'Single-family';
  return 'Multi-unit';
}

function statusLabel(scope: WorkspaceScope): string {
  if (scope.propertyArchived) return 'Archived';
  if (!scope.unitId) return 'Active';
  const status = scope.unitStatus ?? '';
  return ({ OCCUPIED: 'Occupied', VACANT: 'Vacant', TURNOVER: 'Turnover', ARCHIVED: 'Archived' } as Record<string, string>)[status] ?? 'Active';
}

export function Workspace({
  scope,
  activeTab,
  actions = [],
  coverKind,
  coverSrc,
}: {
  scope: WorkspaceScope;
  activeTab: WorkspaceTab;
  actions?: WorkspaceAction[];
  coverKind?: CoverKind;
  coverSrc?: string;
}) {
  const base = scope.unitId
    ? `/properties/${scope.propertyId}/units/${scope.unitId}`
    : `/properties/${scope.propertyId}`;
  const title = scope.unitId
    ? scope.unitIsImplicit ? scope.propertyName : `${scope.propertyName} · Unit ${scope.unitNumber}`
    : scope.propertyName;

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerCopy}>
          <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
            <Link href="/properties">Properties</Link>
            {scope.unitId && (
              <>
                <span aria-hidden="true">/</span>
                <Link href={`/properties/${scope.propertyId}`}>{scope.propertyName}</Link>
              </>
            )}
            <span aria-hidden="true">/</span>
            <span aria-current="page">{scope.unitId && !scope.unitIsImplicit ? `Unit ${scope.unitNumber}` : title}</span>
          </nav>
          <div className={styles.titleLine}>
            <div>
              <p className={styles.eyebrow}>Property workspace</p>
              <h1>{title}</h1>
              {scope.propertyAddress && <p className={styles.address}>{scope.propertyAddress}</p>}
            </div>
            <div className={styles.badges}>
              <Badge tone={statusLabel(scope) === 'Occupied' || statusLabel(scope) === 'Active' ? 'success' : 'info'}>
                {statusLabel(scope)}
              </Badge>
              <Badge tone="info">{propertyTypeLabel(scope)}</Badge>
            </div>
          </div>
          {actions.length > 0 && (
            <div className={styles.actions}>
              {actions.map((action) => (
                <Link key={action.label} className={`btn ${action.primary ? 'btn-primary' : 'btn-secondary'}`} href={action.href}>
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        {coverKind && (
          <div className={styles.cover}>
            <Cover kind={coverKind} src={coverSrc} />
          </div>
        )}
      </header>
      <nav className={styles.tabs} aria-label="Workspace sections">
        {tabs.map((tab) => {
          const selected = tab.toLowerCase() === activeTab;
          return (
            <Link
              key={tab}
              href={scopedHref(scope, tab)}
              className={`${styles.tab} ${selected ? styles.active : ''}`}
              aria-current={selected ? 'page' : undefined}
            >
              {tab}
            </Link>
          );
        })}
      </nav>
      <span className={styles.currentPath} data-workspace-path={base} aria-hidden="true" />
    </>
  );
}
