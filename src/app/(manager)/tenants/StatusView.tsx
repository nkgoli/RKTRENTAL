import Link from 'next/link';
import { Alert, Avatar, Badge, Button, Card, cx, pageFrom, paginate } from '@/components/ui';
import { Icon } from '@/components/shell/Icons';
import { formatDate, initials } from '@/lib/tenants/format';
import type { organizationTenants } from '@/lib/tenants/queries';
import type { SetupState } from '@/lib/tenants/status';
import { TenantPager } from './Pager';
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
const NOT_TRACKED = new Set<(typeof checklistFields)[number]>([
  'invited',
  'accepted',
  'bankVerified',
]);

function stateLabel(field: (typeof checklistFields)[number], state: SetupState) {
  if (NOT_TRACKED.has(field)) return 'Not tracked';
  if (state === 'complete') return '✓ Complete';
  if (state === 'incomplete') return '! Incomplete';
  return '— Not applicable';
}

function stateClass(field: (typeof checklistFields)[number], state: SetupState) {
  if (NOT_TRACKED.has(field)) return styles.unknown;
  if (state === 'complete') return styles.complete;
  if (state === 'incomplete') return styles.incomplete;
  return styles.unknown;
}

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
  const paged = paginate(shown, current);
  const attention = shown.filter(
    (row) => row.checklist.bankAdded === 'incomplete' || row.checklist.autopayOn === 'incomplete',
  ).length;

  return (
    <section className={styles.status} aria-labelledby="tenant-status-title">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="tenant-status-title">Tenant status</h2>
          <p>Who has finished setup — and who still needs a nudge.</p>
        </div>
      </div>

      <div className={styles.period} role="group" aria-label="Lease period">
        <Link
          className={cx(styles.periodLink, period === 'current' && styles.periodActive)}
          aria-current={period === 'current' ? 'true' : undefined}
          href={href(q, property)}
        >
          Current tenants
        </Link>
        <Link
          className={cx(styles.periodLink, period === 'upcoming' && styles.periodActive)}
          aria-current={period === 'upcoming' ? 'true' : undefined}
          href={href(q, property, 'upcoming')}
        >
          Upcoming tenants
        </Link>
      </div>

      <form
        action="/tenants"
        method="get"
        role="search"
        aria-label="Status filters"
        className={styles.filters}
      >
        {period === 'upcoming' && <input type="hidden" name="period" value="upcoming" />}
        <label className={styles.filterField}>
          <span>Search tenants</span>
          <input type="search" name="q" defaultValue={q} placeholder="Property, tenant or email" />
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

      <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
        <p className={styles.meta}>
          {period === 'upcoming' ? 'Draft leases' : 'Active leases'} · {shown.length}{' '}
          {shown.length === 1 ? 'tenant' : 'tenants'} in this view
        </p>
        <Badge tone="warning">
          {attention} need{attention === 1 ? 's' : ''} attention
        </Badge>
      </div>

      <Card flush className={styles.statusCard}>
        <div role="region" aria-label="Tenant setup checklist">
          {paged.length === 0 ? (
            <div className={styles.empty}>
              <Icon name="tenants" />
              <h3>No tenants match this view</h3>
              <p>Try another property, tenant, or lease period.</p>
              <Link className="btn btn-secondary" href="/tenants">
                View current tenants
              </Link>
            </div>
          ) : (
            paged.map((row) => (
              <article className={styles.setup} key={`${row.leaseId}:${row.tenant.id}`}>
                <div className={styles.setupInfo}>
                  <Link
                    className={styles.person}
                    href={`/tenants/${row.tenant.id}?${new URLSearchParams({ returnTo: href(q, property, period, current) })}`}
                  >
                    <Avatar initials={initials(row.tenant.name)} />
                    <span>
                      <strong>{row.tenant.name}</strong>
                      <small>{row.tenant.email ?? row.tenant.phone ?? 'No contact on file'}</small>
                    </span>
                  </Link>
                  <div className={styles.setupLinks}>
                    <Link href={`/properties/${row.property.id}`}>{row.property.name}</Link>
                    <Link
                      href={`/properties/${row.property.id}?unit=${encodeURIComponent(row.unit.id)}`}
                    >
                      {row.unit.isImplicit ? 'Single-unit' : `Unit ${row.unit.number}`}
                    </Link>
                  </div>
                  <Link className={styles.meta} href={`/leases/${row.leaseId}`}>
                    {formatDate(row.startDate)} – {formatDate(row.endDate)}
                  </Link>
                  {row.leaseStatus === 'DRAFT' && <Badge tone="info">Draft lease</Badge>}
                </div>
                <dl className={styles.checks}>
                  {checklistFields.map((field, index) => {
                    const state = row.checklist[field];
                    return (
                      <div key={field}>
                        <dt>{checklistLabels[index]}</dt>
                        <dd className={stateClass(field, state)}>{stateLabel(field, state)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </article>
            ))
          )}
          <TenantPager
            page={current}
            total={shown.length}
            noun="tenants"
            href={(n) => href(q, property, period, n)}
          />
        </div>
      </Card>

      <Alert tone="warning">
        <div>
          <strong>Some setup steps are not tracked yet.</strong>
          <p>
            Invitation, acceptance and bank verification are not tracked. Card on file is not
            applicable when a tenant uses ACH autopay without a card.
          </p>
        </div>
      </Alert>

      <div className={styles.unavailable}>
        <p>Messaging and invitations are not available.</p>
        <div className={styles.actions}>
          <button className="btn btn-sm" type="button" disabled>
            Message
          </button>
          <button className="btn btn-sm" type="button" disabled>
            Resend invite
          </button>
        </div>
      </div>
    </section>
  );
}
