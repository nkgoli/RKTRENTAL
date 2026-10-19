import Link from 'next/link';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';

import { resolveRentSelection, rentGap, loadRentProperties } from '@/lib/analysis/rent';
import { RentCompsPanel } from '@/components/rent-comps/RentCompsPanel';
import { PageHeader } from '@/components/shell/PageHeader';
import { Card } from '@/components/ui';
import { EmptyState } from '@/components/RouteStates';
import { formatAddress, formatMoney } from '@/lib/properties/format';
import {
  buildCompsHref,
  explicitFiltersFromQuery,
  rentAnalysisContext,
} from '@/lib/comps/navigation';
import styles from './rent.module.css';

export const dynamic = 'force-dynamic';
type Search = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const money = (v: number | null) => (v === null ? 'Not set' : formatMoney(v));

export default async function RentAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const [session, query] = await Promise.all([requireManagerRole(), searchParams]);
  const properties = await loadRentProperties(session, db);
  const resolved = resolveRentSelection(properties, first(query.property), first(query.unit));
  if (resolved.kind === 'invalid')
    return (
      <>
        <PageHeader title="Rent Analysis" eyebrow="Analysis" />
        <EmptyState
          title="Property or unit unavailable"
          description="It may have been archived or your access changed. Choose another property."
          action="Choose a property"
          href="/rent-analysis"
        />
      </>
    );
  if (resolved.kind === 'selection') {
    const search = (first(query.q) ?? '').trim();
    const matches = properties.filter((p) =>
      `${p.name} ${formatAddress(p)}`.toLowerCase().includes(search.toLowerCase()),
    );
    return (
      <>
        <PageHeader title="Choose a property" eyebrow="Rent Analysis" />
        <div className={styles.workspace}>
          <p className="muted">Start with a property, then compare rent at the unit level.</p>
          <div className={styles.selection}>
            <Card>
              <h2>Your properties</h2>
              <p className="muted">{properties.length} active properties</p>
              <form action="/rent-analysis" className={styles.search}>
                <label className="field">
                  Find a property
                  <input
                    type="search"
                    name="q"
                    defaultValue={search}
                    placeholder="Search properties…"
                  />
                </label>
                <button className="btn btn-secondary">Search</button>
              </form>
              {matches.map((p) => (
                <div className={styles.property} key={p.id}>
                  <div>
                    <h3>{p.name}</h3>
                    <p className="muted">{formatAddress(p)}</p>
                    <small>
                      {p.units.length} available units ·{' '}
                      {p.units.filter((u) => u.status === 'OCCUPIED').length} occupied
                    </small>
                  </div>
                  <Link
                    className="btn btn-secondary"
                    href={buildCompsHref(rentAnalysisContext(p.id))}
                  >
                    Open Rent Analysis
                  </Link>
                </div>
              ))}
              {!matches.length && (
                <EmptyState
                  title={properties.length ? 'No matching properties' : 'No properties yet'}
                  description={
                    properties.length
                      ? 'Try a different name or street.'
                      : 'Add your first property, then return here.'
                  }
                  action={properties.length ? 'Clear search' : 'Go to properties'}
                  href={properties.length ? '/rent-analysis' : '/properties'}
                />
              )}
            </Card>
            <Card>
              <h2>What you’ll need</h2>
              <p className="muted">
                Rent Analysis uses a property address and unit features. Review saved estimates
                before choosing a unit. Only properties you can manage appear here.
              </p>
            </Card>
          </div>
        </div>
      </>
    );
  }
  const { property } = resolved;
  const explicitFilters = explicitFiltersFromQuery(
    Object.fromEntries(Object.entries(query).map(([key, value]) => [key, first(value)])),
  );
  const facts = await db.property.findFirst({
    where: { id: property.id, organizationId: session.organizationId, archivedAt: null },
    select: {
      type: true,
      units: {
        where: { organizationId: session.organizationId, status: { not: 'ARCHIVED' } },
        select: { id: true, isImplicit: true },
      },
    },
  });
  if (!facts)
    return (
      <EmptyState
        title="Property unavailable"
        description="Choose another property."
        action="Choose a property"
        href="/rent-analysis"
      />
    );
  const implicit = facts.type === 'SINGLE_UNIT' ? facts.units.find((u) => u.isImplicit) : undefined;
  const subject =
    resolved.unit ?? (implicit ? property.units.find((u) => u.id === implicit.id) : undefined);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const leases = await db.lease.findMany({
    where: {
      organizationId: session.organizationId,
      unitId: { in: property.units.map((u) => u.id) },
      status: 'ACTIVE',
      startDate: { lte: today },
      endDate: { gte: today },
    },
    select: { id: true, unitId: true, monthlyRent: true },
  });
  const currentRent = (id: string) => {
    const matches = leases.filter((l) => l.unitId === id);
    return matches.length === 1 ? Number(matches[0].monthlyRent) : null;
  };
  return (
    <>
      <PageHeader title="Rent Analysis" eyebrow="Analysis" />
      <div className={styles.workspace}>
        <Card>
          <div className="row between">
            <div>
              <h2>{property.name}</h2>
              <p className="muted">{formatAddress(property)}</p>
            </div>
            <Link className="btn btn-secondary" href="/rent-analysis">
              Change property
            </Link>
          </div>
        </Card>
        {!implicit && (
          <Card>
            <details open={!subject}>
              <summary>
                View all {property.units.length} units in {property.name}
              </summary>
              <h2>Your units</h2>
              <p className="muted">
                Choose a unit to compare. A multi-unit property has no blended comparable rent.
              </p>
              <div
                className={styles.table}
                role="region"
                aria-label="Saved unit estimates"
                tabIndex={0}
              >
                <table className="table">
                  <thead>
                    <tr>
                      <th>Unit</th>
                      <th>Status</th>
                      <th>Current lease</th>
                      <th>Listed rent</th>
                      <th>Saved market rent</th>
                      <th>Gap / month</th>
                    </tr>
                  </thead>
                  <tbody>
                    {property.units.map((u) => {
                      const baseline = currentRent(u.id) ?? u.listedRent;
                      return (
                        <tr key={u.id}>
                          <th>
                            <Link
                              href={buildCompsHref(
                                rentAnalysisContext(property.id, u.id),
                                explicitFilters,
                              )}
                            >
                              Unit {u.number}
                            </Link>
                          </th>
                          <td>{u.status}</td>
                          <td>{money(currentRent(u.id))}</td>
                          <td>{money(u.listedRent)}</td>
                          <td>{money(u.marketRent)}</td>
                          <td>
                            {money(rentGap(u.marketRent, baseline))}
                            <small className="muted">
                              {' '}
                              vs {currentRent(u.id) === null ? 'listed rent' : 'current lease'}
                            </small>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!property.units.length && (
                <p>No available units. Add or restore a unit in Properties.</p>
              )}
            </details>
          </Card>
        )}
        {subject && (
          <RentCompsPanel
            organizationId={session.organizationId}
            unitId={subject.id}
            searchParams={query}
            context={rentAnalysisContext(property.id, subject.id)}
            propertyLevel={!!implicit}
            subjectLabel={implicit ? property.name : `${property.name} · Unit ${subject.number}`}
            currentLeaseRent={currentRent(subject.id)}
          />
        )}
      </div>
    </>
  );
}
