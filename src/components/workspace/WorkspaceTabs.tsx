'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { WorkspaceTab } from './Workspace';
import { workspaceTabHref } from './routes';
import styles from './Workspace.module.css';

const tabs: { label: string; key: WorkspaceTab }[] = [
  { label: 'Overview', key: 'overview' },
  { label: 'Listing', key: 'listing' },
  { label: 'Applications', key: 'applications' },
  { label: 'Leases', key: 'leases' },
  { label: 'Payments', key: 'payments' },
  { label: 'Returns', key: 'returns' },
  { label: 'Maintenance', key: 'maintenance' },
];

export function WorkspaceTabs({ propertyId, unitId, activeTab }: { propertyId: string; unitId?: string; activeTab?: WorkspaceTab }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedUnit = searchParams.get('unit') ?? unitId;
  const base = `/properties/${propertyId}`;
  const routeTab = pathname === base ? 'overview' : pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length + 1).split('/')[0] : undefined;
  const selected = tabs.find((tab) => tab.key === routeTab)?.key ?? activeTab ?? 'overview';

  return <nav className={styles.tabs} aria-label="Workspace sections">
    {tabs.map((tab) => {
      // Production RSC transitions to this report can remain pending after a
      // successful response. Use the same document navigation as its range
      // controls; retain native keyboard/history behavior and the scoped URL.
      const TabLink = tab.key === 'returns' ? 'a' : Link;
      return <TabLink
      key={tab.key}
      href={workspaceTabHref(propertyId, tab.key, selectedUnit)}
      className={`${styles.tab} ${selected === tab.key ? styles.active : ''}`}
      aria-current={selected === tab.key ? 'page' : undefined}
    >{tab.label}</TabLink>;
    })}
  </nav>;
}
