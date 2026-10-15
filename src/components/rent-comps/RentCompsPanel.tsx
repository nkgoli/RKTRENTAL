import Link from 'next/link';
import { Alert, Badge, Card } from '@/components/ui';
import { EmptyState } from '@/components/RouteStates';
import { parseFilters } from '@/lib/comps/core';
import { compsSettings, fetchComps, listPricingUnits, subjectFacts } from '@/lib/comps/service';
import { bedBath, formatAddress, formatDate, formatMoney, unitLabel } from '@/lib/properties/format';
import { CompsWorkbench } from '@/app/(manager)/rent-comps/CompsWorkbench';
import { FilterBar, UnitPicker } from '@/app/(manager)/rent-comps/FilterBar';
import { refreshCompsAction } from '@/app/(manager)/rent-comps/actions';

type Search = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
const statusLabel = { OCCUPIED: 'Occupied', VACANT: 'Vacant', TURNOVER: 'Turnover' } as const;

export async function RentCompsPanel({
  organizationId,
  unitId,
  searchParams = {},
  subjectLabel,
  propertyLevel = false,
}: {
  organizationId: string;
  unitId: string;
  searchParams?: Search;
  subjectLabel?: string;
  propertyLevel?: boolean;
}) {
  const units = await listPricingUnits(organizationId);
  const unit = units.find((candidate) => candidate.id === unitId);
  if (!unit) return <EmptyState title="No rent comps available" description="This unit is archived or is not available for pricing." action="Go to property" href="/properties" />;

  const params = Object.fromEntries(Object.keys(searchParams).map((key) => [key, first(searchParams[key])]));
  const settings = await compsSettings(organizationId);
  const subject = subjectFacts(unit, settings.radiusMiles);
  const filters = parseFilters(params, subject);
  const label = subjectLabel ?? unitLabel(unit.property, unit);
  const listedRent = unit.listedRent === null ? null : Number(unit.listedRent);
  const marketRent = unit.marketRent === null ? null : Number(unit.marketRent);

  let result: Awaited<ReturnType<typeof fetchComps>> | null = null;
  let failure: string | null = null;
  try {
    result = await fetchComps(organizationId, unit.id, subject, filters);
  } catch (error) {
    failure = error instanceof Error ? error.message : 'Comps could not be loaded.';
  }

  const status = statusLabel[unit.status as keyof typeof statusLabel];
  const appliedNote = unit.marketRentSetAt && unit.marketRentSetByName
    ? `Market rent set by ${unit.marketRentSetByName} on ${formatDate(unit.marketRentSetAt)}.`
    : null;

  return <div className="stack">
    <Card>
      <div className="row between">
        <div className="row">
          <div className="photo" style={{ width: 120 }} />
          <div>
            <p className="eyebrow">{propertyLevel ? 'Subject property' : 'Subject unit'}</p>
            <h3 style={{ fontSize: 20 }}>{label}</h3>
            <p className="muted">
              {formatAddress(unit.property)} · {bedBath({ bedrooms: unit.bedrooms, bathrooms: subject.bathrooms })}
              {unit.squareFeet ? ` · ${unit.squareFeet.toLocaleString('en-US')} sqft` : ''}
            </p>
          </div>
        </div>
        <div className="row" style={{ gap: 24 }}>
          <div><p className="muted">Status</p><Badge tone={unit.status === 'VACANT' ? 'warning' : 'info'}>{status ?? 'Archived'}</Badge></div>
          <div><p className="muted">Listed at</p><strong style={{ fontSize: 20 }}>{formatMoney(listedRent)}</strong>{listedRent !== null && unit.squareFeet ? <p className="muted">${(listedRent / unit.squareFeet).toFixed(2)} / sqft</p> : null}</div>
          <UnitPicker
            unitId={unit.id}
            action="/rent-comps"
            units={units.map((candidate) => ({ id: candidate.id, label: `${unitLabel(candidate.property, candidate)}${candidate.status === 'VACANT' ? ' (vacant)' : ''}` }))}
          />
        </div>
      </div>
    </Card>
    <Card><FilterBar unitId={unit.id} filters={filters} action="/rent-comps" /></Card>
    {failure || !result ? <Alert tone="warning"><div><strong>Comps unavailable</strong><br />{failure} Check the rent comps provider in <Link href="/integrations">Integrations</Link>.</div></Alert> : <>
      <form action={refreshCompsAction} className="row" style={{ justifyContent: 'flex-end' }}>
        <input type="hidden" name="unitId" value={unit.id} />
        <button className="btn btn-ghost btn-sm">Refresh comps</button>
      </form>
      <CompsWorkbench
        key={`${unit.id}:${JSON.stringify(filters)}:${result.fetchedAt.getTime()}`}
        unitId={unit.id}
        unitLabel={label}
        rows={result.rows}
        radiusMiles={filters.radiusMiles}
        subjectSqft={unit.squareFeet}
        listedRent={listedRent}
        marketRent={marketRent}
        providerName={result.providerName}
        syncedAt={result.fetchedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'}
        cached={result.cached}
        appliedNote={appliedNote}
      />
    </>}
  </div>;
}
