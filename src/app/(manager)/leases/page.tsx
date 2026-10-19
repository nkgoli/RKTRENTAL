import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { ScopedWorkspace } from '@/components/workspace/ScopedWorkspace';
import { scopeFilterFrom, scopeQuery, type ScopeFilter } from '@/lib/workspace/scope';
import { Avatar, Badge, Card, Tabs } from '@/components/ui';
import { Icon } from '@/components/shell/Icons';
import { PAGE_SIZE, Pagination } from '@/components/ui/Pagination';
import { requireManagerRole } from '@/lib/auth/access';
import { formatMoney, initials } from '@/lib/properties/format';
import { signLabel, term } from '@/lib/leases/format';
import { leasesDb, type LeaseListItem } from '@/lib/leases/queries';
import { EmptyState } from '@/components/RouteStates';
import styles from './leases-ux.module.css';

type Tab = 'active' | 'expiring' | 'drafts' | 'ended';
const tabs: Tab[] = ['active', 'expiring', 'drafts', 'ended'];

function visible(lease: LeaseListItem, tab: Tab, today: Date, in60: Date) {
  if (tab === 'expiring')
    return lease.status === 'ACTIVE' && lease.endDate >= today && lease.endDate <= in60;
  if (tab === 'drafts') return lease.status === 'DRAFT';
  if (tab === 'ended') return lease.status === 'ENDED' || lease.status === 'TERMINATED';
  return lease.status === 'ACTIVE';
}

function tabHref(tab: Tab, q: string, page = 1, scope: ScopeFilter = {}) {
  const query = scopeQuery(scope);
  if (tab !== 'active') query.set('tab', tab);
  if (q) query.set('q', q);
  if (page > 1) query.set('page', String(page));
  return query.size ? `/leases?${query}` : '/leases';
}

function leaseHref(id: string, scope: ScopeFilter) {
  const query = scopeQuery(scope).toString();
  return query ? `/leases/${id}?${query}` : `/leases/${id}`;
}

function setupHref(scope: ScopeFilter, entry?: { draft?: string; renew?: string }) {
  const query = scopeQuery(scope);
  if (scope.propertyId) query.set('property', scope.propertyId);
  if (scope.unitId) query.set('unit', scope.unitId);
  if (entry?.draft) query.set('draft', entry.draft);
  if (entry?.renew) query.set('renew', entry.renew);
  return query.size ? `/leases/new?${query}` : '/leases/new';
}

export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    q?: string;
    page?: string;
    propertyId?: string;
    unitId?: string;
  }>;
}) {
  const session = await requireManagerRole();
  const params = await searchParams;
  const tab: Tab = tabs.includes(params.tab as Tab) ? (params.tab as Tab) : 'active';
  const q = (params.q ?? '').trim();
  const scope = scopeFilterFrom(params);
  const { leases, counts, today, in60 } = await leasesDb(session.organizationId).list(scope);
  const rows = leases.filter((lease) => {
    if (!visible(lease, tab, today, in60)) return false;
    if (!q) return true;
    const words = [
      lease.unit.property.name,
      lease.unit.number,
      ...lease.tenants.flatMap((t) => [t.tenant.name, t.tenant.email ?? '']),
    ]
      .join(' ')
      .toLowerCase();
    return words.includes(q.toLowerCase());
  });
  const page = Math.min(
    Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1),
    Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
  );
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const leaseStatusLabel = tab === 'drafts' ? 'draft' : tab;
  const values = {
    active: counts.active,
    expiring: counts.expiring,
    drafts: counts.drafts,
    ended: counts.ended,
  };

  return (
    <div className={styles.page}>
      <ScopedWorkspace organizationId={session.organizationId} filter={scope} activeTab="leases" />
      <PageHeader
        eyebrow="Leasing"
        actions={[
          { label: 'Review applications', href: '/applications' },
          { label: 'Lease templates', href: '/leases/templates' },
          { label: '+ New lease', href: setupHref(scope), primary: true },
        ]}
      />
      <section className={styles.pulse} aria-label="Lease stats">
        {[
          {
            label: 'Active leases',
            value: counts.active,
            note: 'Current leases in your portfolio',
            icon: 'leases' as const,
          },
          {
            label: 'Expiring in 60 days',
            value: counts.expiring,
            note: 'Active leases ending in the next 60 days',
            icon: 'leases' as const,
          },
          {
            label: 'Awaiting e-signature',
            value: counts.awaiting,
            note: 'Pending signatures',
            icon: 'tenants' as const,
          },
        ].map((stat) => (
          <div className={styles.stat} key={stat.label}>
            <span className={styles.icon}>
              <Icon name={stat.icon} />
            </span>
            <div>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
              <small>{stat.note}</small>
            </div>
          </div>
        ))}
      </section>
      <Card flush>
        <div className={styles.portfolioHeader}>
          <div className={styles.toolbar}>
            <div>
              <h2>Lease portfolio</h2>
              <p className={styles.intro}>
                Review current terms, continue a draft or prepare a renewal.
              </p>
            </div>
            <form className={styles.search} role="search" action="/leases" method="get">
              {tab !== 'active' && <input type="hidden" name="tab" value={tab} />}
              {scope.propertyId && (
                <input type="hidden" name="propertyId" value={scope.propertyId} />
              )}
              {scope.unitId && <input type="hidden" name="unitId" value={scope.unitId} />}
              <label className="search">
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  aria-label="Search leases"
                  placeholder="Search tenant or property"
                />
              </label>
              <button type="submit" className="btn btn-secondary btn-sm">
                Search
              </button>
              {q && <Link href={tabHref(tab, '', 1, scope)}>Clear search</Link>}
            </form>
          </div>
          <Tabs
            items={tabs.map((key) => ({
              label: `${{ active: 'Active', expiring: 'Expiring soon', drafts: 'Drafts', ended: 'Ended' }[key]} ${values[key]}`,
              href: tabHref(key, q, 1, scope),
              active: tab === key,
            }))}
          />
        </div>
        <div
          className={styles.scroll}
          role="region"
          aria-label="Lease portfolio results"
          tabIndex={0}
        >
          <table className="table">
            <caption className={styles.caption}>
              {rows.length} {leaseStatusLabel} lease
              {rows.length === 1 ? '' : 's'}
              {q && ` matching “${q}”`}. Open a lease to manage its agreement, files and payments.
            </caption>
            <thead>
              <tr>
                <th scope="col">Tenant</th>
                <th scope="col">Property / unit</th>
                <th scope="col">Lease term</th>
                <th scope="col" className="num">
                  Rent
                </th>
                <th scope="col">E-sign status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title={
                        q || tab !== 'active' ? 'No leases match this view' : 'No active leases yet'
                      }
                      description={
                        q || tab !== 'active'
                          ? 'Try another search or view to find a lease.'
                          : 'Create a lease to connect a tenant with a property.'
                      }
                      action={
                        q
                          ? 'Clear search'
                          : tab !== 'active'
                            ? 'View active leases'
                            : 'Create a lease'
                      }
                      href={
                        q
                          ? tabHref(tab, '', 1, scope)
                          : tab !== 'active'
                            ? tabHref('active', '', 1, scope)
                            : setupHref(scope)
                      }
                    />
                  </td>
                </tr>
              )}
              {shown.map((lease) => {
                const tenant =
                  lease.tenants.find((t) => t.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
                const property = lease.unit.property;
                return (
                  <tr key={lease.id}>
                    <td data-label="Tenant">
                      <div className="cell-main">
                        <Avatar initials={initials(tenant?.name ?? 'No tenant')} size="sm" />
                        <div>
                          <strong>
                            {tenant ? (
                              <Link href={`/tenants/${tenant.id}`} style={{ color: 'inherit' }}>
                                {tenant.name}
                              </Link>
                            ) : (
                              'No tenant'
                            )}
                          </strong>
                          <small>{tenant?.email ?? ''}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Property / unit">
                      <strong>
                        <Link href={`/properties/${property.id}`}>{property.name}</Link>
                      </strong>
                      {!lease.unit.isImplicit && (
                        <>
                          <br />
                          <small>
                            <Link href={`/properties/${property.id}/units/${lease.unitId}`}>
                              Unit {lease.unit.number}
                            </Link>
                          </small>
                        </>
                      )}
                    </td>
                    <td data-label="Lease term">
                      <Link href={leaseHref(lease.id, scope)}>
                        {term(lease.startDate, lease.endDate)}
                      </Link>
                    </td>
                    <td className="num" data-label="Rent / month">
                      <strong>{formatMoney(Number(lease.monthlyRent))}</strong>
                      <small className="muted">/mo</small>
                    </td>
                    <td data-label="E-sign status">
                      <Badge
                        tone={
                          lease.eSignStatus === 'SIGNED'
                            ? 'success'
                            : lease.eSignStatus === 'DECLINED'
                              ? 'danger'
                              : 'info'
                        }
                      >
                        {signLabel(lease.eSignStatus)}
                      </Badge>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <Link
                          className={`btn btn-${lease.status === 'DRAFT' ? 'secondary' : 'ghost'} btn-sm`}
                          href={
                            lease.status === 'DRAFT'
                              ? setupHref(scope, { draft: lease.id })
                              : leaseHref(lease.id, scope)
                          }
                        >
                          {lease.status === 'DRAFT' ? 'Continue setup' : 'View'}
                        </Link>
                        {lease.status === 'ACTIVE' && (
                          <Link
                            className="btn btn-ghost btn-sm"
                            href={setupHref(scope, { renew: lease.id })}
                          >
                            Renew
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          total={rows.length}
          size={PAGE_SIZE}
          noun={`${leaseStatusLabel} leases`}
          href={(n) => tabHref(tab, q, n, scope)}
        />
      </Card>
    </div>
  );
}
