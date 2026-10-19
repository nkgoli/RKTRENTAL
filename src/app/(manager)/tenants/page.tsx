import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import {
  Avatar,
  Badge,
  Button,
  Card,
  cx,
  Pagination,
  SearchInput,
  Stat,
  Table,
  TableHead,
} from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { formatDate, formatMoney, initials } from '@/lib/tenants/format';
import { organizationTenants, PAGE_SIZE } from '@/lib/tenants/queries';
import {
  parseStatusFilter,
  STATUS_FILTERS,
  STATUS_LABEL,
  STATUS_TONE,
  type StatusFilter,
} from '@/lib/tenants/status';
import { addTenantAction } from './actions';
import { AddTenantForm } from './TenantForms';
import { EmptyState } from '@/components/RouteStates';
import { StatusView } from './StatusView';
import styles from './tenants.module.css';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const STATUS_CHIP: Record<StatusFilter, string> = {
  all: 'All',
  current: 'Current',
  late: 'Late',
  past: 'Past',
  prospect: 'No lease',
};

function href(params: { q?: string; property?: string; status?: StatusFilter; page?: number }) {
  const query = new URLSearchParams({ view: 'directory' });
  if (params.q) query.set('q', params.q);
  if (params.property) query.set('property', params.property);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  const text = query.toString();
  return `/tenants?${text}`;
}

export default async function TenantsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireManagerRole();
  const raw = await searchParams;
  const q = first(raw.q)?.trim() || undefined;
  const property = first(raw.property) || undefined;
  const status = parseStatusFilter(first(raw.status));
  const page = Math.max(1, Number.parseInt(first(raw.page) ?? '1', 10) || 1);
  const view = first(raw.view) === 'directory' ? 'directory' : 'status';
  const period = first(raw.period) === 'upcoming' ? 'upcoming' : 'current';

  const tenants = organizationTenants(session.organizationId);
  const [listing, stats, properties, setupRows] = await Promise.all([
    tenants.list({ q, propertyId: property, status, page }),
    tenants.stats(),
    tenants.formOptions(),
    view === 'status' ? tenants.setupRows() : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(listing.total / PAGE_SIZE));
  const { rows, total } =
    page > pages ? await tenants.list({ q, propertyId: property, status, page: pages }) : listing;
  const returnTo =
    view === 'directory'
      ? href({ q, property, status, page: Math.min(page, pages) })
      : `/tenants?${new URLSearchParams({ ...(q ? { q } : {}), ...(property ? { property } : {}), period })}`;
  const detailHref = (id: string) => `/tenants/${id}?${new URLSearchParams({ returnTo })}`;

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Tenants"
        actions={[
          { label: '+ Add tenant', href: `${href({ property })}#add-tenant`, primary: true },
        ]}
      />

      <nav className={styles.viewTabs} aria-label="Tenant views">
        <Link
          href={href({ q, property })}
          aria-current={view === 'directory' ? 'page' : undefined}
          className={view === 'directory' ? styles.selectedTab : ''}
        >
          Directory
        </Link>
        <Link
          href={`/tenants?${new URLSearchParams({ ...(q ? { q } : {}), ...(property ? { property } : {}) })}`}
          aria-current={view === 'status' ? 'page' : undefined}
          className={view === 'status' ? styles.selectedTab : ''}
        >
          Status
        </Link>
      </nav>
      {view === 'status' ? (
        <StatusView
          rows={setupRows}
          properties={properties}
          q={q}
          property={property}
          period={period}
          page={first(raw.page)}
        />
      ) : (
        <>
          <div className="kpis">
            <Stat label="Active tenants" value={stats.activeTenants} />
            <Stat
              label="Move-ins (30 days)"
              value={stats.moveIns30}
              tone="up"
              delta="Leases started"
            />
            <Stat
              label="Leases ending in 60 days"
              value={stats.endingSoon}
              tone={stats.endingSoon ? 'down' : 'neutral'}
              delta="Renewals to review"
            />
            <Stat
              label="Outstanding balance"
              value={formatMoney(stats.outstandingCents / 100)}
              tone={stats.lateTenants ? 'down' : 'neutral'}
              delta={`${stats.lateTenants} ${stats.lateTenants === 1 ? 'tenant' : 'tenants'}`}
            />
          </div>

          <section className={styles.directoryControls} aria-label="Directory filters">
            <div className={styles.statusHeading}>
              <div>
                <h2>Directory</h2>
                <p className="muted">
                  {total} {total === 1 ? 'tenant' : 'tenants'} in this view · Portfolio totals above
                </p>
              </div>
              {(q || property || status !== 'all') && (
                <Link href={href({})} className="btn btn-ghost btn-sm">
                  Clear filters
                </Link>
              )}
            </div>
            <form method="get" action="/tenants" role="search" className={styles.filterForm}>
              <input type="hidden" name="view" value="directory" />
              {status !== 'all' && <input type="hidden" name="status" value={status} />}
              <label className={styles.searchField}>
                <span>Search tenants</span>
                <SearchInput name="q" defaultValue={q} placeholder="Name, email, phone or unit" />
              </label>
              <label className={styles.filterField}>
                <span>Property</span>
                <select name="property" defaultValue={property ?? ''}>
                  <option value="">All properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="secondary">
                Apply filters
              </Button>
            </form>
            <nav className="chips" aria-label="Filter by status">
              {STATUS_FILTERS.map((s) => (
                <Link
                  key={s}
                  className={cx('chip', status === s && 'active')}
                  aria-current={status === s ? 'true' : undefined}
                  href={href({ q, property, status: s })}
                >
                  {STATUS_CHIP[s]}
                </Link>
              ))}
            </nav>
          </section>

          <Card flush className={styles.directoryCard}>
            <Table>
              <TableHead
                columns={[
                  'Tenant',
                  'Property / unit',
                  'Lease end',
                  <span key="b" className="num" style={{ display: 'block' }}>
                    Balance
                  </span>,
                  'Status',
                  '',
                ]}
              />
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title={
                          q || property || status !== 'all'
                            ? 'No tenants match this view'
                            : 'No tenants yet'
                        }
                        description={
                          q || property || status !== 'all'
                            ? 'Clear the filters to see all tenants.'
                            : 'Add a tenant to keep contact and lease details together.'
                        }
                        action={
                          q || property || status !== 'all' ? 'Clear filters' : 'Add a tenant'
                        }
                        href={q || property || status !== 'all' ? href({}) : '#add-tenant'}
                      />
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="cell-main" href={detailHref(row.id)}>
                        <Avatar initials={initials(row.name)} />
                        <span>
                          <strong>{row.name}</strong>
                          <small>{row.email ?? row.phone ?? 'No contact on file'}</small>
                        </span>
                      </Link>
                    </td>
                    <td data-label="Property / unit">
                      <span>
                        {row.property && row.unit ? (
                          <>
                            <Link href={`/properties/${row.property.id}`}>{row.property.name}</Link>
                            {row.property.isImplicit ? (
                              <small className="muted"> · Single-unit</small>
                            ) : (
                              <>
                                {' '}
                                ·{' '}
                                <Link
                                  href={`/properties/${row.property.id}?unit=${encodeURIComponent(row.unit.id)}`}
                                >
                                  Unit {row.unit.number}
                                </Link>
                              </>
                            )}
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </span>
                    </td>
                    <td data-label="Lease end">
                      {row.lease ? (
                        <Link href={`/leases/${row.lease.id}`}>
                          {formatDate(row.lease.endDate)}
                        </Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td
                      data-label="Balance"
                      className="num"
                      style={row.balanceCents > 0 ? { color: 'var(--design-danger)' } : undefined}
                    >
                      {formatMoney(row.balanceCents / 100)}
                    </td>
                    <td data-label="Status">
                      <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </td>
                    <td>
                      <Link className="btn btn-ghost btn-sm" href={detailHref(row.id)}>
                        View
                      </Link>{' '}
                      {row.lease && (
                        <Link className="btn btn-ghost btn-sm" href={`/leases/${row.lease.id}`}>
                          Lease
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={Math.min(page, pages)}
              total={total}
              size={PAGE_SIZE}
              noun={total === 1 ? 'tenant' : 'tenants'}
              href={(n) => href({ q, property, status, page: n })}
            />
          </Card>

          <AddTenantForm
            properties={properties}
            initialPropertyId={property}
            action={addTenantAction}
          />
        </>
      )}
    </>
  );
}
