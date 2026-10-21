import Link from 'next/link';
import {
  Avatar,
  Badge,
  Card,
  SearchField,
  AutoSubmitSelect,
  cx,
  pageFrom,
  paginate,
} from '@/components/ui';
import { initials } from '@/lib/tenants/format';
import type { organizationTenants } from '@/lib/tenants/queries';
import { TenantPager } from './Pager';
import styles from './tenants.module.css';

type SetupRow = Awaited<ReturnType<ReturnType<typeof organizationTenants>['setupRows']>>[number];
function href(
  q?: string,
  property?: string,
  period?: string,
  page?: number,
  needsPaymentMethod = false,
) {
  const params = new URLSearchParams({ view: 'status' });
  if (q) params.set('q', q);
  if (property) params.set('property', property);
  if (period === 'upcoming') params.set('period', period);
  if (page && page > 1) params.set('page', String(page));
  if (needsPaymentMethod) params.set('needsPaymentMethod', '1');
  return `/tenants?${params}`;
}
export function needsPaymentSetup(row: SetupRow) {
  return (
    row.checklist.autopayOn !== 'complete' &&
    row.checklist.bankAdded !== 'complete' &&
    row.checklist.cardOnFile !== 'complete'
  );
}
export function StatusView({
  rows,
  properties,
  q,
  property,
  period,
  page,
  needsPaymentMethod = false,
}: {
  rows: SetupRow[];
  properties: { id: string; name: string }[];
  q?: string;
  property?: string;
  period: 'current' | 'upcoming';
  page?: string;
  needsPaymentMethod?: boolean;
}) {
  const matching = rows.filter((row) => {
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
  const attention = matching.filter(needsPaymentSetup).length;
  const shown = needsPaymentMethod ? matching.filter(needsPaymentSetup) : matching;
  const current = pageFrom(page, shown.length, 10);
  const paged = paginate(shown, current, 10);
  return (
    <section className={styles.status} aria-labelledby="tenant-status-title">
      <div className={styles.sectionHead}>
        <div>
          <h2 id="tenant-status-title">Payment setup</h2>
          <p>Payment methods and autopay for your tenants.</p>
        </div>
      </div>
      <div className={styles.period} role="group" aria-label="Lease period">
        {(['current', 'upcoming'] as const).map((value) => (
          <Link
            key={value}
            className={cx(styles.periodLink, period === value && styles.periodActive)}
            aria-current={period === value ? 'true' : undefined}
            href={href(q, property, value)}
          >
            {value === 'current' ? 'Current tenants' : 'Upcoming tenants'}
          </Link>
        ))}
      </div>
      <form
        action="/tenants"
        method="get"
        role="search"
        aria-label="Status filters"
        className={styles.filters}
      >
        <input type="hidden" name="view" value="status" />
        <input type="hidden" name="period" value={period} />
        {needsPaymentMethod && <input type="hidden" name="needsPaymentMethod" value="1" />}
        <label className={styles.filterField}>
          <span>Search tenants</span>
          <SearchField name="q" defaultValue={q} placeholder="Property, tenant or email" />
        </label>
        <label className={styles.filterField}>
          <span>Property</span>
          <AutoSubmitSelect name="property" defaultValue={property ?? ''}>
            <option value="">All properties</option>
            {properties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        {(q || property || needsPaymentMethod) && (
          <Link className="btn btn-ghost btn-sm" href={href(undefined, undefined, period)}>
            Clear filters
          </Link>
        )}
      </form>
      <div className={styles.actions} style={{ justifyContent: 'space-between' }}>
        <p className={styles.meta}>
          {shown.length} {shown.length === 1 ? 'tenant' : 'tenants'} in this view
        </p>
        <Link
          className={cx(styles.chip, needsPaymentMethod && styles.chipActive)}
          href={href(q, property, period, 1, !needsPaymentMethod)}
          aria-current={needsPaymentMethod ? 'true' : undefined}
        >
          Needs payment method · {attention}
        </Link>
      </div>
      <Card flush className={styles.statusCard}>
        <div role="region" aria-label="Tenant payment setup">
          {paged.length === 0 ? (
            <div className={styles.empty}>
              <h3>No tenants match this view</h3>
              <p>Try another property, tenant, or lease period.</p>
              <Link href={href()}>View current tenants</Link>
            </div>
          ) : (
            paged.map((row) => (
              <article className={styles.compactSetup} key={`${row.leaseId}:${row.tenant.id}`}>
                <Link
                  className={styles.person}
                  href={`/tenants/${row.tenant.id}?${new URLSearchParams({ returnTo: href(q, property, period, current, needsPaymentMethod) })}`}
                >
                  <Avatar initials={initials(row.tenant.name)} size="sm" />
                  <span>
                    <strong>{row.tenant.name}</strong>
                    <small>
                      {row.property.name} ·{' '}
                      {row.unit.isImplicit ? 'Single-unit' : `Unit ${row.unit.number}`}
                    </small>
                  </span>
                </Link>
                {needsPaymentSetup(row) ? (
                  <Badge tone="warning">No payment method</Badge>
                ) : (
                  <span className={styles.setupSummary}>
                    {[
                      row.checklist.autopayOn === 'complete' && 'Autopay on',
                      row.checklist.bankAdded === 'complete' && 'Bank added',
                      row.checklist.cardOnFile === 'complete' && 'Card on file',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </article>
            ))
          )}
          <TenantPager
            page={current}
            total={shown.length}
            size={10}
            noun="tenants"
            href={(n) => href(q, property, period, n, needsPaymentMethod)}
          />
        </div>
      </Card>
    </section>
  );
}
