import Link from 'next/link';
import { Avatar, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { leaseName, signLabel, statusLabel, term } from '@/lib/leases/format';
import { leasesDb } from '@/lib/leases/queries';
import { formatMoney, initials } from '@/lib/properties/format';
import type { ScopeFilter } from '@/lib/workspace/scope';
import styles from './leasing.module.css';

/** Leases for one property (and optionally one unit); rows open the existing lease detail page. */
export async function LeasesPanel({ organizationId, scope }: { organizationId: string; scope: ScopeFilter }) {
  const { leases } = await leasesDb(organizationId).list(scope);
  const newLease = scope.unitId ? `/leases/new?unit=${encodeURIComponent(scope.unitId)}` : '/leases/new';

  return <section className={styles.panel} aria-label="Leases">
    <div className="card flush">
      <div className={styles.listHeader}>
        <h3>Leases</h3>
        <Button href={newLease} variant="primary" size="sm">+ New lease</Button>
      </div>
      {leases.length === 0 ? <p className={styles.empty}>No leases yet. Create a lease to start collecting rent.</p> : <table className="table">
        <thead><tr><th>Tenant</th><th>Unit</th><th>Term</th><th className="num">Rent</th><th>Status</th></tr></thead>
        <tbody>{leases.map((lease) => <tr key={lease.id}>
          <td><div className="cell-main">
            <Avatar initials={initials(leaseName(lease))} size="sm" />
            <strong><Link href={`/leases/${lease.id}`} style={{ color: 'inherit' }}>{leaseName(lease)}</Link></strong>
          </div></td>
          <td>{lease.unit.isImplicit ? 'Whole property' : `Unit ${lease.unit.number}`}</td>
          <td>{term(lease.startDate, lease.endDate)}</td>
          <td className="num">{formatMoney(Number(lease.monthlyRent))}</td>
          <td>
            <Badge tone={lease.status === 'ACTIVE' ? 'success' : 'neutral'}>{statusLabel(lease.status)}</Badge>
            {lease.status === 'ACTIVE' && lease.eSignStatus !== 'SIGNED' && <small className="muted" style={{ display: 'block' }}>{signLabel(lease.eSignStatus)}</small>}
          </td>
        </tr>)}</tbody>
      </table>}
    </div>
  </section>;
}
