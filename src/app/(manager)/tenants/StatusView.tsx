import { Fragment } from 'react';
import Link from 'next/link';
import { Avatar, AvatarStack, Card, cx, SearchInput, TrendChip } from '@/components/ui';
import { formatDate, initials } from '@/lib/tenants/format';
import type { organizationTenants } from '@/lib/tenants/queries';
import { EmptyState } from '@/components/RouteStates';
import styles from './tenants.module.css';

type SetupRow = Awaited<ReturnType<ReturnType<typeof organizationTenants>['setupRows']>>[number];

function href(q?: string, property?: string, period?: string) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (property) params.set('property', property);
  if (period === 'upcoming') params.set('period', period);
  return `/tenants${params.size ? `?${params}` : ''}`;
}

const checklistFields = [
  'invited',
  'accepted',
  'bankAdded',
  'bankVerified',
  'autopayOn',
  'cardOnFile',
] as const;
const checklistLabels = [
  'Invited',
  'Accepted',
  'Bank added',
  'Bank verified',
  'Autopay on',
  'Card on file',
];

export function StatusView({
  rows,
  properties,
  q,
  property,
  period,
}: {
  rows: SetupRow[];
  properties: { id: string; name: string }[];
  q?: string;
  property?: string;
  period: 'current' | 'upcoming';
}) {
  const shown = rows.filter((row) => {
    if (period === 'upcoming' ? row.leaseStatus !== 'DRAFT' : row.leaseStatus !== 'ACTIVE')
      return false;
    if (property && row.property.id !== property) return false;
    return (
      !q ||
      `${row.tenant.name} ${row.tenant.email ?? ''} ${row.property.name} ${row.unit.number}`
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  });
  const attention = shown.filter(
    (row) => row.checklist.bankAdded === 'incomplete' || row.checklist.autopayOn === 'incomplete',
  ).length;
  return (
    <section className={styles.statusSection} aria-labelledby="tenant-status-title">
      <div className={styles.statusHeading}>
        <div>
          <p className="eyebrow">Onboarding and payments</p>
          <h2 id="tenant-status-title">Tenant status</h2>
          <p className="muted">Who has finished setup — and who still needs a nudge.</p>
        </div>
        <div className={styles.headingPeople}>
          <AvatarStack initials={shown.slice(0, 4).map((row) => initials(row.tenant.name))} />
          <TrendChip warm>{attention} need attention</TrendChip>
        </div>
      </div>
      <div className={styles.statusControls}>
        <div className="chips" aria-label="Lease period">
          <Link className={cx('chip', period === 'current' && 'active')} href={href(q, property)}>
            Current tenants
          </Link>
          <Link
            className={cx('chip', period === 'upcoming' && 'active')}
            href={href(q, property, 'upcoming')}
          >
            Upcoming tenants
          </Link>
        </div>
        <form action="/tenants" method="get" role="search" className={styles.statusSearch}>
          {period === 'upcoming' && <input type="hidden" name="period" value="upcoming" />}
          {property && <input type="hidden" name="property" value={property} />}
          <SearchInput name="q" defaultValue={q} placeholder="Search property or tenant" />
        </form>
      </div>
      <div className={styles.propertyFilters} aria-label="Filter by property">
        <Link className={cx('chip', !property && 'active')} href={href(q, undefined, period)}>
          All properties
        </Link>
        {properties.map((item) => (
          <Link
            key={item.id}
            className={cx('chip', property === item.id && 'active')}
            href={href(q, item.id, period)}
          >
            {item.name}
          </Link>
        ))}
      </div>
      <div className={styles.legend} aria-label="Checklist legend">
        <span>
          <b className={styles.complete}>✓</b> Complete
        </span>
        <span>
          <b className={styles.incomplete}>!</b> Incomplete
        </span>
        <span>
          <b className={styles.na}>—</b> Not applicable
        </span>
      </div>
      <Card flush>
        <div className={styles.tableScroll}>
          <table className={styles.statusTable}>
            <thead>
              <tr>
                <th>Dates / lease</th>
                <th>Tenant info</th>
                {checklistLabels.map((label) => (
                  <th key={label}>{label}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <EmptyState
                      title="No tenants match this view"
                      description="Try another property, tenant, or lease period."
                      action="View current tenants"
                      href="/tenants"
                    />
                  </td>
                </tr>
              )}
              {shown.map((row, index) => {
                const group = `${row.property.id}:${row.unit.id}:${row.leaseId}`;
                const previous = shown[index - 1];
                const showGroup =
                  !previous ||
                  `${previous.property.id}:${previous.unit.id}:${previous.leaseId}` !== group;
                return (
                  <Fragment key={`${row.leaseId}:${row.tenant.id}`}>
                    {showGroup && (
                      <tr className={styles.groupRow}>
                        <td colSpan={9}>
                          <strong>
                            <Link href={`/properties/${row.property.id}`}>{row.property.name}</Link>{' '}
                            · {row.unit.isImplicit ? 'Single-unit' : `Unit ${row.unit.number}`}
                          </strong>
                          <span>
                            {period === 'upcoming' ? 'Upcoming lease' : 'Current lease'} ·{' '}
                            {formatDate(row.startDate)} – {formatDate(row.endDate)}
                          </span>
                          <Link href={`/leases/${row.leaseId}`}>View lease →</Link>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td>
                        <Link href={`/leases/${row.leaseId}`}>
                          {formatDate(row.startDate)} – {formatDate(row.endDate)}
                        </Link>
                      </td>
                      <td>
                        <Link className="cell-main" href={`/tenants/${row.tenant.id}`}>
                          <Avatar initials={initials(row.tenant.name)} />
                          <span>
                            <strong>{row.tenant.name}</strong>
                            <small>
                              {row.tenant.email ?? row.tenant.phone ?? 'No contact on file'}
                            </small>
                          </span>
                        </Link>
                      </td>
                      {checklistFields.map((field) => {
                        const state = row.checklist[field];
                        return (
                          <td key={field} className={styles.checkCell}>
                            <span
                              className={styles[state === 'not-applicable' ? 'na' : state]}
                              title={state === 'not-applicable' ? 'Not applicable' : state}
                              aria-label={`${checklistLabels[checklistFields.indexOf(field)]}: ${state}`}
                            >
                              {state === 'complete' ? '✓' : state === 'incomplete' ? '!' : '—'}
                            </span>
                          </td>
                        );
                      })}
                      <td className={styles.actions}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled
                          title="Messaging is not available"
                        >
                          Message
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled
                          title="Invitations are not available"
                        >
                          Resend invite
                        </button>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="muted">
        Invitation, acceptance and bank verification are not tracked yet. Card on file is not
        applicable when a tenant uses ACH autopay without a card.
      </p>
    </section>
  );
}
