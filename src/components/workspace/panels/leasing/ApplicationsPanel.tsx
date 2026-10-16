import Link from 'next/link';
import { Avatar, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db/client';
import { initials } from '@/lib/properties/format';
import type { ApplicationStatus } from '@/lib/screening/policy';
import { unitScopeWhere, scopeQuery, type ScopeFilter } from '@/lib/workspace/scope';
import styles from './leasing.module.css';

const labels: Record<ApplicationStatus, string> = {
  SUBMITTED: 'Awaiting consent',
  SCREENING: 'Screening in progress',
  REVIEW: 'Ready for review',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
};
const tones: Record<ApplicationStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  SUBMITTED: 'neutral', SCREENING: 'warning', REVIEW: 'success', APPROVED: 'success', DECLINED: 'danger',
};
const date = (value: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(value);

/** Applications for one property (and optionally one unit); rows open the existing review page. */
export async function ApplicationsPanel({ organizationId, scope }: { organizationId: string; scope: ScopeFilter }) {
  const applications = await db.application.findMany({
    where: { organizationId, ...unitScopeWhere(scope) },
    include: { unit: true },
    orderBy: { appliedAt: 'desc' },
  });
  const approved = applications.find((a) => a.status === 'APPROVED');
  const createLease = new URLSearchParams();
  const leaseUnit = approved?.unitId ?? scope.unitId;
  if (leaseUnit) createLease.set('unit', leaseUnit);
  if (approved) createLease.set('applicant', approved.id);
  const reviewHref = (id: string) => {
    const query = scopeQuery(scope);
    query.set('applicant', id);
    return `/applications?${query}`;
  };

  return <section className={styles.panel} aria-label="Applications">
    <div className="card flush">
      <div className={styles.listHeader}>
        <h3>Applicants</h3>
        <Button href={`/leases/new${createLease.size ? `?${createLease}` : ''}`} variant="primary" size="sm">Create lease</Button>
      </div>
      {applications.length === 0 ? <p className={styles.empty}>No applications yet. Applications for this property will appear here.</p> : <table className="table">
        <thead><tr><th>Applicant</th><th>Unit</th><th>Applied</th><th>Status</th></tr></thead>
        <tbody>{applications.map((application) => <tr key={application.id}>
          <td><div className="cell-main">
            <Avatar initials={initials(application.applicantName)} size="sm" />
            <div>
              <strong><Link href={reviewHref(application.id)} style={{ color: 'inherit' }}>{application.applicantName}</Link></strong>
              <small>{application.applicantEmail}</small>
            </div>
          </div></td>
          <td>{application.unit.isImplicit ? 'Whole property' : `Unit ${application.unit.number}`}</td>
          <td>{date(application.appliedAt)}</td>
          <td><Badge tone={tones[application.status as ApplicationStatus]}>{labels[application.status as ApplicationStatus]}</Badge></td>
        </tr>)}</tbody>
      </table>}
    </div>
  </section>;
}
