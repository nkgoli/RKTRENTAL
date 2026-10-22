import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Icon } from '@/components/shell/Icons';
import {
  Avatar,
  Badge,
  Card,
  cx,
  Table,
  RowMenu,
  SearchField,
  AutoSubmitSelect,
} from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { formatDate, formatMoney, initials } from '@/lib/tenants/format';
import { organizationTenants } from '@/lib/tenants/queries';
import {
  parseStatusFilter,
  STATUS_FILTERS,
  STATUS_LABEL,
  STATUS_TONE,
  type StatusFilter,
} from '@/lib/tenants/status';
import { redirect } from 'next/navigation';
import { applicationsHref } from './navigation';
import { StatusView } from './StatusView';
import { TenantPager } from './Pager';
import styles from './tenants.module.css';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const PAGE_SIZE = 10;

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
  const view = first(raw.view) === 'status' ? 'status' : 'directory';
  const period = first(raw.period) === 'upcoming' ? 'upcoming' : 'current';
  // Legacy `?add=1` links (old bookmarks, lease builder) land on Applications, never a form.
  if (first(raw.add) === '1') redirect(applicationsHref(property));

  const tenants = organizationTenants(session.organizationId);
  const [listing, stats, properties, setupRows] = await Promise.all([
    tenants.list({ q, propertyId: property, status, page, pageSize: PAGE_SIZE }),
    tenants.stats(),
    tenants.formOptions(),
    view === 'status' ? tenants.setupRows() : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(listing.total / PAGE_SIZE));
  const { rows, total } =
    page > pages
      ? await tenants.list({ q, propertyId: property, status, page: pages, pageSize: PAGE_SIZE })
      : listing;
  const returnTo =
    view === 'directory'
      ? href({ q, property, status, page: Math.min(page, pages) })
      : `/tenants?${new URLSearchParams({ view: 'status', ...(q ? { q } : {}), ...(property ? { property } : {}), ...(first(raw.needsPaymentMethod) === '1' ? { needsPaymentMethod: '1' } : {}), period })}`;
  const detailHref = (id: string) => `/tenants/${id}?${new URLSearchParams({ returnTo })}`;
  const filtered = Boolean(q || property || status !== 'all');

  return (
    <div className={styles.scope}>
      <PageHeader
        eyebrow="Workspace / People"
        title="Tenants"
        actions={[
          {
            label: 'Review applications',
            href: applicationsHref(property),
            primary: true,
            icon: 'arrow-right',
          },
        ]}
      />

      <nav className={styles.tabs} aria-label="Tenant views">
        <Link
          href={href({ q, property })}
          aria-current={view === 'directory' ? 'page' : undefined}
          className={view === 'directory' ? styles.selectedTab : undefined}
        >
          Directory
        </Link>
        <Link
          href={`/tenants?${new URLSearchParams({ view: 'status', ...(q ? { q } : {}), ...(property ? { property } : {}) })}`}
          aria-current={view === 'status' ? 'page' : undefined}
          className={view === 'status' ? styles.selectedTab : undefined}
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
          needsPaymentMethod={first(raw.needsPaymentMethod) === '1'}
        />
      ) : (
        <>
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <p>Active tenants</p>
              <strong>{stats.activeTenants}</strong>
              <small>Portfolio total</small>
            </div>
            <div className={styles.kpi}>
              <p>Move-ins (30 days)</p>
              <strong>{stats.moveIns30}</strong>
              <small>Leases started</small>
            </div>
            <div className={styles.kpi}>
              <p>Leases ending in 60 days</p>
              <strong>{stats.endingSoon}</strong>
              <small>Renewals to review</small>
            </div>
            <div className={styles.kpi}>
              <p>Outstanding balance</p>
              <strong>{formatMoney(stats.outstandingCents / 100)}</strong>
              <small>
                {stats.lateTenants} {stats.lateTenants === 1 ? 'tenant' : 'tenants'}
              </small>
            </div>
          </div>

          <Card className={styles.pad}>
            <div className={styles.sectionHead}>
              <div>
                <h2>Directory</h2>
                <p>
                  {total} {total === 1 ? 'tenant' : 'tenants'} in this view · Portfolio totals above
                </p>
              </div>
              {filtered && (
                <Link className="btn btn-ghost btn-sm" href={href({})}>
                  Clear filters
                </Link>
              )}
            </div>
            <form
              method="get"
              action="/tenants"
              role="search"
              aria-label="Directory filters"
              className={styles.filters}
            >
              <input type="hidden" name="view" value="directory" />
              {status !== 'all' && <input type="hidden" name="status" value={status} />}
              <label className={styles.filterField}>
                <span>Search tenants</span>
                <SearchField name="q" defaultValue={q} placeholder="Name, email, phone or unit" />
              </label>
              <label className={styles.filterField}>
                <span>Property</span>
                <AutoSubmitSelect name="property" defaultValue={property ?? ''}>
                  <option value="">All properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </AutoSubmitSelect>
              </label>
            </form>
            <nav className={styles.chips} aria-label="Filter by status">
              {STATUS_FILTERS.map((s) => (
                <Link
                  key={s}
                  className={cx(styles.chip, status === s && styles.chipActive)}
                  aria-current={status === s ? 'true' : undefined}
                  href={href({ q, property, status: s })}
                >
                  {STATUS_CHIP[s]}
                </Link>
              ))}
            </nav>
          </Card>

          <Card flush className={styles.tableCard}>
            {rows.length === 0 ? (
              <div className={styles.empty}>
                <Icon name="tenants" />
                <h3>{filtered ? 'No tenants match this view' : 'No tenants yet'}</h3>
                <p>
                  {filtered
                    ? 'Clear the filters to see all tenants.'
                    : 'Tenants appear here when you promote an approved applicant. Lease setup and move-in are separate steps.'}
                </p>
                <Link
                  className="btn btn-secondary"
                  href={filtered ? href({}) : applicationsHref(property)}
                >
                  {filtered ? 'Clear filters' : 'Review applications'}
                </Link>
              </div>
            ) : (
              <Table mobile="cards" className={cx(styles.table, styles.directoryTable)}>
                <thead>
                  <tr>
                    <th scope="col">Tenant</th>
                    <th scope="col">Property / unit</th>
                    <th scope="col">Lease end</th>
                    <th scope="col">Balance</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="row-link">
                      <th scope="row" data-cell="title">
                        <Link className={cx(styles.person, 'row-anchor')} href={detailHref(row.id)}>
                          <Avatar initials={initials(row.name)} />
                          <span>
                            <strong>{row.name}</strong>
                            <small>{row.email ?? row.phone ?? 'No contact on file'}</small>
                          </span>
                        </Link>
                      </th>
                      <td data-cell="meta" className={styles.muted}>
                        <span>
                          {row.property && row.unit ? (
                            <>
                              {row.property.name}
                              <small>
                                {row.property.isImplicit ? (
                                  'Single-unit'
                                ) : (
                                  <>Unit {row.unit.number}</>
                                )}
                              </small>
                            </>
                          ) : (
                            <span className={styles.muted}>Not assigned</span>
                          )}
                        </span>
                      </td>
                      <td data-cell="hide" className={styles.muted}>
                        {row.lease ? (
                          <>{formatDate(row.lease.endDate)}</>
                        ) : (
                          <span className={styles.muted}>—</span>
                        )}
                      </td>
                      <td data-cell="amount" className={styles.num}>
                        {row.balanceCents ? formatMoney(row.balanceCents / 100) : '—'}
                      </td>
                      <td data-cell="status">
                        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                      </td>
                      <td data-cell="actions" className={styles.rowActions}>
                        <RowMenu label={`Actions for ${row.name}`}>
                          <Link
                            className={styles.link}
                            href={detailHref(row.id)}
                            aria-label={`View ${row.name}`}
                          >
                            Open profile
                          </Link>
                          {row.lease && (
                            <Link className={styles.link} href={`/leases/${row.lease.id}`}>
                              Open lease
                            </Link>
                          )}
                          {row.lease && (
                            <Link href={`/leases/${row.lease.id}?tab=payments`}>Open ledger</Link>
                          )}
                        </RowMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <TenantPager
              page={Math.min(page, pages)}
              total={total}
              size={PAGE_SIZE}
              noun={total === 1 ? 'tenant' : 'tenants'}
              href={(n) => href({ q, property, status, page: n })}
            />
          </Card>
        </>
      )}
    </div>
  );
}
