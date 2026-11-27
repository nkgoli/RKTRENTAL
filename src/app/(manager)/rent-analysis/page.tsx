import Link from 'next/link';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';

import { resolveRentSelection, rentGap, loadRentProperties } from '@/lib/analysis/rent';
import { RentAnalysisComps } from './RentAnalysisComps';
import { PageHeader } from '@/components/shell/PageHeader';
import { SearchField } from '@/components/ui/SearchField';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui';
import { Field } from '@/components/ui/Forms';
import { AutoSubmitSelect } from '@/components/ui/AutoSubmitSelect';
import { EmptyState } from '@/components/RouteStates';
import { formatAddress, formatMoney } from '@/lib/properties/format';
import {
  buildCompsHref,
  explicitFiltersFromQuery,
  filtersToQuery,
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
        <PageHeader title="Rent analysis" />
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
        <PageHeader title="Choose a property" />
        <div className={styles.workspace}>
          <Card>
            <form action="/rent-analysis" className={styles.search}>
              <SearchField defaultValue={search} placeholder="Search properties" />
            </form>
            {matches.map((p) => {
              const occupied = p.units.filter((u) => u.status === 'OCCUPIED').length;
              return (
                <div className={styles.property} key={p.id}>
                  <div>
                    <h3>{p.name}</h3>
                    <p className="muted">
                      {formatAddress(p)} · {p.units.length}{' '}
                      {p.units.length === 1 ? 'unit' : 'units'} · {occupied} occupied
                    </p>
                  </div>
                  <Link
                    className="btn btn-ghost btn-sm"
                    href={buildCompsHref(rentAnalysisContext(p.id))}
                  >
                    Open rent analysis
                  </Link>
                </div>
              );
            })}
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
  const baselineOf = (u: (typeof property.units)[number]) => currentRent(u.id) ?? u.listedRent;
  const gaps = property.units.map((u) => rentGap(u.marketRent, baselineOf(u)));
  const below = gaps.filter((gap) => gap !== null && gap > 0).length;
  const atMarket = gaps.filter((gap) => gap === 0).length;
  const above = gaps.filter((gap) => gap !== null && gap < 0).length;
  const notSet = gaps.filter((gap) => gap === null).length;
  const vacant = property.units.filter((u) => u.status === 'VACANT').length;
  const unitCount = property.units.length;
  const meta = [
    formatAddress(property),
    implicit ? null : `${unitCount} ${unitCount === 1 ? 'unit' : 'units'}`,
    implicit || !vacant ? null : `${vacant} vacant`,
  ]
    .filter(Boolean)
    .join(' · ');
  const unitName = subject ? (implicit ? property.name : `Unit ${subject.number}`) : null;
  const filterQuery = filtersToQuery(explicitFilters);
  return (
    <>
      <PageHeader
        title={unitName && !implicit ? `${property.name} · ${unitName}` : property.name}
        meta={meta}
        back={{ href: `/properties/${property.id}`, label: property.name }}
      />
      <div className={styles.workspace}>
        <div className={styles.toolbar}>
          {!implicit && (
            <form action="/rent-analysis" className={styles.unitForm}>
              <input type="hidden" name="property" value={property.id} />
              {Object.entries(filterQuery).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Field label="Unit">
                <AutoSubmitSelect name="unit" defaultValue={subject?.id ?? ''}>
                  {!subject && (
                    <option value="" disabled>
                      Choose a unit
                    </option>
                  )}
                  {property.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      Unit {u.number} · {u.status.toLowerCase()}
                    </option>
                  ))}
                </AutoSubmitSelect>
              </Field>
              <noscript>
                <button className="btn btn-secondary btn-sm">Show comps</button>
              </noscript>
            </form>
          )}
          <Link className="btn btn-secondary" href="/rent-analysis">
            Change property
          </Link>
        </div>
        {subject && unitName ? (
          <RentAnalysisComps
            organizationId={session.organizationId}
            unitId={subject.id}
            searchParams={query}
            context={rentAnalysisContext(property.id, subject.id)}
            propertyLevel={!!implicit}
            subjectLabel={implicit ? property.name : `${property.name} · Unit ${subject.number}`}
            unitName={unitName}
            currentLeaseRent={currentRent(subject.id)}
          />
        ) : (
          <p className={styles.prompt}>Choose a unit to compare it with nearby rentals.</p>
        )}
        {!implicit && (
          <Card>
            <div className={styles.unitsHead}>
              <h2>Every unit vs saved market rent</h2>
              {!!unitCount && (
                <div className={styles.badges}>
                  {below > 0 && <Badge tone="info">{below} below market</Badge>}
                  {atMarket > 0 && <Badge>{atMarket} at market</Badge>}
                  {above > 0 && <Badge tone="warning">{above} above market</Badge>}
                  {notSet > 0 && <Badge>{notSet} not set</Badge>}
                </div>
              )}
            </div>
            <div
              className={styles.table}
              role="region"
              aria-label="Saved unit estimates"
              tabIndex={0}
            >
              <table className="table" data-mobile="cards">
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
                    const baseline = baselineOf(u);
                    const gap = rentGap(u.marketRent, baseline);
                    const selected = subject?.id === u.id;
                    return (
                      <tr
                        key={u.id}
                        className={`row-link${selected ? ` ${styles.selectedRow}` : ''}`}
                        aria-current={selected ? 'true' : undefined}
                      >
                        <th data-cell="title">
                          <Link
                            className="row-anchor"
                            href={buildCompsHref(
                              rentAnalysisContext(property.id, u.id),
                              explicitFilters,
                            )}
                          >
                            Unit {u.number}
                          </Link>
                        </th>
                        <td data-cell="status">
                          <Badge tone={u.status === 'OCCUPIED' ? 'success' : 'neutral'}>
                            {u.status.charAt(0) + u.status.slice(1).toLowerCase()}
                          </Badge>
                        </td>
                        <td data-cell="meta">
                          <span className={styles.cellLabel}>Current </span>
                          {money(currentRent(u.id))}
                        </td>
                        <td data-cell="hide">{money(u.listedRent)}</td>
                        <td data-cell="amount">
                          <span className={styles.cellLabel}>Market </span>
                          {money(u.marketRent)}
                        </td>
                        <td data-cell="sub">
                          <span className={styles.cellLabel}>Gap </span>
                          <span
                            className={
                              (gap ?? 0) > 0
                                ? styles.positiveGap
                                : (gap ?? 0) < 0
                                  ? styles.negativeGap
                                  : styles.neutralGap
                            }
                          >
                            {(gap ?? 0) > 0 ? '+' : ''}
                            {money(gap)}
                          </span>
                          {gap !== null && currentRent(u.id) === null && (
                            <small className="muted"> vs listed</small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!property.units.length && <p>No units to compare.</p>}
            <Link className={styles.textLink} href={`/properties/${property.id}/leases`}>
              Review leases for renewals →
            </Link>
          </Card>
        )}
      </div>
    </>
  );
}
