import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { Avatar, Badge, Card, Stat, Tabs } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { formatMoney, initials } from '@/lib/properties/format';
import { leaseName, signLabel, term } from '@/lib/leases/format';
import { leasesDb, type LeaseListItem } from '@/lib/leases/queries';

type Tab = 'active' | 'expiring' | 'drafts' | 'ended';
const tabs: Tab[] = ['active', 'expiring', 'drafts', 'ended'];
const PAGE_SIZE = 4;

function visible(lease: LeaseListItem, tab: Tab, today: Date, in60: Date) {
  if (tab === 'expiring')
    return lease.status === 'ACTIVE' && lease.endDate >= today && lease.endDate <= in60;
  if (tab === 'drafts') return lease.status === 'DRAFT';
  if (tab === 'ended') return lease.status === 'ENDED' || lease.status === 'TERMINATED';
  return lease.status === 'ACTIVE';
}

function tabHref(tab: Tab, q: string, page = 1) {
  const query = new URLSearchParams();
  if (tab !== 'active') query.set('tab', tab);
  if (q) query.set('q', q);
  if (page > 1) query.set('page', String(page));
  return query.size ? `/leases?${query}` : '/leases';
}

export default async function LeasesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>;
}) {
  const session = await requireManagerRole();
  const params = await searchParams;
  const tab: Tab = tabs.includes(params.tab as Tab) ? (params.tab as Tab) : 'active';
  const q = (params.q ?? '').trim();
  const { leases, counts, today, in60 } = await leasesDb(session.organizationId).list();
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
  const values = {
    active: counts.active,
    expiring: counts.expiring,
    drafts: counts.drafts,
    ended: counts.ended,
  };

  return (
    <>
      <PageHeader
        eyebrow="Leasing"
        actions={[
          { label: 'Review applications', href: '/applications' },
          { label: '+ New lease', href: '/leases/new', primary: true },
        ]}
      />
      <section className="grid-3">
        <Stat
          label="Active leases"
          value={counts.active}
          delta="Current leases in your portfolio"
        />
        <Stat label="Expiring in 60 days" value={counts.expiring} delta="Renewal reminders ready" />
        <Stat label="Awaiting e-signature" value={counts.awaiting} delta="Pending signatures" />
      </section>
      <Card flush>
        <div style={{ padding: '20px 20px 0' }}>
          <div className="row between" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 20 }}>Lease portfolio</h2>
              <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Each lease covers one property: a single unit, or the whole home for single-unit
                properties.
              </p>
            </div>
            <form role="search" action="/leases" method="get">
              {tab !== 'active' && <input type="hidden" name="tab" value={tab} />}
              <label className="search" style={{ minWidth: 230 }}>
                <span aria-hidden="true">⌕</span>
                <input
                  name="q"
                  defaultValue={q}
                  aria-label="Search leases"
                  placeholder="Search tenant or property"
                />
              </label>
            </form>
          </div>
          <Tabs
            items={tabs.map((key) => ({
              label: `${{ active: 'Active', expiring: 'Expiring soon', drafts: 'Drafts', ended: 'Ended' }[key]} ${values[key]}`,
              href: tabHref(key, q),
              active: tab === key,
            }))}
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Property / unit</th>
                <th>Lease term</th>
                <th className="num">Rent</th>
                <th>E-sign status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((lease) => {
                const tenant =
                  lease.tenants.find((t) => t.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
                const property = lease.unit.property;
                return (
                  <tr key={lease.id}>
                    <td>
                      <div className="cell-main">
                        <Avatar initials={initials(leaseName(lease))} />
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
                    <td>
                      <strong>
                        <Link href={`/properties/${property.id}`}>{property.name}</Link>
                      </strong>
                      {!lease.unit.isImplicit && (
                        <>
                          <br />
                          <small>
                            <Link href={`/properties/${property.id}/units/${lease.unitId}`}>
                              Unit {lease.unit.number}
                            </Link>{' '}
                            · Multi-unit
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      <Link href={`/leases/${lease.id}`}>
                        {term(lease.startDate, lease.endDate)}
                      </Link>
                    </td>
                    <td className="num">
                      <strong>{formatMoney(Number(lease.monthlyRent))}</strong>
                      <br />
                      <small className="muted">per month</small>
                    </td>
                    <td>
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
                      <Link className="btn btn-ghost btn-sm" href={`/leases/${lease.id}`}>
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          className="muted"
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--rr-border)',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {rows.length
            ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${(page - 1) * PAGE_SIZE + shown.length} of ${rows.length} ${tab === 'expiring' ? 'expiring' : tab} leases`
            : 'No leases match this view.'}
          <span className="row" style={{ marginLeft: 'auto' }}>
            {page > 1 && (
              <Link className="btn btn-secondary btn-sm" href={tabHref(tab, q, page - 1)}>
                ‹ Previous
              </Link>
            )}
            {page * PAGE_SIZE < rows.length && (
              <Link className="btn btn-secondary btn-sm" href={tabHref(tab, q, page + 1)}>
                Next ›
              </Link>
            )}
          </span>
        </div>
      </Card>
      {counts.expiring > 0 && (
        <div className="alert">
          <span aria-hidden="true">✦</span>
          <div>
            <strong>Renewal season is coming up</strong>
            <div>
              {counts.expiring} {counts.expiring === 1 ? 'lease expires' : 'leases expire'} in the
              next 60 days. Review renewal terms from each lease.
            </div>
          </div>
          <Link href="/leases?tab=expiring" style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}>
            Review expiring →
          </Link>
        </div>
      )}
    </>
  );
}
