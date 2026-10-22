import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { ScopedWorkspace } from '@/components/workspace/ScopedWorkspace';
import { scopeFilterFrom, scopeQuery, type ScopeFilter } from '@/lib/workspace/scope';
import { Avatar, Badge, Card, Tabs } from '@/components/ui';
import { Icon } from '@/components/shell/Icons';
import { Pagination } from '@/components/ui/Pagination';
import { requireManagerRole } from '@/lib/auth/access';
import { formatMoney, initials } from '@/lib/properties/format';
import { signLabel, term } from '@/lib/leases/format';
import { leasesDb, type LeaseListItem } from '@/lib/leases/queries';
import { EmptyState } from '@/components/RouteStates';
import styles from './leases-ux.module.css';
import { Table } from '@/components/ui/Table';
import { SearchField } from '@/components/ui/SearchField';
import { RowMenu } from '@/components/ui/RowMenu';
import { NoticeToast } from '@/components/ui/Toast';
import { DeleteDraftButton } from '@/components/lease-create/DeleteDraftButton';
import { draftNotice } from '@/components/lease-create/draft-notice';
import { draftRenewalSources } from '@/lib/lease-create/delete-draft';

const PAGE_SIZE = 10;

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
    notice?: string;
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
  const renewals = await draftRenewalSources(
    session.organizationId,
    shown.filter((lease) => lease.status === 'DRAFT').map((lease) => lease.id),
  );
  const notice = draftNotice(params.notice);
  const leaseStatusLabel = tab === 'drafts' ? 'draft' : tab;
  const values = {
    active: counts.active,
    expiring: counts.expiring,
    drafts: counts.drafts,
    ended: counts.ended,
  };

  return (
    <div className={styles.page}>
      {notice && <NoticeToast message={notice} tone="success" />}
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
              <SearchField
                defaultValue={q}
                aria-label="Search leases"
                placeholder="Search tenant or property"
              />
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
          <Table mobile="cards">
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
                  <tr key={lease.id} className="row-link">
                    <td data-cell="title">
                      <div className="cell-main">
                        <Avatar initials={initials(tenant?.name ?? 'No tenant')} size="sm" />
                        <div>
                          <strong>
                            <Link
                              className="row-anchor"
                              href={
                                lease.status === 'DRAFT'
                                  ? setupHref(scope, { draft: lease.id })
                                  : leaseHref(lease.id, scope)
                              }
                              style={{ color: 'inherit' }}
                            >
                              {tenant?.name ?? 'No tenant'}
                            </Link>
                          </strong>
                        </div>
                      </div>
                    </td>
                    <td data-cell="meta">
                      <span>
                        {property.name}
                        {!lease.unit.isImplicit && ` · Unit ${lease.unit.number}`}
                      </span>
                    </td>
                    <td data-cell="sub">{term(lease.startDate, lease.endDate)}</td>
                    <td className="num" data-cell="amount">
                      <strong>{formatMoney(Number(lease.monthlyRent))}</strong>
                      <small className="muted">/mo</small>
                    </td>
                    <td data-cell="status">
                      {lease.eSignStatus !== 'SIGNED' && (
                        <Badge tone={lease.eSignStatus === 'DECLINED' ? 'danger' : 'info'}>
                          {signLabel(lease.eSignStatus)}
                        </Badge>
                      )}
                    </td>
                    <td data-cell="actions">
                      <div className={styles.actions}>
                        {lease.status === 'DRAFT' && (
                          <Link
                            className="btn btn-ghost btn-sm"
                            href={setupHref(scope, { draft: lease.id })}
                          >
                            Continue setup
                          </Link>
                        )}
                        {lease.status === 'DRAFT' && lease.eSignStatus === 'NOT_SENT' && (
                          <DeleteDraftButton
                            leaseId={lease.id}
                            placeLabel={
                              property.name +
                              (lease.unit.isImplicit ? '' : ` · Unit ${lease.unit.number}`)
                            }
                            tenantName={tenant?.name}
                            renewal={renewals.has(lease.id)}
                            text="Delete"
                          />
                        )}
                        {lease.status === 'ACTIVE' &&
                        lease.endDate >= today &&
                        lease.endDate.getTime() - today.getTime() <= 90 * 86400000 ? (
                          <Link
                            className="btn btn-ghost btn-sm"
                            href={setupHref(scope, { renew: lease.id })}
                          >
                            Renew
                          </Link>
                        ) : lease.status === 'ACTIVE' ? (
                          <RowMenu label={`More actions for ${tenant?.name ?? property.name}`}>
                            <Link href={setupHref(scope, { renew: lease.id })}>
                              Prepare renewal
                            </Link>
                          </RowMenu>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
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
