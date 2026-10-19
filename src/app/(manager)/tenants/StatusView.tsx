import { Fragment } from 'react';
import Link from 'next/link';
import {
  Avatar,
  Button,
  Card,
  cx,
  Pagination,
  pageFrom,
  paginate,
  SearchInput,
  TrendChip,
} from '@/components/ui';
import { formatDate, initials } from '@/lib/tenants/format';
import type { organizationTenants } from '@/lib/tenants/queries';
import { EmptyState } from '@/components/RouteStates';
import styles from './tenants.module.css';

type SetupRow = Awaited<ReturnType<ReturnType<typeof organizationTenants>['setupRows']>>[number];

function href(q?: string, property?: string, period?: string, page?: number) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (property) params.set('property', property);
  if (period === 'upcoming') params.set('period', period);
  if (page && page > 1) params.set('page', String(page));
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
  page,
}: {
  rows: SetupRow[];
  properties: { id: string; name: string }[];
  q?: string;
  property?: string;
  period: 'current' | 'upcoming';
  page?: string;
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
  const current = pageFrom(page, shown.length);
  const attention = shown.filter(
    (row) => row.checklist.bankAdded === 'incomplete' || row.checklist.autopayOn === 'incomplete',
  ).length;
  return (
    <section className={styles.statusSection} aria-labelledby="tenant-status-title">
      <div className={styles.statusHeading}>
        <div>
          <h2 id="tenant-status-title">Tenant status</h2>
          <p className="muted">Who has finished setup — and who still needs a nudge.</p>
        </div>
        <div className={styles.headingPeople}>
          <TrendChip warm>{attention} need attention</TrendChip>
        </div>
      </div>
      <div className={styles.statusControls}>
        <div className="chips" aria-label="Lease period">
          <Link
            className={cx('chip', period === 'current' && 'active')}
            aria-current={period === 'current' ? 'true' : undefined}
            href={href(q, property)}
          >
            Current tenants
          </Link>
          <Link
            className={cx('chip', period === 'upcoming' && 'active')}
            aria-current={period === 'upcoming' ? 'true' : undefined}
            href={href(q, property, 'upcoming')}
          >
            Upcoming tenants
          </Link>
        </div>
      </div>
      <form action="/tenants" method="get" role="search" className={styles.filterForm}>
        {period === 'upcoming' && <input type="hidden" name="period" value="upcoming" />}
        <label className={styles.searchField}>
          <span>Search tenants</span>
          <SearchInput name="q" defaultValue={q} placeholder="Property, tenant or email" />
        </label>
        <label className={styles.filterField}>
          <span>Property</span>
          <select name="property" defaultValue={property ?? ''}>
            <option value="">All properties</option>
            {properties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
        {(q || property) && (
          <Link className="btn btn-ghost btn-sm" href={href(undefined, undefined, period)}>
            Clear filters
          </Link>
        )}
      </form>
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
        <div
          className={styles.tableScroll}
          role="region"
          aria-label="Tenant setup checklist"
          tabIndex={0}
        >
          <table className={styles.statusTable}>
            <thead>
              <tr>
                <th scope="col">Lease</th>
                <th scope="col">Tenant info</th>
                {checklistLabels.map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
                <th scope="col">Actions</th>
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
              {paginate(shown, current).map((row) => {
                return (
                  <Fragment key={`${row.leaseId}:${row.tenant.id}`}>
                    <tr>
                      <td>
                        <span className="cell-main">
                          <span>
                            <strong>
                              <Link href={`/properties/${row.property.id}`}>
                                {row.property.name}
                              </Link>{' '}
                              ·{' '}
                              <Link
                                href={`/properties/${row.property.id}?unit=${encodeURIComponent(row.unit.id)}`}
                              >
                                {row.unit.isImplicit ? 'Single-unit' : `Unit ${row.unit.number}`}
                              </Link>
                            </strong>
                            <small>
                              <Link href={`/leases/${row.leaseId}`}>
                                {formatDate(row.startDate)} – {formatDate(row.endDate)}
                              </Link>
                            </small>
                          </span>
                        </span>
                      </td>
                      <td>
                        <Link
                          className="cell-main"
                          href={`/tenants/${row.tenant.id}?${new URLSearchParams({ returnTo: href(q, property, period, current) })}`}
                        >
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
                          <td
                            key={field}
                            className={styles.checkCell}
                            data-label={checklistLabels[checklistFields.indexOf(field)]}
                          >
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
        <Pagination
          page={current}
          total={shown.length}
          noun="tenants"
          href={(n) => href(q, property, period, n)}
        />
      </Card>
      <p className="muted">
        Invitation, acceptance and bank verification are not tracked yet. Card on file is not
        applicable when a tenant uses ACH autopay without a card. Messaging and invitations are not
        available.
      </p>
    </section>
  );
}
