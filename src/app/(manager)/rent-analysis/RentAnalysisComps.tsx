import Link from 'next/link';
import { Alert } from '@/components/ui';
import { EmptyState } from '@/components/RouteStates';
import { workspaceTabHref } from '@/components/workspace/routes';
import { parseFilters, type CompFilters } from '@/lib/comps/core';
import {
  buildCompsHref,
  compsSurfacePath,
  resolveContextUnit,
  type CompsNavContext,
} from '@/lib/comps/navigation';
import { compsSettings, fetchComps, listPricingUnits, subjectFacts } from '@/lib/comps/service';
import { bedBath, formatDate } from '@/lib/properties/format';
import { CompsWorkbench } from '../rent-comps/CompsWorkbench';
import { FilterBar } from '../rent-comps/FilterBar';
import { refreshCompsAction } from '../rent-comps/actions';
import styles from './rent.module.css';

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const STATUS_WORDS = { all: 'listed + leased', listed: 'listed', leased: 'leased' } as const;

/** "1 bd · listed + leased · last 90 days": the comparison the figures describe. */
export function filterSummary(filters: CompFilters) {
  return [
    filters.bedrooms === 0 ? 'studio' : `${filters.bedrooms} bd`,
    filters.bathrooms === null ? null : `${filters.bathrooms} ba`,
    STATUS_WORDS[filters.status],
    `last ${filters.days} days`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * The selected unit's comp result on Rent analysis (Designs/redisgn): sandbox notice with
 * refresh, then the analysis workbench (suggested rent band, comparison with filters, apply card,
 * map, distribution and every comparable rental). Uses the same comps service, filters and
 * apply action as the property Listing.
 */
export async function RentAnalysisComps({
  organizationId,
  unitId,
  searchParams = {},
  subjectLabel,
  unitName,
  propertyLevel = false,
  context,
  currentLeaseRent,
}: {
  organizationId: string;
  unitId: string;
  searchParams?: Search;
  /** "Maple Court · Unit 3A": the apply scope. */
  subjectLabel: string;
  /** "Unit 3A", or the property name for a single-family home. */
  unitName: string;
  propertyLevel?: boolean;
  context: CompsNavContext;
  currentLeaseRent?: number | null;
}) {
  const units = await listPricingUnits(organizationId);
  const unit =
    !context.unitId || context.unitId === unitId
      ? resolveContextUnit(units, { ...context, unitId })
      : null;
  if (!unit)
    return (
      <EmptyState
        title="No rent comps available"
        description="This unit is archived or is not available for pricing."
        action="Go to property"
        href="/properties"
      />
    );
  const nav: CompsNavContext = { ...context, unitId: unit.id };
  const params = Object.fromEntries(
    Object.keys(searchParams).map((key) => [key, first(searchParams[key])]),
  );
  const settings = await compsSettings(organizationId);
  const subject = subjectFacts(unit, settings.radiusMiles);
  const filters = parseFilters(params, subject);
  const listedRent = unit.listedRent === null ? null : Number(unit.listedRent);
  const marketRent = unit.marketRent === null ? null : Number(unit.marketRent);

  let result: Awaited<ReturnType<typeof fetchComps>> | null = null;
  let failure: string | null = null;
  try {
    result = await fetchComps(organizationId, unit.id, subject, filters);
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Comps could not be loaded.';
  }
  const appliedNote =
    unit.marketRentSetAt && unit.marketRentSetByName
      ? `Market rent set by ${unit.marketRentSetByName} on ${formatDate(unit.marketRentSetAt)}.`
      : null;
  const status = unit.status === 'VACANT' ? 'vacant' : unit.status.toLowerCase();
  const syncedAt = result
    ? `${result.fetchedAt.toLocaleString('en-US', { timeZone: 'UTC' })} UTC`
    : null;
  const propertyId = unit.property.id;
  const filterBar = (
    <FilterBar
      unitId={unit.id}
      filters={filters}
      action={compsSurfacePath(nav)}
      propertyId={propertyId}
    />
  );

  return (
    <div className={styles.result}>
      <div className={styles.notice}>
        {result ? (
          <Alert tone="warning">
            <div>
              <strong>Demo comps · not live market data</strong>
              <br />
              Sandbox response · synced {syncedAt}
              {result.cached ? ' · cached for this unit' : ' · newly fetched'} · treat every market
              figure below as an estimate.
            </div>
          </Alert>
        ) : (
          <Alert tone="warning">
            <div>
              <strong>Comps unavailable</strong>
              <br />
              {failure} Check the rent comps provider in{' '}
              <Link href="/integrations">Integrations</Link>.
            </div>
          </Alert>
        )}
        <form action={refreshCompsAction}>
          <input type="hidden" name="unitId" value={unit.id} />
          <button className="btn btn-ghost btn-sm">Refresh comps</button>
        </form>
      </div>
      {result ? (
        <CompsWorkbench
          key={`${unit.id}:${JSON.stringify(filters)}:${result.fetchedAt.getTime()}`}
          variant="analysis"
          unitId={unit.id}
          unitLabel={unitName}
          scopeLabel={subjectLabel}
          subjectFacts={`${bedBath({ bedrooms: unit.bedrooms, bathrooms: subject.bathrooms })} · ${status}`}
          filterSummary={filterSummary(filters)}
          filters={filterBar}
          rows={result.rows}
          radiusMiles={filters.radiusMiles}
          subjectSqft={unit.squareFeet}
          listedRent={listedRent}
          currentLeaseRent={currentLeaseRent}
          propertyId={propertyId}
          marketRent={marketRent}
          providerName={result.providerName}
          syncedAt={syncedAt ?? ''}
          cached={result.cached}
          appliedNote={appliedNote}
          resetHref={buildCompsHref(nav)}
          propertyLevel={propertyLevel}
          occupied={unit.status === 'OCCUPIED'}
          listingHref={buildCompsHref({ ...nav, surface: 'listing' }, filters)}
          applicantsHref={workspaceTabHref(propertyId, 'applications', unit.id)}
          returnsHref={`/roi-analysis?${new URLSearchParams({ property: propertyId })}`}
        />
      ) : (
        <div className="card">{filterBar}</div>
      )}
    </div>
  );
}
