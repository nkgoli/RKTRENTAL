import Link from 'next/link';
import { Avatar, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Pagination, pageFrom, paginate } from '@/components/ui/Pagination';
import { leaseName, signLabel, statusLabel, term } from '@/lib/leases/format';
import { leasesDb, type LeaseListItem } from '@/lib/leases/queries';
import { formatMoney, initials } from '@/lib/properties/format';
import type { ScopeFilter } from '@/lib/workspace/scope';
import { withUnit } from './scope';
import styles from './leasing.module.css';

type Section = { key: 'current' | 'drafts' | 'past'; title: string; leases: LeaseListItem[]; empty: string };

function LeaseCard({ lease, showUnit }: { lease: LeaseListItem; showUnit: boolean }) {
  const name = leaseName(lease);
  const unit = lease.unit.isImplicit ? 'Whole property' : `Unit ${lease.unit.number}`;
  return <li className={styles.leaseCard} data-lease={lease.id}>
    <Avatar initials={initials(name)} size="sm" />
    <div className={styles.leaseMain}>
      <strong><Link href={`/leases/${lease.id}`}>{name}</Link></strong>
      <small>{showUnit && `${unit} · `}{term(lease.startDate, lease.endDate)} · {formatMoney(Number(lease.monthlyRent))}/mo</small>
    </div>
    <div className={styles.leaseStatus}>
      <Badge tone={lease.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(lease.status)}</Badge>
      {lease.status === 'ACTIVE' && lease.eSignStatus !== 'SIGNED' && <small className="muted">{signLabel(lease.eSignStatus)}</small>}
    </div>
    <div className={styles.leaseActions}>
      {lease.status === 'DRAFT'
        ? <Button href={`/leases/new?draft=${lease.id}`} size="sm" variant="primary">Continue setup</Button>
        : <Button href={`/leases/${lease.id}`} size="sm" variant="ghost">View</Button>}
      {lease.status === 'ACTIVE' && <Button href={`/leases/new?renew=${lease.id}`} size="sm" variant="ghost">Renew</Button>}
    </div>
  </li>;
}

/** Leases for one property (and optionally one unit) as Current, Drafts and Past; cards open the lease detail page. */
export async function LeasesPanel({ organizationId, scope, page }: { organizationId: string; scope: ScopeFilter; page?: string }) {
  const { leases } = await leasesDb(organizationId).list(scope);
  const newLease = scope.unitId ? `/leases/new?unit=${encodeURIComponent(scope.unitId)}` : '/leases/new';
  const byStart = (a: LeaseListItem, b: LeaseListItem) => b.startDate.getTime() - a.startDate.getTime();
  const sections: Section[] = [
    { key: 'current', title: 'Current', leases: leases.filter((l) => l.status === 'ACTIVE').sort(byStart), empty: 'No current lease.' },
    { key: 'drafts', title: 'Drafts', leases: leases.filter((l) => l.status === 'DRAFT').sort(byStart), empty: 'No drafts in progress.' },
    { key: 'past', title: 'Past', leases: leases.filter((l) => l.status === 'ENDED' || l.status === 'TERMINATED').sort(byStart), empty: 'No past leases.' },
  ];
  const showUnit = !scope.unitId;
  // Past leases pile up over the years; page them like every other long list.
  const past = sections[2].leases;
  const pastPage = pageFrom(page, past.length);
  const pastHref = (n: number) => withUnit(`/properties/${scope.propertyId}/leases`, scope.unitId, n > 1 ? { page: String(n) } : {});

  return <section className={styles.panel} aria-label="Leases">
    <div className={styles.pageHeader}>
      <div>
        <h2>Leases</h2>
        <p className="muted">{leases.length === 0 ? 'Nothing set up yet.' : `${leases.length} lease${leases.length === 1 ? '' : 's'} for ${scope.unitId ? 'this unit' : 'this property'}.`}</p>
      </div>
      <Button href={newLease} variant="primary" size="sm">Set up lease</Button>
    </div>
    {leases.length === 0 && <div className={`card ${styles.emptyCard}`}>
      <strong>No leases yet</strong>
      <p className="muted">Set up a lease to start collecting rent.</p>
    </div>}
    {sections.map((section) => <div key={section.key} className={styles.leaseSection} aria-label={`${section.title} leases`}>
      <h3>{section.title} <span className="muted">{section.leases.length}</span></h3>
      {section.leases.length === 0
        ? <p className={styles.sectionEmpty}>{section.empty}</p>
        : <div className="card flush">
          <ul className={styles.leaseList}>{(section.key === 'past' ? paginate(past, pastPage) : section.leases).map((lease) => <LeaseCard key={lease.id} lease={lease} showUnit={showUnit} />)}</ul>
          {section.key === 'past' && <Pagination page={pastPage} total={past.length} noun="past leases" href={pastHref} />}
        </div>}
    </div>)}
  </section>;
}
