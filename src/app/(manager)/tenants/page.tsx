import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Avatar, Badge, Card, cx, SearchInput, Stat, Table, TableHead } from '@/components/ui';
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
  const query = new URLSearchParams();
  if (params.q) query.set('q', params.q);
  if (params.property) query.set('property', params.property);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.page && params.page > 1) query.set('page', String(params.page));
  const text = query.toString();
  return text ? `/tenants?${text}` : '/tenants';
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
  const [{ rows, total }, stats, properties, setupRows] = await Promise.all([
    tenants.list({ q, propertyId: property, status, page }),
    tenants.stats(),
    tenants.formOptions(),
    view === 'status' ? tenants.setupRows() : Promise.resolve([]),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Tenants"
        actions={[{ label: '+ Add tenant', href: '/tenants?view=directory#add-tenant', primary: true }]}
      />

      <nav className={styles.viewTabs} aria-label="Tenant views">
        <Link
          href="/tenants?view=directory"
          className={view === 'directory' ? styles.selectedTab : ''}
        >
          Directory
        </Link>
        <Link href="/tenants" className={view === 'status' ? styles.selectedTab : ''}>
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
        />
      ) : (
        <>
          <div className="grid-4">
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

          <div className="toolbar">
            <div className="row">
              <form method="get" action="/tenants" role="search">
                {property && <input type="hidden" name="property" value={property} />}
                {status !== 'all' && <input type="hidden" name="status" value={status} />}
                <SearchInput
                  name="q"
                  defaultValue={q}
                  placeholder="Search by name, email, phone or unit"
                />
              </form>
              <div className="chips" aria-label="Filter by property">
                <Link className={cx('chip', !property && 'active')} href={href({ q, status })}>
                  All properties
                </Link>
                {properties.map((p) => (
                  <Link
                    key={p.id}
                    className={cx('chip', property === p.id && 'active')}
                    href={href({ q, status, property: p.id })}
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            </div>
            <div className="chips" aria-label="Filter by status">
              {STATUS_FILTERS.map((s) => (
                <Link
                  key={s}
                  className={cx('chip', status === s && 'active')}
                  href={href({ q, property, status: s })}
                >
                  {STATUS_CHIP[s]}
                </Link>
              ))}
            </div>
          </div>

          <Card flush>
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
                        href={q || property || status !== 'all' ? '/tenants' : '#add-tenant'}
                      />
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="cell-main" href={`/tenants/${row.id}`}>
                        <Avatar initials={initials(row.name)} />
                        <span>
                          <strong>{row.name}</strong>
                          <small>{row.email ?? row.phone ?? 'No contact on file'}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      {row.property && row.unit ? (
                        <>
                          <Link href={`/properties/${row.property.id}`}>{row.property.name}</Link>
                          {row.property.isImplicit ? (
                            <small className="muted"> · Single-unit</small>
                          ) : (
                            <> · Unit {row.unit.number}</>
                          )}
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {row.lease ? (
                        <Link href={`/leases/${row.lease.id}`}>
                          {formatDate(row.lease.endDate)}
                        </Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td
                      className="num"
                      style={row.balanceCents > 0 ? { color: 'var(--design-danger)' } : undefined}
                    >
                      {formatMoney(row.balanceCents / 100)}
                    </td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </td>
                    <td>
                      <Link className="btn btn-ghost btn-sm" href={`/tenants/${row.id}`}>
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
          </Card>

          <div className="toolbar">
            <span className="muted">
              Showing {from}–{to} of {total} {total === 1 ? 'tenant' : 'tenants'}
            </span>
            {pages > 1 && (
              <div className="chips">
                {page > 1 && (
                  <Link className="chip" href={href({ q, property, status, page: page - 1 })}>
                    Previous
                  </Link>
                )}
                <span className="chip active">
                  {page} / {pages}
                </span>
                {page < pages && (
                  <Link className="chip" href={href({ q, property, status, page: page + 1 })}>
                    Next
                  </Link>
                )}
              </div>
            )}
          </div>

          <AddTenantForm properties={properties} action={addTenantAction} />
        </>
      )}
    </>
  );
}
