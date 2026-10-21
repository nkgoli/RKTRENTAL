'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import type { WorkspaceTab } from './Workspace';
import { workspaceTabHref } from './routes';
import styles from './Workspace.module.css';

const tabs: { label: string; key: WorkspaceTab }[] = [
  { label: 'Overview', key: 'overview' },
  { label: 'Applications', key: 'applications' },
  { label: 'Leases', key: 'leases' },
  { label: 'Payments', key: 'payments' },
  { label: 'Returns & ROI ↗', key: 'returns' },
  { label: 'Maintenance', key: 'maintenance' },
  { label: 'Media', key: 'media' },
];

export function WorkspaceTabs({ propertyId, unitId, activeTab }: { propertyId: string; unitId?: string; activeTab?: WorkspaceTab }) {
  const nav = useRef<HTMLElement>(null);
  const [fade, setFade] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedUnit = searchParams.get('unit') ?? unitId;
  const base = `/properties/${propertyId}`;
  const routeTab = pathname === base ? 'overview' : pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length + 1).split('/')[0] : undefined;
  // The listing route stays reachable directly but has no tab; mark none active there.
  const selected = tabs.find((tab) => tab.key === routeTab)?.key
    ?? (routeTab === 'listing' ? undefined : activeTab ?? 'overview');

  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (active && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, active.offsetLeft - el.offsetLeft - (el.clientWidth - active.clientWidth) / 2);
    const update = () => setFade(el.scrollWidth > el.clientWidth + el.scrollLeft + 4);
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => { el.removeEventListener('scroll', update); observer.disconnect(); };
  }, [selected]);
  return <nav ref={nav} className={`${styles.tabs} ${fade ? styles.tabsFade : ''}`} aria-label="Workspace sections">
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
